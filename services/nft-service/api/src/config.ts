import { z } from 'zod'

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value)
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.username === '' &&
        url.password === '' &&
        url.search === '' &&
        url.hash === ''
      )
    }, 'URL must be HTTP(S) without credentials')
    .optional(),
)

const booleanFlag = z.preprocess((value) => {
  if (value === undefined || value === '') return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return value
}, z.boolean())

const configSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4101),
  NFT_DATA_FILE: z.string().min(1).default('.data/nft-service.json'),
  PINATA_JWT: optionalSecret,
  NFT_STORAGE_MODE: z.enum(['local', 's3', 'pinata']).default('local'),
  NFT_LOCAL_ASSET_DIR: z.string().min(1).default('.data/assets'),
  NFT_PUBLIC_BASE_URL: z
    .url()
    .refine((value) => {
      const url = new URL(value)
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.username === '' &&
        url.password === '' &&
        url.search === '' &&
        url.hash === ''
      )
    }, 'NFT_PUBLIC_BASE_URL must be an HTTP(S) URL without credentials')
    .default('http://127.0.0.1:4101'),
  NFT_S3_BUCKET: optionalSecret,
  NFT_S3_REGION: z.string().min(1).default('us-east-1'),
  NFT_CDN_BASE_URL: optionalUrl,
  NFT_REPOSITORY: z.enum(['file', 'dynamo']).default('file'),
  NFT_DYNAMO_TABLE: z.string().min(1).default('zexvro-nft'),
  NFT_DYNAMO_REGION: z.string().min(1).default('us-east-1'),
  NFT_DYNAMO_GSI_WORKSPACE: z.string().min(1).default('workspace-index'),
  NFT_DYNAMO_GSI_IDEMPOTENCY: z.string().min(1).default('idempotency-index'),
  NFT_REQUIRE_SPONSOR: booleanFlag.default(false),
  COGNITO_USER_POOL_ID: z.string().min(1).default('us-east-1_vyONcitBD'),
  COGNITO_CLIENT_ID: z.string().min(1).default('7qmkq33si9qk8pgo6ebi3qantm'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://127.0.0.1:3000,http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  STELLAR_RPC_URL: z
    .url()
    .default('https://soroban-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .min(1)
    .default('Test SDF Network ; September 2015'),
  STELLAR_SPONSOR_SECRET: optionalSecret,
  NFT_COLLECTION_WASM_HASH: optionalSecret,
  // Payment token for primary sales. Default = native XLM SAC (testnet) — no trustline required.
  // Override with USDC SAC if you need USDC checkout instead.
  STELLAR_USDC_CONTRACT: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/)
    .default('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
  NFT_CHECKOUT_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  /** Platform Lambda base URL for ZCR top-up after credit-pack NFT checkout. */
  PLATFORM_CREDITS_URL: optionalUrl,
  PLATFORM_INTERNAL_SECRET: optionalSecret,
  /** Comma-separated collection IDs that grant ZCR on purchase. */
  ZCR_CREDIT_COLLECTION_IDS: z.string().default('').transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ),
  ZCR_DEFAULT_AMOUNT: z.coerce.number().int().min(1).max(1_000_000).default(100),
})

export type NftServiceConfig = z.infer<typeof configSchema>

export function requiresManagedSponsor(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (environment.NFT_REQUIRE_SPONSOR !== undefined) {
    const flag = booleanFlag.safeParse(environment.NFT_REQUIRE_SPONSOR)
    if (flag.success) return flag.data
  }
  return environment.NODE_ENV === 'production'
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): NftServiceConfig {
  const config = configSchema.parse({
    ...environment,
    NFT_REQUIRE_SPONSOR:
      environment.NFT_REQUIRE_SPONSOR === undefined
        ? requiresManagedSponsor(environment)
        : environment.NFT_REQUIRE_SPONSOR,
  })
  if (config.NFT_STORAGE_MODE === 's3' && config.NFT_S3_BUCKET === undefined) {
    throw new Error('NFT_S3_BUCKET is required when NFT_STORAGE_MODE=s3')
  }
  if (config.NFT_REPOSITORY === 'dynamo' && config.NFT_DYNAMO_TABLE.trim() === '') {
    throw new Error('NFT_DYNAMO_TABLE is required when NFT_REPOSITORY=dynamo')
  }
  if (config.NFT_REQUIRE_SPONSOR) {
    if (config.STELLAR_SPONSOR_SECRET === undefined) {
      throw new Error(
        'STELLAR_SPONSOR_SECRET is required when NFT_REQUIRE_SPONSOR=1 or NODE_ENV=production. Inject it from AWS Secrets Manager or task environment; do not use CLI identity in managed hosts.',
      )
    }
    if (config.NFT_COLLECTION_WASM_HASH === undefined) {
      throw new Error(
        'NFT_COLLECTION_WASM_HASH is required when NFT_REQUIRE_SPONSOR=1 or NODE_ENV=production',
      )
    }
  }
  return config
}
