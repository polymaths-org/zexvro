import { z } from 'zod'
import type { GateConfig } from './domain.js'

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
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  NODE_ENV: z.string().optional(),
})

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GateConfig {
  const parsed = envSchema.parse(env)
  const isProd = parsed.NODE_ENV === 'production'
  return {
    port: parsed.AGENT_AUTH_PORT,
    issuer: parsed.AGENT_AUTH_ISSUER,
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
  }
}
