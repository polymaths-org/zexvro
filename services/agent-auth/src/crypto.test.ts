import { describe, expect, it } from 'vitest'
import {
  canonicalChallengeMessage,
  canonicalPopMessage,
  generateEd25519KeyPair,
  hmacSign,
  hmacVerify,
  hashSecret,
  jwkThumbprintEd25519,
  secretsEqual,
  signEd25519,
  verifyEd25519,
  verifyPop,
} from './crypto.js'

describe('crypto helpers', () => {
  it('hmac roundtrip', () => {
    const sig = hmacSign('secret', 'message')
    expect(hmacVerify('secret', 'message', sig)).toBe(true)
    expect(hmacVerify('secret', 'message', 'nope')).toBe(false)
  })

  it('canonical challenge message is stable', () => {
    const a = canonicalChallengeMessage({
      issuer: 'http://localhost:4103',
      audience: 'site_demo',
      nonce: 'n1',
      exp: 100,
      projectId: 'proj_demo',
      action: 'search.query',
      channel: 'agent',
      clientPublicKey: 'pk',
    })
    expect(a.startsWith('zexvro-gate/v1|')).toBe(true)
    expect(a.split('|')).toHaveLength(9)
  })

  it('Ed25519 sign/verify + jkt + pop', () => {
    const kp = generateEd25519KeyPair()
    expect(kp.publicKey.length).toBeGreaterThan(20)
    const msg = 'hello-gate'
    const sig = signEd25519({ privateKey: kp.privateKey, message: msg })
    expect(sig).toBeTruthy()
    expect(verifyEd25519({ publicKey: kp.publicKey, message: msg, signatureBase64: sig! })).toBe(
      true,
    )
    expect(verifyEd25519({ publicKey: kp.publicKey, message: 'other', signatureBase64: sig! })).toBe(
      false,
    )
    const jkt = jwkThumbprintEd25519(kp.publicKey)
    expect(jkt.length).toBeGreaterThan(10)

    const iat = Math.floor(Date.now() / 1000)
    const popMsg = canonicalPopMessage({
      jti: 'jti_1',
      htm: 'POST',
      htu: 'https://x.test/a',
      iat,
      bodyHash: '-',
    })
    const popSig = signEd25519({ privateKey: kp.privateKey, message: popMsg })
    expect(
      verifyPop({
        publicKey: kp.publicKey,
        jti: 'jti_1',
        htm: 'POST',
        htu: 'https://x.test/a',
        iat,
        bodyHash: '-',
        signature: popSig!,
        allowDevHmac: false,
      }),
    ).toBe(true)
  })

  it('secret hashing and compare', () => {
    const h = hashSecret('abc')
    expect(h).toHaveLength(64)
    expect(secretsEqual('same', 'same')).toBe(true)
    expect(secretsEqual('same', 'diff')).toBe(false)
  })
})
