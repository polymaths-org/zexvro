import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionCreate from './CollectionCreate';
import CollectionDashboard from './CollectionDashboard';

const api = vi.hoisted(() => ({
  createNftCollection: vi.fn(),
  getNftServiceHealth: vi.fn(),
  listNftCollections: vi.fn(),
  uploadNftMedia: vi.fn(),
}));

vi.mock('./nftApi', () => api);

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
  royaltyBps: 500,
  status: 'live' as const,
  contractId: `C${'A'.repeat(55)}`,
  deploymentTxHash: 'deployment-hash',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

function FlowRoutes() {
  const navigate = useNavigate();
  return (
      <Routes>
        <Route path="/services/nft/collections/new" element={(
          <CollectionCreate workspaceId="studio-a" accessToken="access-token" onClose={() => navigate('/services/nft')} />
        )} />
        <Route path="/services/nft" element={(
          <CollectionDashboard workspaceId="studio-a" accessToken="access-token" onCreate={() => navigate('/services/nft/collections/new')} />
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
  });

  it('validates required collection details', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Use 3–64 characters.')).toBeInTheDocument();
    expect(screen.getByText('Use 2–10 uppercase letters or numbers.')).toBeInTheDocument();
    expect(screen.getByText('Use 10–500 characters.')).toBeInTheDocument();
  });

  it('uploads, deploys, and returns to the API-backed dashboard', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText('Name'), 'Astral Gear');
    await user.type(screen.getByLabelText('Symbol'), 'gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const file = new File(['cover'], 'gear.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText(/Choose collection cover/), file);
    await user.clear(screen.getByLabelText('Creator wallet'));
    await user.type(screen.getByLabelText('Creator wallet'), ownerAddress);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Deploy collection' }));

    expect(await screen.findByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(await screen.findByText('Astral Gear')).toBeInTheDocument();
    expect(screen.getByText('GEAR')).toBeInTheDocument();
    expect(api.uploadNftMedia).toHaveBeenCalledWith(file, 'access-token');
    expect(api.createNftCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'studio-a',
        ownerAddress,
        coverImageUri: liveCollection.coverImageUri,
      }),
      'access-token',
    );
  });

  it('accepts covers when the browser leaves mime empty but the extension is valid', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText('Name'), 'Astral Gear');
    await user.type(screen.getByLabelText('Symbol'), 'gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const file = new File(['cover'], 'gear.png', { type: '' });
    await user.upload(screen.getByLabelText(/Choose collection cover/), file);

    expect(screen.queryByText('Choose a PNG, JPEG, WebP, or SVG image.')).not.toBeInTheDocument();
    expect(screen.getByText(/gear\.png/i)).toBeInTheDocument();
  });

  it('accepts SVG covers', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText('Name'), 'Astral Gear');
    await user.type(screen.getByLabelText('Symbol'), 'gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'gear.svg', {
      type: 'image/svg+xml',
    });
    await user.upload(screen.getByLabelText(/Choose collection cover/), file);

    expect(screen.queryByText('Choose a PNG, JPEG, WebP, or SVG image.')).not.toBeInTheDocument();
    expect(screen.getByText(/gear\.svg/i)).toBeInTheDocument();
  });

  it('keeps the form recoverable when deployment fails', async () => {
    const user = userEvent.setup();
    api.createNftCollection.mockRejectedValue(new Error('Deployment unavailable'));
    renderFlow();

    await user.type(screen.getByLabelText('Name'), 'Astral Gear');
    await user.type(screen.getByLabelText('Symbol'), 'gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.upload(
      screen.getByLabelText(/Choose collection cover/),
      new File(['cover'], 'gear.webp', { type: 'image/webp' }),
    );
    await user.clear(screen.getByLabelText('Creator wallet'));
    await user.type(screen.getByLabelText('Creator wallet'), ownerAddress);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Deploy collection' }));

    expect(await screen.findByText('Deployment unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deploy collection' })).toBeEnabled();
  });

  it('does not leak an in-progress form when the active workspace changes', async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Name'), 'Studio A Items');
    await user.type(screen.getByLabelText('Symbol'), 'ITEM');

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-b" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
    expect(screen.getByLabelText('Symbol')).toHaveValue('');

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" accessToken="access-token" onClose={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('Studio A Items'),
    );
    expect(screen.getByLabelText('Symbol')).toHaveValue('ITEM');
  });
});
