import { describe, expect, it } from 'vitest'
import { assertPayerAllowed, accessShieldCheckOrder } from './depinBind.js'

describe('depin bind helpers', () => {
  it('allows self pay when stellar_pk matches', () => {
    const r = assertPayerAllowed(
      { stellar_pk: 'GABC', pay_mode: 'self', allowed_payer_pks: [] },
      'GABC',
    )
    expect(r.ok).toBe(true)
  })

  it('allows allowlisted sponsored payer', () => {
    const r = assertPayerAllowed(
      { stellar_pk: 'GAGENT', pay_mode: 'sponsored', allowed_payer_pks: ['GTREASURY'] },
      'GTREASURY',
    )
    expect(r.ok).toBe(true)
  })

  it('rejects unknown payer', () => {
    const r = assertPayerAllowed(
      { stellar_pk: 'GAGENT', pay_mode: 'self', allowed_payer_pks: ['GAGENT'] },
      'GEVIL',
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('payer_not_allowlisted')
  })

  it('documents check order', () => {
    expect(accessShieldCheckOrder()[0]).toBe('rate_limit')
    expect(accessShieldCheckOrder()).toContain('assert_payer_allowed')
  })
})
