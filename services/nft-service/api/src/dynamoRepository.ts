import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type {
  CheckoutIntentRecord,
  CollectionRecord,
  MintedItemRecord,
  NftRepository,
} from './domain.js'

export interface DynamoNftRepositoryOptions {
  tableName: string
  region: string
  workspaceIndexName?: string
  idempotencyIndexName?: string
  client?: DynamoDBDocumentClient
  clientConfig?: DynamoDBClientConfig
}

function tokenSortKey(tokenId: number): string {
  return `TOKEN#${String(tokenId).padStart(12, '0')}`
}

function collectionItem(collection: CollectionRecord) {
  return {
    pk: `COLLECTION#${collection.id}`,
    sk: 'META',
    entityType: 'collection',
    gsi1pk: `WORKSPACE#${collection.workspaceId}`,
    gsi1sk: `COLLECTION#${collection.createdAt}#${collection.id}`,
    ...collection,
  }
}

function checkoutItem(intent: CheckoutIntentRecord) {
  return {
    pk: `CHECKOUT#${intent.id}`,
    sk: 'META',
    entityType: 'checkout',
    gsi2pk: `IDEMPOTENCY#${intent.idempotencyKey}`,
    gsi2sk: 'CHECKOUT',
    ...intent,
  }
}

function mintedItemRecord(item: MintedItemRecord) {
  return {
    pk: `COLLECTION#${item.collectionId}`,
    sk: tokenSortKey(item.tokenId),
    entityType: 'minted',
    ...item,
  }
}

const KEY_FIELDS = new Set([
  'pk',
  'sk',
  'gsi1pk',
  'gsi1sk',
  'gsi2pk',
  'gsi2sk',
  'entityType',
])

function stripKeys<T>(item: Record<string, unknown>): T {
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(item)) {
    if (!KEY_FIELDS.has(key)) rest[key] = value
  }
  return rest as T
}

export class DynamoNftRepository implements NftRepository {
  private readonly client: DynamoDBDocumentClient
  private readonly tableName: string
  private readonly workspaceIndexName: string
  private readonly idempotencyIndexName: string

  constructor(options: DynamoNftRepositoryOptions) {
    this.tableName = options.tableName
    this.workspaceIndexName = options.workspaceIndexName ?? 'workspace-index'
    this.idempotencyIndexName = options.idempotencyIndexName ?? 'idempotency-index'
    this.client =
      options.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient({
          region: options.region,
          ...(options.clientConfig ?? {}),
        }),
        {
          marshallOptions: { removeUndefinedValues: true },
        },
      )
  }

  async listCollections(workspaceId: string): Promise<CollectionRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.workspaceIndexName,
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `WORKSPACE#${workspaceId}`,
        },
      }),
    )
    return (response.Items ?? []).map((item) =>
      stripKeys<CollectionRecord>(item as Record<string, unknown>),
    )
  }

  async getCollection(id: string): Promise<CollectionRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `COLLECTION#${id}`, sk: 'META' },
      }),
    )
    if (response.Item === undefined) return undefined
    return stripKeys<CollectionRecord>(response.Item as Record<string, unknown>)
  }

  async saveCollection(collection: CollectionRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: collectionItem(collection),
      }),
    )
  }

  async deleteCollection(id: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: `COLLECTION#${id}`, sk: 'META' },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      )
      return true
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false
      throw error
    }
  }

  async getCheckoutIntent(id: string): Promise<CheckoutIntentRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `CHECKOUT#${id}`, sk: 'META' },
      }),
    )
    if (response.Item === undefined) return undefined
    return stripKeys<CheckoutIntentRecord>(response.Item as Record<string, unknown>)
  }

  async findCheckoutIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CheckoutIntentRecord | undefined> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.idempotencyIndexName,
        KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `IDEMPOTENCY#${idempotencyKey}`,
          ':sk': 'CHECKOUT',
        },
        Limit: 1,
      }),
    )
    const item = response.Items?.[0]
    if (item === undefined) return undefined
    return stripKeys<CheckoutIntentRecord>(item as Record<string, unknown>)
  }

  async saveCheckoutIntent(intent: CheckoutIntentRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: checkoutItem(intent),
      }),
    )
  }

  async claimCheckoutIntent(
    id: string,
    now: Date,
  ): Promise<CheckoutIntentRecord | undefined> {
    const updatedAt = now.toISOString()
    try {
      const response = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: `CHECKOUT#${id}`, sk: 'META' },
          UpdateExpression: 'SET #status = :submitting, updatedAt = :updatedAt',
          ConditionExpression:
            'attribute_exists(pk) AND #status = :pending AND expiresAt > :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':submitting': 'submitting',
            ':pending': 'pending_signature',
            ':updatedAt': updatedAt,
            ':now': updatedAt,
          },
          ReturnValues: 'ALL_NEW',
        }),
      )
      if (response.Attributes === undefined) return undefined
      return stripKeys<CheckoutIntentRecord>(
        response.Attributes as Record<string, unknown>,
      )
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return undefined
      throw error
    }
  }

  async listMintedItems(collectionId: string): Promise<MintedItemRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `COLLECTION#${collectionId}`,
          ':prefix': 'TOKEN#',
        },
      }),
    )
    return (response.Items ?? []).map((item) =>
      stripKeys<MintedItemRecord>(item as Record<string, unknown>),
    )
  }

  async getMintedItem(
    collectionId: string,
    tokenId: number,
  ): Promise<MintedItemRecord | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `COLLECTION#${collectionId}`,
          sk: tokenSortKey(tokenId),
        },
      }),
    )
    if (response.Item === undefined) return undefined
    return stripKeys<MintedItemRecord>(response.Item as Record<string, unknown>)
  }

  async saveMintedItem(item: MintedItemRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: mintedItemRecord(item),
      }),
    )
  }
}
