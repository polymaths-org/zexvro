import { z } from 'zod'

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(4101),
  NFT_DATA_FILE: z.string().min(1).default('.data/nft-service.json'),
  PINATA_JWT: optionalSecret,
  NFT_STORAGE_MODE: z.enum(['pinata', 'local']).default('pinata'),
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
  STELLAR_USDC_CONTRACT: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/)
    .default('CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'),
  NFT_CHECKOUT_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
})

export type NftServiceConfig = z.infer<typeof configSchema>

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): NftServiceConfig {
  return configSchema.parse(environment)
}
