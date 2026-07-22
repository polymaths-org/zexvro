/**
 * Helpers for De-pin / Access Shield to bind Gate capability to payment identity.
 */

export type PayerCheckResult =
  | { ok: true }
  | { ok: false; code: string; detail: string }

export function assertPayerAllowed(
  claims: {
    stellar_pk?: string
    pay_mode?: string
    allowed_payer_pks?: string[]
  },
  payerPublicKey: string | undefined,
): PayerCheckResult {
  if (!payerPublicKey) {
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

export function accessShieldCheckOrder(): string[] {
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
