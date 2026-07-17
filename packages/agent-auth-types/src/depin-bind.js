/** Re-export notes: implementation lives in services/agent-auth/src/depinBind.ts for type safety.
 * This file remains a lightweight JS helper for non-TS consumers / docs samples.
 */
export function assertPayerAllowed(claims, payerPublicKey) {
  if (!payerPublicKey || typeof payerPublicKey !== 'string') {
    return { ok: false, code: 'payer_missing', detail: 'Payment payer public key required' }
  }
  const allow = Array.isArray(claims.allowed_payer_pks) ? claims.allowed_payer_pks : []
  const self = claims.stellar_pk
  const payMode = claims.pay_mode || 'self'
  if (payMode === 'none') return { ok: true }
  if (allow.length > 0) {
    if (allow.includes(payerPublicKey)) return { ok: true }
    return {
      ok: false,
      code: 'payer_not_allowlisted',
      detail: 'Payment payer is not in capability allowed_payer_pks',
    }
  }
  if (payMode === 'self' && self && self === payerPublicKey) return { ok: true }
  return {
    ok: false,
    code: 'payer_mismatch',
    detail: 'Payment payer does not match capability stellar_pk',
  }
}

export function accessShieldCheckOrder() {
  return [
    'rate_limit',
    'verify_capability',
    'policy_class',
    'payment_402_if_required',
    'assert_payer_allowed',
    'upstream',
    'settle',
    'release',
  ]
}
