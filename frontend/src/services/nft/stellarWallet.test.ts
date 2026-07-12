import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const freighterApi = vi.hoisted(() => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => ({
  default: freighterApi,
  ...freighterApi,
}));

import {
  formatWalletError,
  getPublicKey,
  isWalletAvailable,
  signTransaction,
  StellarWalletError,
} from './stellarWallet';

describe('stellarWallet', () => {
  beforeEach(() => {
    freighterApi.isConnected.mockReset();
    freighterApi.isAllowed.mockReset();
    freighterApi.setAllowed.mockReset();
    freighterApi.requestAccess.mockReset();
    freighterApi.getAddress.mockReset();
    freighterApi.signTransaction.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports unavailable when Freighter isConnected is false', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: false });
    await expect(isWalletAvailable()).resolves.toBe(false);
  });

  it('reports available when Freighter extension responds', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: true });
    await expect(isWalletAvailable()).resolves.toBe(true);
  });

  it('reads the Freighter public key via requestAccess', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: true });
    freighterApi.requestAccess.mockResolvedValue({
      address: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
    });

    await expect(getPublicKey()).resolves.toBe('GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ');
    expect(freighterApi.requestAccess).toHaveBeenCalled();
  });

  it('falls back to getAddress when requestAccess returns empty address', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: true });
    freighterApi.requestAccess.mockResolvedValue({ address: '' });
    freighterApi.isAllowed.mockResolvedValue({ isAllowed: true });
    freighterApi.getAddress.mockResolvedValue({
      address: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
    });

    await expect(getPublicKey()).resolves.toBe('GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ');
  });

  it('returns signed XDR from Freighter', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: true });
    freighterApi.isAllowed.mockResolvedValue({ isAllowed: true });
    freighterApi.requestAccess.mockResolvedValue({
      address: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
    });
    freighterApi.signTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr' });

    await expect(signTransaction('prepared-xdr')).resolves.toBe('signed-xdr');
    expect(freighterApi.signTransaction).toHaveBeenCalledWith(
      'prepared-xdr',
      expect.objectContaining({
        networkPassphrase: 'Test SDF Network ; September 2015',
        address: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ',
      }),
    );
  });

  it('throws a clear error when Freighter is missing', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: false });
    await expect(getPublicKey()).rejects.toBeInstanceOf(StellarWalletError);
    await expect(getPublicKey()).rejects.toMatchObject({ code: 'wallet_unavailable' });
  });

  it('maps Freighter rejection errors', async () => {
    freighterApi.isConnected.mockResolvedValue({ isConnected: true });
    freighterApi.requestAccess.mockResolvedValue({
      address: '',
      error: { message: 'User rejected access' },
    });
    freighterApi.isAllowed.mockResolvedValue({ isAllowed: false });
    freighterApi.setAllowed.mockResolvedValue({
      isAllowed: false,
      error: { message: 'User rejected access' },
    });

    await expect(getPublicKey()).rejects.toMatchObject({ code: 'wallet_permission_denied' });
  });

  it('formats wallet errors for UI', () => {
    expect(formatWalletError(new StellarWalletError('wallet_unavailable', 'Nope'))).toBe('Nope');
    expect(formatWalletError(new Error('boom'))).toBe('boom');
  });
});
