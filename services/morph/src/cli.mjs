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
import { assistantBlock, banner, err, info, ok, userPrompt, warn } from './ui.mjs'

function printHelp() {
  console.log(`
${banner()}
  Usage:
    morph                     Interactive chat in current directory
    morph run "prompt"        One-shot message
    morph providers           List provider presets + config
    morph providers set ...   Configure provider
    morph providers use <id>  Switch active provider
    morph install             Install morph onto ~/.local/bin
    morph doctor              Show config / workspace / API readiness
    morph help

  Examples:
    cd demos/arcade && morph
    morph run "Analyze this game and plan a ZEXVRO Web3 migration"
    morph providers set --preset openai --api-key sk-... --model gpt-4.1
    morph providers set --preset custom --base-url https://my.api/v1 --api-key ... --model my-model

  Env overrides (optional):
    MORPH_BASE_URL / ZEXVRO_LLM_BASE_URL
    MORPH_API_KEY  / ZEXVRO_LLM_API_KEY / OPENAI_API_KEY
    MORPH_MODEL    / ZEXVRO_LLM_MODEL
    ZEXVRO_GATE_URL, ZEXVRO_NFT_URL, ZEXVRO_DEPIN_URL, ZEXVRO_ACCESS_TOKEN, ZEXVRO_GATE_ADMIN_KEY
`)
}

function resolveWorkspace(argv) {
  const idx = argv.indexOf('--workspace')
  if (idx >= 0 && argv[idx + 1]) return resolve(argv[idx + 1])
  // If launched from monorepo root and arcade exists, prefer monorepo root so Morph sees demos/arcade
  return resolve(process.cwd())
}

async function cmdProviders(args) {
  const sub = args[0]
  if (!sub || sub === 'list' || sub === 'ls') {
    const cfg = loadConfig()
    const active = resolveProvider(cfg)
    console.log('')
    info(`config file: ${configPath()}`)
    info(`active: ${cfg.activeProvider} → ${active.name} · ${active.model}`)
    info(`base:   ${active.baseUrl}`)
    info(`apiKey: ${active.apiKey ? 'set' : 'missing'}`)
    console.log('')
    console.log('  Presets (OpenAI-compatible tools API):')
    for (const [id, p] of Object.entries(PRESETS)) {
      const conf = cfg.providers[id]
      const mark = cfg.activeProvider === id ? '*' : ' '
      console.log(
        `  ${mark} ${id.padEnd(12)} ${p.name.padEnd(28)} ${conf?.apiKey ? 'key✓' : 'key·'}  ${p.baseUrl}`,
      )
    }
    console.log('')
    return
  }

  if (sub === 'use') {
    const id = args[1]
    if (!id || !PRESETS[id] && !loadConfig().providers[id]) {
      err(`Unknown provider id. Try: ${Object.keys(PRESETS).join(', ')}`)
      process.exitCode = 1
      return
    }
    const cfg = loadConfig()
    if (!cfg.providers[id]) {
      cfg.providers[id] = { ...PRESETS[id], apiKey: '' }
    }
    cfg.activeProvider = id
    saveConfig(cfg)
    ok(`Active provider → ${id}`)
    return
  }

  if (sub === 'set') {
    const flags = parseFlags(args.slice(1))
    const preset = flags.preset || flags.id || 'custom'
    if (!PRESETS[preset] && preset !== 'custom') {
      warn(`Unknown preset ${preset}, using custom`)
    }
    const id = preset
    const base = PRESETS[id] || PRESETS.custom
    setProvider(id, {
      name: flags.name || base.name,
      baseUrl: flags['base-url'] || flags.baseUrl || base.baseUrl,
      apiKey: flags['api-key'] || flags.apiKey,
      model: flags.model || base.model,
    })
    ok(`Saved provider ${id}`)
    info(`base  ${flags['base-url'] || flags.baseUrl || base.baseUrl}`)
    info(`model ${flags.model || base.model}`)
    info(`key   ${(flags['api-key'] || flags.apiKey) ? 'set' : '(unchanged/empty)'}`)
    return
  }

  err(`Unknown providers subcommand: ${sub}`)
  process.exitCode = 1
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

async function cmdDoctor(workspace) {
  console.log(banner())
  const cfg = loadConfig()
  const p = resolveProvider(cfg)
  info(`workspace ${workspace}`)
  info(`config    ${configPath()}`)
  info(`provider  ${p.name} (${p.id})`)
  info(`model     ${p.model}`)
  info(`baseUrl   ${p.baseUrl}`)
  info(`apiKey    ${p.apiKey ? 'set' : 'MISSING — morph providers set --preset openai --api-key …'}`)
  if (existsSync(resolve(workspace, 'demos/arcade'))) {
    ok('Found demos/arcade (Neon Run) in workspace')
  } else if (existsSync(resolve(workspace, 'client/index.tsx')) && existsSync(resolve(workspace, 'server/index.ts'))) {
    ok('Looks like a Lakebed capsule directory')
  } else {
    warn('No demos/arcade here — Morph will still work on any repo')
  }
  info(`Gate admin key  ${process.env.ZEXVRO_GATE_ADMIN_KEY || process.env.GATE_ADMIN_API_KEY ? 'set' : 'optional'}`)
  info(`Access token    ${process.env.ZEXVRO_ACCESS_TOKEN ? 'set' : 'optional'}`)
  console.log('')
}

async function cmdInstall() {
  const { mkdirSync, writeFileSync, chmodSync, symlinkSync, unlinkSync, existsSync: ex } = await import(
    'node:fs'
  )
  const { homedir } = await import('node:os')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const here = dirname(fileURLToPath(import.meta.url))
  const morphBin = resolve(here, '../bin/morph.mjs')
  const destDir = join(homedir(), '.local', 'bin')
  const dest = join(destDir, 'morph')
  mkdirSync(destDir, { recursive: true })
  const wrapper = `#!/usr/bin/env bash\nexec node "${morphBin}" "$@"\n`
  writeFileSync(dest, wrapper, { mode: 0o755 })
  chmodSync(dest, 0o755)
  ok(`Installed ${dest}`)
  info('Ensure ~/.local/bin is on your PATH')
  info('Then run: morph')
}

async function interactive(workspace) {
  console.log(banner())
  const provider = resolveProvider()
  if (!provider.apiKey) {
    warn('No API key configured yet.')
    info('Run: morph providers set --preset openai --api-key sk-... --model gpt-4.1')
    info('Or:  export OPENAI_API_KEY=... / MORPH_API_KEY=...')
    console.log('')
  }
  info(`workspace ${workspace}`)
  info(`provider  ${provider.name} · ${provider.model}`)
  if (existsSync(resolve(workspace, 'demos/arcade'))) {
    ok('Neon Run demo available at demos/arcade')
  }
  console.log('')
  info('Tell Morph to analyze, strategize, then implement. /exit to quit. /help for commands.')
  console.log('')

  const agent = new MorphAgent({ workspace, provider })
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = () =>
    new Promise((resolveAsk) => {
      rl.question(userPrompt(), resolveAsk)
    })

  while (true) {
    const line = (await ask()).trim()
    if (!line) continue
    if (line === '/exit' || line === '/quit' || line === 'exit') break
    if (line === '/help') {
      console.log(
        '  /exit  quit\n  /clear clear history (restarts agent)\n  /doctor show setup\n  otherwise chat with Morph',
      )
      continue
    }
    if (line === '/doctor') {
      await cmdDoctor(workspace)
      continue
    }
    if (line === '/clear') {
      // restart session state
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
      const text = await agent.chat(line)
      assistantBlock(text)
    } catch (e) {
      err(e instanceof Error ? e.message : String(e))
    }
  }
  rl.close()
  console.log(cDim('  bye'))
}

function cDim(s) {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s
}

export async function main(argv = process.argv.slice(2)) {
  const workspace = resolveWorkspace(argv)
  // strip --workspace from argv for subcommands
  const cleaned = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workspace') {
      i++
      continue
    }
    cleaned.push(argv[i])
  }

  const cmd = cleaned[0]

  if (!cmd) {
    await interactive(workspace)
    return
  }

  if (cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp()
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

  // bare "morph chat" alias
  if (cmd === 'chat') {
    await interactive(workspace)
    return
  }

  // treat unknown first word as start of run prompt? No — show help
  err(`Unknown command: ${cmd}`)
  printHelp()
  process.exitCode = 1
}
