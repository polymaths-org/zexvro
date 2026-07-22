import { describe, expect, it } from 'vitest'
import {
  assertPayerAllowed,
  capabilityFingerprint,
  extractPayerFromPaymentPayload,
} from './capabilityGate.js'

describe('capabilityGate helpers', () => {
  it('assertPayerAllowed self mode', () => {
    expect(
      assertPayerAllowed({ stellar_pk: 'GABC', pay_mode: 'self' }, 'GABC').ok,
    ).toBe(true)
    expect(
      assertPayerAllowed({ stellar_pk: 'GABC', pay_mode: 'self' }, 'GXYZ').ok,
    ).toBe(false)
  })

  it('assertPayerAllowed allowlist', () => {
    const r = assertPayerAllowed(
      { stellar_pk: 'GAGENT', pay_mode: 'sponsored', allowed_payer_pks: ['GTREAS'] },
      'GTREAS',
    )
    expect(r.ok).toBe(true)
  })

  it('extractPayerFromPaymentPayload finds G address', () => {
    const payer = extractPayerFromPaymentPayload({
      payload: { accepted: { extra: { payer: 'GCSPMRWNIC4CLCGGWX42GH4TFXC3RAHNO5VHMKHRPBN6EJ56T6AZTDK3' } } },
    })
    expect(payer?.startsWith('G')).toBe(true)
  })

  it('capabilityFingerprint is stable hex', () => {
    const a = capabilityFingerprint('cap')
    const b = capabilityFingerprint('cap')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]+$/)
  })
})
