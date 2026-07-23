/**
 * Morph TUI host — OpenCode engine, Morph branding.
 * Providers: use in-TUI /connect (OpenCode-native). Morph does not replace that UX.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { err, info, ok, warn } from './ui.mjs'

export const MORPH_HOME = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function findOpenCode() {
  const pathEnv = [
    join(process.env.HOME || '', '.opencode', 'bin'),
    join(process.env.HOME || '', '.local', 'bin'),
    process.env.PATH || '',
  ].join(':')
  for (const dir of pathEnv.split(':')) {
    if (!dir) continue
    const cand = join(dir, 'opencode')
    if (existsSync(cand)) return { cmd: cand, args: [] }
  }
  return null
}

/** Ensure OpenCode exists (called from install; launch still checks). */
export function ensureOpenCodeInstalled() {
  if (findOpenCode()) return true
  info('Installing OpenCode TUI engine (one-time)…')
  const r = spawnSync('bash', ['-lc', 'curl -fsSL https://opencode.ai/install | bash'], {
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) {
    warn('curl install failed; trying npm -g opencode-ai')
    const n = spawnSync('npm', ['i', '-g', 'opencode-ai@latest'], { stdio: 'inherit' })
    if (n.status !== 0) return false
  }
  return Boolean(findOpenCode())
}

/** Morph branding + ZEXVRO MCP only — no forced custom provider (use TUI /connect). */
export function buildRuntimeConfig() {
  const mcpEntry = join(MORPH_HOME, 'mcp/src/index.mjs')
  return {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'morph',
    theme: 'morph',
    username: 'morph',
    autoupdate: false,
    tools: {
      bash: true,
      edit: true,
      read: true,
      grep: true,
      glob: true,
      webfetch: true,
    },
    permission: {
      bash: 'ask',
      edit: 'ask',
      read: 'allow',
      grep: 'allow',
      glob: 'allow',
      webfetch: 'allow',
      external_directory: 'ask',
    },
    mcp: {
      zexvro: {
        type: 'local',
        command: ['node', mcpEntry],
        enabled: true,
        environment: {
          ZEXVRO_API_URL: process.env.ZEXVRO_API_URL || '',
          ZEXVRO_GATE_URL: process.env.ZEXVRO_GATE_URL || '',
          ZEXVRO_NFT_URL: process.env.ZEXVRO_NFT_URL || '',
          ZEXVRO_DEPIN_URL: process.env.ZEXVRO_DEPIN_URL || '',
          ZEXVRO_ACCESS_TOKEN: process.env.ZEXVRO_ACCESS_TOKEN || '',
          ZEXVRO_GATE_ADMIN_KEY: process.env.ZEXVRO_GATE_ADMIN_KEY || '',
        },
      },
    },
  }
}

export function ensureMorphOpenCodeAssets() {
  const home = process.env.HOME
  if (!home) return
  const base = join(home, '.config', 'opencode')
  const agentDir = join(base, 'agent')
  const themeDir = join(base, 'themes')
  mkdirSync(agentDir, { recursive: true })
  mkdirSync(themeDir, { recursive: true })

  for (const name of ['morph.md', 'morph-ops.md']) {
    const src = join(MORPH_HOME, 'agent', name)
    if (existsSync(src)) writeFileSync(join(agentDir, name), readFileSync(src, 'utf8'))
  }
  const themeSrc = join(MORPH_HOME, 'themes', 'morph.json')
  if (existsSync(themeSrc)) {
    writeFileSync(join(themeDir, 'morph.json'), readFileSync(themeSrc, 'utf8'))
  }
}

export function writeRuntimeConfigFile() {
  const dir = join(process.env.HOME || '/tmp', '.config', 'morph')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'opencode.runtime.json')
  writeFileSync(path, JSON.stringify(buildRuntimeConfig(), null, 2) + '\n', { mode: 0o600 })
  return path
}

export function launchTui({ workspace, extraArgs = [] } = {}) {
  const cwd = resolve(workspace || process.cwd())

  let oc = findOpenCode()
  if (!oc) {
    warn('OpenCode engine missing — installing…')
    if (!ensureOpenCodeInstalled()) {
      err('Could not install OpenCode. Run: curl -fsSL https://opencode.ai/install | bash')
      return Promise.resolve(1)
    }
    oc = findOpenCode()
    if (!oc) {
      err('OpenCode still not on PATH. Open a new terminal, or: export PATH="$HOME/.opencode/bin:$PATH"')
      return Promise.resolve(1)
    }
  }

  ensureMorphOpenCodeAssets()
  const runtimeConfig = writeRuntimeConfigFile()

  const env = {
    ...process.env,
    PATH: `${join(process.env.HOME || '', '.opencode', 'bin')}:${join(process.env.HOME || '', '.local', 'bin')}:${process.env.PATH || ''}`,
    OPENCODE_CONFIG: runtimeConfig,
    COLORTERM: process.env.COLORTERM || 'truecolor',
    MORPH_HOME: MORPH_HOME,
  }

  const args = [...oc.args, cwd, '--agent', 'morph', ...extraArgs]

  info(`Morph · workspace ${cwd}`)
  info('In TUI: type /connect  (add OpenAI / Anthropic / custom OpenAI-compatible / API key / model)')
  ok('Starting Morph')

  return new Promise((resolvePromise) => {
    const child = spawn(oc.cmd, args, { cwd, env, stdio: 'inherit' })
    child.on('error', (e) => {
      err(e.message)
      resolvePromise(1)
    })
    child.on('exit', (code) => resolvePromise(code ?? 0))
  })
}
