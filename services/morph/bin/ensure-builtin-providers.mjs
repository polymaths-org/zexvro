#!/usr/bin/env node
/**
 * Merge Morph built-in providers into ~/.config/morph/morph.jsonc
 * Idempotent: keeps user auth; refreshes baseURL/models for known built-ins.
 *
 * Usage: node ensure-builtin-providers.mjs
 * Env: MORPH_CONFIG_DIR, XDG_CONFIG_HOME
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CONFIG_DIR = process.env.MORPH_CONFIG_DIR
  || (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'morph')
    : join(homedir(), '.config', 'morph'))

const MORPH_HOME = process.env.MORPH_HOME
  || join(dirname(fileURLToPath(import.meta.url)), '..')

const cfgPathJsonc = join(CONFIG_DIR, 'morph.jsonc')
const cfgPathJson = join(CONFIG_DIR, 'morph.json')
const cfgPath = existsSync(cfgPathJsonc)
  ? cfgPathJsonc
  : existsSync(cfgPathJson)
    ? cfgPathJson
    : cfgPathJsonc

function loadBuiltin() {
  const p = join(MORPH_HOME, 'lib', 'builtin-providers.mjs')
  return import(pathToFileURL(p).href).then((m) => m.BUILTIN_PROVIDERS)
}

function loadJsonc(path) {
  if (!existsSync(path)) return null
  let text = readFileSync(path, 'utf8')
  text = text.replace(/\/\*[\s\S]*?\*\//g, '')
  text = text.replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(text)
}

async function main() {
  const builtins = await loadBuiltin()
  mkdirSync(CONFIG_DIR, { recursive: true })

  let cfg = loadJsonc(cfgPath)
  if (!cfg) {
    // Prefer seed if present
    const seed = join(MORPH_HOME, 'seed', 'morph.jsonc')
    cfg = loadJsonc(seed) || {
      $schema: 'https://opencode.ai/config.json',
      default_agent: 'morph',
    }
  }

  cfg.provider = cfg.provider || {}
  let changed = false
  for (const [id, def] of Object.entries(builtins)) {
    const prev = cfg.provider[id]
    // Always keep built-in baseURL + models current; preserve any extra keys user added.
    const next = {
      ...(prev && typeof prev === 'object' ? prev : {}),
      npm: def.npm,
      name: def.name,
      options: {
        ...(prev?.options && typeof prev.options === 'object' ? prev.options : {}),
        baseURL: def.options.baseURL,
      },
      models: {
        ...(prev?.models && typeof prev.models === 'object' ? prev.models : {}),
        ...def.models,
      },
    }
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      cfg.provider[id] = next
      changed = true
    } else {
      cfg.provider[id] = next
    }
    if (!cfg.model && def.defaultModel) {
      cfg.model = def.defaultModel
      changed = true
    }
  }

  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  if (process.env.MORPH_ENSURE_QUIET !== '1') {
    const ids = Object.keys(builtins).join(', ')
    console.log(`  ✓ built-in providers ready (${ids}) → ${cfgPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
