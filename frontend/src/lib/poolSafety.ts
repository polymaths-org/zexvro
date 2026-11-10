import { runtimeValue } from './runtimeConfig';

/** The checked-in legacy pool/circuit fails funding and recipient-binding tests.
 * Do not accept new funds until upgraded contracts and proofs are verified.
 * Existing notes and the withdrawal path are preserved for recovery.
 */
export const PRIVATE_POOL_FUNDING_PAUSED = true;
export const PRIVATE_POOL_SAFETY_MESSAGE =
  'New private-pool payments are paused pending a contract safety upgrade. Existing notes and withdrawal access are preserved.';

/** Demo-only escape hatch. Enable with VITE_ZER0_DEMO_UNSAFE_POOLS=true or
 * `localStorage.setItem('zexvro_demo_unsafe_pools', 'true')` on the demo machine.
 * Never enable this on a public deployment. */
export const PRIVATE_POOL_DEMO_UNLOCK_KEY = 'zexvro_demo_unsafe_pools';
export const PRIVATE_POOL_DEMO_MESSAGE =
  'Demo mode: mainnet private pay is running on the legacy unaudited pool contracts. Internal walkthrough only — do not use funds you cannot lose.';

export function isPrivatePoolDemoUnlocked(): boolean {
  try {
    if (String(runtimeValue('VITE_ZER0_DEMO_UNSAFE_POOLS') ?? '').toLowerCase() === 'true') return true;
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(PRIVATE_POOL_DEMO_UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isPrivatePoolFundingPaused(): boolean {
  return PRIVATE_POOL_FUNDING_PAUSED && !isPrivatePoolDemoUnlocked();
}

export function assertPrivatePoolFundingAllowed() {
  if (isPrivatePoolFundingPaused()) throw new Error(PRIVATE_POOL_SAFETY_MESSAGE);
}
