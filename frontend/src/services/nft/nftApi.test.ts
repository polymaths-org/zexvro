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
  submitNftSaleConfig,
  submitPublicCheckoutIntent,
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
          stellarConfigured: false,
          storageMode: 'local',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNftServiceHealth()).resolves.toMatchObject({
      service: 'nft-service',
      capabilities: { stellarConfigured: false, storageMode: 'local' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/nft/health', expect.objectContaining({
      headers: { Accept: 'application/json' },
    }));
  });

  it('sends bearer tokens for authenticated collection routes', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ collections: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          asset: {
            cid: 'bafy',
            uri: 'ipfs://bafy',
            size: 12,
            mimeType: 'image/png',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          collection: {
            id: 'collection-id',
            workspaceId: 'studio-a',
            name: 'Astral Gear',
            symbol: 'GEAR',
            description: 'Equipment used throughout the Astral Gear game world.',
            ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            baseMetadataUri: 'ipfs://bafybase/',
            collectionMetadataUri: 'ipfs://bafymeta',
            coverImageUri: 'ipfs://bafycover',
            royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            royaltyBps: 500,
            status: 'live',
            createdAt: '2026-07-11T00:00:00.000Z',
            updatedAt: '2026-07-11T00:00:00.000Z',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          collection: {
            id: 'collection-id',
            workspaceId: 'studio-a',
            name: 'Astral Gear II',
            symbol: 'GEAR',
            description: 'Updated',
            ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            baseMetadataUri: 'ipfs://bafybase/',
            collectionMetadataUri: 'ipfs://bafymeta',
            coverImageUri: 'ipfs://bafycover',
            royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            royaltyBps: 500,
            status: 'live',
            createdAt: '2026-07-11T00:00:00.000Z',
            updatedAt: '2026-07-11T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          collection: {
            id: 'collection-id',
            workspaceId: 'studio-a',
            name: 'Astral Gear',
            symbol: 'GEAR',
            description: 'Equipment used throughout the Astral Gear game world.',
            ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            baseMetadataUri: 'ipfs://bafybase/',
            collectionMetadataUri: 'ipfs://bafymeta',
            coverImageUri: 'ipfs://bafycover',
            royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            royaltyBps: 500,
            status: 'live',
            createdAt: '2026-07-11T00:00:00.000Z',
            updatedAt: '2026-07-11T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          intent: {
            serializedTransaction: 'prepared-sale',
            requiredSigners: ['GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'],
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ));
    vi.stubGlobal('fetch', fetchMock);

    await listNftCollections('studio-a', 'token');
    await uploadNftMedia(new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' }), 'token');
    await createNftCollection({
      workspaceId: 'studio-a',
      name: 'Astral Gear',
      symbol: 'GEAR',
      description: 'Equipment used throughout the Astral Gear game world.',
      ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      coverImageUri: 'ipfs://bafycover',
      royaltyRecipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      royaltyBps: 500,
    }, 'token');
    await updateNftCollection('collection-id', { name: 'Astral Gear II' }, 'token');
    await retryNftCollectionDeployment('collection-id', 'token');
    await deleteNftCollection('collection-id', 'token');
    await prepareNftSaleConfig({
      collectionId: 'collection-id',
      ownerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      priceAtomic: '1000000',
      accessToken: 'token',
    });

    expect(fetchMock.mock.calls.every((call) => {
      const headers = call[1]?.headers as Record<string, string>;
      return headers.Authorization === 'Bearer token' || call[0] === '/api/nft/health';
    })).toBe(true);
  });

  it('uses public routes for collection lookup and checkout intents', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          collection: {
            id: 'collection-id',
            name: 'Astral Gear',
            symbol: 'GEAR',
            description: 'Equipment used throughout the Astral Gear game world.',
            baseMetadataUri: 'ipfs://bafybase/',
            collectionMetadataUri: 'ipfs://bafymeta',
            coverImageUri: 'ipfs://bafycover',
            royaltyBps: 500,
            status: 'live',
            createdAt: '2026-07-11T00:00:00.000Z',
            updatedAt: '2026-07-11T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          intent: {
            id: 'intent-1',
            collectionId: 'collection-id',
            tokenId: 1,
            buyerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
            serializedTransaction: 'prepared',
            requiredSigners: ['GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'],
            status: 'pending_signature',
            expiresAt: '2026-07-12T00:05:00.000Z',
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

  it('submits sale config and public checkout intents', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        transaction: { transactionHash: 'sale-hash', status: 'confirmed' },
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        intent: {
          id: 'intent-1',
          collectionId: 'collection-id',
          tokenId: 1,
          buyerAddress: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
          serializedTransaction: 'prepared',
          requiredSigners: ['GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ'],
          status: 'confirmed',
          expiresAt: '2026-07-12T00:05:00.000Z',
          createdAt: '2026-07-12T00:00:00.000Z',
          updatedAt: '2026-07-12T00:01:00.000Z',
          transactionHash: 'buy-hash',
        },
        transaction: { transactionHash: 'buy-hash', status: 'confirmed' },
      }), { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await submitNftSaleConfig({
      collectionId: 'collection-id',
      preparedTransaction: 'prepared-sale',
      signedTransaction: 'signed-sale',
      priceAtomic: '12500000',
      accessToken: 'token',
    });
    await submitPublicCheckoutIntent({
      intentId: 'intent-1',
      signedTransaction: 'signed-checkout',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/nft/v1/collections/collection-id/sale-config/submit',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/nft/v1/public/checkout/intents/intent-1/submit',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
