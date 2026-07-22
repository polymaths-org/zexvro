import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as signSync,
  timingSafeEqual,
  verify as verifySync,
  type KeyObject,
} from 'node:crypto'

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function sha256Base64Url(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('base64url')
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`
}

export function randomNonce(): string {
  return randomBytes(24).toString('base64url')
}

export function hashSecret(secret: string): string {
  return sha256Hex(`zexvro-gate-secret:v1:${secret}`)
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** Canonical challenge message (v1 wire format still used by Phase-1 clients). */
export function canonicalChallengeMessage(input: {
  issuer: string
  audience: string
  nonce: string
  exp: number
  projectId: string
  action: string
  channel: string
  clientPublicKey: string
}): string {
  return [
    'zexvro-gate/v1',
    input.issuer,
    input.audience,
    input.nonce,
    String(input.exp),
    input.projectId,
    input.action,
    input.channel,
    input.clientPublicKey,
  ].join('|')
}

/**
 * PoP message for every capability presentation.
 * zexvro-pop/v0.2|{jti}|{htm}|{htu}|{iat}|{bodyHash}
 */
export function canonicalPopMessage(input: {
  jti: string
  htm: string
  htu: string
  iat: number
  bodyHash: string
}): string {
  return [
    'zexvro-pop/v0.2',
    input.jti,
    input.htm.toUpperCase(),
    input.htu,
    String(input.iat),
    input.bodyHash || '-',
  ].join('|')
}

export interface Ed25519KeyPair {
  /** base64url raw 32-byte public key */
  publicKey: string
  /** base64url raw 32-byte private seed (PKCS8 extracted) */
  privateKey: string
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

function rawEd25519ToSpki(raw: Buffer): KeyObject {
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  })
}

function rawEd25519ToPkcs8(rawSeed: Buffer): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, rawSeed]),
    format: 'der',
    type: 'pkcs8',
  })
}

/** Generate a raw Ed25519 keypair (base64url). */
export function generateEd25519KeyPair(): Ed25519KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
  // SPKI ends with 32-byte key; PKCS8 ends with 32-byte seed after prefix
  const pubRaw = pubDer.subarray(pubDer.length - 32)
  const privRaw = privDer.subarray(privDer.length - 32)
  return {
    publicKey: pubRaw.toString('base64url'),
    privateKey: privRaw.toString('base64url'),
  }
}

export function jwkThumbprintEd25519(publicKeyBase64Url: string): string {
  // RFC 7638 for OKP Ed25519: {"crv":"Ed25519","kty":"OKP","x":"..."} sorted
  const x = publicKeyBase64Url
  const canonical = `{"crv":"Ed25519","kty":"OKP","x":"${x}"}`
  return sha256Base64Url(canonical)
}

function parsePublicKey(publicKey: string): KeyObject | null {
  try {
    if (publicKey.includes('BEGIN')) {
      return createPublicKey(publicKey)
    }
    // base64url or base64 raw 32 bytes
    let raw: Buffer
    try {
      raw = Buffer.from(publicKey, 'base64url')
    } catch {
      raw = Buffer.from(publicKey, 'base64')
    }
    if (raw.length !== 32) return null
    return rawEd25519ToSpki(raw)
  } catch {
    return null
  }
}

function parsePrivateKey(privateKey: string): KeyObject | null {
  try {
    if (privateKey.includes('BEGIN')) {
      return createPrivateKey(privateKey)
    }
    let raw: Buffer
    try {
      raw = Buffer.from(privateKey, 'base64url')
    } catch {
      raw = Buffer.from(privateKey, 'base64')
    }
    if (raw.length !== 32) return null
    return rawEd25519ToPkcs8(raw)
  } catch {
    return null
  }
}

export function signEd25519(input: {
  privateKey: string
  message: string
}): string | null {
  try {
    const key = parsePrivateKey(input.privateKey)
    if (!key) return null
    const sig = signSync(null, Buffer.from(input.message, 'utf8'), key)
    return sig.toString('base64url')
  } catch {
    return null
  }
}

export function verifyEd25519(input: {
  publicKey: string
  message: string
  signatureBase64: string
}): boolean {
  try {
    const key = parsePublicKey(input.publicKey)
    if (!key) return false
    // accept base64url or standard base64
    let sig: Buffer
    try {
      sig = Buffer.from(input.signatureBase64, 'base64url')
    } catch {
      sig = Buffer.from(input.signatureBase64, 'base64')
    }
    if (sig.length === 0) return false
    return verifySync(null, Buffer.from(input.message, 'utf8'), key, sig)
  } catch {
    return false
  }
}

export function hmacSign(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url')
}

export function hmacVerify(secret: string, message: string, signature: string): boolean {
  const expected = hmacSign(secret, message)
  // compare base64url forms
  try {
    return secretsEqual(expected, signature)
  } catch {
    return false
  }
}

export function verifyPop(input: {
  publicKey: string
  jti: string
  htm: string
  htu: string
  iat: number
  bodyHash: string
  signature: string
  /** allow HMAC(publicKey) only when true */
  allowDevHmac: boolean
  nowSeconds?: number
  maxSkewSeconds?: number
}): boolean {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const skew = input.maxSkewSeconds ?? 30
  if (Math.abs(now - input.iat) > skew) return false
  const message = canonicalPopMessage({
    jti: input.jti,
    htm: input.htm,
    htu: input.htu,
    iat: input.iat,
    bodyHash: input.bodyHash,
  })
  if (verifyEd25519({ publicKey: input.publicKey, message, signatureBase64: input.signature })) {
    return true
  }
  if (input.allowDevHmac) {
    return hmacVerify(input.publicKey, message, input.signature)
  }
  return false
}
