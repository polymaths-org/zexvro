import type { D1Database } from '@cloudflare/workers-types'
import type {
  CollectionRecord,
  CheckoutIntentRecord,
  MintedItemRecord,
  NftRepository,
  NftPage,
} from './domain.js'
const read = <T>(row: { data: string } | null): T | undefined =>
  row ? (JSON.parse(row.data) as T) : undefined
export class D1NftRepository implements NftRepository {
  readonly countersAreAuthoritative = true
  constructor(private readonly db: D1Database) {}
  async listCollections(
    workspaceId: string,
    page: NftPage = {},
  ): Promise<CollectionRecord[]> {
    const rows = await this.db
      .prepare(
        'SELECT data FROM nft_collections INDEXED BY nft_workspace WHERE workspace_scope=? AND id>? ORDER BY id LIMIT ?',
      )
      .bind(
        workspaceId,
        String(page.cursor || ''),
        Math.min(101, Math.max(1, page.limit || 100)),
      )
      .all<{ data: string }>()
    return rows.results.map((row) => JSON.parse(row.data) as CollectionRecord)
  }
  async getCollection(id: string) {
    return read<CollectionRecord>(
      await this.db
        .prepare('SELECT data FROM nft_collections WHERE id=?')
        .bind(id)
        .first<{ data: string }>(),
    )
  }
  async saveCollection(collection: CollectionRecord) {
    await this.db
      .prepare(
        'INSERT INTO nft_collections(id,workspace_scope,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET workspace_scope=excluded.workspace_scope,data=excluded.data WHERE nft_collections.data<>excluded.data',
      )
      .bind(collection.id, collection.workspaceId, JSON.stringify(collection))
      .run()
  }
  async deleteCollection(id: string) {
    return (
      (
        await this.db
          .prepare('DELETE FROM nft_collections WHERE id=?')
          .bind(id)
          .run()
      ).meta.changes > 0
    )
  }
  async getCheckoutIntent(id: string) {
    return read<CheckoutIntentRecord>(
      await this.db
        .prepare('SELECT data FROM nft_checkout WHERE id=?')
        .bind(id)
        .first<{ data: string }>(),
    )
  }
  async findCheckoutIntentByIdempotencyKey(key: string) {
    return read<CheckoutIntentRecord>(
      await this.db
        .prepare('SELECT data FROM nft_checkout WHERE idempotency_key=?')
        .bind(key)
        .first<{ data: string }>(),
    )
  }
  async saveCheckoutIntent(intent: CheckoutIntentRecord) {
    await this.db
      .prepare(
        'INSERT INTO nft_checkout(id,collection_id,idempotency_key,status,expires_at,data) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,expires_at=excluded.expires_at,data=excluded.data WHERE nft_checkout.data<>excluded.data',
      )
      .bind(
        intent.id,
        intent.collectionId,
        intent.idempotencyKey,
        intent.status,
        intent.expiresAt,
        JSON.stringify(intent),
      )
      .run()
  }
  async claimCheckoutIntent(id: string, now: Date) {
    return read<CheckoutIntentRecord>(
      await this.db
        .prepare(
          "UPDATE nft_checkout SET status='submitting',data=json_set(data,'$.status','submitting','$.updatedAt',?) WHERE id=? AND status='pending_signature' AND expires_at>? RETURNING data",
        )
        .bind(now.toISOString(), id, now.toISOString())
        .first<{ data: string }>(),
    )
  }
  async listMintedItems(
    collectionId: string,
    page: NftPage = {},
  ): Promise<MintedItemRecord[]> {
    const rows = await this.db
      .prepare(
        'SELECT data FROM nft_minted WHERE collection_id=? AND token_id>? ORDER BY token_id LIMIT ?',
      )
      .bind(
        collectionId,
        page.cursor === undefined ? -1 : Number(page.cursor),
        Math.min(101, Math.max(1, page.limit || 100)),
      )
      .all<{ data: string }>()
    return rows.results.map((row) => JSON.parse(row.data) as MintedItemRecord)
  }
  async getMintedItem(collectionId: string, tokenId: number) {
    return read<MintedItemRecord>(
      await this.db
        .prepare(
          'SELECT data FROM nft_minted WHERE collection_id=? AND token_id=?',
        )
        .bind(collectionId, tokenId)
        .first<{ data: string }>(),
    )
  }
  async saveMintedItem(item: MintedItemRecord) {
    await this.db.batch([
      this.db
        .prepare(
          'INSERT INTO nft_minted(collection_id,token_id,data) VALUES(?,?,?) ON CONFLICT(collection_id,token_id) DO UPDATE SET data=excluded.data WHERE nft_minted.data<>excluded.data',
        )
        .bind(item.collectionId, item.tokenId, JSON.stringify(item)),
      this.db
        .prepare(
          'UPDATE nft_collections SET counter=? WHERE id=? AND counter<?',
        )
        .bind(item.tokenId, item.collectionId, item.tokenId),
    ])
  }
  async allocateNextTokenId(collectionId: string) {
    const row = await this.db
      .prepare(
        'UPDATE nft_collections SET counter=counter+1 WHERE id=? AND counter<4294967295 RETURNING counter',
      )
      .bind(collectionId)
      .first<{ counter: number }>()
    if (!row) throw new Error('Collection missing or token IDs exhausted')
    return row.counter
  }
  async countMintedItems(collectionId: string) {
    return (
      (
        await this.db
          .prepare('SELECT minted_count FROM nft_collections WHERE id=?')
          .bind(collectionId)
          .first<{ minted_count: number }>()
      )?.minted_count ?? 0
    )
  }
  async getTokenCounter(collectionId: string) {
    return (
      (
        await this.db
          .prepare('SELECT counter FROM nft_collections WHERE id=?')
          .bind(collectionId)
          .first<{ counter: number }>()
      )?.counter ?? 0
    )
  }
}
