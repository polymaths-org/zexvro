/** Shared Stellar network helpers for NFTo / DEDSEC / explorers. */

export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const STELLAR_PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export type StellarCaipNetwork = 'stellar:testnet' | 'stellar:pubnet';
export type AppChainEnv = 'testnet' | 'mainnet';

export function isTestnetPassphrase(passphrase?: string): boolean {
  const p = (passphrase || '').trim();
  if (!p) return true;
  return p.includes('Test SDF') || p.toLowerCase().includes('testnet') || p.toLowerCase().includes('futurenet');
}

export function passphraseToCaip(passphrase?: string): StellarCaipNetwork {
  return isTestnetPassphrase(passphrase) ? 'stellar:testnet' : 'stellar:pubnet';
}

export function caipToAppEnv(network?: string): AppChainEnv {
  const n = (network || '').toLowerCase();
  if (n.includes('pubnet') || n.includes('public') || n === 'mainnet' || n === 'stellar:mainnet') {
    return 'mainnet';
  }
  return 'testnet';
}

export function appEnvToCaip(env: AppChainEnv): StellarCaipNetwork {
  return env === 'mainnet' ? 'stellar:pubnet' : 'stellar:testnet';
}

export function appEnvToPassphrase(env: AppChainEnv): string {
  return env === 'mainnet' ? STELLAR_PUBLIC_PASSPHRASE : STELLAR_TESTNET_PASSPHRASE;
}

export function networkLabel(network?: string): string {
  return caipToAppEnv(network) === 'mainnet' ? 'Mainnet' : 'Testnet';
}

/** stellar.expert explorer base for a CAIP / app network string. */
export function stellarExpertBase(network?: string): string {
  return caipToAppEnv(network) === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
}

export function stellarExpertContractUrl(contractId: string, network?: string): string {
  return `${stellarExpertBase(network)}/contract/${contractId}`;
}

export function stellarExpertTxUrl(txHash: string, network?: string): string {
  return `${stellarExpertBase(network)}/tx/${txHash}`;
}

/** Circle USDC SAC (SEP-41) — same as @x402/stellar package. */
export const STELLAR_USDC_TESTNET = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
export const STELLAR_USDC_MAINNET = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';

/** Native XLM SAC */
export const STELLAR_XLM_SAC_TESTNET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const STELLAR_XLM_SAC_MAINNET = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';

export const OZ_CHANNELS_TESTNET = 'https://channels.openzeppelin.com/x402/testnet';
export const OZ_CHANNELS_MAINNET = 'https://channels.openzeppelin.com/x402';

export const DEFAULT_SOROBAN_RPC_TESTNET = 'https://soroban-testnet.stellar.org';
export const DEFAULT_SOROBAN_RPC_MAINNET = 'https://mainnet.sorobanrpc.com';

export const DEFAULT_HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
export const DEFAULT_HORIZON_MAINNET = 'https://horizon.stellar.org';

export function horizonForAppEnv(env: AppChainEnv): string {
  return env === 'mainnet' ? DEFAULT_HORIZON_MAINNET : DEFAULT_HORIZON_TESTNET;
}

export function appEnvFromHorizon(url?: string): AppChainEnv {
  const u = (url || '').trim().toLowerCase();
  if (!u) return 'testnet';
  if (u.includes('testnet') || u.includes('futurenet')) return 'testnet';
  if (u.includes('horizon.stellar.org') || u.includes('pubnet') || u.includes('public')) return 'mainnet';
  return 'testnet';
}

/** Workspace environment is canonical; then project prefs; then explicit Horizon URL. */
export function resolveWorkspaceChainEnv(input: {
  workspaceEnvironment?: string | null;
  projectNetworks?: Array<string | undefined | null>;
  horizonUrl?: string | null;
}): AppChainEnv {
  const ws = (input.workspaceEnvironment || '').toLowerCase().trim();
  if (ws === 'mainnet' || ws === 'pubnet' || ws === 'public') return 'mainnet';
  if (ws === 'testnet') return 'testnet';

  for (const raw of input.projectNetworks || []) {
    const n = String(raw || '').toLowerCase();
    if (!n) continue;
    if (n === 'mainnet' || n.includes('main') || n.includes('pubnet') || n.includes('public')) {
      return 'mainnet';
    }
  }

  if (input.horizonUrl?.trim()) return appEnvFromHorizon(input.horizonUrl);
  return 'testnet';
}

export function balanceNetworkLabel(env: AppChainEnv): string {
  return env === 'mainnet' ? 'Mainnet' : 'Testnet';
}
