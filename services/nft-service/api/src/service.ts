import { randomUUID } from 'node:crypto'
import type {
  CheckoutIntentRecord,
  CollectionRecord,
  MintedItemRecord,
  MintedItemSource,
  NftChainGateway,
  NftRepository,
  PinningService,
  PreparedContractCall,
  SubmissionResult,
} from './domain.js'
import { ApiError } from './errors.js'

export interface CreateCollectionInput {
  workspaceId: string
  name: string
  symbol: string
  description: string
  ownerAddress: string
  baseMetadataUri?: string | undefined
  coverImageUri: string
  royaltyRecipient: string
  royaltyBps: number
  externalUrl?: string | undefined
}

type EditableCollectionFields = Pick<
  CreateCollectionInput,
  | 'name'
  | 'symbol'
  | 'description'
  | 'ownerAddress'
  | 'baseMetadataUri'
  | 'coverImageUri'
  | 'royaltyRecipient'
  | 'royaltyBps'
  | 'externalUrl'
>

export type UpdateFailedCollectionInput = {
  [Key in keyof EditableCollectionFields]?: EditableCollectionFields[Key] | undefined
}

interface CollectionMetadataInput {
  name: string
  symbol: string
  description: string
  coverImageUri: string
  baseMetadataUri: string
  royaltyRecipient: string
  royaltyBps: number
  externalUrl?: string
}

/** Native XLM SAC on Stellar testnet (no trustline). */
const DEFAULT_TESTNET_PAYMENT_TOKEN =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

export type CreditTopupHooks = {
  platformCreditsUrl?: string
  platformInternalSecret?: string
  creditCollectionIds?: string[]
  defaultZcrAmount?: number
}

export class NftService {
  constructor(
    private readonly repository: NftRepository,
    private readonly pinning: PinningService,
    private readonly chain: NftChainGateway,
    private readonly checkoutTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly paymentTokenAddress: string = DEFAULT_TESTNET_PAYMENT_TOKEN,
    private readonly localMetadataBaseUrl?: string,
    private readonly creditHooks: CreditTopupHooks = {},
  ) {}

  async uploadMedia(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }) {
    return this.pinning.pinFile(input)
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
    const id = randomUUID()
    const baseMetadataUri =
      input.baseMetadataUri ??
      (this.localMetadataBaseUrl === undefined
        ? undefined
        : `${this.localMetadataBaseUrl.replace(/\/$/, '')}/v1/public/collections/${id}/tokens/`)
    if (baseMetadataUri === undefined) {
      throw new ApiError(
        400,
        'base_metadata_uri_required',
        'A token metadata base URI ending with / is required for this storage mode',
      )
    }
    const pinnedMetadata = await this.pinCollectionMetadata({
      name: input.name,
      symbol: input.symbol,
      description: input.description,
      coverImageUri: input.coverImageUri,
      baseMetadataUri,
      royaltyRecipient: input.royaltyRecipient,
      royaltyBps: input.royaltyBps,
      ...(input.externalUrl === undefined ? {} : { externalUrl: input.externalUrl }),
    })

    const timestamp = this.now().toISOString()
    let collection: CollectionRecord = {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      symbol: input.symbol,
      description: input.description,
      ownerAddress: input.ownerAddress,
      baseMetadataUri,
      collectionMetadataUri: pinnedMetadata.uri,
      coverImageUri: input.coverImageUri,
      royaltyRecipient: input.royaltyRecipient,
      royaltyBps: input.royaltyBps,
      ...(input.externalUrl === undefined ? {} : { externalUrl: input.externalUrl }),
      status: 'deploying',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.saveCollection(collection)

    try {
      const deployment = await this.chain.deployCollection({
        ownerAddress: input.ownerAddress,
        name: input.name,
        symbol: input.symbol,
        baseMetadataUri,
        royaltyRecipient: input.royaltyRecipient,
        royaltyBps: input.royaltyBps,
      })
      collection = {
        ...collection,
        status: 'live',
        contractId: deployment.contractId,
        deploymentTxHash: deployment.transactionHash,
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCollection(collection)
      return collection
    } catch (error) {
      collection = {
        ...collection,
        status: 'failed',
        failureReason: this.safeFailureReason(error),
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCollection(collection)
      if (error instanceof ApiError) throw error
      throw new ApiError(
        502,
        'collection_deployment_failed',
        'The collection metadata was pinned, but Stellar deployment failed',
        { collectionId: id },
      )
    }
  }

  listCollections(workspaceId: string): Promise<CollectionRecord[]> {
    return this.repository.listCollections(workspaceId)
  }

  /** Re-key workspace scope (e.g. legacy per-user → shared team scope). */
  async rekeyCollectionWorkspace(
    collectionId: string,
    nextWorkspaceId: string,
  ): Promise<CollectionRecord> {
    const collection = await this.getCollection(collectionId)
    if (collection.workspaceId === nextWorkspaceId) return collection
    const updated: CollectionRecord = {
      ...collection,
      workspaceId: nextWorkspaceId,
      updatedAt: this.now().toISOString(),
    }
    await this.repository.saveCollection(updated)
    return updated
  }

  async getCollection(id: string): Promise<CollectionRecord> {
    const collection = await this.repository.getCollection(id)
    if (collection === undefined) {
      throw new ApiError(404, 'collection_not_found', 'Collection not found')
    }
    return collection
  }

  async getPublicTokenMetadata(id: string, tokenId: number) {
    const collection = await this.getCollection(id)
    if (collection.status !== 'live') {
      throw new ApiError(404, 'collection_not_found', 'Collection not found')
    }
    const minted = await this.resolveMintedItem(collection, tokenId)
    return {
      name: `${collection.name} #${String(tokenId)}`,
      description: collection.description,
      image: collection.coverImageUri,
      ...(collection.externalUrl === undefined
        ? {}
        : { external_url: collection.externalUrl }),
      collection: {
        name: collection.name,
        symbol: collection.symbol,
      },
      attributes: [
        { trait_type: 'Collection', value: collection.name },
        { trait_type: 'Token ID', value: tokenId },
      ],
      availability: minted === undefined ? 'available' : 'sold',
      ...(minted === undefined
        ? {}
        : {
            ownerAddress: minted.ownerAddress,
            source: minted.source,
            transactionHash: minted.transactionHash,
            mintedAt: minted.mintedAt,
          }),
    }
  }

  async listMintedItems(collectionId: string): Promise<MintedItemRecord[]> {
    await this.getCollection(collectionId)
    return this.repository.listMintedItems(collectionId)
  }

  async getMintedItem(
    collectionId: string,
    tokenId: number,
  ): Promise<MintedItemRecord | undefined> {
    const collection = await this.getCollection(collectionId)
    return this.resolveMintedItem(collection, tokenId)
  }

  async suggestNextTokenId(collectionId: string): Promise<number> {
    const collection = await this.getCollection(collectionId)
    const items = await this.repository.listMintedItems(collectionId)
    const counter = await this.repository.getTokenCounter(collectionId)
    let candidate = items.length === 0 ? 1 : Math.max(...items.map((item) => item.tokenId)) + 1
    // Respect reserved IDs from prior auto-allocations (mint/checkout prepare).
    candidate = Math.max(candidate, counter + 1)
    if (collection.contractId === undefined) return candidate

    // Walk forward until chain agrees the token is free (covers pre-inventory mints).
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const owner = await this.chain.getTokenOwner({
        contractId: collection.contractId,
        tokenId: candidate,
      })
      if (owner === undefined) return candidate
      await this.recordMintedItem({
        collectionId,
        tokenId: candidate,
        ownerAddress: owner,
        source: 'purchase',
        transactionHash: `on-chain-sync:${collection.contractId}:${candidate}`,
      })
      candidate += 1
    }
    return candidate
  }

  async archiveCollection(id: string): Promise<CollectionRecord> {
    const collection = await this.getCollection(id)
    if (collection.status !== 'live') {
      throw new ApiError(
        409,
        'collection_not_archivable',
        'Only live collections can be archived',
        { status: collection.status },
      )
    }
    const archived: CollectionRecord = {
      ...collection,
      status: 'archived',
      updatedAt: this.now().toISOString(),
    }
    await this.repository.saveCollection(archived)
    return archived
  }

  async unarchiveCollection(id: string): Promise<CollectionRecord> {
    const collection = await this.getCollection(id)
    if (collection.status !== 'archived') {
      throw new ApiError(
        409,
        'collection_not_archived',
        'Only archived collections can be restored',
        { status: collection.status },
      )
    }
    if (collection.contractId === undefined) {
      throw new ApiError(
        409,
        'collection_not_live',
        'Archived collection is missing its contract identifier',
      )
    }
    const restored: CollectionRecord = {
      ...collection,
      status: 'live',
      updatedAt: this.now().toISOString(),
    }
    await this.repository.saveCollection(restored)
    return restored
  }

  async updateFailedCollection(
    id: string,
    input: UpdateFailedCollectionInput,
  ): Promise<CollectionRecord> {
    const collection = await this.getCollection(id)
    if (collection.status !== 'failed') {
      throw new ApiError(
        409,
        'collection_not_editable',
        'Only failed collection records can be edited before retry',
        { status: collection.status },
      )
    }

    const nextExternalUrl =
      Object.hasOwn(input, 'externalUrl') ? input.externalUrl : collection.externalUrl
    const metadataInput: CollectionMetadataInput = {
      name: input.name ?? collection.name,
      symbol: input.symbol ?? collection.symbol,
      description: input.description ?? collection.description,
      coverImageUri: input.coverImageUri ?? collection.coverImageUri,
      baseMetadataUri: input.baseMetadataUri ?? collection.baseMetadataUri,
      royaltyRecipient: input.royaltyRecipient ?? collection.royaltyRecipient,
      royaltyBps: input.royaltyBps ?? collection.royaltyBps,
      ...(nextExternalUrl === undefined ? {} : { externalUrl: nextExternalUrl }),
    }
    const pinnedMetadata = await this.pinCollectionMetadata(metadataInput)
    const updated: CollectionRecord = {
      ...collection,
      ...metadataInput,
      ownerAddress: input.ownerAddress ?? collection.ownerAddress,
      collectionMetadataUri: pinnedMetadata.uri,
      updatedAt: this.now().toISOString(),
    }
    delete updated.failureReason
    await this.repository.saveCollection(updated)
    return updated
  }

  async retryCollectionDeployment(id: string): Promise<CollectionRecord> {
    const existing = await this.getCollection(id)
    if (existing.status !== 'failed') {
      throw new ApiError(
        409,
        'collection_not_retryable',
        'Only failed collection deployments can be retried',
        { status: existing.status },
      )
    }

    const deploying: CollectionRecord = {
      ...existing,
      status: 'deploying',
      updatedAt: this.now().toISOString(),
    }
    delete deploying.failureReason
    await this.repository.saveCollection(deploying)

    try {
      const deployment = await this.chain.deployCollection({
        ownerAddress: deploying.ownerAddress,
        name: deploying.name,
        symbol: deploying.symbol,
        baseMetadataUri: deploying.baseMetadataUri,
        royaltyRecipient: deploying.royaltyRecipient,
        royaltyBps: deploying.royaltyBps,
      })
      const live: CollectionRecord = {
        ...deploying,
        status: 'live',
        contractId: deployment.contractId,
        deploymentTxHash: deployment.transactionHash,
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCollection(live)
      return live
    } catch (error) {
      const failed: CollectionRecord = {
        ...deploying,
        status: 'failed',
        failureReason: this.safeFailureReason(error),
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCollection(failed)
      if (error instanceof ApiError) throw error
      throw new ApiError(
        502,
        'collection_deployment_failed',
        'The collection deployment retry failed',
        { collectionId: id },
      )
    }
  }

  async deleteCollection(id: string): Promise<void> {
    const collection = await this.getCollection(id)
    if (collection.status !== 'failed') {
      throw new ApiError(
        409,
        'collection_delete_blocked',
        'Only failed collection records can be deleted. Live contracts remain on-chain.',
        { status: collection.status },
      )
    }
    await this.repository.deleteCollection(id)
  }

  async prepareMint(input: {
    collectionId: string
    operatorAddress: string
    recipientAddress: string
    tokenId?: number
  }): Promise<PreparedContractCall> {
    const collection = await this.requireLiveCollection(input.collectionId)
    const tokenId = await this.resolveTokenIdForWrite(collection.id, input.tokenId)
    const prepared = await this.chain.prepareMint({
      contractId: collection.contractId,
      operatorAddress: input.operatorAddress,
      recipientAddress: input.recipientAddress,
      tokenId,
    })
    if (!prepared.requiredSigners.includes(input.operatorAddress)) {
      throw new ApiError(
        502,
        'minter_authorization_missing',
        'The simulated mint did not require the selected minter authorization',
      )
    }
    return { ...prepared, tokenId }
  }

  async prepareSaleConfig(input: {
    collectionId: string
    ownerAddress: string
    price: bigint
  }): Promise<PreparedContractCall> {
    const collection = await this.requireLiveCollection(input.collectionId)
    if (input.ownerAddress !== collection.ownerAddress) {
      throw new ApiError(
        403,
        'collection_owner_required',
        'Only the collection owner can configure primary sales',
      )
    }
    const prepared = await this.chain.prepareSaleConfig({
      contractId: collection.contractId,
      ownerAddress: input.ownerAddress,
      paymentTokenAddress: this.paymentTokenAddress,
      price: input.price,
    })
    if (
      !prepared.requiredSigners.includes(input.ownerAddress) &&
      prepared.autoSubmitted === undefined
    ) {
      throw new ApiError(
        502,
        'owner_authorization_missing',
        'The simulated sale configuration did not require owner authorization',
      )
    }
    if (prepared.autoSubmitted !== undefined) {
      await this.markPrimarySaleConfigured(
        collection,
        input.price,
        prepared.autoSubmitted.transactionHash,
      )
    }
    return prepared
  }

  async submitSaleConfig(input: {
    collectionId: string
    preparedTransaction: string
    signedTransaction: string
    price: bigint
  }) {
    const collection = await this.requireLiveCollection(input.collectionId)
    // Idempotent: if sale already recorded at this price, return current state.
    if (
      collection.primarySale !== undefined &&
      collection.primarySale.priceAtomic === input.price.toString()
    ) {
      return {
        transactionHash: collection.primarySale.transactionHash,
        status: 'confirmed' as const,
        collection,
      }
    }
    const result = await this.chain.submitSaleConfig({
      contractId: collection.contractId,
      expectedSerializedTransaction: input.preparedTransaction,
      serializedTransaction: input.signedTransaction,
    })
    await this.markPrimarySaleConfigured(
      collection,
      input.price,
      result.transactionHash,
    )
    const updated = await this.repository.getCollection(collection.id)
    return {
      ...result,
      collection: updated ?? collection,
    }
  }

  async submitMint(input: {
    collectionId: string
    preparedTransaction: string
    signedTransaction: string
    tokenId?: number
    ownerAddress?: string
  }): Promise<SubmissionResult & { item?: MintedItemRecord }> {
    const collection = await this.requireLiveCollection(input.collectionId)
    if (input.tokenId !== undefined) {
      await this.assertTokenAvailable(collection.id, input.tokenId)
    }
    const result = await this.chain.submitMint({
      contractId: collection.contractId,
      expectedSerializedTransaction: input.preparedTransaction,
      serializedTransaction: input.signedTransaction,
    })
    const tokenId = input.tokenId ?? result.tokenId
    const ownerAddress = input.ownerAddress ?? result.ownerAddress
    if (tokenId === undefined || ownerAddress === undefined) {
      return result
    }
    const item = await this.recordMintedItem({
      collectionId: collection.id,
      tokenId,
      ownerAddress,
      source: 'mint',
      transactionHash: result.transactionHash,
    })
    return { ...result, item }
  }

  async createCheckoutIntent(input: {
    idempotencyKey: string
    collectionId: string
    buyerAddress: string
    tokenId?: number
    creditWorkspaceId?: string
    creditZcrAmount?: number
    creditPackId?: string
  }): Promise<CheckoutIntentRecord> {
    const existing = await this.repository.findCheckoutIntentByIdempotencyKey(
      input.idempotencyKey,
    )
    if (existing !== undefined) {
      if (
        existing.collectionId !== input.collectionId ||
        existing.buyerAddress !== input.buyerAddress ||
        (input.tokenId !== undefined && existing.tokenId !== input.tokenId)
      ) {
        throw new ApiError(
          409,
          'idempotency_conflict',
          'The idempotency key is already bound to another checkout',
        )
      }
      return existing
    }

    const collection = await this.requireLiveCollection(input.collectionId)
    const tokenId = await this.resolveTokenIdForWrite(collection.id, input.tokenId)
    const prepared = await this.chain.prepareCheckout({
      contractId: collection.contractId,
      buyerAddress: input.buyerAddress,
      tokenId,
    })
    if (!prepared.requiredSigners.includes(input.buyerAddress)) {
      throw new ApiError(
        502,
        'buyer_authorization_missing',
        'The simulated checkout did not require buyer authorization',
      )
    }

    const createdAt = this.now()
    const intent: CheckoutIntentRecord = {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      collectionId: input.collectionId,
      tokenId,
      buyerAddress: input.buyerAddress,
      serializedTransaction: prepared.serializedTransaction,
      requiredSigners: prepared.requiredSigners,
      status: 'pending_signature',
      expiresAt: new Date(
        createdAt.getTime() + this.checkoutTtlSeconds * 1_000,
      ).toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      ...(input.creditWorkspaceId
        ? {
            creditWorkspaceId: input.creditWorkspaceId,
            creditZcrAmount:
              input.creditZcrAmount ?? this.creditHooks.defaultZcrAmount ?? 100,
            creditPackId: input.creditPackId,
          }
        : {}),
    }
    await this.repository.saveCheckoutIntent(intent)
    return intent
  }

  async getCheckoutIntent(id: string): Promise<CheckoutIntentRecord> {
    const intent = await this.repository.getCheckoutIntent(id)
    if (intent === undefined) {
      throw new ApiError(404, 'checkout_intent_not_found', 'Checkout intent not found')
    }
    return intent
  }

  async submitCheckoutIntent(input: {
    intentId: string
    signedTransaction: string
  }): Promise<CheckoutIntentRecord> {
    const current = await this.getCheckoutIntent(input.intentId)
    const now = this.now()
    if (new Date(current.expiresAt).getTime() <= now.getTime()) {
      const expired: CheckoutIntentRecord = {
        ...current,
        status: 'failed',
        failureReason: 'expired',
        updatedAt: now.toISOString(),
      }
      await this.repository.saveCheckoutIntent(expired)
      throw new ApiError(410, 'checkout_intent_expired', 'Checkout intent has expired')
    }
    if (current.status !== 'pending_signature') {
      throw new ApiError(
        409,
        'checkout_intent_consumed',
        'Checkout intent has already been submitted',
        { status: current.status },
      )
    }

    const claimed = await this.repository.claimCheckoutIntent(input.intentId, now)
    if (claimed === undefined) {
      throw new ApiError(
        409,
        'checkout_intent_consumed',
        'Checkout intent is already being processed',
      )
    }

    const collection = await this.requireLiveCollection(claimed.collectionId)
    try {
      const result = await this.chain.submitCheckout({
        contractId: collection.contractId,
        expectedSerializedTransaction: claimed.serializedTransaction,
        serializedTransaction: input.signedTransaction,
      })
      await this.recordMintedItem({
        collectionId: collection.id,
        tokenId: claimed.tokenId,
        ownerAddress: claimed.buyerAddress,
        source: 'purchase',
        transactionHash: result.transactionHash,
      })
      const confirmed: CheckoutIntentRecord = {
        ...claimed,
        status: 'confirmed',
        transactionHash: result.transactionHash,
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCheckoutIntent(confirmed)
      await this.maybeGrantPlatformCredits(confirmed, collection)
      return confirmed
    } catch (error) {
      const failed: CheckoutIntentRecord = {
        ...claimed,
        status: 'failed',
        failureReason: this.safeFailureReason(error),
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCheckoutIntent(failed)
      if (error instanceof ApiError) throw error
      throw new ApiError(
        502,
        'checkout_submission_failed',
        'The signed checkout could not be submitted to Stellar',
      )
    }
  }

  private async maybeGrantPlatformCredits(
    intent: CheckoutIntentRecord,
    collection: CollectionRecord,
  ): Promise<void> {
    const url = this.creditHooks.platformCreditsUrl?.replace(/\/$/, '')
    const secret = this.creditHooks.platformInternalSecret
    if (!url || !secret) return

    const creditCollections = new Set(this.creditHooks.creditCollectionIds || [])
    const isCreditCollection =
      creditCollections.has(collection.id) ||
      /zcr|credit.?pack|platform.?credit/i.test(
        `${collection.name} ${collection.symbol} ${collection.description}`,
      )
    const workspaceId = intent.creditWorkspaceId
    const amount =
      intent.creditZcrAmount ?? this.creditHooks.defaultZcrAmount ?? 100
    if (!isCreditCollection) return
    if (!workspaceId || amount <= 0) {
      console.error(
        `[credits.topup] skipped checkout=${intent.id} collection=${collection.id}: missing creditWorkspaceId/amount (workspace=${workspaceId || 'none'} amount=${amount})`,
      )
      return
    }

    try {
      const res = await fetch(`${url}/api/internal/credits/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': secret,
        },
        body: JSON.stringify({
          workspaceId,
          amount,
          nftCheckoutId: intent.id,
          collectionId: collection.id,
          tokenId: intent.tokenId,
          txHash: intent.transactionHash,
          packId: intent.creditPackId,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(
          `[credits.topup] failed ${res.status} workspace=${workspaceId} amount=${amount}: ${text}`,
        )
      } else {
        console.log(
          `[credits.topup] ok workspace=${workspaceId} amount=${amount} checkout=${intent.id}`,
        )
      }
    } catch (err) {
      console.error('[credits.topup] network error', err)
    }
  }

  private async resolveMintedItem(
    collection: CollectionRecord,
    tokenId: number,
  ): Promise<MintedItemRecord | undefined> {
    const existing = await this.repository.getMintedItem(collection.id, tokenId)
    if (existing !== undefined) return existing
    if (collection.contractId === undefined) return undefined

    const owner = await this.chain.getTokenOwner({
      contractId: collection.contractId,
      tokenId,
    })
    if (owner === undefined) return undefined

    return this.recordMintedItem({
      collectionId: collection.id,
      tokenId,
      ownerAddress: owner,
      source: 'purchase',
      transactionHash: `on-chain-sync:${collection.contractId}:${tokenId}`,
    })
  }

  private async assertTokenAvailable(
    collectionId: string,
    tokenId: number,
  ): Promise<void> {
    const collection = await this.getCollection(collectionId)
    const existing = await this.resolveMintedItem(collection, tokenId)
    if (existing !== undefined) {
      throw new ApiError(
        409,
        'token_already_minted',
        'That token ID is already minted. Choose another token ID.',
        {
          tokenId,
          ownerAddress: existing.ownerAddress,
          transactionHash: existing.transactionHash,
        },
      )
    }
  }

  /**
   * Always-auto token IDs: omit tokenId → allocate next free ID.
   * Explicit tokenId still supported for advanced/API callers and is validated.
   */
  private async resolveTokenIdForWrite(
    collectionId: string,
    tokenId: number | undefined,
  ): Promise<number> {
    if (tokenId !== undefined) {
      if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 4_294_967_295) {
        throw new ApiError(
          400,
          'invalid_token_id',
          'Token ID must be an integer between 0 and 4294967295',
        )
      }
      await this.assertTokenAvailable(collectionId, tokenId)
      return tokenId
    }

    // Allocate then verify chain/inventory still free (handles pre-counter mints).
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = await this.repository.allocateNextTokenId(collectionId)
      try {
        await this.assertTokenAvailable(collectionId, candidate)
        return candidate
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'token_already_minted') {
          throw error
        }
      }
    }
    throw new ApiError(
      503,
      'token_allocation_exhausted',
      'Could not allocate a free token ID after several attempts',
    )
  }

  private async recordMintedItem(input: {
    collectionId: string
    tokenId: number
    ownerAddress: string
    source: MintedItemSource
    transactionHash: string
  }): Promise<MintedItemRecord> {
    const existing = await this.repository.getMintedItem(
      input.collectionId,
      input.tokenId,
    )
    if (existing !== undefined) {
      return existing
    }
    const item: MintedItemRecord = {
      id: randomUUID(),
      collectionId: input.collectionId,
      tokenId: input.tokenId,
      ownerAddress: input.ownerAddress,
      source: input.source,
      transactionHash: input.transactionHash,
      mintedAt: this.now().toISOString(),
    }
    await this.repository.saveMintedItem(item)
    return item
  }

  private async requireLiveCollection(
    id: string,
  ): Promise<CollectionRecord & { contractId: string }> {
    const collection = await this.getCollection(id)
    if (collection.status === 'archived') {
      throw new ApiError(
        409,
        'collection_archived',
        'Collection is archived. Restore it before minting, selling, or buying.',
        { status: collection.status },
      )
    }
    if (collection.status !== 'live' || collection.contractId === undefined) {
      throw new ApiError(
        409,
        'collection_not_live',
        'Collection must be live before this operation',
        { status: collection.status },
      )
    }
    return collection as CollectionRecord & { contractId: string }
  }

  private safeFailureReason(error: unknown): string {
    if (error instanceof ApiError) return error.code
    return error instanceof Error ? error.message.slice(0, 160) : 'unknown_error'
  }

  private async markPrimarySaleConfigured(
    collection: CollectionRecord,
    price: bigint,
    transactionHash: string,
  ): Promise<void> {
    const timestamp = this.now().toISOString()
    await this.repository.saveCollection({
      ...collection,
      primarySale: {
        paymentTokenAddress: this.paymentTokenAddress,
        priceAtomic: price.toString(),
        transactionHash,
        configuredAt: timestamp,
      },
      updatedAt: timestamp,
    })
  }

  private pinCollectionMetadata(input: CollectionMetadataInput) {
    return this.pinning.pinJson({
      filename: `${input.symbol.toLowerCase()}-collection.json`,
      value: {
        schema: 'https://zexvro.dev/schemas/nft-collection/v1',
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        image: input.coverImageUri,
        base_metadata_uri: input.baseMetadataUri,
        royalty: {
          recipient: input.royaltyRecipient,
          basis_points: input.royaltyBps,
          enforcement: 'marketplace-compatible-information',
        },
        ...(input.externalUrl === undefined
          ? {}
          : {
              external_url: input.externalUrl,
              properties: {
                zexvro: {
                  schema_version: 1,
                  gameplay_attributes: {
                    source: input.externalUrl,
                    mutable: true,
                  },
                },
              },
            }),
      },
    })
  }
}
