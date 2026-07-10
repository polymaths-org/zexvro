import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { FileNftRepository } from './repository.js'
import { PinataPinningService } from './pinning.js'
import { NftService } from './service.js'
import {
  StellarNftChainGateway,
  UnavailableNftChainGateway,
} from './stellarGateway.js'

const config = loadConfig()
const repository = await FileNftRepository.open(config.NFT_DATA_FILE)
const pinning = new PinataPinningService(config.PINATA_JWT)
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
)

createApp(service).listen(config.PORT, () => {
  console.log(`NFT service listening on http://localhost:${String(config.PORT)}`)
})
