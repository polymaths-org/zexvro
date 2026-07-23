/**
 * Morph interactive session — fully self-contained Morph branding & config.
 */
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { MorphAgent } from './agent.mjs'
import {
  PRESETS,
  configPath,
  loadConfig,
  listProviders,
  resolveProvider,
  saveConfig,
  setProvider,
} from './config.mjs'
import { systemPrompt } from './prompts.mjs'
import { assistantBlock, banner, c, err, ok, userPrompt, warn } from './ui.mjs'

function statusLine(workspace, provider) {
  const shortWs = workspace.length > 52 ? '…' + workspace.slice(-51) : workspace
  const key = provider.apiKey ? c.green('ready') : c.yellow('need /connect')
  return (
    c.dim('  ') +
    c.bold(c.cyan('Morph')) +
    c.dim('  ·  ') +
    c.white(provider.name || 'none') +
    c.dim(' / ') +
    c.white(provider.model || '—') +
    c.dim('  ·  ') +
    key +
    c.dim('  ·  ') +
    c.dim(shortWs)
  )
}

function helpText() {
  return [
    '',
    c.bold('  Morph commands'),
    c.dim('  ──────────────────────────────────────────────'),
    `  ${c.cyan('/connect')}              Add provider (OpenAI / Anthropic-compatible / custom)`,
    `  ${c.cyan('/providers')}            List saved providers`,
    `  ${c.cyan('/use')} ${c.dim('<id>')}           Switch active provider`,
    `  ${c.cyan('/model')} ${c.dim('<name>')}       Set model for active provider`,
    `  ${c.cyan('/clear')}                Clear conversation`,
    `  ${c.cyan('/doctor')}               Show workspace + provider status`,
    `  ${c.cyan('/help')}                 This help`,
    `  ${c.cyan('/exit')}                 Quit Morph`,
    '',
    c.dim('  Tip: “Analyze demos/arcade, plan ZEXVRO migration, implement it.”'),
    '',
  ].join('\n')
}

function paintChrome(workspace, provider) {
  console.log(banner())
  console.log(statusLine(workspace, provider))
  console.log(c.dim('  ──────────────────────────────────────────────────────────'))
  console.log(c.dim('  /connect  /providers  /use  /model  /clear  /help  /exit'))
  console.log('')
}

async function connectWizard(rl) {
  const ask = (q) => new Promise((r) => rl.question(q, r))
  console.log('')
  console.log(c.bold(c.cyan('  /connect')))
  console.log(c.dim('  ──────────────────────────────────────────────'))
  console.log('  1) OpenAI')
  console.log('  2) Anthropic-compatible (OpenAI-compatible endpoint)')
  console.log('  3) Custom OpenAI-compatible endpoint')
  console.log('  4) xAI Grok')
  console.log('  5) OpenRouter')
  console.log('  6) Groq')
  console.log('  7) DeepSeek')
  console.log('')

  const choice = (await ask(c.dim('  Choice [1-7]: '))).trim()
  const map = {
    1: 'openai',
    2: 'anthropic',
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

  if (id === 'custom' || choice === '2') {
    if (choice === '2') name = 'Anthropic-compatible'
    else name = (await ask(c.dim('  Display name [Custom]: '))).trim() || 'Custom'
    const bu = (
      await ask(c.dim(`  Base URL (…/v1) [${baseUrl}]: `))
    ).trim()
    if (bu) baseUrl = bu
    if (!baseUrl) {
      err('Base URL required')
      return null
    }
  } else {
    const bu = (await ask(c.dim(`  Base URL [${baseUrl}]: `))).trim()
    if (bu) baseUrl = bu
  }

  const mo = (await ask(c.dim(`  Model [${model}]: `))).trim()
  if (mo) model = mo

  const apiKey = (await ask(c.dim('  API key: '))).trim()
  if (!apiKey) {
    err('API key required')
    return null
  }

  setProvider(id, { name, baseUrl, apiKey, model })
  ok(`Connected · ${name} · ${model}`)
  console.log(c.dim(`  saved ${configPath()}`))
  console.log('')
  return resolveProvider()
}

/**
 * Launch Morph interactive session.
 */
export async function launchTui({ workspace } = {}) {
  const ws = resolve(workspace || process.cwd())
  let provider = resolveProvider()

  paintChrome(ws, provider)

  if (!provider.apiKey) {
    warn('No provider yet. Type /connect to add OpenAI, Anthropic-compatible, or custom endpoint.')
    console.log('')
  } else {
    console.log(
      c.dim('  Ready. Example: Analyze demos/arcade and plan a ZEXVRO Web2→Web3 migration.'),
    )
    console.log('')
  }

  let agent = new MorphAgent({ workspace: ws, provider })
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const ask = () => new Promise((r) => rl.question(userPrompt(), r))

  const rebuild = () => {
    provider = resolveProvider()
    agent = new MorphAgent({ workspace: ws, provider })
  }

  try {
    while (true) {
      const line = (await ask()).trim()
      if (!line) continue

      if (line === '/exit' || line === '/quit' || line === 'exit') break
      if (line === '/help' || line === '/?') {
        console.log(helpText())
        continue
      }
      if (line === '/clear') {
        rebuild()
        paintChrome(ws, provider)
        ok('Conversation cleared')
        console.log('')
        continue
      }
      if (line === '/doctor') {
        provider = resolveProvider()
        console.log('')
        console.log(c.dim(`  workspace  ${ws}`))
        console.log(c.dim(`  provider   ${provider.name}`))
        console.log(c.dim(`  model      ${provider.model}`))
        console.log(c.dim(`  baseUrl    ${provider.baseUrl}`))
        console.log(c.dim(`  apiKey     ${provider.apiKey ? 'set' : 'missing'}`))
        console.log(c.dim(`  config     ${configPath()}`))
        console.log('')
        continue
      }
      if (line === '/providers' || line === '/provider') {
        console.log('')
        for (const p of listProviders()) {
          const mark = p.active ? c.cyan('*') : ' '
          console.log(
            `  ${mark} ${p.id.padEnd(12)} ${String(p.name).padEnd(28)} ${p.model}  ${
              p.hasKey ? c.green('key') : c.dim('no key')
            }`,
          )
        }
        console.log('')
        console.log(c.dim('  /connect to add · /use <id> to switch'))
        console.log('')
        continue
      }
      if (line.startsWith('/use ')) {
        const id = line.slice(5).trim()
        const cfg = loadConfig()
        if (!cfg.providers[id] && !PRESETS[id]) {
          err(`Unknown provider: ${id}`)
          continue
        }
        if (!cfg.providers[id]) cfg.providers[id] = { ...PRESETS[id], apiKey: '' }
        cfg.activeProvider = id
        saveConfig(cfg)
        rebuild()
        paintChrome(ws, provider)
        ok(`Using ${id} · ${provider.model}`)
        console.log('')
        continue
      }
      if (line.startsWith('/model ')) {
        const model = line.slice(7).trim()
        if (!model) {
          err('Usage: /model <model-id>')
          continue
        }
        const cfg = loadConfig()
        const id = cfg.activeProvider || 'openai'
        const prev = cfg.providers[id] || PRESETS[id] || PRESETS.custom
        setProvider(id, {
          name: prev.name,
          baseUrl: prev.baseUrl,
          apiKey: prev.apiKey,
          model,
        })
        rebuild()
        ok(`Model → ${model}`)
        console.log('')
        continue
      }
      if (line === '/connect' || line === '/provider add') {
        const next = await connectWizard(rl)
        if (next) {
          rebuild()
          paintChrome(ws, provider)
          ok('Provider ready. Ask Morph to analyze / plan / implement.')
          console.log('')
        }
        continue
      }

      if (!resolveProvider().apiKey) {
        warn('No API key. Run /connect first.')
        continue
      }

      try {
        process.stdout.write(c.dim('  morph is working…\r'))
        const text = await agent.chat(line)
        process.stdout.write(' '.repeat(24) + '\r')
        assistantBlock(text)
      } catch (e) {
        process.stdout.write(' '.repeat(24) + '\r')
        err(e instanceof Error ? e.message : String(e))
        console.log('')
      }
    }
  } finally {
    rl.close()
    console.log(c.dim('  morph session ended'))
  }
  return 0
}
