import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  CheckoutIntentRecord,
  CollectionRecord,
  MintedItemRecord,
  NftRepository,
  RepositoryState,
} from './domain.js'

const emptyState = (): RepositoryState => ({
  version: 1,
  collections: [],
  checkoutIntents: [],
  mintedItems: [],
})

export class InMemoryNftRepository implements NftRepository {
  protected state: RepositoryState

  constructor(initialState: RepositoryState = emptyState()) {
    this.state = {
      ...emptyState(),
      ...structuredClone(initialState),
      mintedItems: structuredClone(initialState.mintedItems ?? []),
    }
  }

  async listCollections(workspaceId: string): Promise<CollectionRecord[]> {
    return structuredClone(
      this.state.collections.filter((collection) => collection.workspaceId === workspaceId),
    )
  }

  async getCollection(id: string): Promise<CollectionRecord | undefined> {
    const collection = this.state.collections.find((entry) => entry.id === id)
    return collection === undefined ? undefined : structuredClone(collection)
  }

  async saveCollection(collection: CollectionRecord): Promise<void> {
    const index = this.state.collections.findIndex((entry) => entry.id === collection.id)
    if (index === -1) {
      this.state.collections.push(structuredClone(collection))
    } else {
      this.state.collections[index] = structuredClone(collection)
    }
    await this.afterMutation()
  }

  async deleteCollection(id: string): Promise<boolean> {
    const nextCollections = this.state.collections.filter(
      (collection) => collection.id !== id,
    )
    if (nextCollections.length === this.state.collections.length) return false
    this.state.collections = nextCollections
    await this.afterMutation()
    return true
  }

  async getCheckoutIntent(id: string): Promise<CheckoutIntentRecord | undefined> {
    const intent = this.state.checkoutIntents.find((entry) => entry.id === id)
    return intent === undefined ? undefined : structuredClone(intent)
  }

  async findCheckoutIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CheckoutIntentRecord | undefined> {
    const intent = this.state.checkoutIntents.find(
      (entry) => entry.idempotencyKey === idempotencyKey,
    )
    return intent === undefined ? undefined : structuredClone(intent)
  }

  async saveCheckoutIntent(intent: CheckoutIntentRecord): Promise<void> {
    const index = this.state.checkoutIntents.findIndex((entry) => entry.id === intent.id)
    if (index === -1) {
      this.state.checkoutIntents.push(structuredClone(intent))
    } else {
      this.state.checkoutIntents[index] = structuredClone(intent)
    }
    await this.afterMutation()
  }

  async claimCheckoutIntent(
    id: string,
    now: Date,
  ): Promise<CheckoutIntentRecord | undefined> {
    const index = this.state.checkoutIntents.findIndex((entry) => entry.id === id)
    const intent = this.state.checkoutIntents[index]
    if (
      intent === undefined ||
      intent.status !== 'pending_signature' ||
      new Date(intent.expiresAt).getTime() <= now.getTime()
    ) {
      return undefined
    }

    const claimed: CheckoutIntentRecord = {
      ...intent,
      status: 'submitting',
      updatedAt: now.toISOString(),
    }
    this.state.checkoutIntents[index] = claimed
    await this.afterMutation()
    return structuredClone(claimed)
  }

  async listMintedItems(collectionId: string): Promise<MintedItemRecord[]> {
    return structuredClone(
      this.state.mintedItems
        .filter((item) => item.collectionId === collectionId)
        .sort((left, right) => left.tokenId - right.tokenId),
    )
  }

  async getMintedItem(
    collectionId: string,
    tokenId: number,
  ): Promise<MintedItemRecord | undefined> {
    const item = this.state.mintedItems.find(
      (entry) => entry.collectionId === collectionId && entry.tokenId === tokenId,
    )
    return item === undefined ? undefined : structuredClone(item)
  }

  async saveMintedItem(item: MintedItemRecord): Promise<void> {
    const index = this.state.mintedItems.findIndex(
      (entry) =>
        entry.collectionId === item.collectionId && entry.tokenId === item.tokenId,
    )
    if (index === -1) {
      this.state.mintedItems.push(structuredClone(item))
    } else {
      this.state.mintedItems[index] = structuredClone(item)
    }
    await this.afterMutation()
  }

  protected async afterMutation(): Promise<void> {}
}

export class FileNftRepository extends InMemoryNftRepository {
  private writeQueue = Promise.resolve()

  private constructor(
    private readonly filePath: string,
    state: RepositoryState,
  ) {
    super(state)
  }

  static async open(filePath: string): Promise<FileNftRepository> {
    let state = emptyState()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as RepositoryState
      if (parsed.version !== 1) {
        throw new Error(`Unsupported NFT repository version: ${String(parsed.version)}`)
      }
      state = {
        ...emptyState(),
        ...parsed,
        mintedItems: parsed.mintedItems ?? [],
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        throw error
      }
    }

    return new FileNftRepository(filePath, state)
  }

  protected override async afterMutation(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2)
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`
      await writeFile(temporaryPath, snapshot, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.filePath)
    })
    await this.writeQueue
  }
}
