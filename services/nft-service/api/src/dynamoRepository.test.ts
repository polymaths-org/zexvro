import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DynamoNftRepository } from './dynamoRepository.js'
import type { CheckoutIntentRecord, CollectionRecord, MintedItemRecord } from './domain.js'

const collection: CollectionRecord = {
  id: 'col-1',
  workspaceId: 'ws-1',
  name: 'Sky Forge',
  symbol: 'SKY',
  description: 'A collection of verifiable game items.',
  ownerAddress: 'G'.padEnd(56, 'A'),
  baseMetadataUri: 'https://api.example/tokens/',
  collectionMetadataUri: 'https://cdn.example/meta.json',
  coverImageUri: 'https://cdn.example/cover.png',
  royaltyRecipient: 'G'.padEnd(56, 'A'),
  royaltyBps: 500,
  status: 'live',
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z',
}

const intent: CheckoutIntentRecord = {
  id: 'intent-1',
  idempotencyKey: 'idem-1',
  collectionId: 'col-1',
  tokenId: 7,
  buyerAddress: 'G'.padEnd(56, 'B'),
  serializedTransaction: 'tx',
  requiredSigners: ['G'.padEnd(56, 'B')],
  status: 'pending_signature',
  expiresAt: '2026-07-13T01:00:00.000Z',
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z',
}

const minted: MintedItemRecord = {
  id: 'mint-1',
  collectionId: 'col-1',
  tokenId: 7,
  ownerAddress: 'G'.padEnd(56, 'B'),
  source: 'purchase',
  transactionHash: 'hash',
  mintedAt: '2026-07-13T00:30:00.000Z',
}

describe('DynamoNftRepository', () => {
  let send: ReturnType<typeof vi.fn>
  let repository: DynamoNftRepository

  beforeEach(() => {
    send = vi.fn()
    repository = new DynamoNftRepository({
      tableName: 'zexvro-nft',
      region: 'us-east-1',
      client: { send } as never,
    })
  })

  it('lists collections by workspace GSI and strips key attributes', async () => {
    send.mockResolvedValueOnce({
      Items: [
        {
          pk: 'COLLECTION#col-1',
          sk: 'META',
          entityType: 'collection',
          gsi1pk: 'WORKSPACE#ws-1',
          gsi1sk: 'COLLECTION#2026-07-13T00:00:00.000Z#col-1',
          ...collection,
        },
      ],
    })

    const rows = await repository.listCollections('ws-1')
    expect(rows).toEqual([collection])
    expect(rows[0]).not.toHaveProperty('pk')
    expect(send).toHaveBeenCalledOnce()
  })

  it('saves collection with workspace index keys', async () => {
    send.mockResolvedValueOnce({})
    await repository.saveCollection(collection)
    const command = send.mock.calls[0]?.[0] as { input: { Item: Record<string, unknown> } }
    expect(command.input.Item).toMatchObject({
      pk: 'COLLECTION#col-1',
      sk: 'META',
      gsi1pk: 'WORKSPACE#ws-1',
      name: 'Sky Forge',
    })
  })

  it('claims checkout intents atomically and returns undefined on conflict', async () => {
    send.mockResolvedValueOnce({
      Attributes: {
        pk: 'CHECKOUT#intent-1',
        sk: 'META',
        ...intent,
        status: 'submitting',
        updatedAt: '2026-07-13T00:10:00.000Z',
      },
    })
    const claimed = await repository.claimCheckoutIntent(
      'intent-1',
      new Date('2026-07-13T00:10:00.000Z'),
    )
    expect(claimed?.status).toBe('submitting')

    send.mockRejectedValueOnce(
      new ConditionalCheckFailedException({ message: 'conflict', $metadata: {} }),
    )
    await expect(
      repository.claimCheckoutIntent('intent-1', new Date('2026-07-13T00:11:00.000Z')),
    ).resolves.toBeUndefined()
  })

  it('queries minted tokens under the collection partition', async () => {
    send.mockResolvedValueOnce({
      Items: [
        {
          pk: 'COLLECTION#col-1',
          sk: 'TOKEN#000000000007',
          entityType: 'minted',
          ...minted,
        },
      ],
    })
    const items = await repository.listMintedItems('col-1')
    expect(items).toEqual([minted])
  })

  it('finds checkout intents by idempotency GSI', async () => {
    send.mockResolvedValueOnce({
      Items: [
        {
          pk: 'CHECKOUT#intent-1',
          sk: 'META',
          entityType: 'checkout',
          gsi2pk: 'IDEMPOTENCY#idem-1',
          gsi2sk: 'CHECKOUT',
          ...intent,
        },
      ],
    })
    const found = await repository.findCheckoutIntentByIdempotencyKey('idem-1')
    expect(found).toEqual(intent)
  })
})
