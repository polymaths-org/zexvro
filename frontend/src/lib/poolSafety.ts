/** The checked-in legacy pool/circuit fails funding and recipient-binding tests.
 * Do not accept new funds until upgraded contracts and proofs are verified.
 * Existing notes and the withdrawal path are preserved for recovery.
 */
export const PRIVATE_POOL_FUNDING_PAUSED = true;
export const PRIVATE_POOL_SAFETY_MESSAGE =
  'New private-pool payments are paused pending a contract safety upgrade. Existing notes and withdrawal access are preserved.';
export function assertPrivatePoolFundingAllowed() {
  if (PRIVATE_POOL_FUNDING_PAUSED) throw new Error(PRIVATE_POOL_SAFETY_MESSAGE);
}
