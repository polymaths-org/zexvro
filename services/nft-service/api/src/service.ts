import { randomUUID } from 'node:crypto'
import type {
  CheckoutIntentRecord,
  CollectionRecord,
  NftChainGateway,
  NftRepository,
  PinningService,
  PreparedContractCall,
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

const DEFAULT_TESTNET_USDC_CONTRACT =
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

export class NftService {
  constructor(
    private readonly repository: NftRepository,
    private readonly pinning: PinningService,
    private readonly chain: NftChainGateway,
    private readonly checkoutTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly paymentTokenAddress: string = DEFAULT_TESTNET_USDC_CONTRACT,
    private readonly localMetadataBaseUrl?: string,
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
        'An IPFS token metadata directory is required for Pinata storage',
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
    }
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
    tokenId: number
  }): Promise<PreparedContractCall> {
    const collection = await this.requireLiveCollection(input.collectionId)
    const prepared = await this.chain.prepareMint({
      contractId: collection.contractId,
      operatorAddress: input.operatorAddress,
      recipientAddress: input.recipientAddress,
      tokenId: input.tokenId,
    })
    if (!prepared.requiredSigners.includes(input.operatorAddress)) {
      throw new ApiError(
        502,
        'minter_authorization_missing',
        'The simulated mint did not require the selected minter authorization',
      )
    }
    return prepared
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
    if (!prepared.requiredSigners.includes(input.ownerAddress)) {
      throw new ApiError(
        502,
        'owner_authorization_missing',
        'The simulated sale configuration did not require owner authorization',
      )
    }
    return prepared
  }

  async submitSaleConfig(input: {
    collectionId: string
    preparedTransaction: string
    signedTransaction: string
  }) {
    const collection = await this.requireLiveCollection(input.collectionId)
    return this.chain.submitSaleConfig({
      contractId: collection.contractId,
      expectedSerializedTransaction: input.preparedTransaction,
      serializedTransaction: input.signedTransaction,
    })
  }

  async submitMint(input: {
    collectionId: string
    preparedTransaction: string
    signedTransaction: string
  }) {
    const collection = await this.requireLiveCollection(input.collectionId)
    return this.chain.submitMint({
      contractId: collection.contractId,
      expectedSerializedTransaction: input.preparedTransaction,
      serializedTransaction: input.signedTransaction,
    })
  }

  async createCheckoutIntent(input: {
    idempotencyKey: string
    collectionId: string
    buyerAddress: string
    tokenId: number
  }): Promise<CheckoutIntentRecord> {
    const existing = await this.repository.findCheckoutIntentByIdempotencyKey(
      input.idempotencyKey,
    )
    if (existing !== undefined) {
      if (
        existing.collectionId !== input.collectionId ||
        existing.buyerAddress !== input.buyerAddress ||
        existing.tokenId !== input.tokenId
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
    const prepared = await this.chain.prepareCheckout({
      contractId: collection.contractId,
      buyerAddress: input.buyerAddress,
      tokenId: input.tokenId,
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
      tokenId: input.tokenId,
      buyerAddress: input.buyerAddress,
      serializedTransaction: prepared.serializedTransaction,
      requiredSigners: prepared.requiredSigners,
      status: 'pending_signature',
      expiresAt: new Date(
        createdAt.getTime() + this.checkoutTtlSeconds * 1_000,
      ).toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
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
      const confirmed: CheckoutIntentRecord = {
        ...claimed,
        status: 'confirmed',
        transactionHash: result.transactionHash,
        updatedAt: this.now().toISOString(),
      }
      await this.repository.saveCheckoutIntent(confirmed)
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

  private async requireLiveCollection(
    id: string,
  ): Promise<CollectionRecord & { contractId: string }> {
    const collection = await this.getCollection(id)
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
