import freighterApi from '@stellar/freighter-api';
import { Address, TransactionBuilder } from '@stellar/stellar-sdk';
import { AssembledTransaction } from '@stellar/stellar-sdk/contract';
import {
  STELLAR_TESTNET_PASSPHRASE as NET_TESTNET_PASSPHRASE,
  STELLAR_PUBLIC_PASSPHRASE as NET_PUBLIC_PASSPHRASE,
  DEFAULT_SOROBAN_RPC_TESTNET,
  DEFAULT_SOROBAN_RPC_MAINNET,
  isTestnetPassphrase,
} from '../../lib/stellarNetwork';
import { getStellarWalletsKit } from '../../api/stellarWalletsKit';
import type { WalletProvider } from '../../api/walletConnect';
import {
  connectAlbedo,
  connectFreighter,
  connectXBull,
} from '../../api/walletConnect';
import { connectWithWalletsKit } from '../../api/stellarWalletsKit';

export class StellarWalletError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StellarWalletError';
    this.code = code;
  }
}

const TESTNET_PASSPHRASE = NET_TESTNET_PASSPHRASE;
const PUBLIC_PASSPHRASE = NET_PUBLIC_PASSPHRASE;
const FREIGHTER_INSTALL_URL = 'https://www.freighter.app/';
const SESSION_KEY = 'zexvro_nft_wallet_session';

export type NftCheckoutWalletId = 'freighter' | 'albedo' | 'xbull' | 'kit';

export type NftWalletSession = {
  address: string;
  provider: NftCheckoutWalletId;
  kitWalletId?: string;
  kitWalletName?: string;
  network: 'TESTNET' | 'PUBLIC';
};

function placeholderRpcForPassphrase(networkPassphrase: string): string {
  return isTestnetPassphrase(networkPassphrase)
    ? DEFAULT_SOROBAN_RPC_TESTNET
    : DEFAULT_SOROBAN_RPC_MAINNET;
}

function networkFromPassphrase(networkPassphrase: string): 'TESTNET' | 'PUBLIC' {
  return isTestnetPassphrase(networkPassphrase) ? 'TESTNET' : 'PUBLIC';
}

export function readWalletSession(): NftWalletSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NftWalletSession;
    if (!parsed?.address || !parsed?.provider) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWalletSession(session: NftWalletSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearWalletSession(): void {
  writeWalletSession(null);
}

function mapProvider(provider: WalletProvider): NftCheckoutWalletId {
  if (provider === 'freighter' || provider === 'albedo' || provider === 'xbull' || provider === 'kit') {
    return provider;
  }
  return 'freighter';
}

type PreparedAssembledJson = {
  method?: string;
  tx?: string;
  simulationResult?: {
    auth: string[];
    retval: string;
  };
  simulationTransactionData?: string;
};

function extractInvokeContractTarget(
  txXdr: string,
  networkPassphrase: string,
): { contractId: string; method: string } {
  const built = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
  if (built.operations.length !== 1) {
    throw new StellarWalletError(
      'wallet_invalid_transaction',
      'Prepared transaction must contain exactly one contract invocation.',
    );
  }
  const operation = built.operations[0] as {
    type?: string;
    func?: {
      switch: () => { name: string };
      value: () => {
        contractAddress: () => unknown;
        functionName: () => { toString: (encoding: string) => string };
      };
    };
  };
  if (operation.type !== 'invokeHostFunction' || !operation.func) {
    throw new StellarWalletError(
      'wallet_invalid_transaction',
      'Prepared transaction is not a Soroban contract invocation.',
    );
  }
  if (operation.func.switch().name !== 'hostFunctionTypeInvokeContract') {
    throw new StellarWalletError(
      'wallet_invalid_transaction',
      'Prepared transaction is not an invokeContract host function.',
    );
  }
  const invoke = operation.func.value();
  const contractId = Address.fromScAddress(invoke.contractAddress() as never).toString();
  const method = invoke.functionName().toString('utf-8');
  if (!contractId || !method) {
    throw new StellarWalletError(
      'wallet_invalid_transaction',
      'Could not read contract id or method from the prepared transaction.',
    );
  }
  return { contractId, method };
}

type FreighterErrorLike = {
  code?: number | string;
  message?: string;
  error?: unknown;
};

function freighterErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const record = error as FreighterErrorLike & Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
    if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
    if (record.error && typeof record.error === 'object') {
      const nested = freighterErrorMessage(record.error);
      if (nested) return nested;
    }
  }
  return undefined;
}

function throwIfFreighterError(result: { error?: unknown } | null | undefined, fallbackCode: string, fallbackMessage: string): void {
  if (!result?.error) return;
  const message = freighterErrorMessage(result.error) || fallbackMessage;
  const lower = message.toLowerCase();
  if (lower.includes('reject') || lower.includes('denied') || lower.includes('user declined') || lower.includes('cancelled') || lower.includes('canceled')) {
    throw new StellarWalletError('wallet_permission_denied', message);
  }
  if (lower.includes('network')) {
    throw new StellarWalletError('wallet_network_mismatch', message);
  }
  throw new StellarWalletError(fallbackCode, message);
}

/**
 * Freighter no longer reliably exposes a rich window.freighterApi object for dapps.
 * Official integration is via @stellar/freighter-api, which talks to the extension
 * over postMessage. isConnected() is the supported "is the extension present?" probe.
 */
export async function isWalletAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    // isConnected() can be false when Freighter is installed but locked / not yet
    // allowed for this origin. Prefer "extension present" so Connect can call requestAccess.
    if (typeof freighterApi.isConnected === 'function') {
      const status = await freighterApi.isConnected();
      if (status?.error) {
        // Extension responded with an error payload but is present.
        return true;
      }
      if (status?.isConnected) return true;
      // Explicit false means the bridge answered — treat as not ready (locked/not installed path).
      if (status && status.isConnected === false) return false;
    }
    // Fallback when isConnected is missing: probe getNetwork.
    if (typeof freighterApi.getNetwork === 'function') {
      try {
        await freighterApi.getNetwork();
        return true;
      } catch {
        // ignore
      }
    }
    return Boolean(
      (window as Window & { freighterApi?: unknown; freighter?: unknown }).freighterApi
        || (window as Window & { freighter?: unknown }).freighter,
    );
  } catch {
    return Boolean(
      (window as Window & { freighterApi?: unknown; freighter?: unknown }).freighterApi
        || (window as Window & { freighter?: unknown }).freighter,
    );
  }
}

/** @deprecated Prefer await isWalletAvailable(); kept for rare sync UI probes. */
export function isWalletAvailableSync(): boolean {
  if (typeof window === 'undefined') return false;
  // Best-effort only: official package uses async isConnected via postMessage.
  return Boolean(
    // legacy inject (older extensions / tests)
    (window as Window & { freighterApi?: unknown; freighter?: unknown }).freighterApi
      || (window as Window & { freighter?: unknown }).freighter,
  );
}

/**
 * Ensure Freighter is on the network ZEXVRO expects (testnet by default).
 * Stellar dapp skill: surface network mismatch before signing.
 */
export async function assertWalletNetwork(
  networkPassphrase: string = TESTNET_PASSPHRASE,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new StellarWalletError('wallet_unavailable', 'Wallet APIs are only available in the browser.');
  }
  const network = await freighterApi.getNetwork();
  throwIfFreighterError(
    network,
    'wallet_network_mismatch',
    'Could not read Freighter network. Unlock Freighter and try again.',
  );
  const passphrase = (network.networkPassphrase || '').trim();
  const label = (network.network || '').trim().toUpperCase();
  if (passphrase && passphrase !== networkPassphrase) {
    const expected = isTestnetPassphrase(networkPassphrase) ? 'Testnet' : 'Mainnet (Public)';
    throw new StellarWalletError(
      'wallet_network_mismatch',
      `Freighter is on ${label || passphrase}, but ZEXVRO expects ${expected}. Open Freighter → switch network, then retry.`,
    );
  }
  const wantTestnet = isTestnetPassphrase(networkPassphrase);
  if (!passphrase && label) {
    const freighterTest = label === 'TESTNET' || label === 'FUTURENET';
    const freighterPublic = label === 'PUBLIC' || label === 'MAINNET';
    if ((wantTestnet && !freighterTest) || (!wantTestnet && !freighterPublic)) {
      throw new StellarWalletError(
        'wallet_network_mismatch',
        `Freighter is on ${label}, but ZEXVRO expects ${wantTestnet ? 'Testnet' : 'Mainnet'}. Open Freighter → switch network, then retry.`,
      );
    }
  }
}

async function getFreighterPublicKey(): Promise<string> {
  const connected = await freighterApi.isConnected();
  throwIfFreighterError(
    connected,
    'wallet_unavailable',
    `Freighter is not available in this browser. Install Freighter (${FREIGHTER_INSTALL_URL}), unlock it, and allow this site.`,
  );
  if (!connected.isConnected) {
    throw new StellarWalletError(
      'wallet_unavailable',
      `Freighter is not available in this browser. Install Freighter (${FREIGHTER_INSTALL_URL}), unlock it, enable it for this site, and use the same browser profile as the extension.`,
    );
  }

  const access = await freighterApi.requestAccess();
  throwIfFreighterError(
    access,
    'wallet_permission_denied',
    'Freighter did not grant access. Approve this site in the Freighter popup and try again.',
  );
  if (access.address?.trim()) {
    return access.address.trim();
  }

  const allowed = await freighterApi.isAllowed();
  if (!allowed.isAllowed) {
    const set = await freighterApi.setAllowed();
    throwIfFreighterError(
      set,
      'wallet_permission_denied',
      'Freighter did not grant access. Approve this site in the Freighter popup and try again.',
    );
  }

  const addressResult = await freighterApi.getAddress();
  throwIfFreighterError(
    addressResult,
    'wallet_address_failed',
    'Freighter did not return a public key.',
  );
  if (addressResult.address?.trim()) {
    return addressResult.address.trim();
  }

  throw new StellarWalletError('wallet_address_failed', 'Freighter did not return a public key.');
}

/**
 * Connect a checkout wallet. Freighter is default; Albedo / xBull / kit cover other options.
 */
export async function connectCheckoutWallet(
  provider: NftCheckoutWalletId = 'freighter',
  networkPassphrase: string = TESTNET_PASSPHRASE,
): Promise<NftWalletSession> {
  if (typeof window === 'undefined') {
    throw new StellarWalletError('wallet_unavailable', 'Wallet APIs are only available in the browser.');
  }
  const network = networkFromPassphrase(networkPassphrase);

  try {
    if (provider === 'freighter') {
      // Prefer freighter-api path (requestAccess + network assert later on sign).
      let address = '';
      try {
        address = await getFreighterPublicKey();
      } catch {
        const via = await connectFreighter(network);
        address = via.publicKey;
      }
      const session: NftWalletSession = { address, provider: 'freighter', network };
      writeWalletSession(session);
      return session;
    }

    if (provider === 'albedo') {
      const via = await connectAlbedo(network);
      const session: NftWalletSession = {
        address: via.publicKey,
        provider: 'albedo',
        network,
      };
      writeWalletSession(session);
      return session;
    }

    if (provider === 'xbull') {
      const via = await connectXBull(network);
      const session: NftWalletSession = {
        address: via.publicKey,
        provider: 'xbull',
        network,
      };
      writeWalletSession(session);
      return session;
    }

    const via = await connectWithWalletsKit(network);
    const session: NftWalletSession = {
      address: via.publicKey,
      provider: mapProvider(via.provider),
      kitWalletId: via.kitWalletId,
      kitWalletName: via.kitWalletName,
      network,
    };
    writeWalletSession(session);
    return session;
  } catch (error) {
    if (error instanceof StellarWalletError) throw error;
    throw new StellarWalletError(
      'wallet_connect_failed',
      error instanceof Error ? error.message : 'Could not connect wallet.',
    );
  }
}

export async function getPublicKey(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new StellarWalletError('wallet_unavailable', 'Wallet APIs are only available in the browser.');
  }

  const session = readWalletSession();
  if (session?.address) {
    // Re-confirm Freighter still owns the key when that was the last provider.
    if (session.provider === 'freighter') {
      try {
        const current = await getFreighterPublicKey();
        if (current !== session.address) {
          const next = { ...session, address: current };
          writeWalletSession(next);
          return current;
        }
      } catch {
        // fall through to freighter-only connect
      }
    } else if (session.kitWalletId || session.provider === 'albedo' || session.provider === 'xbull' || session.provider === 'kit') {
      return session.address;
    }
  }

  const address = await getFreighterPublicKey();
  writeWalletSession({
    address,
    provider: 'freighter',
    network: 'TESTNET',
  });
  return address;
}

function asSignedAuthEntryString(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value instanceof Uint8Array) {
    // Buffer / Uint8Array from some wallets — encode as base64 if not already stringy
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value).toString('base64');
    }
    let binary = '';
    value.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const s = String(value);
    if (s && s !== '[object Object]') return s;
  }
  throw new StellarWalletError('wallet_sign_failed', 'Wallet returned an empty authorization entry.');
}

async function signAuthEntryWithSession(
  entryXdr: string,
  networkPassphrase: string,
  address: string,
  session: NftWalletSession | null,
): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
  const useKit =
    session
    && session.provider !== 'freighter'
    && (session.kitWalletId || session.provider === 'albedo' || session.provider === 'xbull' || session.provider === 'kit');

  if (useKit && session) {
    const network = networkFromPassphrase(networkPassphrase);
    const kit = getStellarWalletsKit(network);
    if (session.kitWalletId) kit.setWallet(session.kitWalletId);
    else if (session.provider === 'albedo') kit.setWallet('albedo');
    else if (session.provider === 'xbull') kit.setWallet('xbull');
    try {
      const signed = await kit.signAuthEntry(entryXdr, {
        networkPassphrase,
        address,
      });
      if (!signed.signedAuthEntry) {
        throw new StellarWalletError('wallet_sign_failed', 'Wallet did not return a signed authorization entry.');
      }
      return {
        signedAuthEntry: asSignedAuthEntryString(signed.signedAuthEntry),
        signerAddress: signed.signerAddress || address,
      };
    } catch (error) {
      if (error instanceof StellarWalletError) throw error;
      throw new StellarWalletError(
        'wallet_sign_failed',
        error instanceof Error ? error.message : 'Wallet could not sign the authorization entry.',
      );
    }
  }

  const signed = await freighterApi.signAuthEntry(entryXdr, {
    networkPassphrase,
    address,
  });
  throwIfFreighterError(signed, 'wallet_sign_failed', 'Freighter could not sign the authorization entry.');
  if (!signed.signedAuthEntry) {
    throw new StellarWalletError('wallet_sign_failed', 'Freighter did not return a signed authorization entry.');
  }
  return {
    signedAuthEntry: asSignedAuthEntryString(signed.signedAuthEntry),
    signerAddress: signed.signerAddress || address,
  };
}

export async function signTransaction(
  serializedTransaction: string,
  networkPassphrase: string = TESTNET_PASSPHRASE,
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new StellarWalletError('wallet_unavailable', 'Wallet APIs are only available in the browser.');
  }
  if (!serializedTransaction.trim()) {
    throw new StellarWalletError('wallet_invalid_transaction', 'No prepared transaction is available to sign.');
  }

  const session = readWalletSession();
  const useFreighter = !session || session.provider === 'freighter';

  if (useFreighter) {
    const connected = await freighterApi.isConnected();
    throwIfFreighterError(
      connected,
      'wallet_unavailable',
      `Freighter is not available in this browser. Install Freighter (${FREIGHTER_INSTALL_URL}), unlock it, and allow this site.`,
    );
    if (!connected.isConnected) {
      throw new StellarWalletError(
        'wallet_unavailable',
        `Freighter is not available in this browser. Install Freighter (${FREIGHTER_INSTALL_URL}), unlock it, enable it for this site, and use the same browser profile as the extension.`,
      );
    }
    const allowed = await freighterApi.isAllowed();
    if (!allowed.isAllowed) {
      await freighterApi.requestAccess();
    }
    await assertWalletNetwork(networkPassphrase);
  }

  let address: string | undefined;
  try {
    address = session?.address || (await getPublicKey());
  } catch (error) {
    if (error instanceof StellarWalletError && error.code === 'wallet_network_mismatch') {
      throw error;
    }
  }

  const network = isTestnetPassphrase(networkPassphrase) ? 'TESTNET' : 'PUBLIC';

  let txIsJSON = false;
  try {
    JSON.parse(serializedTransaction);
    txIsJSON = serializedTransaction.trim().startsWith('{');
  } catch {
    // not JSON
  }

  if (txIsJSON) {
    if (!address) {
      throw new StellarWalletError('wallet_sign_failed', 'Wallet address required to sign authorization entries.');
    }

    try {
      const parsed = JSON.parse(serializedTransaction) as PreparedAssembledJson;
      if (!parsed.tx || !parsed.simulationResult || !parsed.simulationTransactionData) {
        throw new StellarWalletError(
          'wallet_invalid_transaction',
          'Prepared transaction JSON is missing simulation data required for wallet authorization.',
        );
      }

      const target = extractInvokeContractTarget(parsed.tx, networkPassphrase);
      const method = parsed.method || target.method;
      if (method !== target.method) {
        throw new StellarWalletError(
          'wallet_invalid_transaction',
          `Prepared method '${method}' does not match envelope method '${target.method}'.`,
        );
      }

      const tx = AssembledTransaction.fromJSON(
        {
          contractId: target.contractId,
          networkPassphrase,
          rpcUrl: placeholderRpcForPassphrase(networkPassphrase),
          method,
          parseResultXdr: () => undefined,
        },
        {
          tx: parsed.tx,
          simulationResult: parsed.simulationResult,
          simulationTransactionData: parsed.simulationTransactionData,
        },
      );

      await tx.signAuthEntries({
        address,
        signAuthEntry: async (entryXdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
          return signAuthEntryWithSession(
            entryXdr,
            opts?.networkPassphrase || networkPassphrase,
            opts?.address || address,
            session,
          );
        },
      });
      return tx.toJSON();
    } catch (error) {
      if (error instanceof StellarWalletError) throw error;
      throw new StellarWalletError(
        'wallet_sign_failed',
        error instanceof Error ? error.message : 'Failed to sign authorization entries.',
      );
    }
  }

  if (!useFreighter && session) {
    const kit = getStellarWalletsKit(networkFromPassphrase(networkPassphrase));
    if (session.kitWalletId) kit.setWallet(session.kitWalletId);
    else if (session.provider === 'albedo') kit.setWallet('albedo');
    else if (session.provider === 'xbull') kit.setWallet('xbull');
    try {
      const signed = await kit.signTransaction(serializedTransaction, {
        networkPassphrase,
        ...(address ? { address } : {}),
      });
      if (!signed.signedTxXdr?.trim()) {
        throw new StellarWalletError('wallet_sign_failed', 'Wallet did not return a signed transaction.');
      }
      return signed.signedTxXdr.trim();
    } catch (error) {
      if (error instanceof StellarWalletError) throw error;
      throw new StellarWalletError(
        'wallet_sign_failed',
        error instanceof Error ? error.message : 'Wallet could not sign the transaction.',
      );
    }
  }

  const signed = await freighterApi.signTransaction(serializedTransaction, {
    networkPassphrase,
    ...(network ? { network } : {}),
    ...(address ? { address } : {}),
  });
  throwIfFreighterError(
    signed,
    'wallet_sign_failed',
    'Freighter could not sign the transaction. Confirm Freighter is unlocked, on the correct network, and that you approve the prompt.',
  );
  if (!signed.signedTxXdr?.trim()) {
    throw new StellarWalletError('wallet_sign_failed', 'Freighter did not return a signed transaction.');
  }
  return signed.signedTxXdr.trim();
}

export function formatWalletError(error: unknown): string {
  if (error instanceof StellarWalletError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Wallet action failed.';
}

export const NFT_CHECKOUT_WALLETS: Array<{
  id: NftCheckoutWalletId;
  label: string;
  hint: string;
}> = [
  { id: 'freighter', label: 'Freighter', hint: 'Browser extension' },
  { id: 'albedo', label: 'Albedo', hint: 'Web wallet' },
  { id: 'xbull', label: 'xBull', hint: 'Extension' },
  { id: 'kit', label: 'Others', hint: 'Lobstr, Rabet, Hana…' },
];

export const STELLAR_TESTNET_PASSPHRASE = TESTNET_PASSPHRASE;
export const STELLAR_PUBLIC_PASSPHRASE = PUBLIC_PASSPHRASE;
export const FREIGHTER_WALLET_INSTALL_URL = FREIGHTER_INSTALL_URL;
export { isTestnetPassphrase, DEFAULT_SOROBAN_RPC_MAINNET, DEFAULT_SOROBAN_RPC_TESTNET };

/** Prefer API health / project preference passphrase when available. */
export function resolveNftSignPassphrase(apiPassphrase?: string): string {
  if (apiPassphrase?.trim()) return apiPassphrase.trim();
  try {
    const pref = localStorage.getItem('zexvro_nft_network_pref');
    if (pref === 'mainnet' || pref === 'stellar:pubnet') return PUBLIC_PASSPHRASE;
  } catch { /* ignore */ }
  return TESTNET_PASSPHRASE;
}
