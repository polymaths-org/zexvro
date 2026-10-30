import {runtimeValue} from '../../lib/runtimeConfig';
import type { CollectionStatus } from '../../types';
import { ensureValidAccessToken, isAccessTokenExpired } from '../../auth/cognito';

const HOSTED_NFT_API = 'https://zexvro-platform-api.zexvro.workers.dev/nft';
const configuredNftApi = (runtimeValue('VITE_NFT_API_URL') || '').trim().replace(/\/$/, '');
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
    network: 'stellar:testnet' | 'stellar:pubnet';
    networkPassphrase?: string;
    rpcUrl?: string;
    paymentTokenAddress?: string;
    pinningConfigured: boolean;
    stellarConfigured: boolean;
    storageMode: 'local' | 's3' | 'pinata' | 'r2';
  };
}

/** Cached last health for explorers / Freighter passphrase. */
let lastNftHealth: NftServiceHealth | null = null;

export function getCachedNftHealth(): NftServiceHealth | null {
  return lastNftHealth;
}

export function setCachedNftHealth(health: NftServiceHealth | null) {
  lastNftHealth = health;
}

export function nftNetworkLabel(health?: NftServiceHealth | null): string {
  const n = health?.capabilities?.network || lastNftHealth?.capabilities?.network;
  if (!n) return 'Unknown';
  return n === 'stellar:pubnet' ? 'Mainnet' : 'Testnet';
}

export function nftNetworkPassphrase(health?: NftServiceHealth | null): string {
  const fromApi = health?.capabilities?.networkPassphrase || lastNftHealth?.capabilities?.networkPassphrase;
  if (fromApi?.trim()) return fromApi.trim();
  const n = health?.capabilities?.network || lastNftHealth?.capabilities?.network;
  if (n === 'stellar:pubnet') {
    return 'Public Global Stellar Network ; September 2015';
  }
  // Prefer project preference when API has not reported network yet.
  try {
    const pref = localStorage.getItem('zexvro_nft_network_pref');
    if (pref === 'mainnet' || pref === 'stellar:pubnet') {
      return 'Public Global Stellar Network ; September 2015';
    }
  } catch { /* ignore */ }
  return 'Test SDF Network ; September 2015';
}

/** UI / project preference for NFT Freighter when API is still testnet-hosted. */
export function setNftNetworkPreference(env: 'testnet' | 'mainnet') {
  try {
    localStorage.setItem('zexvro_nft_network_pref', env);
  } catch { /* ignore */ }
}

export function getNftNetworkPreference(): 'testnet' | 'mainnet' {
  try {
    const pref = localStorage.getItem('zexvro_nft_network_pref');
    if (pref === 'mainnet' || pref === 'stellar:pubnet') return 'mainnet';
  } catch { /* ignore */ }
  const n = lastNftHealth?.capabilities?.network;
  return n === 'stellar:pubnet' ? 'mainnet' : 'testnet';
}

export function nftExplorerBase(health?: NftServiceHealth | null): string {
  const n = health?.capabilities?.network || lastNftHealth?.capabilities?.network;
  // Prefer mainnet explorer when health is missing (hosted API is pubnet).
  if (!n) return 'https://stellar.expert/explorer/public';
  return n === 'stellar:pubnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
}

/** Native XLM / Circle USDC SAC ids — match server payment token. */
const XLM_SACS = new Set([
  'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
]);
const USDC_SACS = new Set([
  'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
]);

export function atomicToPaymentDisplay(value: string): string {
  try {
    const atomic = BigInt(value);
    const whole = atomic / 10_000_000n;
    const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  } catch {
    return value;
  }
}

/** Label for primary-sale payment token (client-configured amount uses this asset). */
export function paymentAssetLabel(
  paymentTokenAddress?: string | null,
  health?: NftServiceHealth | null,
): string {
  const token =
    (paymentTokenAddress || '').trim()
    || (health?.capabilities?.paymentTokenAddress || lastNftHealth?.capabilities?.paymentTokenAddress || '').trim();
  if (!token) return 'XLM';
  if (XLM_SACS.has(token)) return 'XLM';
  if (USDC_SACS.has(token)) return 'USDC';
  return 'token';
}

export function formatPrimarySalePrice(
  sale?: { priceAtomic: string; paymentTokenAddress?: string } | null,
  health?: NftServiceHealth | null,
): string | null {
  if (!sale?.priceAtomic) return null;
  return `${atomicToPaymentDisplay(sale.priceAtomic)} ${paymentAssetLabel(sale.paymentTokenAddress, health)}`;
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
  nextCursor?:number|null;
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
  availability: 'available' | 'sold' | 'unknown';
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
  // Normalize network if API is older (no pubnet yet).
  if (health.capabilities.network !== 'stellar:pubnet' && health.capabilities.network !== 'stellar:testnet') {
    health.capabilities.network = 'stellar:testnet';
  }
  setCachedNftHealth(health);
  return health;
}

export async function listNftCollections(
  workspaceId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  const all:ApiNftCollection[]=[];let cursor='';
  for(let page=0;page<100;page++){
    const result=await requestJson<{collections?:ApiNftCollection[];nextCursor?:string|null}>(`/v1/collections?workspaceId=${encodeURIComponent(workspaceId)}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`,{signal},accessToken);
    all.push(...(result.collections||[]));if(!result.nextCursor)return all;
    if(result.nextCursor===cursor)throw new Error('Invalid collection pagination');cursor=result.nextCursor;
  }
  throw new Error('Too many collections; narrow the request');
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

async function inventoryPages(path:string,signal?:AbortSignal,token?:string){
  const first=await requestJson<NftInventorySummary>(path,{signal},token);let cursor=first.nextCursor;
  for(let page=0;cursor!==null&&cursor!==undefined&&page<99;page++){
    const next=await requestJson<NftInventorySummary>(`${path}?cursor=${encodeURIComponent(String(cursor))}`,{signal},token);first.items.push(...next.items);
    if(next.nextCursor===cursor)throw new Error('Invalid inventory pagination');cursor=next.nextCursor;
  }
  if(cursor!==null&&cursor!==undefined)throw new Error('Too many tokens; narrow the request');first.nextCursor=null;return first;
}

export async function getPublicCollectionInventory(
  collectionId: string,
  signal?: AbortSignal,
) {
  return inventoryPages(`/v1/public/collections/${encodeURIComponent(collectionId)}/tokens`,signal);
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
  return inventoryPages(`/v1/collections/${encodeURIComponent(input.collectionId)}/items`,input.signal,input.accessToken);
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
