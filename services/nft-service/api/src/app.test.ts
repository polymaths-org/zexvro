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
  submitCalls = 0

  async deployCollection(_input: CollectionDeploymentInput): Promise<DeploymentResult> {
    if (this.deployFailure !== undefined) throw this.deployFailure
    return {
      contractId: `C${'A'.repeat(55)}`,
      transactionHash: 'deployment-hash',
    }
  }

  async prepareMint(): Promise<PreparedContractCall> {
    if (this.prepareFailure !== undefined) throw this.prepareFailure
    return { serializedTransaction: 'prepared-mint', requiredSigners: [] }
  }

  async submitMint(): Promise<SubmissionResult> {
    if (this.submitFailure !== undefined) throw this.submitFailure
    return { transactionHash: 'mint-hash', status: 'confirmed' }
  }

  async prepareSaleConfig(input: {
    ownerAddress: string
  }): Promise<PreparedContractCall> {
    if (this.prepareFailure !== undefined) throw this.prepareFailure
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

  async getTransactionStatus(): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
    return 'confirmed'
  }
}

const ownerAddress = Keypair.random().publicKey()
const buyerAddress = Keypair.random().publicKey()

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
