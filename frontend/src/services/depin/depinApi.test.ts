import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDepinHealth,
  getDepinStatus,
  probeDepinProvider,
  type DepinProvider,
} from './depinApi';

const DEPIN_BASE = 'https://sr9k3xpmbj.us-east-1.awsapprunner.com';

const provider: DepinProvider = {
  route: '/v1/nft-health',
  method: 'GET',
  description: 'ZEXVRO NFT service health response',
  price: '$0.001',
  recipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
  network: 'stellar:testnet',
  timeoutMs: 5000,
  upstreamOrigin: 'http://127.0.0.1:4101',
  upstreamSecretRequired: false,
};

function encoded(value: unknown) {
  return globalThis.btoa(JSON.stringify(value));
}

describe('De-pin API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads health and sanitized status through the Vite proxy path', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ status: 'ok', service: 'depin' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          status: 'ok',
          service: 'depin',
          multiInstanceSafe: false,
          stateBackend: 'memory',
          capabilities: {
            scheme: 'exact',
            network: 'stellar:testnet',
            facilitatorUrl: 'https://x402.org/facilitator',
            facilitatorAuthConfigured: false,
            facilitatorOzChannels: false,
            settleAuthRequired: false,
            settleReady: true,
            settlement: 'after_upstream_success',
            fees: 'sponsored',
            replayTtlMs: 600000,
            unpaidRateLimit: { maxRequests: 30, windowMs: 60000 },
          },
          providers: [provider],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const health = await getDepinHealth();
    const status = await getDepinStatus();

    expect(health.service).toBe('depin');
    expect(status.providers[0]?.route).toBe('/v1/nft-health');
    expect(status.capabilities.settleReady).toBe(true);
    expect(status.multiInstanceSafe).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${DEPIN_BASE}/health`, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${DEPIN_BASE}/status`, expect.any(Object));
  });

  it('probes a provider and decodes the standard x402 challenge header', async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: 'stellar:testnet',
          amount: '10000',
          payTo: provider.recipient,
        },
      ],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 402,
      headers: {
        'content-type': 'application/json',
        'PAYMENT-REQUIRED': encoded(paymentRequired),
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await probeDepinProvider(provider);

    expect(result.httpStatus).toBe(402);
    expect(result.hasPaymentRequiredHeader).toBe(true);
    expect(result.paymentRequired?.accepts?.[0]).toMatchObject({
      scheme: 'exact',
      network: 'stellar:testnet',
      amount: '10000',
      payTo: provider.recipient,
    });
  });
});
