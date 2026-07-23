import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DIR = join(homedir(), '.config', 'morph')
const PATH = join(DIR, 'config.json')

/** Built-in presets — all OpenAI-compatible chat/completions + tools */
export const PRESETS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1-mini',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  together: {
    name: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  xai: {
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3',
  },
  opencode: {
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'big-pickle',
  },
  custom: {
    name: 'Custom OpenAI-compatible',
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: 'default',
  },
}

const defaults = {
  activeProvider: 'openai',
  providers: {
    openai: { ...PRESETS.openai, apiKey: '' },
  },
}

export function configPath() {
  return PATH
}

export function loadConfig() {
  if (!existsSync(PATH)) return structuredClone(defaults)
  try {
    const raw = JSON.parse(readFileSync(PATH, 'utf8'))
    return {
      ...defaults,
      ...raw,
      providers: { ...defaults.providers, ...(raw.providers || {}) },
    }
  } catch {
    return structuredClone(defaults)
  }
}

export function saveConfig(cfg) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
}

/**
 * Resolve active LLM endpoint.
 * Priority: env overrides → config active provider
 */
export function resolveProvider(cfg = loadConfig()) {
  const envBase = (process.env.MORPH_BASE_URL || process.env.ZEXVRO_LLM_BASE_URL || '').trim()
  const envKey = (
    process.env.MORPH_API_KEY ||
    process.env.ZEXVRO_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim()
  const envModel = (process.env.MORPH_MODEL || process.env.ZEXVRO_LLM_MODEL || '').trim()

  if (envBase && envKey) {
    return {
      id: 'env',
      name: 'Environment',
      baseUrl: envBase.replace(/\/$/, ''),
      apiKey: envKey,
      model: envModel || 'default',
    }
  }

  const id = cfg.activeProvider || 'openai'
  const p = cfg.providers?.[id] || PRESETS.openai
  const apiKey = (p.apiKey || envKey || '').trim()
  return {
    id,
    name: p.name || id,
    baseUrl: String(p.baseUrl || PRESETS.openai.baseUrl).replace(/\/$/, ''),
    apiKey,
    model: envModel || p.model || 'gpt-4.1',
  }
}

export function setProvider(id, { name, baseUrl, apiKey, model } = {}) {
  const cfg = loadConfig()
  const preset = PRESETS[id] || PRESETS.custom
  const prev = cfg.providers[id] || {}
  cfg.providers[id] = {
    name: name || prev.name || preset.name,
    baseUrl: (baseUrl || prev.baseUrl || preset.baseUrl).replace(/\/$/, ''),
    apiKey: apiKey !== undefined ? apiKey : prev.apiKey || '',
    model: model || prev.model || preset.model,
  }
  cfg.activeProvider = id
  saveConfig(cfg)
  return cfg.providers[id]
}
