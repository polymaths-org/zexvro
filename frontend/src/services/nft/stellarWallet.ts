export class StellarWalletError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StellarWalletError';
    this.code = code;
  }
}

type FreighterApi = {
  isConnected?: () => Promise<boolean | { isConnected?: boolean }>;
  isAllowed?: () => Promise<boolean | { isAllowed?: boolean }>;
  setAllowed?: () => Promise<boolean | { isAllowed?: boolean }>;
  getAddress?: () => Promise<string | { address?: string; error?: string }>;
  getPublicKey?: () => Promise<string | { publicKey?: string; error?: string }>;
  signTransaction?: (
    xdr: string,
    options?: { networkPassphrase?: string; network?: string; address?: string },
  ) => Promise<string | { signedTxXdr?: string; error?: string }>;
};

declare global {
  interface Window {
    freighterApi?: FreighterApi;
    freighter?: FreighterApi;
  }
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

function freighter(): FreighterApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.freighterApi || window.freighter;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'isConnected' in value) {
    return Boolean((value as { isConnected?: boolean }).isConnected);
  }
  if (value && typeof value === 'object' && 'isAllowed' in value) {
    return Boolean((value as { isAllowed?: boolean }).isAllowed);
  }
  return Boolean(value);
}

function asString(value: unknown, keys: string[]): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    for (const key of keys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      if (key === 'error' && typeof candidate === 'string' && candidate.trim()) {
        throw new StellarWalletError('wallet_error', candidate);
      }
    }
  }
  return undefined;
}

export function isWalletAvailable(): boolean {
  const api = freighter();
  return Boolean(api && (api.getAddress || api.getPublicKey) && api.signTransaction);
}

export async function getPublicKey(): Promise<string> {
  const api = freighter();
  if (!api) {
    throw new StellarWalletError(
      'wallet_unavailable',
      'Freighter is not installed. Install the Freighter browser extension to sign Stellar transactions.',
    );
  }

  try {
    if (api.isConnected) {
      const connected = asBoolean(await api.isConnected());
      if (!connected && api.setAllowed) await api.setAllowed();
    } else if (api.isAllowed) {
      const allowed = asBoolean(await api.isAllowed());
      if (!allowed && api.setAllowed) await api.setAllowed();
    } else if (api.setAllowed) {
      await api.setAllowed();
    }
  } catch (error) {
    if (error instanceof StellarWalletError) throw error;
    throw new StellarWalletError(
      'wallet_permission_denied',
      'Freighter did not grant access. Approve this site in the extension and try again.',
    );
  }

  try {
    if (api.getAddress) {
      const address = asString(await api.getAddress(), ['address', 'error']);
      if (address) return address;
    }
    if (api.getPublicKey) {
      const publicKey = asString(await api.getPublicKey(), ['publicKey', 'error']);
      if (publicKey) return publicKey;
    }
  } catch (error) {
    if (error instanceof StellarWalletError) throw error;
    throw new StellarWalletError(
      'wallet_address_failed',
      error instanceof Error ? error.message : 'Freighter did not return a public key.',
    );
  }

  throw new StellarWalletError('wallet_address_failed', 'Freighter did not return a public key.');
}

export async function signTransaction(
  serializedTransaction: string,
  networkPassphrase: string = TESTNET_PASSPHRASE,
): Promise<string> {
  const api = freighter();
  if (!api?.signTransaction) {
    throw new StellarWalletError(
      'wallet_unavailable',
      'Freighter is not installed. Install the Freighter browser extension to sign Stellar transactions.',
    );
  }
  if (!serializedTransaction.trim()) {
    throw new StellarWalletError('wallet_invalid_transaction', 'No prepared transaction is available to sign.');
  }

  try {
    const signed = await api.signTransaction(serializedTransaction, {
      networkPassphrase,
      network: 'TESTNET',
    });
    const xdr = asString(signed, ['signedTxXdr', 'error']);
    if (!xdr) {
      throw new StellarWalletError('wallet_sign_failed', 'Freighter did not return a signed transaction.');
    }
    return xdr;
  } catch (error) {
    if (error instanceof StellarWalletError) throw error;
    throw new StellarWalletError(
      'wallet_sign_failed',
      error instanceof Error ? error.message : 'Freighter could not sign the transaction.',
    );
  }
}

export const STELLAR_TESTNET_PASSPHRASE = TESTNET_PASSPHRASE;
