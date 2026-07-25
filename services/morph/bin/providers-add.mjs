#!/usr/bin/env node
/**
 * Morph: add / connect an LLM provider (built-in presets or custom OpenAI-compatible).
 * Writes:
 *   ~/.local/share/morph/auth.json
 *   ~/.config/morph/morph.jsonc  (provider block)
 *
 * Usage:
 *   morph providers add              # interactive
 *   morph providers add codexin      # built-in CodexIn (prompts for API key only)
 *   morph providers add --list
 */
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MORPH_HOME = process.env.MORPH_HOME || join(__dirname, '..')

const CONFIG_DIR = process.env.MORPH_CONFIG_DIR
  || (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'morph')
    : join(homedir(), '.config', 'morph'))
const DATA_DIR = process.env.XDG_DATA_HOME
  ? join(process.env.XDG_DATA_HOME, 'morph')
  : join(homedir(), '.local', 'share', 'morph')
const AUTH_PATH = join(DATA_DIR, 'auth.json')
const MORPH_JSONC = join(CONFIG_DIR, 'morph.jsonc')
const MORPH_JSON = join(CONFIG_DIR, 'morph.json')

async function loadBuiltins() {
  const p = join(MORPH_HOME, 'lib', 'builtin-providers.mjs')
  const m = await import(pathToFileURL(p).href)
  return m.BUILTIN_PROVIDERS || {}
}

function ask(rl, q) {
  return new Promise((r) => rl.question(q, r))
}

function loadJson(path) {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

function loadJsonc(path) {
  if (!existsSync(path)) return {}
  let text = readFileSync(path, 'utf8')
  text = text.replace(/\/\*[\s\S]*?\*\//g, '')
  text = text.replace(/^\s*\/\/.*$/gm, '')
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error(`Could not parse ${path}:`, e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

function writeJsonc(path, obj) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function writeAuth(providerId, apiKey) {
  mkdirSync(DATA_DIR, { recursive: true })
  const auth = loadJson(AUTH_PATH)
  auth[providerId] = { type: 'api', key: apiKey }
  writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2) + '\n', { mode: 0o600 })
}

function saveProvider(providerId, name, baseURL, modelId, modelName, setDefault) {
  const cfgPath = existsSync(MORPH_JSONC)
    ? MORPH_JSONC
    : existsSync(MORPH_JSON)
      ? MORPH_JSON
      : MORPH_JSONC
  const cfg = loadJsonc(cfgPath)
  cfg.provider = cfg.provider || {}
  cfg.provider[providerId] = {
    ...(cfg.provider[providerId] || {}),
    npm: '@ai-sdk/openai-compatible',
    name,
    options: { baseURL },
    models: {
      ...((cfg.provider[providerId] && cfg.provider[providerId].models) || {}),
      [modelId]: { name: modelName },
    },
  }
  if (setDefault || !cfg.model) {
    cfg.model = `${providerId}/${modelId}`
  }
  writeJsonc(cfgPath, cfg)
  return cfgPath
}

async function addPreset(rl, providerId, def, apiKeyArg) {
  console.log('')
  console.log(`  Morph · connect built-in provider: ${def.name}`)
  console.log('  ────────────────────────────────────────────')
  console.log(`  id        ${providerId}`)
  console.log(`  base URL  ${def.options.baseURL}`)
  const modelId = Object.keys(def.models)[0]
  const modelName = def.models[modelId]?.name || modelId
  console.log(`  model     ${providerId}/${modelId} (${modelName})`)
  console.log('')

  let apiKey = apiKeyArg || ''
  if (!apiKey) {
    apiKey = (await ask(rl, '  API key: ')).trim()
  }
  if (!apiKey) {
    console.error('  ✗ API key required')
    process.exit(1)
  }

  writeAuth(providerId, apiKey)
  const cfgPath = saveProvider(
    providerId,
    def.name,
    def.options.baseURL,
    modelId,
    modelName,
    true,
  )

  console.log('')
  console.log(`  ✓ Auth  → ${AUTH_PATH}`)
  console.log(`  ✓ Config → ${cfgPath}`)
  console.log(`  ✓ Provider ${providerId} · model ${providerId}/${modelId}`)
  console.log('')
  console.log('  Restart Morph → /models → pick CodexIn / Grok 4.5')
  console.log('  Or in TUI: /connect → CodexIn (Popular) if you only need to re-enter the key.')
  console.log('')
}

async function addCustom(rl) {
  console.log('')
  console.log('  Morph · add custom OpenAI-compatible provider')
  console.log('  ────────────────────────────────────────────')
  console.log('')

  const idRaw = (await ask(rl, '  Provider id (a-z0-9-_) [custom]: ')).trim() || 'custom'
  const providerId = idRaw.replace(/^@ai-sdk\//, '').toLowerCase()
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(providerId)) {
    console.error('  ✗ Invalid id. Use lowercase letters, numbers, hyphens, underscores.')
    process.exit(1)
  }

  const name =
    (await ask(rl, `  Display name [${providerId}]: `)).trim() || providerId
  let baseURL = (
    await ask(rl, '  Base URL (must end with /v1) [https://api.openai.com/v1]: ')
  ).trim() || 'https://api.openai.com/v1'
  baseURL = baseURL.replace(/\/$/, '')
  if (!/^https?:\/\//.test(baseURL)) {
    console.error('  ✗ Base URL must start with http:// or https://')
    process.exit(1)
  }
  if (!baseURL.endsWith('/v1')) {
    console.log('  ! Tip: most OpenAI-compatible APIs want …/v1')
  }

  const modelId =
    (await ask(rl, '  Model id [gpt-4o]: ')).trim() || 'gpt-4o'
  const modelName =
    (await ask(rl, `  Model display name [${modelId}]: `)).trim() || modelId

  const apiKey = (await ask(rl, '  API key: ')).trim()
  if (!apiKey) {
    console.error('  ✗ API key required')
    process.exit(1)
  }

  writeAuth(providerId, apiKey)
  const cfgPath = saveProvider(providerId, name, baseURL, modelId, modelName, false)

  console.log('')
  console.log(`  ✓ Auth  → ${AUTH_PATH}`)
  console.log(`  ✓ Config → ${cfgPath}`)
  console.log(`  ✓ Provider ${providerId} · model ${providerId}/${modelId}`)
  console.log('')
  console.log('  Restart Morph, then /models and pick your model.')
  console.log('')
}

async function main() {
  const builtins = await loadBuiltins()
  const args = process.argv.slice(2).filter((a) => a !== 'add')
  const list = args.includes('--list') || args.includes('-l')
  const rest = args.filter((a) => !a.startsWith('-'))
  const presetArg = rest[0]?.toLowerCase()
  const apiKeyFlagIdx = args.findIndex((a) => a === '--api-key' || a === '-k')
  const apiKeyArg = apiKeyFlagIdx >= 0 ? args[apiKeyFlagIdx + 1] : undefined

  if (list) {
    console.log('')
    console.log('  Built-in providers')
    console.log('  ──────────────────')
    for (const [id, def] of Object.entries(builtins)) {
      const modelId = Object.keys(def.models)[0]
      console.log(`  ${id.padEnd(12)} ${def.name}  ${def.options.baseURL}  model=${id}/${modelId}`)
    }
    console.log('')
    console.log('  morph providers add codexin')
    console.log('  morph providers add          # interactive (preset or custom)')
    console.log('')
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    if (presetArg && builtins[presetArg]) {
      await addPreset(rl, presetArg, builtins[presetArg], apiKeyArg)
      return
    }
    if (presetArg && presetArg !== 'custom') {
      console.error(`  ✗ Unknown built-in provider "${presetArg}". Try: morph providers add --list`)
      process.exit(1)
    }

    // Interactive menu
    console.log('')
    console.log('  Morph · LLM providers')
    console.log('  ─────────────────────')
    const ids = Object.keys(builtins)
    ids.forEach((id, i) => {
      const d = builtins[id]
      console.log(`  ${i + 1}) ${d.name} (${id})  — built-in · ${d.options.baseURL}`)
    })
    console.log(`  ${ids.length + 1}) Custom OpenAI-compatible endpoint`)
    console.log('')
    const choice = (await ask(rl, `  Choice [1-${ids.length + 1}]: `)).trim() || '1'
    const n = Number(choice)
    if (n >= 1 && n <= ids.length) {
      const id = ids[n - 1]
      await addPreset(rl, id, builtins[id], apiKeyArg)
    } else {
      await addCustom(rl)
    }
  } finally {
    rl.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
