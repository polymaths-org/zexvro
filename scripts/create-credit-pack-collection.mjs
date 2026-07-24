/**
 * Create a live platform Credit Pack NFT collection (testnet) with primary sale.
 * Uses the same NFT service stack as App Runner (Dynamo + sponsor).
 *
 * Usage:
 *   export STELLAR_SPONSOR_SECRET=...
 *   export NFT_COLLECTION_WASM_HASH=...
 *   node scripts/create-credit-pack-collection.mjs
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { Keypair } from '@stellar/stellar-sdk'

const require = createRequire(import.meta.url)
// Load compiled or ts via dynamic import from nft-service
const nftApiRoot = new URL('../services/nft-service/api/', import.meta.url)

const region = process.env.AWS_REGION || 'us-east-1'
const tableName = process.env.NFT_DYNAMO_TABLE || 'zexvro-nft'
const sponsorSecret = (process.env.STELLAR_SPONSOR_SECRET || '').trim()
const wasmHash = (process.env.NFT_COLLECTION_WASM_HASH || '').trim()
const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
const networkPassphrase =
  process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
const paymentToken =
  process.env.STELLAR_USDC_CONTRACT ||
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
const publicBase =
  process.env.NFT_PUBLIC_BASE_URL || 'https://iyk6idmup6.us-east-1.awsapprunner.com'
// 5.00 USDC (7 decimals) — matches Starter pack list price
const priceAtomic = BigInt(process.env.ZCR_PACK_PRICE_ATOMIC || '50000000')

if (!sponsorSecret || !wasmHash) {
  console.error('Need STELLAR_SPONSOR_SECRET and NFT_COLLECTION_WASM_HASH')
  process.exit(1)
}

const sponsor = Keypair.fromSecret(sponsorSecret)
const ownerAddress = sponsor.publicKey()
console.log('Sponsor/owner', ownerAddress)

// Import gateway from built dist if present, else tsx path
let StellarNftChainGateway
try {
  ;({ StellarNftChainGateway } = await import(
    `${nftApiRoot.href}dist/stellarGateway.js`
  ))
} catch {
  // build dist first
  console.log('Building nft-service dist…')
  const { execSync } = await import('node:child_process')
  execSync('npm run build', {
    cwd: new URL('../services/nft-service/api', import.meta.url).pathname,
    stdio: 'inherit',
  })
  ;({ StellarNftChainGateway } = await import(
    `${nftApiRoot.href}dist/stellarGateway.js`
  ))
}

const chain = new StellarNftChainGateway({
  rpcUrl,
  networkPassphrase,
  sponsorSecret,
  collectionWasmHash: wasmHash,
})

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }))
const id = randomUUID()
const now = new Date().toISOString()
const baseMetadataUri = `${publicBase.replace(/\/$/, '')}/v1/public/collections/${id}/tokens/`
// Reuse a known public cover from CDN used by other collections
const coverImageUri =
  process.env.ZCR_PACK_COVER_URI ||
  'https://d1a0z3arlwwfrj.cloudfront.net/nft/d3d6428513178375f6f7e05f38f409e131f6db'

const name = 'ZEXVRO Credit Pack'
const symbol = 'ZCR'
const description =
  'Platform credit pack (ZCR). Purchasing mints a pack receipt NFT and grants Zexvro credits to your workspace. platform:zexvro-credits'

console.log('Deploying collection', id, '…')
const deployment = await chain.deployCollection({
  ownerAddress,
  name,
  symbol,
  baseMetadataUri,
  royaltyRecipient: ownerAddress,
  royaltyBps: 0,
})
console.log('Deployed', deployment.contractId, deployment.transactionHash)

const collection = {
  entityType: 'collection',
  pk: `COLLECTION#${id}`,
  sk: 'META',
  id,
  workspaceId: 'team.platform-zcr-credits',
  gsi1pk: 'WORKSPACE#team.platform-zcr-credits',
  gsi1sk: `COLLECTION#${now}#${id}`,
  name,
  symbol,
  description,
  ownerAddress,
  baseMetadataUri,
  collectionMetadataUri: `${publicBase.replace(/\/$/, '')}/v1/public/collections/${id}`,
  coverImageUri,
  royaltyRecipient: ownerAddress,
  royaltyBps: 0,
  status: 'live',
  contractId: deployment.contractId,
  deploymentTxHash: deployment.transactionHash,
  createdAt: now,
  updatedAt: now,
}

await ddb.send(
  new PutCommand({
    TableName: tableName,
    Item: collection,
  }),
)
// token counter
await ddb.send(
  new PutCommand({
    TableName: tableName,
    Item: {
      entityType: 'token_counter',
      pk: `COLLECTION#${id}`,
      sk: 'COUNTER',
      nextTokenId: 1,
    },
  }),
)

console.log('Configuring primary sale price', priceAtomic.toString(), '…')
const prepared = await chain.prepareSaleConfig({
  contractId: deployment.contractId,
  ownerAddress,
  paymentTokenAddress: paymentToken,
  price: priceAtomic,
})

let saleTxHash = prepared.autoSubmitted?.transactionHash
if (!saleTxHash) {
  // Sponsor is owner — prepareSaleConfig should auto-submit; if not, submit with sponsor
  console.log('autoSubmitted missing, requiredSigners', prepared.requiredSigners)
  if (prepared.serializedTransaction) {
    const result = await chain.submitSaleConfig({
      contractId: deployment.contractId,
      expectedSerializedTransaction: prepared.serializedTransaction,
      serializedTransaction: prepared.serializedTransaction,
    })
    saleTxHash = result.transactionHash
  }
}

if (!saleTxHash) {
  console.error('Could not configure primary sale automatically')
  process.exit(2)
}

const configuredAt = new Date().toISOString()
const withSale = {
  ...collection,
  primarySale: {
    paymentTokenAddress: paymentToken,
    priceAtomic: priceAtomic.toString(),
    transactionHash: saleTxHash,
    configuredAt,
  },
  updatedAt: configuredAt,
}
await ddb.send(
  new PutCommand({
    TableName: tableName,
    Item: withSale,
  }),
)

// verify public read path shape
const check = await ddb.send(
  new GetCommand({
    TableName: tableName,
    Key: { pk: `COLLECTION#${id}`, sk: 'META' },
  }),
)
console.log('Saved primarySale', Boolean(check.Item?.primarySale))

console.log(
  JSON.stringify(
    {
      collectionId: id,
      contractId: deployment.contractId,
      deploymentTxHash: deployment.transactionHash,
      saleTxHash,
      priceAtomic: priceAtomic.toString(),
      paymentToken,
      ownerAddress,
      publicUrl: `https://console.zexvro.in/nft/collections/${id}`,
      embedCheckout: `https://console.zexvro.in/nft/embed/checkout?collectionId=${id}`,
    },
    null,
    2,
  ),
)
