import { describe, expect, it } from 'vitest';
import {
  clearCollectionDraft,
  createCollection,
  loadCollectionDraft,
  loadCollections,
  saveCollectionDraft,
} from './collectionStore';

const draft = {
  name: 'Astral Gear',
  symbol: 'GEAR',
  description: 'Equipment used throughout the Astral Gear game world.',
  coverName: 'gear.webp',
  royaltyBps: 500,
};

describe('NFT collection storage', () => {
  it('isolates collections by workspace', () => {
    createCollection('studio-a', draft);

    expect(loadCollections('studio-a')).toHaveLength(1);
    expect(loadCollections('studio-b')).toEqual([]);
  });

  it('persists text draft fields without the local file name', () => {
    saveCollectionDraft('studio-a', draft);

    expect(loadCollectionDraft('studio-a')).toEqual({ ...draft, coverName: '' });
    clearCollectionDraft('studio-a');
    expect(loadCollectionDraft('studio-a')).toBeNull();
  });
});
