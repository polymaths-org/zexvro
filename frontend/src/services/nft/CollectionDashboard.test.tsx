import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionDashboard from './CollectionDashboard';
import { createCollection } from './collectionStore';

const api = vi.hoisted(() => ({
  getNftServiceHealth: vi.fn(),
  listNftCollections: vi.fn(),
}));

vi.mock('./nftApi', () => api);

const remoteCollection = {
  id: '4a0dc446-4f57-4cf2-94ec-257b41b786a1',
  workspaceId: 'studio-a',
  name: 'Sky Forge',
  symbol: 'SKY',
  description: 'A collection of verifiable game items.',
  ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
  baseMetadataUri: 'ipfs://bafybase/',
  collectionMetadataUri: 'ipfs://bafymetadata',
  coverImageUri: 'ipfs://bafycover',
  royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
  royaltyBps: 500,
  status: 'live' as const,
  contractId: `C${'A'.repeat(55)}`,
  deploymentTxHash: 'deployment-hash',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

describe('CollectionDashboard', () => {
  beforeEach(() => {
    api.getNftServiceHealth.mockResolvedValue({
      status: 'ok',
      service: 'nft-service',
      capabilities: {
        network: 'stellar:testnet',
        pinningConfigured: true,
        stellarConfigured: true,
        storageMode: 'local',
      },
    });
    api.listNftCollections.mockResolvedValue([]);
  });

  it('shows an honest API-backed empty state', async () => {
    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No collections yet' })).toBeInTheDocument();
    expect(screen.getByText(/deploys a collection contract/i)).toBeInTheDocument();
  });

  it('shows live API collections and existing browser drafts separately', async () => {
    api.listNftCollections.mockResolvedValue([remoteCollection]);
    createCollection('studio-a', {
      name: 'Astral Gear',
      symbol: 'GEAR',
      description: 'Equipment used throughout the Astral Gear game world.',
      coverName: 'gear.webp',
      royaltyBps: 500,
    });

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sky Forge')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Astral Gear')).toBeInTheDocument();
    expect(screen.getByText('Browser draft')).toBeInTheDocument();
  });

  it('surfaces API failures without hiding browser drafts', async () => {
    api.listNftCollections.mockRejectedValue(new Error('NFT API unavailable'));
    createCollection('studio-a', {
      name: 'Astral Gear',
      symbol: 'GEAR',
      description: 'Equipment used throughout the Astral Gear game world.',
      coverName: 'gear.webp',
      royaltyBps: 500,
    });

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('NFT API unavailable')).toBeInTheDocument();
    expect(screen.getByText('Astral Gear')).toBeInTheDocument();
  });
});
