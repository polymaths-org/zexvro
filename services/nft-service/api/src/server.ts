import { createApp } from './app.js'
import { createCognitoAccessTokenMiddleware } from './auth.js'
import { loadConfig } from './config.js'
import { DynamoNftRepository } from './dynamoRepository.js'
import { LocalAssetPinningService } from './localPinning.js'
import { FileNftRepository } from './repository.js'
import { PinataPinningService } from './pinning.js'
import { S3AssetPinningService } from './s3Pinning.js'
import { NftService } from './service.js'
import {
  StellarNftChainGateway,
  UnavailableNftChainGateway,
} from './stellarGateway.js'
import type { NftRepository, PinningService } from './domain.js'

const config = loadConfig()
const repository: NftRepository =
  config.NFT_REPOSITORY === 'dynamo'
    ? new DynamoNftRepository({
        tableName: config.NFT_DYNAMO_TABLE,
        region: config.NFT_DYNAMO_REGION,
        workspaceIndexName: config.NFT_DYNAMO_GSI_WORKSPACE,
        idempotencyIndexName: config.NFT_DYNAMO_GSI_IDEMPOTENCY,
      })
    : await FileNftRepository.open(config.NFT_DATA_FILE)

let localPinning: LocalAssetPinningService | undefined
let pinning: PinningService
let pinningConfigured = false
let metadataBaseUrl: string | undefined

if (config.NFT_STORAGE_MODE === 'local') {
  localPinning = new LocalAssetPinningService(
    config.NFT_LOCAL_ASSET_DIR,
    config.NFT_PUBLIC_BASE_URL,
  )
  pinning = localPinning
  pinningConfigured = true
  metadataBaseUrl = config.NFT_PUBLIC_BASE_URL
} else if (config.NFT_STORAGE_MODE === 's3') {
  pinning = new S3AssetPinningService({
    bucket: config.NFT_S3_BUCKET as string,
    region: config.NFT_S3_REGION,
    ...(config.NFT_CDN_BASE_URL === undefined
      ? {}
      : { publicBaseUrl: config.NFT_CDN_BASE_URL }),
  })
  pinningConfigured = true
  // Token JSON still served from the API public routes unless a directory URI is provided.
  metadataBaseUrl = config.NFT_PUBLIC_BASE_URL
} else {
  if (config.PINATA_JWT === undefined) {
    console.warn(
      'NFT_STORAGE_MODE=pinata but PINATA_JWT is unset; media/metadata uploads will return 503 until the JWT is provided.',
    )
  }
  pinning = new PinataPinningService(config.PINATA_JWT)
  pinningConfigured = config.PINATA_JWT !== undefined
  metadataBaseUrl = undefined
}

const chain =
  config.STELLAR_SPONSOR_SECRET === undefined ||
  config.NFT_COLLECTION_WASM_HASH === undefined
    ? new UnavailableNftChainGateway()
    : new StellarNftChainGateway({
        rpcUrl: config.STELLAR_RPC_URL,
        networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
        sponsorSecret: config.STELLAR_SPONSOR_SECRET,
        collectionWasmHash: config.NFT_COLLECTION_WASM_HASH,
      })

const creditHooks = {
  creditCollectionIds: config.ZCR_CREDIT_COLLECTION_IDS,
  defaultZcrAmount: config.ZCR_DEFAULT_AMOUNT,
  ...(config.PLATFORM_CREDITS_URL === undefined
    ? {}
    : { platformCreditsUrl: config.PLATFORM_CREDITS_URL }),
  ...(config.PLATFORM_INTERNAL_SECRET === undefined
    ? {}
    : { platformInternalSecret: config.PLATFORM_INTERNAL_SECRET }),
}

const service = new NftService(
  repository,
  pinning,
  chain,
  config.NFT_CHECKOUT_TTL_SECONDS,
  () => new Date(),
  config.STELLAR_USDC_CONTRACT,
  metadataBaseUrl,
  creditHooks,
)

createApp(service, {
  authenticate: createCognitoAccessTokenMiddleware({
    userPoolId: config.COGNITO_USER_POOL_ID,
    clientId: config.COGNITO_CLIENT_ID,
  }),
  allowedOrigins: config.CORS_ALLOWED_ORIGINS,
  capabilities: {
    network: 'stellar:testnet',
    pinningConfigured,
    stellarConfigured:
      config.STELLAR_SPONSOR_SECRET !== undefined &&
      config.NFT_COLLECTION_WASM_HASH !== undefined,
    storageMode: config.NFT_STORAGE_MODE,
  },
  ...(localPinning === undefined ? {} : { assetReader: localPinning }),
}).listen(config.PORT, () => {
  console.log(
    `NFT service listening on http://localhost:${String(config.PORT)} storageMode=${config.NFT_STORAGE_MODE} repository=${config.NFT_REPOSITORY} pinningConfigured=${String(pinningConfigured)}`,
  )
})
