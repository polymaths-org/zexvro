import type { CollectionStatus } from '../../types';

const NFT_API_BASE = (import.meta.env.VITE_NFT_API_URL || '/api/nft').replace(/\/$/, '');

export interface NftServiceHealth {
  status: 'ok';
  service: 'nft-service';
  capabilities: {
    network: 'stellar:testnet';
    pinningConfigured: boolean;
    stellarConfigured: boolean;
    storageMode: 'local' | 's3' | 'pinata';
  };
}

export interface NftMediaAsset {
  cid: string;
  uri: string;
  size: number;
  mimeType: string;
}

export interface ApiNftCollection {
  id: string;
  workspaceId: string;
  name: string;
  symbol: string;
  description: string;
  ownerAddress: string;
  baseMetadataUri: string;
  collectionMetadataUri: string;
  coverImageUri: string;
  royaltyRecipient: string;
  royaltyBps: number;
  externalUrl?: string;
  status: Exclude<CollectionStatus, 'draft'>;
  contractId?: string;
  deploymentTxHash?: string;
  failureReason?: string;
  primarySale?: {
    paymentTokenAddress: string;
    priceAtomic: string;
    transactionHash: string;
    configuredAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type PublicNftCollection = Omit<
  ApiNftCollection,
  'workspaceId' | 'ownerAddress' | 'royaltyRecipient'
>;

export interface CreateNftCollectionInput {
  workspaceId: string;
  name: string;
  symbol: string;
  description: string;
  ownerAddress: string;
  baseMetadataUri?: string;
  coverImageUri: string;
  royaltyRecipient: string;
  royaltyBps: number;
  externalUrl?: string;
}

export type UpdateNftCollectionInput = Partial<
  Omit<CreateNftCollectionInput, 'workspaceId'>
>;

export interface NftCheckoutIntent {
  id: string;
  collectionId: string;
  tokenId: number;
  buyerAddress: string;
  serializedTransaction: string;
  requiredSigners: string[];
  status: 'pending_signature' | 'submitting' | 'confirmed' | 'failed';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  transactionHash?: string;
  failureReason?: string;
}

export interface NftMintedItem {
  id: string;
  collectionId: string;
  tokenId: number;
  ownerAddress: string;
  source: 'mint' | 'purchase';
  transactionHash: string;
  mintedAt: string;
}

export interface NftInventorySummary {
  items: NftMintedItem[];
  nextTokenId: number;
  mintedCount: number;
}

export interface PublicTokenMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  collection: {
    name: string;
    symbol: string;
  };
  attributes: Array<{ trait_type: string; value: string | number }>;
  availability: 'available' | 'sold';
  ownerAddress?: string;
  source?: 'mint' | 'purchase';
  transactionHash?: string;
  mintedAt?: string;
}

export interface PreparedNftTransaction {
  serializedTransaction: string;
  requiredSigners: string[];
  autoSubmitted?: {
    transactionHash: string;
    status: 'confirmed';
  };
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class NftApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'NftApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined;
  return response.json().catch(() => undefined);
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const response = await fetch(`${NFT_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    throw new NftApiError(
      response.status,
      apiError?.error?.code || 'nft_api_error',
      apiError?.error?.message || `NFT service request failed (${response.status})`,
      apiError?.error?.details,
    );
  }

  return payload as T;
}

export function getNftServiceHealth(signal?: AbortSignal) {
  return requestJson<NftServiceHealth>('/health', { signal });
}

export async function listNftCollections(
  workspaceId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  const result = await requestJson<{ collections: ApiNftCollection[] }>(
    `/v1/collections?workspaceId=${encodeURIComponent(workspaceId)}`,
    { signal },
    accessToken,
  );
  return result.collections;
}

export async function uploadNftMedia(file: File, accessToken: string) {
  const body = new FormData();
  body.set('file', file);
  const result = await requestJson<{ asset: NftMediaAsset }>(
    '/v1/media',
    { method: 'POST', body },
    accessToken,
  );
  return result.asset;
}

export async function createNftCollection(
  input: CreateNftCollectionInput,
  accessToken: string,
) {
  const result = await requestJson<{ collection: ApiNftCollection }>(
    '/v1/collections',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    accessToken,
  );
  return result.collection;
}

export async function updateNftCollection(
  collectionId: string,
  input: UpdateNftCollectionInput,
  accessToken: string,
) {
  const result = await requestJson<{ collection: ApiNftCollection }>(
    `/v1/collections/${encodeURIComponent(collectionId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    accessToken,
  );
  return result.collection;
}

export async function retryNftCollectionDeployment(
  collectionId: string,
  accessToken: string,
) {
  const result = await requestJson<{ collection: ApiNftCollection }>(
    `/v1/collections/${encodeURIComponent(collectionId)}/retry`,
    { method: 'POST' },
    accessToken,
  );
  return result.collection;
}

export async function deleteNftCollection(
  collectionId: string,
  accessToken: string,
) {
  await requestJson<void>(
    `/v1/collections/${encodeURIComponent(collectionId)}`,
    { method: 'DELETE' },
    accessToken,
  );
}

export async function prepareNftSaleConfig(input: {
  collectionId: string;
  ownerAddress: string;
  priceAtomic: string;
  accessToken: string;
}) {
  const result = await requestJson<{ intent: PreparedNftTransaction }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/sale-config/intent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress: input.ownerAddress,
        priceAtomic: input.priceAtomic,
      }),
    },
    input.accessToken,
  );
  return result.intent;
}

export async function getPublicNftCollection(
  collectionId: string,
  signal?: AbortSignal,
) {
  const result = await requestJson<{
    collection: PublicNftCollection;
    inventory?: NftInventorySummary;
  }>(
    `/v1/public/collections/${encodeURIComponent(collectionId)}`,
    { signal },
  );
  return result;
}

export async function getPublicCollectionInventory(
  collectionId: string,
  signal?: AbortSignal,
) {
  const result = await requestJson<NftInventorySummary>(
    `/v1/public/collections/${encodeURIComponent(collectionId)}/tokens`,
    { signal },
  );
  return result;
}

export async function getPublicTokenMetadata(
  collectionId: string,
  tokenId: number,
  signal?: AbortSignal,
) {
  return requestJson<PublicTokenMetadata>(
    `/v1/public/collections/${encodeURIComponent(collectionId)}/tokens/${encodeURIComponent(String(tokenId))}`,
    { signal },
  );
}

export async function listCollectionItems(input: {
  collectionId: string;
  accessToken: string;
  signal?: AbortSignal;
}) {
  return requestJson<NftInventorySummary>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/items`,
    { signal: input.signal },
    input.accessToken,
  );
}

export async function archiveNftCollection(input: {
  collectionId: string;
  accessToken: string;
}) {
  const result = await requestJson<{ collection: ApiNftCollection }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/archive`,
    { method: 'POST' },
    input.accessToken,
  );
  return result.collection;
}

export async function unarchiveNftCollection(input: {
  collectionId: string;
  accessToken: string;
}) {
  const result = await requestJson<{ collection: ApiNftCollection }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/unarchive`,
    { method: 'POST' },
    input.accessToken,
  );
  return result.collection;
}

export async function createPublicCheckoutIntent(input: {
  collectionId: string;
  buyerAddress: string;
  tokenId: number;
  idempotencyKey?: string;
}) {
  const idempotencyKey =
    input.idempotencyKey || crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const result = await requestJson<{ intent: NftCheckoutIntent }>(
    '/v1/public/checkout/intents',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        collectionId: input.collectionId,
        buyerAddress: input.buyerAddress,
        tokenId: input.tokenId,
      }),
    },
  );
  return result.intent;
}

export async function submitNftSaleConfig(input: {
  collectionId: string;
  preparedTransaction: string;
  signedTransaction: string;
  accessToken: string;
}) {
  const result = await requestJson<{
    transaction: { transactionHash: string; status: 'confirmed' };
    collection?: ApiNftCollection;
  }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/sale-config/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preparedTransaction: input.preparedTransaction,
        signedTransaction: input.signedTransaction,
      }),
    },
    input.accessToken,
  );
  return result;
}

export async function submitNftMint(input: {
  collectionId: string;
  preparedTransaction: string;
  signedTransaction: string;
  tokenId?: number;
  ownerAddress?: string;
  accessToken: string;
}) {
  const result = await requestJson<{
    transaction: { transactionHash: string; status: 'confirmed' };
    item?: NftMintedItem;
  }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/mints/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preparedTransaction: input.preparedTransaction,
        signedTransaction: input.signedTransaction,
        ...(input.tokenId === undefined ? {} : { tokenId: input.tokenId }),
        ...(input.ownerAddress === undefined ? {} : { ownerAddress: input.ownerAddress }),
      }),
    },
    input.accessToken,
  );
  return result;
}

export async function prepareNftMint(input: {
  collectionId: string;
  operatorAddress: string;
  recipientAddress: string;
  tokenId: number;
  accessToken: string;
}) {
  const result = await requestJson<{ intent: PreparedNftTransaction }>(
    `/v1/collections/${encodeURIComponent(input.collectionId)}/mints/intent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorAddress: input.operatorAddress,
        recipientAddress: input.recipientAddress,
        tokenId: input.tokenId,
      }),
    },
    input.accessToken,
  );
  return result.intent;
}

export async function submitPublicCheckoutIntent(input: {
  intentId: string;
  signedTransaction: string;
}) {
  const result = await requestJson<{
    intent: NftCheckoutIntent;
    transaction?: { transactionHash: string; status: 'confirmed' };
  }>(
    `/v1/public/checkout/intents/${encodeURIComponent(input.intentId)}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedTransaction: input.signedTransaction,
      }),
    },
  );
  return result;
}
