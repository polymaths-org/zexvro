import { z } from 'zod'
import type { GateConfig } from './domain.js'

const DEFAULT_CORS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4103',
  'http://127.0.0.1:4103',
  'https://console.zexvro.in',
  'https://zexvro.pages.dev',
  'https://main.zexvro.pages.dev',
  'https://*.zexvro.pages.dev',
  'https://zexvro.in',
  'https://www.zexvro.in',
]

const envSchema = z.object({
  AGENT_AUTH_PORT: z.coerce.number().int().min(1).max(65_535).default(4103),
  AGENT_AUTH_ISSUER: z.string().url().default('http://localhost:4103'),
  AGENT_AUTH_SIGNING_SECRET: z
    .string()
    .min(16)
    .default('dev-only-change-me-please'),
  AGENT_AUTH_DEFAULT_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  AGENT_AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(90),
  GATE_ALLOW_DEV_HUMAN: z
    .enum(['0', '1', 'true', 'false'])
    .default('true')
    .transform((v) => v === '1' || v === 'true'),
  GATE_ALLOW_DEV_HMAC: z
    .enum(['0', '1', 'true', 'false'])
    .default('true')
    .transform((v) => v === '1' || v === 'true'),
  GATE_REQUIRE_POP: z
    .enum(['0', '1', 'true', 'false'])
    .default('true')
    .transform((v) => v === '1' || v === 'true'),
  GATE_STATE_BACKEND: z.enum(['memory', 'dynamo']).default('memory'),
  GATE_DYNAMO_TABLE: z.string().default('zexvro-agent-auth'),
  GATE_ADMIN_REQUIRE_AUTH: z.enum(['0', '1', 'true', 'false']).optional(),
  /** e.g. `/gate` when public URL is https://api.zexvro.in/gate */
  GATE_BASE_PATH: z.string().optional(),
  /** Comma-separated browser origins for CORS */
  GATE_CORS_ORIGINS: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  NODE_ENV: z.string().optional(),
})

function normalizeBasePath(raw: string | undefined, issuer: string): string {
  let path = (raw ?? '').trim()
  if (!path) {
    try {
      const u = new URL(issuer)
      path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
    } catch {
      path = ''
    }
  }
  if (!path || path === '/') return ''
  if (!path.startsWith('/')) path = `/${path}`
  return path.replace(/\/$/, '')
}

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return [...DEFAULT_CORS]
  return raw
    .split(',')
    .map((v) => v.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GateConfig {
  const parsed = envSchema.parse(env)
  const isProd = parsed.NODE_ENV === 'production'
  const issuer = parsed.AGENT_AUTH_ISSUER.replace(/\/$/, '')
  return {
    port: parsed.AGENT_AUTH_PORT,
    issuer,
    signingSecret: parsed.AGENT_AUTH_SIGNING_SECRET,
    defaultTtlSeconds: parsed.AGENT_AUTH_DEFAULT_TTL_SECONDS,
    challengeTtlSeconds: parsed.AGENT_AUTH_CHALLENGE_TTL_SECONDS,
    allowDevHuman: isProd ? false : parsed.GATE_ALLOW_DEV_HUMAN,
    allowDevHmac: isProd ? false : parsed.GATE_ALLOW_DEV_HMAC,
    isProd,
    requirePop: parsed.GATE_REQUIRE_POP,
    stateBackend: parsed.GATE_STATE_BACKEND,
    dynamoTable: parsed.GATE_DYNAMO_TABLE,
    // Production defaults to requiring admin auth if not explicitly disabled
    adminRequireAuth: (() => {
      const explicit = env.GATE_ADMIN_REQUIRE_AUTH
      if (explicit === undefined) return isProd
      return explicit === '1' || explicit === 'true'
    })(),
    cognitoUserPoolId: parsed.COGNITO_USER_POOL_ID,
    cognitoClientId: parsed.COGNITO_CLIENT_ID,
    basePath: normalizeBasePath(parsed.GATE_BASE_PATH, issuer),
    corsOrigins: parseCorsOrigins(parsed.GATE_CORS_ORIGINS),
  }
}

/** Exact match or single-label wildcard host (e.g. https://*.zexvro.pages.dev). */
export function isCorsOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = origin.trim().replace(/\/$/, '')
  if (!normalized) return false
  if (allowedOrigins.includes(normalized)) return true

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false

  for (const entry of allowedOrigins) {
    if (!entry.includes('*')) continue
    try {
      const wildcard = new URL(entry.replace('://*.', '://wildcard-marker.'))
      if (wildcard.protocol !== parsed.protocol) continue
      const suffix = wildcard.hostname.replace(/^wildcard-marker\./, '')
      if (!suffix) continue
      if (parsed.hostname === suffix) return true
      if (parsed.hostname.endsWith(`.${suffix}`)) {
        const sub = parsed.hostname.slice(0, -(suffix.length + 1))
        // one label only
        if (sub && !sub.includes('.')) return true
      }
    } catch {
      /* ignore bad entry */
    }
  }
  return false
}
