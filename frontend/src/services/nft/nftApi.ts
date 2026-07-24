import type { CollectionStatus } from '../../types';
import { ensureValidAccessToken, isAccessTokenExpired } from '../../auth/cognito';

const HOSTED_NFT_API = 'https://iyk6idmup6.us-east-1.awsapprunner.com';
const configuredNftApi = (import.meta.env.VITE_NFT_API_URL || '').trim().replace(/\/$/, '');
// Prefer explicit env; fall back to hosted App Runner so local/Pages never hit a dead proxy or SPA HTML 200.
const NFT_API_BASE = configuredNftApi || HOSTED_NFT_API;

/** Shared API origin for dashboard + SDK snippets. */
export function getNftApiBaseUrl(): string {
  return NFT_API_BASE;
}

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
> & {
  /** Convenience aliases for game/SDK clients. */
  logo?: string;
  logoUri?: string;
};

export function collectionLogo(collection: Pick<PublicNftCollection, 'logo' | 'logoUri' | 'coverImageUri'>) {
  return collection.logo || collection.logoUri || collection.coverImageUri || '';
}

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
  /** Assigned by the API when tokenId was omitted (always-auto allocation). */
  tokenId?: number;
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
  if (contentType.includes('application/json')) {
    return response.json().catch(() => undefined);
  }

  // Some proxies omit content-type; try parse body when it looks like JSON.
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return undefined;
    }
  }
  // HTML / SPA shell / plain text — never treat as API JSON.
  return undefined;
}

function assertJsonPayload(payload: unknown, path: string, status: number): asserts payload is object {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    throw new NftApiError(
      status >= 200 && status < 300 ? 502 : status,
      'invalid_nft_api_response',
      `NFT API returned a non-JSON ${status} for ${path} (base ${NFT_API_BASE}). Set VITE_NFT_API_URL to the App Runner NFT API, not the static site.`,
    );
  }
}

async function resolveAccessToken(accessToken?: string): Promise<string | undefined> {
  if (!accessToken) return undefined;
  try {
    // Always prefer a non-expired Cognito access token (refresh when needed).
    if (isAccessTokenExpired(accessToken)) {
      return await ensureValidAccessToken();
    }
    return accessToken;
  } catch {
    return accessToken;
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  let token = await resolveAccessToken(accessToken);

  const doFetch = async (bearer?: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    };
    const response = await fetch(`${NFT_API_BASE}${path}`, {
      ...init,
      headers,
    });
    const payload = await readJson(response);
    return { response, payload };
  };

  let { response, payload } = await doFetch(token);

  // Expired / wrong token: refresh once and retry (common after long dashboard sessions).
  if (response.status === 401 && accessToken) {
    try {
      token = await ensureValidAccessToken();
      ({ response, payload } = await doFetch(token));
    } catch {
      // fall through with original 401
    }
  }

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    const detail =
      typeof apiError?.error?.details === 'string'
        ? ` — ${apiError.error.details}`
        : '';
    throw new NftApiError(
      response.status,
      apiError?.error?.code || 'nft_api_error',
      (apiError?.error?.message || `NFT service request failed (${response.status})`) + detail,
      apiError?.error?.details,
    );
  }

  // 204 / empty success bodies are valid (e.g. DELETE).
  if (response.status === 204) {
    return undefined as T;
  }

  // Never treat HTML/empty 200 as success — that previously returned undefined and
  // crashed callers with "can't access property X of undefined" (e.g. capabilities).
  assertJsonPayload(payload, path, response.status);
  return payload as T;
}

export async function getNftServiceHealth(signal?: AbortSignal) {
  const health = await requestJson<NftServiceHealth>('/health', { signal });
  if (!health?.capabilities || typeof health.capabilities !== 'object') {
    throw new NftApiError(
      502,
      'invalid_nft_health',
      'NFT health payload is missing capabilities. Is VITE_NFT_API_URL set to the App Runner NFT API?',
    );
  }
  return health;
}

export async function listNftCollections(
  workspaceId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  const result = await requestJson<{ collections?: ApiNftCollection[] }>(
    `/v1/collections?workspaceId=${encodeURIComponent(workspaceId)}`,
    { signal },
    accessToken,
  );
  return Array.isArray(result?.collections) ? result.collections : [];
}

export async function uploadNftMedia(file: File, accessToken: string) {
  const body = new FormData();
  body.set('file', file);
  const result = await requestJson<{ asset?: NftMediaAsset }>(
    '/v1/media',
    { method: 'POST', body },
    accessToken,
  );
  if (!result?.asset) {
    throw new NftApiError(
      502,
      'invalid_nft_api_response',
      'NFT media upload response was empty. Check auth token and VITE_NFT_API_URL.',
    );
  }
  return result.asset;
}

export async function createNftCollection(
  input: CreateNftCollectionInput,
  accessToken: string,
) {
  const result = await requestJson<{ collection?: ApiNftCollection }>(
    '/v1/collections',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    accessToken,
  );
  if (!result?.collection) {
    throw new NftApiError(
      502,
      'invalid_nft_api_response',
      'NFT create response did not include a collection. Check auth token and VITE_NFT_API_URL.',
    );
  }
  return result.collection;
}

export async function getNftCollection(
  collectionId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  const result = await requestJson<{ collection?: ApiNftCollection }>(
    `/v1/collections/${encodeURIComponent(collectionId)}`,
    { signal },
    accessToken,
  );
  if (!result?.collection) {
    throw new NftApiError(
      502,
      'invalid_nft_api_response',
      'NFT collection response was empty. Sign in again and retry.',
    );
  }
  return result.collection;
}

export async function getNftCollectionStatus(
  collectionId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  return requestJson<{
    id: string;
    status: Exclude<CollectionStatus, 'draft'>;
    contractId?: string;
    deploymentTxHash?: string;
    failureReason?: string;
  }>(
    `/v1/collections/${encodeURIComponent(collectionId)}/status`,
    { signal },
    accessToken,
  );
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
  const result = await requestJson<{ intent?: PreparedNftTransaction }>(
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
  if (!result?.intent) {
    throw new NftApiError(
      502,
      'invalid_nft_api_response',
      'Sale-config prepare response was empty. Sign in again and retry.',
    );
  }
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

/** Lightweight public fields games can poll for branding (name + logo). */
export async function getPublicNftBranding(collectionId: string, signal?: AbortSignal) {
  const result = await getPublicNftCollection(collectionId, signal);
  return {
    id: result.collection.id,
    name: result.collection.name,
    logo: collectionLogo(result.collection),
    symbol: result.collection.symbol,
    description: result.collection.description,
    priceAtomic: result.collection.primarySale?.priceAtomic,
  };
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
  /** Optional. Omit to let the API allocate the next free token ID. */
  tokenId?: number;
  idempotencyKey?: string;
  /** Platform ZCR credit pack: grant after confirmed wallet payment. */
  creditWorkspaceId?: string;
  creditZcrAmount?: number;
  creditPackId?: string;
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
        ...(input.tokenId === undefined ? {} : { tokenId: input.tokenId }),
        ...(input.creditWorkspaceId
          ? {
              creditWorkspaceId: input.creditWorkspaceId,
              creditZcrAmount: input.creditZcrAmount,
              creditPackId: input.creditPackId,
            }
          : {}),
      }),
    },
  );
  return result.intent;
}

export async function submitNftSaleConfig(input: {
  collectionId: string;
  preparedTransaction: string;
  signedTransaction: string;
  priceAtomic: string;
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
        priceAtomic: input.priceAtomic,
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
  /** Optional. Omit to let the API allocate the next free token ID. */
  tokenId?: number;
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
        ...(input.tokenId === undefined ? {} : { tokenId: input.tokenId }),
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
