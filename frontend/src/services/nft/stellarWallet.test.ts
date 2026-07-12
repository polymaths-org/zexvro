import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicKey, isWalletAvailable, signTransaction, StellarWalletError } from './stellarWallet';

describe('stellarWallet', () => {
  afterEach(() => {
    delete window.freighterApi;
    delete window.freighter;
  });

  it('reports unavailable when Freighter is missing', () => {
    expect(isWalletAvailable()).toBe(false);
  });

  it('reads the Freighter public key after permission', async () => {
    window.freighterApi = {
      isConnected: vi.fn().mockResolvedValue(false),
      setAllowed: vi.fn().mockResolvedValue(true),
      getAddress: vi.fn().mockResolvedValue({ address: 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ' }),
      signTransaction: vi.fn(),
    };

    await expect(getPublicKey()).resolves.toBe('GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ');
    expect(window.freighterApi.setAllowed).toHaveBeenCalled();
  });

  it('returns signed XDR from Freighter', async () => {
    window.freighterApi = {
      getAddress: vi.fn(),
      signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
    };

    await expect(signTransaction('prepared-xdr')).resolves.toBe('signed-xdr');
    expect(window.freighterApi.signTransaction).toHaveBeenCalledWith(
      'prepared-xdr',
      expect.objectContaining({ network: 'TESTNET' }),
    );
  });

  it('throws a clear error when Freighter is missing', async () => {
    await expect(getPublicKey()).rejects.toBeInstanceOf(StellarWalletError);
  });
});
