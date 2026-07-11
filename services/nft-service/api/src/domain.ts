export type CollectionStatus = 'deploying' | 'live' | 'failed'

export interface CollectionRecord {
  id: string
  workspaceId: string
  name: string
  symbol: string
  description: string
  ownerAddress: string
  baseMetadataUri: string
  collectionMetadataUri: string
  coverImageUri: string
  royaltyRecipient: string
  royaltyBps: number
  externalUrl?: string
  status: CollectionStatus
  contractId?: string
  deploymentTxHash?: string
  failureReason?: string
  primarySale?: {
    paymentTokenAddress: string
    priceAtomic: string
    transactionHash: string
    configuredAt: string
  }
  createdAt: string
  updatedAt: string
}

export type CheckoutStatus =
  | 'pending_signature'
  | 'submitting'
  | 'confirmed'
  | 'failed'

export interface CheckoutIntentRecord {
  id: string
  idempotencyKey: string
  collectionId: string
  tokenId: number
  buyerAddress: string
  serializedTransaction: string
  requiredSigners: string[]
  status: CheckoutStatus
  expiresAt: string
  createdAt: string
  updatedAt: string
  transactionHash?: string
  failureReason?: string
}

export interface DeploymentResult {
  contractId: string
  transactionHash: string
}

export interface PreparedContractCall {
  serializedTransaction: string
  requiredSigners: string[]
  autoSubmitted?: SubmissionResult
}

export interface SubmissionResult {
  transactionHash: string
  status: 'confirmed'
}

export interface CollectionDeploymentInput {
  ownerAddress: string
  name: string
  symbol: string
  baseMetadataUri: string
  royaltyRecipient: string
  royaltyBps: number
}

export interface NftChainGateway {
  deployCollection(input: CollectionDeploymentInput): Promise<DeploymentResult>
  prepareMint(input: {
    contractId: string
    operatorAddress: string
    recipientAddress: string
    tokenId: number
  }): Promise<PreparedContractCall>
  submitMint(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult>
  prepareSaleConfig(input: {
    contractId: string
    ownerAddress: string
    paymentTokenAddress: string
    price: bigint
  }): Promise<PreparedContractCall>
  submitSaleConfig(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult>
  prepareCheckout(input: {
    contractId: string
    buyerAddress: string
    tokenId: number
  }): Promise<PreparedContractCall>
  submitCheckout(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult>
  getTransactionStatus(transactionHash: string): Promise<
    'pending' | 'confirmed' | 'failed' | 'not_found'
  >
}

export interface PinnedAsset {
  cid: string
  uri: string
  size: number
  mimeType: string
}

export interface PinningService {
  pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset>
  pinJson(input: {
    value: Record<string, unknown>
    filename: string
  }): Promise<PinnedAsset>
}

export interface RepositoryState {
  version: 1
  collections: CollectionRecord[]
  checkoutIntents: CheckoutIntentRecord[]
}

export interface NftRepository {
  listCollections(workspaceId: string): Promise<CollectionRecord[]>
  getCollection(id: string): Promise<CollectionRecord | undefined>
  saveCollection(collection: CollectionRecord): Promise<void>
  deleteCollection(id: string): Promise<boolean>
  getCheckoutIntent(id: string): Promise<CheckoutIntentRecord | undefined>
  findCheckoutIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CheckoutIntentRecord | undefined>
  saveCheckoutIntent(intent: CheckoutIntentRecord): Promise<void>
  claimCheckoutIntent(
    id: string,
    now: Date,
  ): Promise<CheckoutIntentRecord | undefined>
}
