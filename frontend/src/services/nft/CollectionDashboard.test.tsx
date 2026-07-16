import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionDashboard from './CollectionDashboard';
import { createCollection } from './collectionStore';

const api = vi.hoisted(() => ({
  archiveNftCollection: vi.fn(),
  deleteNftCollection: vi.fn(),
  getNftApiBaseUrl: vi.fn(() => 'https://iyk6idmup6.us-east-1.awsapprunner.com'),
  getNftServiceHealth: vi.fn(),
  listCollectionItems: vi.fn(),
  listNftCollections: vi.fn(),
  prepareNftMint: vi.fn(),
  prepareNftSaleConfig: vi.fn(),
  retryNftCollectionDeployment: vi.fn(),
  submitNftMint: vi.fn(),
  submitNftSaleConfig: vi.fn(),
  unarchiveNftCollection: vi.fn(),
  updateNftCollection: vi.fn(),
}));

const wallet = vi.hoisted(() => ({
  getPublicKey: vi.fn(),
  isWalletAvailable: vi.fn(),
  formatWalletError: vi.fn((error: unknown) => error instanceof Error ? error.message : 'Wallet action failed.'),
  signTransaction: vi.fn(),
}));

vi.mock('./nftApi', () => api);
vi.mock('./stellarWallet', () => wallet);

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

const failedCollection = {
  ...remoteCollection,
  id: '5a0dc446-4f57-4cf2-94ec-257b41b786a1',
  status: 'failed' as const,
  contractId: undefined,
  deploymentTxHash: undefined,
  failureReason: 'stellar_deployment_incomplete',
};

const configuredCollection = {
  ...remoteCollection,
  id: '6a0dc446-4f57-4cf2-94ec-257b41b786a1',
  primarySale: {
    paymentTokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    priceAtomic: '12500000',
    transactionHash: 'sale-config-auto-hash',
    configuredAt: '2026-07-12T00:00:00.000Z',
  },
};

describe('CollectionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    api.prepareNftSaleConfig.mockResolvedValue({
      serializedTransaction: 'prepared-sale',
      requiredSigners: [remoteCollection.ownerAddress],
    });
    api.prepareNftMint.mockResolvedValue({
      serializedTransaction: 'prepared-mint',
      requiredSigners: [remoteCollection.ownerAddress],
    });
    api.retryNftCollectionDeployment.mockResolvedValue(remoteCollection);
    api.updateNftCollection.mockResolvedValue(failedCollection);
    api.deleteNftCollection.mockResolvedValue(undefined);
    api.submitNftSaleConfig.mockResolvedValue({
      transaction: { transactionHash: 'wallet-sale-hash', status: 'confirmed' },
    });
    api.submitNftMint.mockResolvedValue({
      transaction: { transactionHash: 'wallet-mint-hash', status: 'confirmed' },
      item: {
        id: 'item-1',
        collectionId: remoteCollection.id,
        tokenId: 7,
        ownerAddress: remoteCollection.ownerAddress,
        source: 'mint',
        transactionHash: 'wallet-mint-hash',
        mintedAt: '2026-07-12T00:00:00.000Z',
      },
    });
    api.listCollectionItems.mockResolvedValue({
      items: [],
      nextTokenId: 1,
      mintedCount: 0,
    });
    api.archiveNftCollection.mockResolvedValue({
      ...remoteCollection,
      status: 'archived',
    });
    api.unarchiveNftCollection.mockResolvedValue(remoteCollection);
    wallet.isWalletAvailable.mockResolvedValue(false);
    wallet.getPublicKey.mockResolvedValue(remoteCollection.ownerAddress);
    wallet.signTransaction.mockResolvedValue('signed-sale');
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

  it('exposes public view, buy, copy, retry, edit, and delete actions', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection, failedCollection]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByTitle('View public page')).toHaveAttribute('href', `/nft/collections/${remoteCollection.id}`);
    expect(screen.getByTitle('Open buyer page')).toHaveAttribute('href', `/nft/collections/${remoteCollection.id}?buy=1`);

    await user.click(screen.getByTitle('Copy public URL'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/nft/collections/${remoteCollection.id}`));

    await user.click(screen.getByTitle('Configure primary sale'));
    expect(await screen.findByRole('heading', { name: 'Primary sale setup' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), '1.25');
    await user.click(screen.getByRole('button', { name: /prepare sale/i }));
    expect(api.prepareNftSaleConfig).toHaveBeenCalledWith({
      collectionId: remoteCollection.id,
      ownerAddress: remoteCollection.ownerAddress,
      priceAtomic: '12500000',
      accessToken: 'access-token',
    });
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByTitle('Retry deployment'));
    expect(api.retryNftCollectionDeployment).toHaveBeenCalledWith(failedCollection.id, 'access-token');

    await user.click(screen.getByTitle('Edit failed record'));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Sky Forge Retry');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(api.updateNftCollection).toHaveBeenCalledWith(
      failedCollection.id,
      expect.objectContaining({ name: 'Sky Forge Retry' }),
      'access-token',
    );

    await user.click(screen.getByTitle('Delete failed record'));
    expect(api.deleteNftCollection).toHaveBeenCalledWith(failedCollection.id, 'access-token');
  });

  it('shows configured primary sales as updateable instead of unprepared', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([configuredCollection]);

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTitle('Update primary sale'));
    expect(screen.getByRole('heading', { name: 'Primary sale configured' })).toBeInTheDocument();
    expect(screen.getByText('1.25 XLM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update sale/i })).toBeInTheDocument();
  });

  it('persists auto-submitted sale setup in dashboard state', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection]);
    api.prepareNftSaleConfig.mockResolvedValue({
      serializedTransaction: 'prepared-sale',
      requiredSigners: [],
      autoSubmitted: {
        transactionHash: 'sale-config-auto-hash',
        status: 'confirmed',
      },
    });

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTitle('Configure primary sale'));
    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), '1.25');
    await user.click(screen.getByRole('button', { name: /prepare sale/i }));

    expect(await screen.findByRole('button', { name: /sale configured/i })).toBeDisabled();
    expect(screen.getByText('Submitted by local sponsor')).toBeInTheDocument();
  });

  it('signs non-sponsor sale configuration with Freighter and submits', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection]);
    api.prepareNftSaleConfig.mockResolvedValue({
      serializedTransaction: 'prepared-sale',
      requiredSigners: [remoteCollection.ownerAddress],
    });
    api.submitNftSaleConfig.mockResolvedValue({
      transaction: { transactionHash: 'wallet-sale-hash', status: 'confirmed' },
    });
    wallet.isWalletAvailable.mockResolvedValue(true);
    wallet.getPublicKey.mockResolvedValue(remoteCollection.ownerAddress);
    wallet.signTransaction.mockResolvedValue('signed-sale');

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTitle('Configure primary sale'));
    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), '1.25');
    await user.click(screen.getByRole('button', { name: /prepare sale/i }));
    await user.click(await screen.findByRole('button', { name: /sign with wallet/i }));

    expect(wallet.signTransaction).toHaveBeenCalledWith('prepared-sale');
    expect(api.submitNftSaleConfig).toHaveBeenCalledWith({
      collectionId: remoteCollection.id,
      preparedTransaction: 'prepared-sale',
      signedTransaction: 'signed-sale',
      priceAtomic: expect.any(String),
      accessToken: 'access-token',
    });
    expect(await screen.findByText(/signed and confirmed/i)).toBeInTheDocument();
  });

  it('prepares and submits creator mint with Freighter', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection]);
    api.prepareNftMint.mockResolvedValue({
      serializedTransaction: 'prepared-mint',
      requiredSigners: [remoteCollection.ownerAddress],
      tokenId: 7,
    });
    wallet.isWalletAvailable.mockResolvedValue(true);
    wallet.getPublicKey.mockResolvedValue(remoteCollection.ownerAddress);
    wallet.signTransaction.mockResolvedValue('signed-mint');

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTitle('Mint token'));
    expect(await screen.findByRole('heading', { name: 'Mint token' })).toBeInTheDocument();
    expect(screen.getByText(/assigned automatically/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /prepare mint/i }));

    expect(api.prepareNftMint).toHaveBeenCalledWith({
      collectionId: remoteCollection.id,
      operatorAddress: remoteCollection.ownerAddress,
      recipientAddress: remoteCollection.ownerAddress,
      accessToken: 'access-token',
    });
    expect(await screen.findByText(/Assigned token #7/i)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /sign with wallet/i }));
    expect(wallet.signTransaction).toHaveBeenCalledWith('prepared-mint');
    expect(api.submitNftMint).toHaveBeenCalledWith({
      collectionId: remoteCollection.id,
      preparedTransaction: 'prepared-mint',
      signedTransaction: 'signed-mint',
      tokenId: 7,
      ownerAddress: remoteCollection.ownerAddress,
      accessToken: 'access-token',
    });
    expect(await screen.findByText(/signed and minted/i)).toBeInTheDocument();
  });

  it('surfaces mint prepare failures such as token already minted', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection]);
    api.prepareNftMint.mockRejectedValue(new Error('Token is already minted'));

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByTitle('Mint token'));
    await user.click(screen.getByRole('button', { name: /prepare mint/i }));
    expect(await screen.findByText('Token is already minted')).toBeInTheDocument();
  });

  it('opens SDK integrate panel from the dashboard header', async () => {
    const user = userEvent.setup();
    api.listNftCollections.mockResolvedValue([remoteCollection]);

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => undefined} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /Integrate SDK/i }));
    expect(await screen.findByRole('heading', { name: /NFT SDK/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(remoteCollection.id)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy code/i })).toBeInTheDocument();
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
