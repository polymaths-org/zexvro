import type { CollectionStatus } from '../../types';

const NFT_API_BASE = (import.meta.env.VITE_NFT_API_URL || '/api/nft').replace(/\/$/, '');

export interface NftServiceHealth {
  status: 'ok';
  service: 'nft-service';
  capabilities: {
    network: 'stellar:testnet';
    pinningConfigured: boolean;
    stellarConfigured: boolean;
    storageMode: 'pinata' | 'local';
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
  createdAt: string;
  updatedAt: string;
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
