/**
 * Morph TUI — fully self-contained. No third-party agent harness branding.
 */
import { createInterface } from 'node:readline'
import { MorphAgent } from './agent.mjs'
import {
  PRESETS,
  configPath,
  loadConfig,
  resolveProvider,
  saveConfig,
  setProvider,
} from './config.mjs'
import { systemPrompt } from './prompts.mjs'
import { c, err, ok, warn } from './ui.mjs'

const ALT_ON = '\x1b[?1049h\x1b[?25h'
const ALT_OFF = '\x1b[?1049l'
const CLEAR = '\x1b[2J\x1b[H'
const HIDE = '\x1b[?25l'
const SHOW = '\x1b[?25h'

function morphLogo() {
  return [
    c.cyan('  ███╗   ███╗ ██████╗ ██████╗ ██████╗ ██╗  ██╗'),
    c.cyan('  ████╗ ████║██╔═══██╗██╔══██╗██╔══██╗██║  ██║'),
    c.cyan('  ██╔████╔██║██║   ██║██████╔╝██████╔╝███████║'),
    c.cyan('  ██║╚██╔╝██║██║   ██║██╔══██╗██╔═══╝ ██╔══██║'),
    c.cyan('  ██║ ╚═╝ ██║╚██████╔╝██║  ██║██║     ██║  ██║'),
    c.cyan('  ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝'),
  ].join('\n')
}

function statusLine(workspace, provider) {
  const shortWs = workspace.length > 48 ? '…' + workspace.slice(-47) : workspace
  const key = provider.apiKey ? c.green('ready') : c.yellow('no key')
  return (
    c.dim('  ') +
    c.bold(c.cyan('Morph')) +
    c.dim('  ·  ') +
    c.white(provider.name) +
    c.dim(' / ') +
    c.white(provider.model) +
    c.dim('  ·  ') +
    key +
    c.dim('  ·  ') +
    c.dim(shortWs)
  )
}

function helpText() {
  return [
    c.bold('  Commands'),
    c.dim('  ─────────────────────────────────────────────'),
    `  ${c.cyan('/connect')}     Add provider (OpenAI / Anthropic-compatible / custom endpoint + key + model)`,
    `  ${c.cyan('/providers')}   List saved providers`,
    `  ${c.cyan('/use')} <id>    Switch active provider`,
    `  ${c.cyan('/model')} <id>  Set model name for active provider`,
    `  ${c.cyan('/clear')}       Clear conversation`,
    `  ${c.cyan('/doctor')}      Workspace + provider status`,
    `  ${c.cyan('/help')}        This help`,
    `  ${c.cyan('/exit')}        Quit Morph`,
    '',
    c.dim('  Or just type — Morph will analyze, plan, and implement with tools.'),
    '',
  ].join('\n')
}

function paintHeader(workspace, provider) {
  process.stdout.write(CLEAR)
  console.log('')
  console.log(morphLogo())
  console.log('')
  console.log(c.bold('  ZEXVRO transformation agent') + c.dim('  ·  Web2 → Web3'))
  console.log(statusLine(workspace, provider))
  console.log(c.dim('  ──────────────────────────────────────────────────────────'))
  console.log(c.dim('  /connect  /providers  /model  /clear  /help  /exit'))
  console.log(c.dim('  tab-style tips: describe a task, Morph uses tools to implement'))
  console.log('')
}

function printMsg(role, text) {
  if (role === 'user') {
    console.log(c.bold(c.white('  you')))
  } else if (role === 'system') {
    console.log(c.dim('  morph · system'))
  } else {
    console.log(c.bold(c.cyan('  morph')))
  }
  for (const line of String(text).split('\n')) {
    console.log('  ' + line)
  }
  console.log('')
}

async function connectWizard(rl) {
  const ask = (q) => new Promise((r) => rl.question(q, r))
  console.log('')
  console.log(c.bold(c.cyan('  /connect  ·  add a provider')))
  console.log(c.dim('  ─────────────────────────────────────────────'))
  console.log('  1) OpenAI')
  console.log('  2) Anthropic-compatible (OpenAI-compatible gateway to Claude)')
  console.log('  3) OpenAI-compatible custom endpoint')
  console.log('  4) xAI / Grok')
  console.log('  5) OpenRouter')
  console.log('  6) Groq')
  console.log('  7) DeepSeek')
  console.log('')
  const choice = (await ask(c.dim('  Type 1-7: '))).trim()

  const map = {
    1: 'openai',
    2: 'custom', // anthropic via compatible proxy
    3: 'custom',
    4: 'xai',
    5: 'openrouter',
    6: 'groq',
    7: 'deepseek',
  }
  const id = map[choice] || 'custom'
  const preset = PRESETS[id] || PRESETS.custom

  let name = preset.name
  let baseUrl = preset.baseUrl
  let model = preset.model

  if (choice === '2') {
    name = 'Anthropic-compatible'
    baseUrl = (await ask(c.dim('  Base URL (OpenAI-compatible proxy for Anthropic) [https://api.anthropic.com/v1]: '))).trim() ||
      'https://api.anthropic.com/v1'
    model = (await ask(c.dim('  Model [claude-sonnet-4-5]: '))).trim() || 'claude-sonnet-4-5'
  } else if (choice === '3' || id === 'custom') {
    name = (await ask(c.dim('  Display name [Custom]: '))).trim() || 'Custom'
    baseUrl = (await ask(c.dim('  Base URL (must end with /v1): '))).trim()
    if (!baseUrl) {
      err('  Base URL required')
      return null
    }
    model = (await ask(c.dim('  Model id: '))).trim() || 'default'
  } else {
    const bu = (await ask(c.dim(`  Base URL [${baseUrl}]: `))).trim()
    if (bu) baseUrl = bu
    const mo = (await ask(c.dim(`  Model [${model}]: `))).trim()
    if (mo) model = mo
  }

  const apiKey = (await ask(c.dim('  API key: '))).trim()
  if (!apiKey) {
    err('  API key required')
    return null
  }

  const saveId = choice === '2' ? 'anthropic' : id
  if (saveId === 'anthropic') {
    // store under custom key anthropic
    const cfg = loadConfig()
    cfg.providers.anthropic = { name, baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model }
    cfg.activeProvider = 'anthropic'
    saveConfig(cfg)
  } else {
    setProvider(saveId === 'custom' ? 'custom' : saveId, {
      name,
      baseUrl,
      apiKey,
      model,
    })
  }

  ok(`  Saved · ${name} · ${model}`)
  infoLine(`  Config: ${configPath()}`)
  console.log('')
  return resolveProvider()
}

function infoLine(s) {
  console.log(c.dim(s))
}

/**
 * Full Morph interactive session (branded TUI).
 */
export async function launchTui({ workspace } = {}) {
  const ws = resolve(workspace || process.cwd())
  let provider = resolveProvider()

  // Stay on normal screen with clean branded chrome (reliable across terminals)
  process.stdout.write(SHOW)
  paintHeader(ws, provider)

  if (!provider.apiKey) {
    warn('  No provider yet. Run /connect to add OpenAI, Anthropic-compatible, or custom endpoint.')
    console.log('')
  } else {
    printMsg(
      'system',
      `Ready. Workspace: ${ws}\nTell me to analyze, strategize, then implement a Web2→Web3 migration.`,
    )
  }

  let agent = new MorphAgent({ workspace: ws, provider })
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  const ask = () =>
    new Promise((r) => {
      rl.question(c.bold(c.white('  you')) + c.dim(' › '), r)
    })

  const rebuildAgent = () => {
    provider = resolveProvider()
    agent = new MorphAgent({ workspace: ws, provider })
  }

  try {
    while (true) {
      const raw = await ask()
      const line = raw.trim()
      if (!line) continue

      if (line === '/exit' || line === '/quit' || line === 'exit') break

      if (line === '/help' || line === '/?') {
        console.log(helpText())
        continue
      }

      if (line === '/clear') {
        rebuildAgent()
        paintHeader(ws, provider)
        ok('  Conversation cleared')
        console.log('')
        continue
      }

      if (line === '/doctor') {
        provider = resolveProvider()
        console.log('')
        infoLine(`  workspace  ${ws}`)
        infoLine(`  provider   ${provider.name}`)
        infoLine(`  model      ${provider.model}`)
        infoLine(`  baseUrl    ${provider.baseUrl}`)
        infoLine(`  apiKey     ${provider.apiKey ? 'set' : 'missing'}`)
        infoLine(`  config     ${configPath()}`)
        console.log('')
        continue
      }

      if (line === '/providers' || line === '/provider') {
        const cfg = loadConfig()
        console.log('')
        console.log(c.bold('  Saved providers'))
        for (const [id, p] of Object.entries(cfg.providers || {})) {
          const mark = cfg.activeProvider === id ? c.cyan('*') : ' '
          console.log(
            `  ${mark} ${id.padEnd(12)} ${(p.name || id).padEnd(22)} ${p.model || ''}  ${p.apiKey ? c.green('key') : c.dim('no key')}`,
          )
        }
        for (const [id, p] of Object.entries(PRESETS)) {
          if (cfg.providers?.[id]) continue
          console.log(c.dim(`    ${id.padEnd(12)} ${p.name} (preset)`))
        }
        console.log('')
        infoLine('  /connect to add · /use <id> to switch')
        console.log('')
        continue
      }

      if (line.startsWith('/use ')) {
        const id = line.slice(5).trim()
        const cfg = loadConfig()
        if (!cfg.providers[id] && !PRESETS[id]) {
          err(`  Unknown provider: ${id}`)
          continue
        }
        if (!cfg.providers[id]) cfg.providers[id] = { ...PRESETS[id], apiKey: '' }
        cfg.activeProvider = id
        saveConfig(cfg)
        rebuildAgent()
        paintHeader(ws, provider)
        ok(`  Using ${id} · ${provider.model}`)
        console.log('')
        continue
      }

      if (line.startsWith('/model ')) {
        const model = line.slice(7).trim()
        if (!model) {
          err('  Usage: /model <model-id>')
          continue
        }
        const cfg = loadConfig()
        const id = cfg.activeProvider || 'openai'
        const prev = cfg.providers[id] || PRESETS[id] || PRESETS.custom
        setProvider(id, { ...prev, model })
        rebuildAgent()
        ok(`  Model → ${model}`)
        console.log('')
        continue
      }

      if (line === '/connect' || line === '/provider add') {
        const next = await connectWizard(rl)
        if (next) {
          rebuildAgent()
          paintHeader(ws, provider)
          ok('  Provider connected. Ask Morph anything.')
          console.log('')
        }
        continue
      }

      // Normal chat
      if (!resolveProvider().apiKey) {
        warn('  No API key. Run /connect first.')
        continue
      }

      try {
        process.stdout.write(c.dim('  morph is thinking…\n'))
        const text = await agent.chat(line)
        // erase thinking line roughly
        printMsg('assistant', text)
      } catch (e) {
        err('  ' + (e instanceof Error ? e.message : String(e)))
        console.log('')
      }
    }
  } finally {
    rl.close()
    process.stdout.write(SHOW)
    console.log(c.dim('  morph session ended'))
  }

  return 0
}
