import type { NftCollection, NftCollectionDraft } from '../../types';

const COLLECTIONS_PREFIX = 'zexvro:nft:collections:v1';
const DRAFT_PREFIX = 'zexvro:nft:collection-draft:v1';

function storageKey(prefix: string, workspaceId: string) {
  return `${prefix}:${encodeURIComponent(workspaceId || 'default')}`;
}

function parseArray(value: string | null): NftCollection[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isCollection) : [];
  } catch {
    return [];
  }
}

function isCollection(value: unknown): value is NftCollection {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Partial<NftCollection>;
  return (
    typeof collection.id === 'string' &&
    typeof collection.workspaceId === 'string' &&
    typeof collection.name === 'string' &&
    typeof collection.symbol === 'string' &&
    typeof collection.description === 'string' &&
    typeof collection.royaltyBps === 'number' &&
    typeof collection.createdAt === 'string'
  );
}

export function loadCollections(workspaceId: string) {
  return parseArray(window.localStorage.getItem(storageKey(COLLECTIONS_PREFIX, workspaceId)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createCollection(workspaceId: string, draft: NftCollectionDraft) {
  const collection: NftCollection = {
    ...draft,
    id: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `collection-${Date.now().toString(36)}`,
    workspaceId,
    itemCount: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  const collections = [collection, ...loadCollections(workspaceId)];
  window.localStorage.setItem(storageKey(COLLECTIONS_PREFIX, workspaceId), JSON.stringify(collections));
  return collection;
}

export function loadCollectionDraft(workspaceId: string): NftCollectionDraft | null {
  const saved = window.localStorage.getItem(storageKey(DRAFT_PREFIX, workspaceId));
  if (!saved) return null;
  try {
    const value = JSON.parse(saved) as Partial<NftCollectionDraft>;
    if (typeof value.name !== 'string' || typeof value.symbol !== 'string') return null;
    return {
      name: value.name,
      symbol: value.symbol,
      description: typeof value.description === 'string' ? value.description : '',
      coverName: '',
      royaltyBps: typeof value.royaltyBps === 'number' ? value.royaltyBps : 0,
      ...(typeof value.ownerAddress === 'string' ? { ownerAddress: value.ownerAddress } : {}),
      ...(typeof value.royaltyRecipient === 'string' ? { royaltyRecipient: value.royaltyRecipient } : {}),
      ...(typeof value.baseMetadataUri === 'string' ? { baseMetadataUri: value.baseMetadataUri } : {}),
      ...(typeof value.externalUrl === 'string' ? { externalUrl: value.externalUrl } : {}),
    };
  } catch {
    return null;
  }
}

export function saveCollectionDraft(workspaceId: string, draft: NftCollectionDraft) {
  window.localStorage.setItem(storageKey(DRAFT_PREFIX, workspaceId), JSON.stringify({
    ...draft,
    coverName: '',
  }));
}

export function clearCollectionDraft(workspaceId: string) {
  window.localStorage.removeItem(storageKey(DRAFT_PREFIX, workspaceId));
}
