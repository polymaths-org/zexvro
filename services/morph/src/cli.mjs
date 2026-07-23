import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { launchTui } from './tui.mjs'
import { banner, err, info, ok, warn } from './ui.mjs'
import { resolveProvider, configPath, loadConfig, PRESETS } from './config.mjs'

function printHelp() {
  console.log(`
${banner()}
  Morph — ZEXVRO transformation agent (self-contained)

  Install (once):
    curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash
    # or:  bash services/morph/install.sh

  Start:
    morph

  In Morph:
    /connect     Add OpenAI · Anthropic-compatible · custom endpoint + API key + model
    /providers   List providers
    /use <id>    Switch provider
    /model <id>  Set model
    /help        Commands
    /exit        Quit

  Other:
    morph run "prompt"    Headless one-shot
    morph doctor          Setup check
    morph install         Install to ~/.local/bin
    morph help
`)
}

function resolveWorkspace(argv) {
  const idx = argv.indexOf('--workspace')
  if (idx >= 0 && argv[idx + 1]) return resolve(argv[idx + 1])
  return resolve(process.cwd())
}

async function doctor(workspace) {
  console.log(banner())
  const p = resolveProvider()
  info(`workspace ${workspace}`)
  info(`config    ${configPath()}`)
  info(`provider  ${p.name}`)
  info(`model     ${p.model}`)
  info(`baseUrl   ${p.baseUrl}`)
  info(`apiKey    ${p.apiKey ? 'set' : 'missing — use /connect in morph'}`)
  if (existsSync(resolve(workspace, 'demos/arcade'))) ok('demos/arcade present')
  if (existsSync(resolve(workspace, 'client/index.tsx'))) ok('Lakebed capsule cwd')
  console.log('')
  info('Start: morph')
  info('Then:  /connect')
  console.log('')
}

async function install() {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const sh = join(dirname(fileURLToPath(import.meta.url)), '../install.sh')
  if (existsSync(sh)) {
    const r = spawnSync('bash', [sh], { stdio: 'inherit' })
    process.exitCode = r.status ?? 1
    return
  }
  const { mkdirSync, writeFileSync, chmodSync } = await import('node:fs')
  const { homedir } = await import('node:os')
  const morphMjs = join(dirname(fileURLToPath(import.meta.url)), '../bin/morph.mjs')
  const bin = join(homedir(), '.local', 'bin', 'morph')
  mkdirSync(join(homedir(), '.local', 'bin'), { recursive: true })
  writeFileSync(bin, `#!/usr/bin/env bash\nexec node "${morphMjs}" "$@"\n`, { mode: 0o755 })
  chmodSync(bin, 0o755)
  ok(`Installed ${bin}`)
  info('Run: morph')
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

  if (cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp()
    return
  }
  if (cmd === 'doctor') {
    await doctor(workspace)
    return
  }
  if (cmd === 'install') {
    await install()
    return
  }
  if (cmd === 'run') {
    const { runOnce } = await import('./agent.mjs')
    const prompt = cleaned.slice(1).join(' ').trim()
    if (!prompt) {
      err('Usage: morph run "prompt"')
      process.exitCode = 1
      return
    }
    console.log(banner())
    const p = resolveProvider()
    if (!p.apiKey) {
      err('No provider. Start morph and run /connect, or set MORPH_API_KEY / OPENAI_API_KEY')
      process.exitCode = 1
      return
    }
    await runOnce({ workspace, provider: p, prompt })
    return
  }

  // Default: Morph TUI (self-contained, Morph-branded)
  process.exitCode = await launchTui({ workspace })
}
