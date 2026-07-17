import { describe, expect, it } from 'vitest'
import {
  facilitatorAuthConfigured,
  facilitatorSettleReadiness,
  isOpenZeppelinChannelsFacilitator,
  resolveFacilitatorApiKey,
} from './facilitator.js'

describe('facilitator helpers', () => {
  it('detects OZ Channels hosts', () => {
    expect(
      isOpenZeppelinChannelsFacilitator(
        'https://channels.openzeppelin.com/x402/testnet',
      ),
    ).toBe(true)
    expect(isOpenZeppelinChannelsFacilitator('https://x402.org/facilitator')).toBe(
      false,
    )
  })

  it('reads either OZ_API_KEY or X402_FACILITATOR_API_KEY', () => {
    expect(facilitatorAuthConfigured({})).toBe(false)
    expect(facilitatorAuthConfigured({ OZ_API_KEY: '  key  ' })).toBe(true)
    expect(
      resolveFacilitatorApiKey({ X402_FACILITATOR_API_KEY: 'alias' }),
    ).toBe('alias')
  })

  it('marks settle ready for public facilitators without a key', () => {
    const readiness = facilitatorSettleReadiness(
      'https://x402.org/facilitator',
      {},
    )
    expect(readiness.settleAuthRequired).toBe(false)
    expect(readiness.settleReady).toBe(true)
  })

  it('requires a key for OZ Channels settle', () => {
    const missing = facilitatorSettleReadiness(
      'https://channels.openzeppelin.com/x402/testnet',
      {},
    )
    expect(missing.settleAuthRequired).toBe(true)
    expect(missing.settleReady).toBe(false)

    const ready = facilitatorSettleReadiness(
      'https://channels.openzeppelin.com/x402/testnet',
      { OZ_API_KEY: 'test-key' },
    )
    expect(ready.settleReady).toBe(true)
  })
})
