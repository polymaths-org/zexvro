import { createApp } from './app.js'
import { createCognitoAccessTokenMiddleware } from './auth.js'
import { loadConfig } from './config.js'
import { LocalAssetPinningService } from './localPinning.js'
import { FileNftRepository } from './repository.js'
import { PinataPinningService } from './pinning.js'
import { NftService } from './service.js'
import {
  StellarNftChainGateway,
  UnavailableNftChainGateway,
} from './stellarGateway.js'

const config = loadConfig()
const repository = await FileNftRepository.open(config.NFT_DATA_FILE)
const localPinning =
  config.NFT_STORAGE_MODE === 'local'
    ? new LocalAssetPinningService(
        config.NFT_LOCAL_ASSET_DIR,
        config.NFT_PUBLIC_BASE_URL,
      )
    : undefined
const pinning = localPinning ?? new PinataPinningService(config.PINATA_JWT)
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

const service = new NftService(
  repository,
  pinning,
  chain,
  config.NFT_CHECKOUT_TTL_SECONDS,
  () => new Date(),
  config.STELLAR_USDC_CONTRACT,
  localPinning === undefined ? undefined : config.NFT_PUBLIC_BASE_URL,
)

createApp(service, {
  authenticate: createCognitoAccessTokenMiddleware({
    userPoolId: config.COGNITO_USER_POOL_ID,
    clientId: config.COGNITO_CLIENT_ID,
  }),
  allowedOrigins: config.CORS_ALLOWED_ORIGINS,
  capabilities: {
    network: 'stellar:testnet',
    pinningConfigured: localPinning !== undefined || config.PINATA_JWT !== undefined,
    stellarConfigured:
      config.STELLAR_SPONSOR_SECRET !== undefined &&
      config.NFT_COLLECTION_WASM_HASH !== undefined,
    storageMode: config.NFT_STORAGE_MODE,
  },
  ...(localPinning === undefined ? {} : { assetReader: localPinning }),
}).listen(config.PORT, () => {
  console.log(`NFT service listening on http://localhost:${String(config.PORT)}`)
})
