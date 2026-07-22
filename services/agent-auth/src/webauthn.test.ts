import { describe, expect, it } from 'vitest'
import { buildWebAuthnGetOptions, randomWebAuthnUserId } from './webauthn.js'

describe('webauthn scaffold helpers', () => {
  it('builds get options from challenge origin', () => {
    const opts = buildWebAuthnGetOptions({
      site: {
        siteId: 'site_demo',
        projectId: 'proj_demo',
        siteKey: 'zk',
        secretHash: '',
        allowedOrigins: ['https://app.example'],
        name: 'd',
        createdAt: new Date().toISOString(),
      },
      challenge: {
        id: 'ch_1',
        siteId: 'site_demo',
        action: 'checkout.submit',
        channel: 'human',
        status: 'pending',
        nonce: 'nonce_abc',
        clientPublicKey: 'pk',
        origin: 'https://app.example',
        expiresAt: Date.now() + 60_000,
        expSeconds: Math.floor(Date.now() / 1000) + 60,
        createdAt: Date.now(),
      },
    })
    expect(opts.rpId).toBe('app.example')
    expect(opts.challenge).toBe('nonce_abc')
    expect(opts.userVerification).toBe('preferred')
  })

  it('random user ids are unique-ish', () => {
    const a = randomWebAuthnUserId()
    const b = randomWebAuthnUserId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(10)
  })
})
