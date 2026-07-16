import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionCreate from './CollectionCreate';
import CollectionList from './CollectionList';

const api = vi.hoisted(() => ({
  createNftCollection: vi.fn(),
  getNftApiBaseUrl: vi.fn(() => 'https://iyk6idmup6.us-east-1.awsapprunner.com'),
  getNftServiceHealth: vi.fn(),
  listNftCollections: vi.fn(),
  uploadNftMedia: vi.fn(),
  prepareNftSaleConfig: vi.fn(),
  submitNftSaleConfig: vi.fn(),
}));

vi.mock('./nftApi', () => api);

vi.mock('./stellarWallet', () => ({
  formatWalletError: (error: unknown) => (error instanceof Error ? error.message : ''),
  getPublicKey: vi.fn().mockResolvedValue('GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'),
  isWalletAvailable: vi.fn().mockResolvedValue(true),
  signTransaction: vi.fn().mockResolvedValue('signed-sale'),
}));

const ownerAddress = 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ';

const liveCollection = {
  id: '4a0dc446-4f57-4cf2-94ec-257b41b786a1',
  workspaceId: 'studio-a',
  name: 'Astral Gear',
  symbol: 'GEAR',
  description: 'Equipment used throughout the Astral Gear game world.',
  ownerAddress,
  baseMetadataUri: 'http://127.0.0.1:4101/v1/public/collections/4a0dc446-4f57-4cf2-94ec-257b41b786a1/tokens/',
  collectionMetadataUri: 'http://127.0.0.1:4101/v1/assets/metadata',
  coverImageUri: 'http://127.0.0.1:4101/v1/assets/cover',
  royaltyRecipient: ownerAddress,
  royaltyBps: 0,
  status: 'live' as const,
  contractId: `C${'A'.repeat(55)}`,
  deploymentTxHash: 'deployment-hash',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

function StudioStub({ name }: { name: string }) {
  return (
    <div>
      <h1>Collection studio</h1>
      <p>{name}</p>
    </div>
  );
}

function FlowRoutes() {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/services/nft/collections/new" element={(
        <CollectionCreate
          workspaceId="studio-a"
          accessToken="access-token"
          onClose={() => navigate('/services/nft')}
          onCreated={(collection) => navigate(`/services/nft/collections/${collection.id}`)}
        />
      )} />
      <Route path="/services/nft" element={(
        <CollectionList
          workspaceId="studio-a"
          accessToken="access-token"
          onCreate={() => navigate('/services/nft/collections/new')}
          onOpenDashboard={() => undefined}
        />
      )} />
      <Route path="/services/nft/collections/:collectionId" element={(
        <StudioStub name="Astral Gear" />
      )} />
    </Routes>
  );
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/services/nft/collections/new']}>
      <FlowRoutes />
    </MemoryRouter>,
  );
}

describe('CollectionCreate', () => {
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
    api.uploadNftMedia.mockResolvedValue({
      cid: 'cover',
      uri: liveCollection.coverImageUri,
      size: 5,
      mimeType: 'image/webp',
    });
    api.createNftCollection.mockResolvedValue(liveCollection);
    api.listNftCollections.mockResolvedValue([liveCollection]);
    api.prepareNftSaleConfig.mockResolvedValue({
      serializedTransaction: 'prepared-sale',
      requiredSigners: [ownerAddress],
    });
    api.submitNftSaleConfig.mockResolvedValue({
      transaction: { transactionHash: 'sale-hash', status: 'confirmed' },
      collection: {
        ...liveCollection,
        primarySale: {
          paymentTokenAddress: 'native',
          priceAtomic: '100000000',
          transactionHash: 'sale-hash',
          configuredAt: '2026-07-11T00:00:00.000Z',
        },
      },
    });
  });

  it('validates required collection details', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Use 3–64 characters.')).toBeInTheDocument();
    expect(screen.getByText('Use 10–500 characters.')).toBeInTheDocument();
    expect(screen.getByText('Upload an NFT logo / cover image.')).toBeInTheDocument();
  });

  it('uploads, deploys, activates sale, and opens the collection studio', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText('NFT name'), 'Astral Gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    const file = new File(['cover'], 'gear.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText(/NFT logo/), file);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.clear(screen.getByDisplayValue('1'));
    await user.type(screen.getByDisplayValue(''), '10');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.clear(screen.getByLabelText('Wallet address'));
    await user.type(screen.getByLabelText('Wallet address'), ownerAddress);
    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(api.uploadNftMedia).toHaveBeenCalledWith(file, 'access-token');
    expect(api.createNftCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'studio-a',
        ownerAddress,
        coverImageUri: liveCollection.coverImageUri,
      }),
      'access-token',
    );
    await waitFor(() => expect(api.prepareNftSaleConfig).toHaveBeenCalled());
    await waitFor(() => expect(api.submitNftSaleConfig).toHaveBeenCalled());
    // Launch cinema → success popup (not auto-navigate).
    expect(await screen.findByRole('heading', { name: 'Astral Gear' }, { timeout: 12_000 })).toBeInTheDocument();
    expect(screen.getByText(/NFT created/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to dashboard/i })).toBeInTheDocument();
  }, 20_000);

  it('accepts SVG covers', async () => {
    const user = userEvent.setup();
    renderFlow();

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'gear.svg', {
      type: 'image/svg+xml',
    });
    await user.upload(screen.getByLabelText(/NFT logo/), file);

    expect(screen.queryByText('Choose a PNG, JPEG, WebP, or SVG image.')).not.toBeInTheDocument();
    expect(screen.getByAltText('NFT logo preview')).toBeInTheDocument();
  });

  it('keeps the form recoverable when deployment fails', async () => {
    const user = userEvent.setup();
    api.createNftCollection.mockRejectedValue(new Error('Deployment unavailable'));
    renderFlow();

    await user.type(screen.getByLabelText('NFT name'), 'Astral Gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.upload(
      screen.getByLabelText(/NFT logo/),
      new File(['cover'], 'gear.webp', { type: 'image/webp' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.clear(screen.getByLabelText('Wallet address'));
    await user.type(screen.getByLabelText('Wallet address'), ownerAddress);
    await user.click(screen.getByRole('button', { name: 'Create collection' }));

    expect(await screen.findByText('Deployment unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create collection' })).toBeEnabled();
  });

  it('does not leak an in-progress form when the active workspace changes', async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('NFT name'), 'Studio A Items');

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-b" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('NFT name')).toHaveValue(''));

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('NFT name')).toHaveValue('Studio A Items'),
    );
  });
});
