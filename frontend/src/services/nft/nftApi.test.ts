import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicCheckoutIntent,
  createNftCollection,
  deleteNftCollection,
  getPublicNftCollection,
  getNftServiceHealth,
  listNftCollections,
  prepareNftSaleConfig,
  retryNftCollectionDeployment,
  updateNftCollection,
  uploadNftMedia,
} from './nftApi';

describe('NFT API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads public service capabilities without sending credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        status: 'ok',
        service: 'nft-service',
        capabilities: {
          network: 'stellar:testnet',
          pinningConfigured: true,
          stellarConfigured: true,
          storageMode: 'local',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const health = await getNftServiceHealth();

    expect(health.capabilities.storageMode).toBe('local');
    expect(fetchMock).toHaveBeenCalledWith('/api/nft/health', expect.objectContaining({
      headers: { Accept: 'application/json' },
    }));
  });

  it('scopes collection listing through the bearer token and encoded workspace', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ collections: [] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await listNftCollections('studio/a', 'access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/nft/v1/collections?workspaceId=studio%2Fa',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    );
  });

  it('uploads media before creating a collection', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          asset: {
            cid: 'asset-id',
            uri: 'http://127.0.0.1:4101/v1/assets/asset-id',
            size: 5,
            mimeType: 'image/webp',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ collection: { id: 'collection-id' } }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });

    const asset = await uploadNftMedia(file, 'access-token');
    await createNftCollection({
      workspaceId: 'studio-a',
      name: 'Astral Gear',
      symbol: 'GEAR',
      description: 'Equipment used throughout the Astral Gear game world.',
      ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      coverImageUri: asset.uri,
      royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      royaltyBps: 500,
    }, 'access-token');

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('Astral Gear');
  });

  it('surfaces the API error code and safe message', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        error: { code: 'pinning_not_configured', message: 'PINATA_JWT is required' },
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )));

    await expect(listNftCollections('studio-a', 'access-token')).rejects.toEqual(
      expect.objectContaining({
        code: 'pinning_not_configured',
        message: 'PINATA_JWT is required',
        status: 503,
      }),
    );
  });

  it('updates, retries, and deletes collection records through authenticated lifecycle routes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ collection: { id: 'collection-id', name: 'Retry' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ collection: { id: 'collection-id', status: 'live' } }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          intent: {
            serializedTransaction: 'prepared-sale',
            requiredSigners: ['GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'],
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await updateNftCollection('collection-id', { name: 'Retry' }, 'access-token');
    await retryNftCollectionDeployment('collection-id', 'access-token');
    await prepareNftSaleConfig({
      collectionId: 'collection-id',
      ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      priceAtomic: '12500000',
      accessToken: 'access-token',
    });
    await deleteNftCollection('collection-id', 'access-token');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/nft/v1/collections/collection-id', expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/nft/v1/collections/collection-id/retry', expect.objectContaining({
      method: 'POST',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/nft/v1/collections/collection-id/sale-config/intent', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
        priceAtomic: '12500000',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/nft/v1/collections/collection-id', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('loads public collections and prepares public checkout intents without credentials', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ collection: { id: 'collection-id', name: 'Sky Forge' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          intent: {
            id: 'intent-id',
            collectionId: 'collection-id',
            tokenId: 1,
            buyerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            serializedTransaction: 'tx',
            requiredSigners: ['GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'],
            status: 'pending_signature',
            expiresAt: '2026-07-12T00:00:00.000Z',
            createdAt: '2026-07-12T00:00:00.000Z',
            updatedAt: '2026-07-12T00:00:00.000Z',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ));
    vi.stubGlobal('fetch', fetchMock);

    await getPublicNftCollection('collection-id');
    await createPublicCheckoutIntent({
      collectionId: 'collection-id',
      buyerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      tokenId: 1,
      idempotencyKey: 'public-buy-1',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/nft/v1/public/collections/collection-id', expect.objectContaining({
      headers: { Accept: 'application/json' },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/nft/v1/public/checkout/intents', expect.objectContaining({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'public-buy-1',
      },
    }));
  });
});
