import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MorphAgent, runOnce } from './agent.mjs'
import {
  PRESETS,
  configPath,
  loadConfig,
  resolveProvider,
  saveConfig,
  setProvider,
} from './config.mjs'
import { launchTui } from './tui.mjs'
import { assistantBlock, banner, err, info, ok, userPrompt, warn } from './ui.mjs'

function printHelp() {
  console.log(`
${banner()}
  Morph is a branded agent on the OpenCode TUI engine (full / commands),
  with a better provider setup UX. You only run: morph

  Usage:
    morph                     Morph TUI in current directory (default)
    morph tui                 Same as default
    morph chat                Simple REPL (no TUI) — fallback / scripts
    morph run "prompt"        Headless one-shot (no TUI)
    morph providers           List providers
    morph providers set ...   Easy custom / preset providers
    morph providers use <id>  Switch active provider
    morph install             Install morph → ~/.local/bin
    morph doctor              Setup check
    morph help

  Examples:
    cd demos/arcade && morph
    morph providers set --preset openai --api-key sk-... --model gpt-4.1
    morph providers set --preset custom --base-url https://my.api/v1 --api-key KEY --model m
    morph run "Analyze this game and plan ZEXVRO migration"

  In the TUI you get OpenCode features: /theme /models /session /share /undo …
  Morph agent is selected by default. Provider from: morph providers set

  Platform env (optional):
    ZEXVRO_GATE_URL, ZEXVRO_NFT_URL, ZEXVRO_DEPIN_URL,
    ZEXVRO_ACCESS_TOKEN, ZEXVRO_GATE_ADMIN_KEY
`)
}

function resolveWorkspace(argv) {
  const idx = argv.indexOf('--workspace')
  if (idx >= 0 && argv[idx + 1]) return resolve(argv[idx + 1])
  return resolve(process.cwd())
}

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) out[key] = true
      else {
        out[key] = next
        i++
      }
    }
  }
  return out
}

async function cmdProviders(args) {
  const sub = args[0]
  if (!sub || sub === 'list' || sub === 'ls') {
    const cfg = loadConfig()
    const active = resolveProvider(cfg)
    console.log('')
    info(`config:  ${configPath()}`)
    info(`active:  ${cfg.activeProvider} → ${active.name} · ${active.model}`)
    info(`base:    ${active.baseUrl}`)
    info(`apiKey:  ${active.apiKey ? 'set' : 'missing'}`)
    console.log('')
    console.log('  Presets (easy custom endpoints — all OpenAI-compatible tools API):')
    for (const [id, p] of Object.entries(PRESETS)) {
      const conf = cfg.providers[id]
      const mark = cfg.activeProvider === id ? '*' : ' '
      console.log(
        `  ${mark} ${id.padEnd(12)} ${p.name.padEnd(28)} ${conf?.apiKey ? 'key✓' : 'key·'}  ${p.baseUrl}`,
      )
    }
    console.log('')
    info('Stock OpenCode providers (Anthropic, Google, …) still work via TUI /connect')
    info('Morph presets feed the default Morph model in the TUI after: morph providers set')
    console.log('')
    return
  }

  if (sub === 'use') {
    const id = args[1]
    if (!id || (!PRESETS[id] && !loadConfig().providers[id])) {
      err(`Unknown provider. Try: ${Object.keys(PRESETS).join(', ')}`)
      process.exitCode = 1
      return
    }
    const cfg = loadConfig()
    if (!cfg.providers[id]) cfg.providers[id] = { ...PRESETS[id], apiKey: '' }
    cfg.activeProvider = id
    saveConfig(cfg)
    ok(`Active Morph provider → ${id}`)
    info('Restart morph TUI to use it as default model')
    return
  }

  if (sub === 'set') {
    const flags = parseFlags(args.slice(1))
    const preset = flags.preset || flags.id || 'custom'
    const id = PRESETS[preset] ? preset : 'custom'
    const base = PRESETS[id] || PRESETS.custom
    setProvider(id, {
      name: flags.name || base.name,
      baseUrl: flags['base-url'] || flags.baseUrl || base.baseUrl,
      apiKey: flags['api-key'] || flags.apiKey,
      model: flags.model || base.model,
    })
    ok(`Saved Morph provider "${id}"`)
    info(`base  ${flags['base-url'] || flags.baseUrl || base.baseUrl}`)
    info(`model ${flags.model || base.model}`)
    info(`key   ${flags['api-key'] || flags.apiKey ? 'set' : '(unchanged)'}`)
    info('Run `morph` — TUI will default to this provider/model')
    return
  }

  // Interactive add wizard
  if (sub === 'add') {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const q = (p) => new Promise((r) => rl.question(p, r))
    console.log('')
    ok('Add custom provider (OpenAI-compatible)')
    const name = (await q('  Name [Custom]: ')) || 'Custom'
    const baseUrl = (await q('  Base URL (…/v1): ')).trim()
    const apiKey = (await q('  API key: ')).trim()
    const model = (await q('  Model id: ')).trim() || 'default'
    rl.close()
    if (!baseUrl || !apiKey) {
      err('base URL and API key required')
      process.exitCode = 1
      return
    }
    const id = 'custom'
    setProvider(id, { name, baseUrl, apiKey, model })
    ok(`Saved as Morph provider "custom" · model ${model}`)
    info('Run: morph')
    return
  }

  err(`Unknown providers subcommand: ${sub}`)
  process.exitCode = 1
}

async function cmdDoctor(workspace) {
  console.log(banner())
  const cfg = loadConfig()
  const p = resolveProvider(cfg)
  info(`workspace ${workspace}`)
  info(`config    ${configPath()}`)
  info(`provider  ${p.name} (${p.id})`)
  info(`model     ${p.model}`)
  info(`baseUrl   ${p.baseUrl}`)
  info(`apiKey    ${p.apiKey ? 'set' : 'MISSING — morph providers set / morph providers add'}`)
  if (existsSync(resolve(workspace, 'demos/arcade'))) ok('Found demos/arcade (Neon Run)')
  else if (existsSync(resolve(workspace, 'client/index.tsx'))) ok('Looks like a Lakebed capsule')
  else warn('No demos/arcade here — Morph still works on any repo')
  const { findOpenCodeHint } = { findOpenCodeHint: () => null }
  void findOpenCodeHint
  // check opencode
  try {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync('opencode', ['--version'], { encoding: 'utf8' })
    if (r.status === 0) ok(`OpenCode TUI engine: ${String(r.stdout || r.stderr).trim()}`)
    else warn('OpenCode not found — TUI needs: curl -fsSL https://opencode.ai/install | bash')
  } catch {
    warn('OpenCode not found — TUI needs OpenCode install (Morph still launches via npx fallback)')
  }
  console.log('')
}

async function cmdInstall() {
  const { mkdirSync, writeFileSync, chmodSync } = await import('node:fs')
  const { homedir } = await import('node:os')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const here = dirname(fileURLToPath(import.meta.url))
  const morphBin = resolve(here, '../bin/morph.mjs')
  const destDir = join(homedir(), '.local', 'bin')
  const dest = join(destDir, 'morph')
  mkdirSync(destDir, { recursive: true })
  writeFileSync(dest, `#!/usr/bin/env bash\nexec node "${morphBin}" "$@"\n`, { mode: 0o755 })
  chmodSync(dest, 0o755)
  ok(`Installed ${dest}`)
  info('Ensure ~/.local/bin is on your PATH → then just: morph')
}

async function interactiveRepl(workspace) {
  console.log(banner())
  const provider = resolveProvider()
  if (!provider.apiKey) {
    warn('No API key. morph providers set --preset openai --api-key …')
  }
  info(`workspace ${workspace}`)
  info(`provider  ${provider.name} · ${provider.model}`)
  info('REPL mode (no full TUI). Prefer: morph   for OpenCode-style TUI')
  console.log('')

  const agent = new MorphAgent({ workspace, provider })
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = () => new Promise((r) => rl.question(userPrompt(), r))

  while (true) {
    const line = (await ask()).trim()
    if (!line) continue
    if (line === '/exit' || line === 'exit' || line === '/quit') break
    if (line === '/help') {
      console.log('  /exit  /clear  /doctor  (for full /theme /models use: morph)')
      continue
    }
    if (line === '/doctor') {
      await cmdDoctor(workspace)
      continue
    }
    if (line === '/clear') {
      agent.messages = [
        {
          role: 'system',
          content: (await import('./prompts.mjs')).systemPrompt({ workspace }),
        },
      ]
      ok('Session cleared')
      continue
    }
    try {
      assistantBlock(await agent.chat(line))
    } catch (e) {
      err(e instanceof Error ? e.message : String(e))
    }
  }
  rl.close()
}

export async function main(argv = process.argv.slice(2)) {
  const workspace = resolveWorkspace(argv)
  const cleaned = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace') {
      i++
      continue
    }
    cleaned.push(argv[i])
  }

  const cmd = cleaned[0]

  // Default → full Morph TUI
  if (!cmd || cmd === 'tui' || cmd === 'ui') {
    const extra = cmd ? cleaned.slice(1) : cleaned
    const code = await launchTui({ workspace, extraArgs: extra })
    process.exitCode = code
    return
  }

  if (cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp()
    return
  }

  if (cmd === 'chat' || cmd === 'repl') {
    await interactiveRepl(workspace)
    return
  }

  if (cmd === 'providers' || cmd === 'provider') {
    await cmdProviders(cleaned.slice(1))
    return
  }

  if (cmd === 'doctor') {
    await cmdDoctor(workspace)
    return
  }

  if (cmd === 'install') {
    await cmdInstall()
    return
  }

  if (cmd === 'run') {
    const prompt = cleaned.slice(1).join(' ').trim()
    if (!prompt) {
      err('Usage: morph run "your prompt"')
      process.exitCode = 1
      return
    }
    console.log(banner())
    await runOnce({ workspace, provider: resolveProvider(), prompt })
    return
  }

  err(`Unknown command: ${cmd}`)
  printHelp()
  process.exitCode = 1
}
