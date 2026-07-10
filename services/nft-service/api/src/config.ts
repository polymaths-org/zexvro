import { z } from 'zod'

const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(4101),
  NFT_DATA_FILE: z.string().min(1).default('.data/nft-service.json'),
  PINATA_JWT: optionalSecret,
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
