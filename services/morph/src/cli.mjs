import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { launchTui, ensureMorphOpenCodeAssets, ensureOpenCodeInstalled } from './tui.mjs'
import { banner, err, info, ok, warn } from './ui.mjs'

function printHelp() {
  console.log(`
${banner()}
  One install. One command. Full TUI.

  Install (once):
    curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash
    # or from a zexvro checkout:
    bash services/morph/install.sh

  Start:
    morph

  In the TUI (same as OpenCode provider flow):
    /connect     add OpenAI, Anthropic, Google, custom OpenAI-compatible endpoint,
                 API key, and model — then pick it and chat
    /models      switch models
    /theme       Morph theme is default (try /theme morph)
    /session     sessions
    /help        all slash commands

  Workspace = current directory (run inside demos/arcade or monorepo root).

  Other:
    morph run "prompt"     headless one-shot (no TUI)
    morph doctor           check install
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
  info(`workspace ${workspace}`)
  try {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync('opencode', ['--version'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.opencode/bin:${process.env.HOME}/.local/bin:${process.env.PATH}`,
      },
    })
    if (r.status === 0) ok(`OpenCode engine ${String(r.stdout || r.stderr).trim()}`)
    else warn('OpenCode not found — run: bash services/morph/install.sh')
  } catch {
    warn('OpenCode not found')
  }
  if (existsSync(resolve(workspace, 'demos/arcade'))) ok('demos/arcade present')
  if (existsSync(resolve(workspace, 'client/index.tsx'))) ok('Lakebed capsule cwd')
  ok('Providers: use /connect inside Morph TUI (OpenAI / Anthropic / custom endpoint + key + model)')
  console.log('')
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

  if (cmd === 'setup-assets') {
    ensureMorphOpenCodeAssets()
    return
  }

  if (cmd === 'doctor') {
    await doctor(workspace)
    return
  }

  if (cmd === 'install') {
    // Delegate to install.sh when available
    const { spawnSync } = await import('node:child_process')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const sh = join(dirname(fileURLToPath(import.meta.url)), '../install.sh')
    if (existsSync(sh)) {
      const r = spawnSync('bash', [sh], { stdio: 'inherit' })
      process.exitCode = r.status ?? 1
      return
    }
    ensureOpenCodeInstalled()
    ensureMorphOpenCodeAssets()
    const { mkdirSync, writeFileSync, chmodSync } = await import('node:fs')
    const { homedir } = await import('node:os')
    const bin = join(homedir(), '.local', 'bin', 'morph')
    const morphMjs = join(dirname(fileURLToPath(import.meta.url)), '../bin/morph.mjs')
    mkdirSync(join(homedir(), '.local', 'bin'), { recursive: true })
    writeFileSync(
      bin,
      `#!/usr/bin/env bash\nexport PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"\nexec node "${morphMjs}" "$@"\n`,
      { mode: 0o755 },
    )
    chmodSync(bin, 0o755)
    ok(`Installed ${bin}`)
    info('Run: morph')
    return
  }

  if (cmd === 'run') {
    // Headless fallback — self-contained agent
    const { runOnce } = await import('./agent.mjs')
    const { resolveProvider } = await import('./config.mjs')
    const prompt = cleaned.slice(1).join(' ').trim()
    if (!prompt) {
      err('Usage: morph run "prompt"')
      process.exitCode = 1
      return
    }
    console.log(banner())
    // Prefer env / OPENAI_API_KEY for headless
    const p = resolveProvider()
    if (!p.apiKey) {
      err('Set OPENAI_API_KEY or MORPH_API_KEY for headless run, or use: morph  (TUI /connect)')
      process.exitCode = 1
      return
    }
    await runOnce({ workspace, provider: p, prompt })
    return
  }

  // Default: full Morph TUI
  const code = await launchTui({
    workspace,
    extraArgs: cmd && cmd !== 'tui' ? cleaned : cleaned.slice(cmd === 'tui' ? 1 : 0),
  })
  process.exitCode = code
}
