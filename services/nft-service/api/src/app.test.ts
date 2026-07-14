import request from 'supertest'
import type { RequestHandler } from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import { Keypair } from './index.js'
import { createApp } from './app.js'
import type {
  CollectionDeploymentInput,
  DeploymentResult,
  NftChainGateway,
  PinnedAsset,
  PinningService,
  PreparedContractCall,
  SubmissionResult,
} from './domain.js'
import { ApiError } from './errors.js'
import { InMemoryNftRepository } from './repository.js'
import { NftService } from './service.js'

class FakePinning implements PinningService {
  failure?: Error
  lastJson?: Record<string, unknown>

  async pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset> {
    if (this.failure !== undefined) throw this.failure
    return {
      cid: `bafy-${input.filename}`,
      uri: `ipfs://bafy-${input.filename}`,
      size: input.bytes.byteLength,
      mimeType: input.mimeType,
    }
  }

  pinJson(input: {
    value: Record<string, unknown>
    filename: string
  }): Promise<PinnedAsset> {
    this.lastJson = input.value
    return this.pinFile({
      bytes: new TextEncoder().encode(JSON.stringify(input.value)),
      filename: input.filename,
      mimeType: 'application/json',
    })
  }
}

class FakeChain implements NftChainGateway {
  deployFailure?: Error
  prepareFailure?: Error
  submitFailure?: Error
  autoSubmitSaleConfig = false
  submitCalls = 0

  async deployCollection(_input: CollectionDeploymentInput): Promise<DeploymentResult> {
    if (this.deployFailure !== undefined) throw this.deployFailure
    return {
      contractId: `C${'A'.repeat(55)}`,
      transactionHash: 'deployment-hash',
    }
  }

  async prepareMint(input: {
    operatorAddress: string
  }): Promise<PreparedContractCall> {
    if (this.prepareFailure !== undefined) throw this.prepareFailure
    return { serializedTransaction: 'prepared-mint', requiredSigners: [input.operatorAddress] }
  }

  async submitMint(): Promise<SubmissionResult> {
    if (this.submitFailure !== undefined) throw this.submitFailure
    return {
      transactionHash: 'mint-hash',
      status: 'confirmed',
      tokenId: 7,
      ownerAddress: ownerAddress,
    }
  }

  async prepareSaleConfig(input: {
    ownerAddress: string
  }): Promise<PreparedContractCall> {
    if (this.prepareFailure !== undefined) throw this.prepareFailure
    if (this.autoSubmitSaleConfig) {
      return {
        serializedTransaction: 'prepared-sale-config',
        requiredSigners: [],
        autoSubmitted: {
          transactionHash: 'sale-config-auto-hash',
          status: 'confirmed',
        },
      }
    }
    return {
      serializedTransaction: 'prepared-sale-config',
      requiredSigners: [input.ownerAddress],
    }
  }

  async submitSaleConfig(): Promise<SubmissionResult> {
    if (this.submitFailure !== undefined) throw this.submitFailure
    return { transactionHash: 'sale-config-hash', status: 'confirmed' }
  }

  async prepareCheckout(input: {
    buyerAddress: string
  }): Promise<PreparedContractCall> {
    if (this.prepareFailure !== undefined) throw this.prepareFailure
    return {
      serializedTransaction: 'prepared-checkout',
      requiredSigners: [input.buyerAddress],
    }
  }

  async submitCheckout(): Promise<SubmissionResult> {
    this.submitCalls += 1
    if (this.submitFailure !== undefined) throw this.submitFailure
    return { transactionHash: 'checkout-hash', status: 'confirmed' }
  }

  owners = new Map<string, string>()

  async getTokenOwner(input: {
    contractId: string
    tokenId: number
  }): Promise<string | undefined> {
    return this.owners.get(`${input.contractId}:${input.tokenId}`)
  }

  async getTransactionStatus(): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
    return 'confirmed'
  }
}

const ownerAddress = Keypair.random().publicKey()
const buyerAddress = Keypair.random().publicKey()
const testAssetId = 'a'.repeat(64)

const testAuth: RequestHandler = (request, response, next) => {
  response.locals.nftIdentity = {
    subject: request.header('X-Test-Subject') ?? 'user-a',
  }
  next()
}

const validCollection = {
  workspaceId: 'workspace-a',
  name: 'Sky Forge',
  symbol: 'SKY',
  description: 'A collection of verifiable game items.',
  ownerAddress,
  baseMetadataUri: 'ipfs://bafybase/',
  coverImageUri: 'ipfs://bafycover',
  royaltyRecipient: ownerAddress,
  royaltyBps: 500,
}

describe('NFT service API', () => {
  let repository: InMemoryNftRepository
  let pinning: FakePinning
  let chain: FakeChain
  let now: Date
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    repository = new InMemoryNftRepository()
    pinning = new FakePinning()
    chain = new FakeChain()
    now = new Date('2026-07-10T10:00:00.000Z')
    app = createApp(
      new NftService(repository, pinning, chain, 60, () => new Date(now)),
      {
        authenticate: testAuth,
        capabilities: {
          network: 'stellar:testnet',
          pinningConfigured: true,
          stellarConfigured: true,
          storageMode: 'pinata',
        },
        allowedOrigins: ['http://127.0.0.1:3000'],
        assetReader: {
          async readAsset(assetId: string) {
            if (assetId !== testAssetId) return undefined
            return {
              bytes: new Uint8Array([1, 2, 3, 4]),
              filename: 'cover.png',
              mimeType: 'image/png',
            }
          },
        },
      },
    )
  })

  async function createCollection() {
    const response = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(201)
    return response.body.collection as { id: string }
  }

  it('rejects malformed collection input without pinning or deployment', async () => {
    const response = await request(app)
      .post('/v1/collections')
      .send({ ...validCollection, symbol: 'lowercase' })
      .expect(400)

    expect(response.body.error.code).toBe('invalid_request')

    await request(app)
      .post('/v1/collections')
      .send({ ...validCollection, externalUrl: 'ftp://studio.example/game' })
      .expect(400)
    expect(pinning.lastJson).toBeUndefined()
  })

  it('reports non-secret service capabilities from the public health route', async () => {
    const response = await request(app).get('/health').expect(200)

    expect(response.body).toEqual({
      status: 'ok',
      service: 'nft-service',
      capabilities: {
        network: 'stellar:testnet',
        pinningConfigured: true,
        stellarConfigured: true,
        storageMode: 'pinata',
      },
    })
  })

  it('uploads supported media and surfaces upload failures', async () => {
    const uploaded = await request(app)
      .post('/v1/media')
      .attach('file', Buffer.from('image'), {
        filename: 'cover.png',
        contentType: 'image/png',
      })
      .expect(201)
    expect(uploaded.body.asset.uri).toBe('ipfs://bafy-cover.png')

    pinning.failure = new ApiError(502, 'pinata_upload_failed', 'Pinata rejected upload')
    const failed = await request(app)
      .post('/v1/media')
      .attach('file', Buffer.from('image'), {
        filename: 'cover.webp',
        contentType: 'image/webp',
      })
      .expect(502)
    expect(failed.body.error.code).toBe('pinata_upload_failed')

    await request(app)
      .post('/v1/media')
      .attach('file', Buffer.from('text'), {
        filename: 'cover.svg',
        contentType: 'image/svg+xml',
      })
      .expect(415)
  })

  it('maps Pinata upload rejection to 502 on collection create without claiming live', async () => {
    pinning.failure = new ApiError(502, 'pinata_upload_failed', 'Pinata rejected upload')
    const failed = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(502)

    expect(failed.body.error.code).toBe('pinata_upload_failed')
    const listed = await request(app)
      .get('/v1/collections')
      .query({ workspaceId: validCollection.workspaceId })
      .expect(200)
    expect(listed.body.collections).toEqual([])
  })

  it('requires baseMetadataUri for pinata-style collection create', async () => {
    const withoutBase = {
      workspaceId: validCollection.workspaceId,
      name: validCollection.name,
      symbol: validCollection.symbol,
      description: validCollection.description,
      ownerAddress: validCollection.ownerAddress,
      coverImageUri: validCollection.coverImageUri,
      royaltyRecipient: validCollection.royaltyRecipient,
      royaltyBps: validCollection.royaltyBps,
    }
    const response = await request(app)
      .post('/v1/collections')
      .send(withoutBase)
      .expect(400)

    expect(response.body.error.code).toBe('base_metadata_uri_required')
    expect(pinning.lastJson).toBeUndefined()
  })

  it('pins collection metadata as ipfs URI when storage mode is pinata', async () => {
    const created = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(201)

    expect(created.body.collection).toMatchObject({
      status: 'live',
      baseMetadataUri: 'ipfs://bafybase/',
      coverImageUri: 'ipfs://bafycover',
    })
    expect(String(created.body.collection.collectionMetadataUri)).toMatch(/^ipfs:\/\//)
    expect(pinning.lastJson).toMatchObject({
      name: 'Sky Forge',
      symbol: 'SKY',
    })
  })

  it('serves local content-addressed assets without accepting bad identifiers', async () => {
    const asset = await request(app)
      .get(`/v1/assets/${testAssetId}`)
      .expect(200)

    expect(asset.headers['content-type']).toContain('image/png')
    expect(asset.headers.etag).toBe(`"${testAssetId}"`)
    expect(Array.from(asset.body as Buffer)).toEqual([1, 2, 3, 4])

    await request(app)
      .get(`/v1/assets/${'b'.repeat(64)}`)
      .expect(404)

    await request(app)
      .get('/v1/assets/not-a-valid-asset-id')
      .expect(400)
  })

  it('lists collections by workspace and reports deployment status', async () => {
    const collection = await createCollection()

    const list = await request(app)
      .get('/v1/collections')
      .query({ workspaceId: 'workspace-a' })
      .expect(200)
    expect(list.body.collections).toHaveLength(1)
    expect(list.body.collections[0].status).toBe('live')

    const isolated = await request(app)
      .get('/v1/collections')
      .query({ workspaceId: 'workspace-b' })
      .expect(200)
    expect(isolated.body.collections).toEqual([])

    const status = await request(app)
      .get(`/v1/collections/${collection.id}/status`)
      .expect(200)
    expect(status.body).toMatchObject({
      status: 'live',
      transactionHash: 'deployment-hash',
    })
  })

  it('scopes workspace records to the authenticated subject', async () => {
    const created = await request(app)
      .post('/v1/collections')
      .set('X-Test-Subject', 'user-a')
      .send(validCollection)
      .expect(201)

    const otherUserList = await request(app)
      .get('/v1/collections')
      .set('X-Test-Subject', 'user-b')
      .query({ workspaceId: validCollection.workspaceId })
      .expect(200)
    expect(otherUserList.body.collections).toEqual([])

    await request(app)
      .get(`/v1/collections/${String(created.body.collection.id)}`)
      .set('X-Test-Subject', 'user-b')
      .expect(404)
  })

  it('serves public token metadata without exposing workspace ownership', async () => {
    const created = await createCollection()

    const metadata = await request(app)
      .get(`/v1/public/collections/${created.id}/tokens/7`)
      .expect(200)

    expect(metadata.body).toMatchObject({
      name: 'Sky Forge #7',
      description: validCollection.description,
      image: validCollection.coverImageUri,
      collection: { name: 'Sky Forge', symbol: 'SKY' },
    })
    expect(metadata.body).not.toHaveProperty('workspaceId')
    expect(metadata.body).not.toHaveProperty('ownerAddress')
  })

  it('marks external gameplay attributes as mutable in pinned metadata', async () => {
    await request(app)
      .post('/v1/collections')
      .send({
        ...validCollection,
        externalUrl: 'https://api.zexvro.dev/nft/gameplay/v1/sky-forge',
      })
      .expect(201)

    expect(pinning.lastJson).toMatchObject({
      external_url: 'https://api.zexvro.dev/nft/gameplay/v1/sky-forge',
      properties: {
        zexvro: {
          schema_version: 1,
          gameplay_attributes: { mutable: true },
        },
      },
    })
  })

  it('persists a failed deployment without claiming the collection is live', async () => {
    chain.deployFailure = new Error('simulation failed')
    const failed = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(502)

    expect(failed.body.error.code).toBe('collection_deployment_failed')
    const collectionId = failed.body.error.details.collectionId as string
    const stored = await repository.getCollection(collectionId)
    expect(stored).toMatchObject({ status: 'failed', failureReason: 'simulation failed' })
  })

  it('edits, retries, and deletes failed collection records', async () => {
    chain.deployFailure = new Error('simulation failed')
    const failed = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(502)
    const collectionId = failed.body.error.details.collectionId as string

    const edited = await request(app)
      .patch(`/v1/collections/${collectionId}`)
      .send({
        name: 'Sky Forge Retry',
        description: 'Updated metadata before redeploying the failed collection.',
        royaltyBps: 250,
      })
      .expect(200)
    expect(edited.body.collection).toMatchObject({
      name: 'Sky Forge Retry',
      royaltyBps: 250,
    })
    expect(edited.body.collection).not.toHaveProperty('failureReason')

    delete chain.deployFailure
    const retried = await request(app)
      .post(`/v1/collections/${collectionId}/retry`)
      .expect(201)
    expect(retried.body.collection).toMatchObject({
      status: 'live',
      contractId: `C${'A'.repeat(55)}`,
      deploymentTxHash: 'deployment-hash',
    })

    await request(app)
      .delete(`/v1/collections/${collectionId}`)
      .expect(409)

    chain.deployFailure = new Error('still failed')
    const nextFailed = await request(app)
      .post('/v1/collections')
      .send({ ...validCollection, symbol: 'FAIL' })
      .expect(502)
    const failedId = nextFailed.body.error.details.collectionId as string
    await request(app)
      .delete(`/v1/collections/${failedId}`)
      .expect(204)
    expect(await repository.getCollection(failedId)).toBeUndefined()
  })

  it('serves a public live collection page payload only after deployment succeeds', async () => {
    chain.deployFailure = new Error('simulation failed')
    const failed = await request(app)
      .post('/v1/collections')
      .send(validCollection)
      .expect(502)
    await request(app)
      .get(`/v1/public/collections/${String(failed.body.error.details.collectionId)}`)
      .expect(404)

    delete chain.deployFailure
    const live = await createCollection()
    const publicCollection = await request(app)
      .get(`/v1/public/collections/${live.id}`)
      .expect(200)

    expect(publicCollection.body.collection).toMatchObject({
      id: live.id,
      name: 'Sky Forge',
      symbol: 'SKY',
      status: 'live',
    })
    expect(publicCollection.body.collection).not.toHaveProperty('workspaceId')
    expect(publicCollection.body.collection).not.toHaveProperty('ownerAddress')
  })

  it('returns simulation errors when a checkout intent cannot be prepared', async () => {
    const collection = await createCollection()
    chain.prepareFailure = new ApiError(
      502,
      'stellar_simulation_failed',
      'Simulation failed',
    )

    const response = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'checkout-simulation')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 7 })
      .expect(502)
    expect(response.body.error.code).toBe('stellar_simulation_failed')
  })

  it('lets public buyers prepare checkout intents without Cognito scope', async () => {
    const collection = await createCollection()

    const created = await request(app)
      .post('/v1/public/checkout/intents')
      .set('Idempotency-Key', 'public-checkout')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 12 })
      .expect(201)

    expect(created.body.intent).toMatchObject({
      collectionId: collection.id,
      buyerAddress,
      tokenId: 12,
      serializedTransaction: 'prepared-checkout',
      requiredSigners: [buyerAddress],
      status: 'pending_signature',
    })
    expect(created.body.intent).not.toHaveProperty('idempotencyKey')

    const submitted = await request(app)
      .post(`/v1/public/checkout/intents/${String(created.body.intent.id)}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(201)
    expect(submitted.body.intent.status).toBe('confirmed')
  })

  it('allows buyers to create checkout intents and isolates them by buyer identity', async () => {
    const { id } = await createCollection()
    const created = await request(app)
      .post('/v1/checkout/intents')
      .set('X-Test-Subject', 'buyer-user')
      .set('Idempotency-Key', 'buyer-checkout')
      .send({ collectionId: id, buyerAddress, tokenId: 7 })
      .expect(201)

    const intentId = created.body.intent.id as string
    await request(app)
      .get(`/v1/checkout/intents/${intentId}`)
      .set('X-Test-Subject', 'another-buyer')
      .expect(404)
    const visible = await request(app)
      .get(`/v1/checkout/intents/${intentId}`)
      .set('X-Test-Subject', 'buyer-user')
      .expect(200)
    expect(visible.body.intent.idempotencyKey).toBe('buyer-checkout')
  })

  it('prepares and submits an owner-authorized USDC sale configuration', async () => {
    const collection = await createCollection()
    const prepared = await request(app)
      .post(`/v1/collections/${collection.id}/sale-config/intent`)
      .send({ ownerAddress, priceAtomic: '250000' })
      .expect(201)
    expect(prepared.body.intent).toMatchObject({
      serializedTransaction: 'prepared-sale-config',
      requiredSigners: [ownerAddress],
    })

    const submitted = await request(app)
      .post(`/v1/collections/${collection.id}/sale-config/submit`)
      .send({
        preparedTransaction: 'prepared-sale-config',
        signedTransaction: 'signed-sale-config',
      })
      .expect(201)
    expect(submitted.body.transaction.transactionHash).toBe('sale-config-hash')

    await request(app)
      .post(`/v1/collections/${collection.id}/sale-config/intent`)
      .send({ ownerAddress: buyerAddress, priceAtomic: '250000' })
      .expect(403)
  })

  it('prepares and submits creator mint transactions', async () => {
    const collection = await createCollection()
    const prepared = await request(app)
      .post(`/v1/collections/${collection.id}/mints/intent`)
      .send({
        operatorAddress: ownerAddress,
        recipientAddress: buyerAddress,
        tokenId: 42,
      })
      .expect(201)
    expect(prepared.body.intent).toMatchObject({
      serializedTransaction: 'prepared-mint',
      requiredSigners: [ownerAddress],
      tokenId: 42,
    })

    const submitted = await request(app)
      .post(`/v1/collections/${collection.id}/mints/submit`)
      .send({
        preparedTransaction: 'prepared-mint',
        signedTransaction: 'signed-mint',
      })
      .expect(201)
    expect(submitted.body.transaction).toMatchObject({
      transactionHash: 'mint-hash',
      status: 'confirmed',
    })
  })

  it('auto-allocates token IDs when mint and checkout omit tokenId', async () => {
    const collection = await createCollection()

    const mintA = await request(app)
      .post(`/v1/collections/${collection.id}/mints/intent`)
      .send({
        operatorAddress: ownerAddress,
        recipientAddress: buyerAddress,
      })
      .expect(201)
    expect(mintA.body.intent.tokenId).toBe(1)

    const mintB = await request(app)
      .post(`/v1/collections/${collection.id}/mints/intent`)
      .send({
        operatorAddress: ownerAddress,
        recipientAddress: buyerAddress,
      })
      .expect(201)
    expect(mintB.body.intent.tokenId).toBe(2)

    const checkout = await request(app)
      .post('/v1/public/checkout/intents')
      .set('Idempotency-Key', 'auto-token-checkout')
      .send({ collectionId: collection.id, buyerAddress })
      .expect(201)
    expect(checkout.body.intent.tokenId).toBe(3)

    const inventory = await request(app)
      .get(`/v1/public/collections/${collection.id}/tokens`)
      .expect(200)
    // Counter advanced even though mints were only prepared (not submitted).
    expect(inventory.body.nextTokenId).toBeGreaterThanOrEqual(4)
  })

  it('accepts local sponsor-owned sale configuration that is auto-submitted', async () => {
    const collection = await createCollection()
    chain.autoSubmitSaleConfig = true

    const prepared = await request(app)
      .post(`/v1/collections/${collection.id}/sale-config/intent`)
      .send({ ownerAddress, priceAtomic: '250000' })
      .expect(201)

    expect(prepared.body.intent).toMatchObject({
      serializedTransaction: 'prepared-sale-config',
      requiredSigners: [],
      autoSubmitted: {
        transactionHash: 'sale-config-auto-hash',
        status: 'confirmed',
      },
    })
    await expect(repository.getCollection(collection.id)).resolves.toMatchObject({
      primarySale: {
        paymentTokenAddress: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
        priceAtomic: '250000',
        transactionHash: 'sale-config-auto-hash',
      },
    })
  })

  it('makes intent creation idempotent and rejects key reuse for another item', async () => {
    const collection = await createCollection()
    const payload = { collectionId: collection.id, buyerAddress, tokenId: 7 }
    const first = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'checkout-7')
      .send(payload)
      .expect(201)
    const repeated = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'checkout-7')
      .send(payload)
      .expect(201)

    expect(repeated.body.intent.id).toBe(first.body.intent.id)
    await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'checkout-7')
      .send({ ...payload, tokenId: 8 })
      .expect(409)
  })

  it('rejects expired intents before chain submission', async () => {
    const collection = await createCollection()
    const created = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'expired-checkout')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 9 })
      .expect(201)

    now = new Date('2026-07-10T10:02:00.000Z')
    await request(app)
      .post(`/v1/checkout/intents/${String(created.body.intent.id)}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(410)
    expect(chain.submitCalls).toBe(0)
  })

  it('records failed submissions and prevents replay', async () => {
    const collection = await createCollection()
    const created = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'failed-checkout')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 10 })
      .expect(201)

    chain.submitFailure = new Error('rpc rejected transaction')
    const intentId = String(created.body.intent.id)
    await request(app)
      .post(`/v1/checkout/intents/${intentId}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(502)

    const status = await request(app)
      .get(`/v1/checkout/intents/${intentId}`)
      .expect(200)
    expect(status.body.intent.status).toBe('failed')

    await request(app)
      .post(`/v1/checkout/intents/${intentId}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(409)
    expect(chain.submitCalls).toBe(1)
  })

  it('tracks minted inventory, blocks sold tokens, and archives live collections', async () => {
    const collection = await createCollection()

    await request(app)
      .post(`/v1/collections/${collection.id}/mints/submit`)
      .send({
        preparedTransaction: 'prepared-mint',
        signedTransaction: 'signed-mint',
        tokenId: 7,
        ownerAddress,
      })
      .expect(201)

    const inventory = await request(app)
      .get(`/v1/collections/${collection.id}/items`)
      .expect(200)
    expect(inventory.body).toMatchObject({
      mintedCount: 1,
      nextTokenId: 8,
      items: [
        {
          tokenId: 7,
          ownerAddress,
          source: 'mint',
          transactionHash: 'mint-hash',
        },
      ],
    })

    const publicInventory = await request(app)
      .get(`/v1/public/collections/${collection.id}/tokens`)
      .expect(200)
    expect(publicInventory.body.nextTokenId).toBe(8)

    const tokenMeta = await request(app)
      .get(`/v1/public/collections/${collection.id}/tokens/7`)
      .expect(200)
    expect(tokenMeta.body.availability).toBe('sold')
    expect(tokenMeta.body.ownerAddress).toBe(ownerAddress)

    const sold = await request(app)
      .post('/v1/public/checkout/intents')
      .set('Idempotency-Key', 'sold-token')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 7 })
      .expect(409)
    expect(sold.body.error.code).toBe('token_already_minted')

    const archived = await request(app)
      .post(`/v1/collections/${collection.id}/archive`)
      .expect(200)
    expect(archived.body.collection.status).toBe('archived')

    await request(app)
      .get(`/v1/public/collections/${collection.id}`)
      .expect(404)

    const restored = await request(app)
      .post(`/v1/collections/${collection.id}/unarchive`)
      .expect(200)
    expect(restored.body.collection.status).toBe('live')
  })

  it('syncs on-chain ownership into inventory for pre-existing mints', async () => {
    const collection = await createCollection()
    chain.owners.set(`${'C'}${'A'.repeat(55)}:1`, buyerAddress)

    const meta = await request(app)
      .get(`/v1/public/collections/${collection.id}/tokens/1`)
      .expect(200)
    expect(meta.body).toMatchObject({
      availability: 'sold',
      ownerAddress: buyerAddress,
    })

    const inventory = await request(app)
      .get(`/v1/public/collections/${collection.id}/tokens`)
      .expect(200)
    expect(inventory.body.nextTokenId).toBe(2)
    expect(inventory.body.mintedCount).toBeGreaterThanOrEqual(1)
    const items = inventory.body.items as Array<{ tokenId: number }>
    expect(items.some((item) => item.tokenId === 1)).toBe(true)

    const blocked = await request(app)
      .post('/v1/public/checkout/intents')
      .set('Idempotency-Key', 'chain-synced-sold')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 1 })
      .expect(409)
    expect(blocked.body.error.code).toBe('token_already_minted')
  })

  it('submits one signed checkout and returns its transaction hash', async () => {
    const collection = await createCollection()
    const created = await request(app)
      .post('/v1/checkout/intents')
      .set('Idempotency-Key', 'successful-checkout')
      .send({ collectionId: collection.id, buyerAddress, tokenId: 11 })
      .expect(201)

    const intentId = String(created.body.intent.id)
    const submitted = await request(app)
      .post(`/v1/checkout/intents/${intentId}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(201)
    expect(submitted.body.intent).toMatchObject({
      status: 'confirmed',
      transactionHash: 'checkout-hash',
    })

    await request(app)
      .post(`/v1/checkout/intents/${intentId}/submit`)
      .send({ signedTransaction: 'signed' })
      .expect(409)
  })
})
