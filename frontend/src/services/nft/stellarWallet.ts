import freighterApi from '@stellar/freighter-api';
import { Address, TransactionBuilder } from '@stellar/stellar-sdk';
import { AssembledTransaction } from '@stellar/stellar-sdk/contract';

export class StellarWalletError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StellarWalletError';
    this.code = code;
  }
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const FREIGHTER_INSTALL_URL = 'https://www.freighter.app/';
const PLACEHOLDER_RPC_URL = 'https://soroban-testnet.stellar.org';

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
    const expected =
      networkPassphrase === TESTNET_PASSPHRASE ? 'Testnet' : 'the required Stellar network';
    throw new StellarWalletError(
      'wallet_network_mismatch',
      `Freighter is on ${label || passphrase}, but ZEXVRO expects ${expected}. Open Freighter → switch network, then retry.`,
    );
  }
  if (!passphrase && label && networkPassphrase === TESTNET_PASSPHRASE && label !== 'TESTNET') {
    throw new StellarWalletError(
      'wallet_network_mismatch',
      `Freighter is on ${label}, but ZEXVRO expects Testnet. Open Freighter → switch network, then retry.`,
    );
  }
}

export async function getPublicKey(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new StellarWalletError('wallet_unavailable', 'Wallet APIs are only available in the browser.');
  }

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

  // requestAccess prompts allow-list + returns the active public key when approved.
  const access = await freighterApi.requestAccess();
  throwIfFreighterError(
    access,
    'wallet_permission_denied',
    'Freighter did not grant access. Approve this site in the Freighter popup and try again.',
  );
  if (access.address?.trim()) {
    await assertWalletNetwork();
    return access.address.trim();
  }

  // Fallback if requestAccess returned empty but site was previously allowed.
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
    await assertWalletNetwork();
    return addressResult.address.trim();
  }

  throw new StellarWalletError('wallet_address_failed', 'Freighter did not return a public key.');
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

  // Ensure site is allowed before sign prompt.
  const allowed = await freighterApi.isAllowed();
  if (!allowed.isAllowed) {
    await freighterApi.requestAccess();
  }

  // Fail fast on wrong Freighter network (skill UX checklist).
  await assertWalletNetwork(networkPassphrase);

  let address: string | undefined;
  try {
    address = await getPublicKey();
  } catch (error) {
    // Network mismatch from getPublicKey must surface; other address issues can still prompt.
    if (error instanceof StellarWalletError && error.code === 'wallet_network_mismatch') {
      throw error;
    }
  }

  const network = networkPassphrase === TESTNET_PASSPHRASE ? 'TESTNET' : undefined;
  
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

      // Client.fromJSON validates that options.contractId matches the envelope.
      // Extract the real target from the prepared XDR instead of using a placeholder.
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
          rpcUrl: PLACEHOLDER_RPC_URL,
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
          const signed = await freighterApi.signAuthEntry(entryXdr, {
            networkPassphrase: opts?.networkPassphrase || networkPassphrase,
            address: opts?.address || address,
          });
          throwIfFreighterError(signed, 'wallet_sign_failed', 'Freighter could not sign the authorization entry.');
          if (!signed.signedAuthEntry) {
            throw new StellarWalletError('wallet_sign_failed', 'Freighter did not return a signed authorization entry.');
          }
          return {
            signedAuthEntry: signed.signedAuthEntry,
            signerAddress: signed.signerAddress || address,
          };
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

  const signed = await freighterApi.signTransaction(serializedTransaction, {
    networkPassphrase,
    ...(network ? { network } : {}),
    ...(address ? { address } : {}),
  });
  throwIfFreighterError(
    signed,
    'wallet_sign_failed',
    'Freighter could not sign the transaction. Confirm Freighter is unlocked, on Testnet, and that you approve the prompt.',
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

export const STELLAR_TESTNET_PASSPHRASE = TESTNET_PASSPHRASE;
export const FREIGHTER_WALLET_INSTALL_URL = FREIGHTER_INSTALL_URL;
