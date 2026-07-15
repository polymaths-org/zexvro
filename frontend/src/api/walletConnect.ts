/**
 * Wallet Connect Utility
 *
 * Handles Stellar wallet connections via Freighter or Albedo browser extensions.
 * Also supports manual public key paste as a fallback.
 *
 * ZEXVRO never holds secret keys — transactions are signed by the user's wallet.
 */
import { isConnected, requestAccess } from '@stellar/freighter-api';

export type WalletProvider = 'freighter' | 'albedo' | 'xbull' | 'manual' | 'kit';

export interface WalletConnection {
  publicKey: string;
  provider: WalletProvider;
  network: 'TESTNET' | 'PUBLIC';
  /** When provider is kit — original module id / display name */
  kitWalletId?: string;
  kitWalletName?: string;
}

/** Check if Freighter wallet extension is available */
export function isFreighterAvailable(): boolean {
  return typeof window !== 'undefined' && !!((window as any).freighterApi || (window as any).freighter);
}

/** Check if xBull wallet extension is available */
export function isXBullAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).xBullSDK;
}

/** Check if Albedo is available (it's always available since it's a web popup) */
export function isAlbedoAvailable(): boolean {
  return typeof window !== 'undefined';
}

/** Detect which wallet providers are available */
export function getAvailableProviders(): WalletProvider[] {
  const providers: WalletProvider[] = ['manual'];
  if (isFreighterAvailable()) providers.unshift('freighter');
  if (isXBullAvailable()) providers.unshift('xbull');
  // Albedo works via web popup, always available
  providers.splice(providers.length - 1, 0, 'albedo');
  return providers;
}

/** Connect to Freighter wallet */
export async function connectFreighter(network: 'TESTNET' | 'PUBLIC' = 'TESTNET'): Promise<WalletConnection> {
  try {
    // 1. Try using the official Freighter API package
    const connectionStatus = await isConnected();
    if (connectionStatus && connectionStatus.isConnected) {
      const accessResponse = await requestAccess();
      if (accessResponse) {
        if (accessResponse.error) {
          throw new Error(typeof accessResponse.error === 'object' ? accessResponse.error.message || JSON.stringify(accessResponse.error) : accessResponse.error);
        }
        const address = accessResponse.address || (accessResponse as any).publicKey || (typeof accessResponse === 'string' ? accessResponse : '');
        if (address) {
          return {
            publicKey: address,
            provider: 'freighter',
            network,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('Official Freighter API failed, trying direct window injection fallback...', err);
  }

  // 2. Direct injection fallback
  const freighter = (window as any).freighterApi || (window as any).freighter;
  if (!freighter) {
    throw new Error('Freighter extension not detected. Please install it from freighter.app or enable it in your browser extensions.');
  }

  try {
    let publicKey = '';
    
    // Some versions of freighter have requestAccess
    if (typeof freighter.requestAccess === 'function') {
      const accessResponse = await freighter.requestAccess();
      if (typeof accessResponse === 'string') {
        publicKey = accessResponse;
      } else if (accessResponse && typeof accessResponse === 'object') {
        if (accessResponse.error) {
          throw new Error(typeof accessResponse.error === 'object' ? accessResponse.error.message || JSON.stringify(accessResponse.error) : accessResponse.error);
        }
        publicKey = accessResponse.address || accessResponse.publicKey || '';
      }
    }

    if (!publicKey) {
      const getAddrFn = freighter.getAddress || freighter.getPublicKey;
      if (typeof getAddrFn === 'function') {
        const addressResponse = await getAddrFn();
        if (typeof addressResponse === 'string') {
          publicKey = addressResponse;
        } else if (addressResponse && typeof addressResponse === 'object') {
          if (addressResponse.error) {
            throw new Error(typeof addressResponse.error === 'object' ? addressResponse.error.message || JSON.stringify(addressResponse.error) : addressResponse.error);
          }
          publicKey = addressResponse.address || addressResponse.publicKey || '';
        }
      }
    }

    if (!publicKey) {
      throw new Error('Could not retrieve public key from Freighter wallet.');
    }

    return {
      publicKey,
      provider: 'freighter',
      network,
    };
  } catch (err: any) {
    console.error('Freighter connection error:', err);
    const errMsg = err?.message || err?.error?.message || (typeof err === 'string' ? err : 'Failed to connect Freighter wallet');
    throw new Error(errMsg);
  }
}

/** Connect to xBull wallet */
export async function connectXBull(network: 'TESTNET' | 'PUBLIC' = 'TESTNET'): Promise<WalletConnection> {
  const xBullSDK = (window as any).xBullSDK;
  if (!xBullSDK) {
    throw new Error('xBull extension not detected. Please install it from xbull.app');
  }

  try {
    // Request connection permission first
    await xBullSDK.connect({
      canRequestPublicKey: true,
      canRequestSign: true
    });
    
    // Get public key
    const publicKey = await xBullSDK.getPublicKey();
    if (!publicKey) {
      throw new Error('Could not retrieve public key from xBull.');
    }

    return {
      publicKey,
      provider: 'xbull',
      network,
    };
  } catch (err: any) {
    console.error('xBull connection error:', err);
    const errMsg = err?.message || err?.error?.message || (typeof err === 'string' ? err : 'Failed to connect xBull wallet');
    throw new Error(errMsg);
  }
}

/** Connect to Albedo (opens popup) */
export async function connectAlbedo(network: 'TESTNET' | 'PUBLIC' = 'TESTNET'): Promise<WalletConnection> {
  try {
    // Albedo loads via dynamic import or script tag
    const albedo = (window as any).albedo;
    if (!albedo) {
      // Try dynamic loading
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://albedo.link/albedo.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Albedo'));
        document.head.appendChild(script);
      });
    }

    const result = await (window as any).albedo.publicKey({
      require_existing: false,
    });

    return {
      publicKey: result.pubkey,
      provider: 'albedo',
      network,
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Albedo connection cancelled or failed');
  }
}

/** Create a manual wallet connection from a pasted public key */
export function connectManual(publicKey: string, network: 'TESTNET' | 'PUBLIC' = 'TESTNET'): WalletConnection {
  const trimmed = publicKey.trim();
  if (!isValidStellarPublicKey(trimmed)) {
    throw new Error('Invalid Stellar public key. Must start with G and be 56 characters.');
  }
  return {
    publicKey: trimmed,
    provider: 'manual',
    network,
  };
}

/** Validate a Stellar public key format */
export function isValidStellarPublicKey(key: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(key);
}

/** Get the Stellar Horizon URL for a network */
export function getHorizonUrl(network: 'TESTNET' | 'PUBLIC'): string {
  return network === 'TESTNET'
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org';
}

/** Get the Stellar Explorer URL for a transaction */
export function getExplorerTxUrl(txHash: string, network: 'TESTNET' | 'PUBLIC'): string {
  const net = network === 'TESTNET' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

/** Get the Stellar Explorer URL for an account */
export function getExplorerAccountUrl(publicKey: string, network: 'TESTNET' | 'PUBLIC'): string {
  const net = network === 'TESTNET' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${net}/account/${publicKey}`;
}

/** Truncate a public key or hash for display: GBZX...9R3Q */
export function truncateKey(key: string, startLen = 4, endLen = 4): string {
  if (key.length <= startLen + endLen + 3) return key;
  return `${key.slice(0, startLen)}...${key.slice(-endLen)}`;
}
