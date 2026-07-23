/**
 * Morph TUI = OpenCode engine with Morph branding + provider UX.
 * User only runs `morph`. OpenCode is the TUI host (slash commands, sessions, etc.).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, resolveProvider } from './config.mjs'
import { err, info, ok, warn } from './ui.mjs'

const MORPH_HOME = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function findOpenCode() {
  const pathEnv = process.env.PATH || ''
  for (const dir of pathEnv.split(':')) {
    const cand = join(dir, 'opencode')
    if (existsSync(cand)) return { cmd: cand, args: [] }
  }
  return { cmd: 'npx', args: ['--yes', 'opencode-ai@latest'] }
}

/** Morph branding + active provider (does not remove stock OpenCode providers). */
export function buildRuntimeConfig() {
  const provider = resolveProvider(loadConfig())
  const mcpEntry = join(MORPH_HOME, 'mcp/src/index.mjs')

  const cfg = {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'morph',
    theme: 'morph',
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

  if (provider.apiKey && provider.baseUrl) {
    const modelId = String(provider.model || 'default').replace(/[^a-zA-Z0-9._:/-]/g, '-')
    cfg.provider = {
      morph: {
        name: `Morph · ${provider.name}`,
        npm: '@ai-sdk/openai-compatible',
        options: {
          baseURL: provider.baseUrl,
          apiKey: provider.apiKey,
          timeout: 600_000,
        },
        models: {
          [modelId]: {
            name: provider.model || modelId,
            tool_call: true,
            limit: { context: 200_000, output: 16_384 },
            modalities: { input: ['text', 'image'], output: ['text'] },
          },
        },
      },
    }
    cfg.model = `morph/${modelId}`
  }

  return cfg
}

/** Install Morph agent + theme into ~/.config/opencode so TUI finds them in any cwd. */
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

  // Morph product instructions always available as global soft default
  const agentsSrc = join(MORPH_HOME, 'AGENTS.md')
  if (existsSync(agentsSrc)) {
    // do not overwrite user's personal AGENTS.md — write morph-specific companion
    writeFileSync(join(base, 'MORPH.md'), readFileSync(agentsSrc, 'utf8'))
  }
}

export function writeRuntimeConfigFile() {
  const dir = join(process.env.HOME || '/tmp', '.config', 'morph')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'opencode.runtime.json')
  writeFileSync(path, JSON.stringify(buildRuntimeConfig(), null, 2) + '\n', { mode: 0o600 })
  return path
}

/**
 * Launch Morph TUI in workspace (OpenCode with Morph agent, theme, MCP, provider).
 */
export function launchTui({ workspace, extraArgs = [] } = {}) {
  const cwd = resolve(workspace || process.cwd())
  ensureMorphOpenCodeAssets()
  const runtimeConfig = writeRuntimeConfigFile()
  const { cmd, args: baseArgs } = findOpenCode()
  const provider = resolveProvider()

  const env = {
    ...process.env,
    // Morph runtime config (theme, mcp, morph provider, default agent)
    OPENCODE_CONFIG: runtimeConfig,
    COLORTERM: process.env.COLORTERM || 'truecolor',
    MORPH_HOME: MORPH_HOME,
  }

  const args = [...baseArgs, cwd, '--agent', 'morph', ...extraArgs]

  info(`TUI workspace: ${cwd}`)
  info(`provider: ${provider.name} · ${provider.model}`)
  if (!provider.apiKey) {
    warn('No provider key yet — in TUI use /connect, or: morph providers set --preset openai --api-key …')
  }
  ok('Morph TUI — full slash commands (/theme /models /session …) · Morph branding')

  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: 'inherit',
    })
    child.on('error', (e) => {
      err(`Failed to start Morph TUI: ${e.message}`)
      err('Morph uses OpenCode as the TUI engine. Install once:')
      err('  curl -fsSL https://opencode.ai/install | bash')
      err('Or: npm i -g opencode-ai@latest')
      err('You only ever run `morph` after that — not `opencode`.')
      reject(e)
    })
    child.on('exit', (code) => resolvePromise(code ?? 0))
  })
}
