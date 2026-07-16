import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DepinService from './DepinService';

const api = vi.hoisted(() => ({
  getDepinHealth: vi.fn(),
  getDepinStatus: vi.fn(),
  probeDepinProvider: vi.fn(),
}));

vi.mock('../../services/depin/depinApi', () => api);

const status = {
  status: 'ok',
  service: 'depin',
  stateBackend: 'memory' as const,
  multiInstanceSafe: false,
  configSource: { type: 'file' as const, detail: 'depin.config.json' },
  capabilities: {
    scheme: 'exact',
    network: 'stellar:testnet',
    facilitatorUrl: 'https://x402.org/facilitator',
    settleReady: true,
    settlement: 'after_upstream_success',
    fees: 'sponsored',
    replayTtlMs: 600000,
    unpaidRateLimit: { maxRequests: 30, windowMs: 60000 },
  },
  providers: [
    {
      route: '/v1/nft-health',
      method: 'GET',
      description: 'ZEXVRO NFT service health response',
      price: '$0.001',
      recipient: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      network: 'stellar:testnet',
      timeoutMs: 5000,
      upstreamOrigin: 'http://127.0.0.1:4101',
      upstreamSecretRequired: false,
    },
  ],
};

describe('DepinService', () => {
  beforeEach(() => {
    api.getDepinHealth.mockResolvedValue({ status: 'ok', service: 'depin' });
    api.getDepinStatus.mockResolvedValue(status);
    api.probeDepinProvider.mockResolvedValue({
      httpStatus: 402,
      hasPaymentRequiredHeader: true,
      paymentRequired: {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'stellar:testnet',
            amount: '10000',
            payTo: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
          },
        ],
      },
    });
  });

  it('renders configured x402 gateway providers', async () => {
    render(<DepinService />);

    expect(await screen.findByRole('heading', { name: 'x402 Gateway' })).toBeInTheDocument();
    expect(screen.getByText('GET /v1/nft-health')).toBeInTheDocument();
    expect(screen.getByText('$0.001')).toBeInTheDocument();
    expect(screen.getByText('stellar:testnet')).toBeInTheDocument();
  });

  it('shows the unpaid x402 probe result', async () => {
    const user = userEvent.setup();
    render(<DepinService />);

    await user.click(await screen.findByRole('button', { name: /probe 402/i }));

    expect(await screen.findByText('PAYMENT-REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('0.001 USDC')).toBeInTheDocument();
    expect(api.probeDepinProvider).toHaveBeenCalledWith(status.providers[0]);
  });

  it('surfaces single-instance state and OZ settle warnings', async () => {
    api.getDepinStatus.mockResolvedValue({
      ...status,
      multiInstanceSafe: false,
      capabilities: {
        ...status.capabilities,
        settleReady: false,
      },
    });

    render(<DepinService />);

    expect(await screen.findByText(/Needs OZ key/i)).toBeInTheDocument();
    expect(screen.getByText(/OZ_API_KEY/i)).toBeInTheDocument();
    expect(screen.getByText(/single-instance/i)).toBeInTheDocument();
  });
});
