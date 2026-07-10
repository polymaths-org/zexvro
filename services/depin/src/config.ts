import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { validateStellarDestinationAddress } from '@x402/stellar'
import type { DepinConfig } from './domain.js'

const routeSchema = z
  .string()
  .regex(/^\/(?:[A-Za-z0-9._~-]+\/?)*$/, 'Route must be a concrete absolute path')
  .refine(
    (route) => route.split('/').every((segment) => segment !== '.' && segment !== '..'),
    'Route cannot contain dot segments',
  )
  .refine((route) => route === '/' || !route.endsWith('/'), {
    message: 'Route cannot have a trailing slash',
  })
  .refine((route) => route !== '/health', {
    message: 'The /health route is reserved',
  })

const priceSchema = z.string().refine((value) => {
  if (!/^\$(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(value)) return false
  const amount = Number(value.slice(1))
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000
}, 'Price must be a positive dollar amount no greater than $1000')

const upstreamUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.username === '' &&
    url.password === '' &&
    url.hash === ''
  )
}, 'Upstream URL must be HTTP(S), without credentials or a fragment')

const providerSchema = z.object({
  route: routeSchema,
  method: z.enum(['GET', 'HEAD']),
  upstreamUrl: upstreamUrlSchema,
  description: z.string().trim().min(1).max(240),
  price: priceSchema,
  recipient: z.string().refine(validateStellarDestinationAddress, {
    message: 'Recipient must be a valid Stellar destination address',
  }),
  network: z.literal('stellar:testnet'),
  timeoutMs: z.number().int().min(100).max(60_000),
  upstreamSecretRef: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,127}$/)
    .optional(),
})

const configSchema = z
  .object({
    port: z.number().int().min(1).max(65_535).default(4102),
    facilitatorUrl: z.url().default('https://x402.org/facilitator'),
    maxUpstreamResponseBytes: z.number().int().min(1_024).max(50 * 1024 * 1024).default(10 * 1024 * 1024),
    replayTtlMs: z.number().int().min(60_000).max(24 * 60 * 60 * 1_000).default(10 * 60 * 1_000),
    unpaidRateLimit: z
      .object({
        maxRequests: z.number().int().min(1).max(10_000).default(30),
        windowMs: z.number().int().min(1_000).max(60 * 60 * 1_000).default(60_000),
      })
      .default({ maxRequests: 30, windowMs: 60_000 }),
    providers: z.array(providerSchema).min(1),
  })
  .superRefine((config, context) => {
    const keys = new Set<string>()
    for (const [index, provider] of config.providers.entries()) {
      const key = `${provider.method} ${provider.route}`
      if (keys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['providers', index],
          message: `Duplicate provider route: ${key}`,
        })
      }
      keys.add(key)
    }
  })

export function parseConfig(value: unknown): DepinConfig {
  return configSchema.parse(value)
}

export async function loadConfig(path: string): Promise<DepinConfig> {
  const contents = await readFile(path, 'utf8')
  return parseConfig(JSON.parse(contents) as unknown)
}

export function assertSecretReferences(
  config: DepinConfig,
  environment: NodeJS.ProcessEnv,
): void {
  for (const provider of config.providers) {
    if (
      provider.upstreamSecretRef !== undefined &&
      !environment[provider.upstreamSecretRef]
    ) {
      throw new Error(
        `Missing environment variable referenced by ${provider.method} ${provider.route}: ${provider.upstreamSecretRef}`,
      )
    }
  }
}
