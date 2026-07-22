/**
 * Browser helpers for ZEXVRO Gate human channel (Web Crypto).
 * No node:crypto dependency — safe for Vite/browser bundles.
 */

export const CAPABILITY_HEADER = 'x-zexvro-capability'

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  const b64 = btoa(s)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(body.detail || `Gate error ${response.status}`)
    err.status = response.status
    err.problem = body
    throw err
  }
  return body
}

/**
 * Generate ephemeral Ed25519 keypair for session_pop (Web Crypto).
 * Returns { publicKey, privateKey } as base64url raw 32-byte keys where possible.
 * Note: Web Crypto exports JWK; we convert x / d to base64url.
 */
export async function generateSessionKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    publicKey: pubJwk.x,
    privateKey: privJwk.d,
    _cryptoKeys: pair,
  }
}

async function importPrivateKey(dB64url) {
  return crypto.subtle.importKey('jwk', {
    kty: 'OKP',
    crv: 'Ed25519',
    d: dB64url,
    x: undefined,
    // Some browsers require x; derive not always available — import with full jwk from pair preferred
  }, { name: 'Ed25519' }, false, ['sign']).catch(async () => {
    // Fallback: regenerate not possible from d alone without x on all browsers.
    // Use CryptoKey stored from generateSessionKeyPair when available.
    throw new Error('Import private key failed; pass _cryptoKeys from generateSessionKeyPair')
  })
}

/**
 * Sign challenge message with CryptoKey or raw d (best-effort).
 */
export async function signSessionMessage(privateMaterial, message) {
  let key = privateMaterial
  if (privateMaterial && privateMaterial.privateKey && privateMaterial.privateKey.type === 'private') {
    key = privateMaterial.privateKey
  } else if (typeof privateMaterial === 'string') {
    // Need both d and x for JWK import in most browsers
    throw new Error('Pass CryptoKeyPair from generateSessionKeyPair for browser signing')
  }
  const data = new TextEncoder().encode(message)
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, data)
  return b64url(sig)
}

function canonicalChallengeMessage(input) {
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
 * Browser Gate client with session_pop (preferred) and soft_confirm fallback.
 */
export class BrowserGate {
  /**
   * @param {{ siteKey: string, apiBase: string, siteId?: string, projectId?: string, mode?: 'session_pop'|'soft_confirm'|'captcha' }} opts
   */
  constructor(opts) {
    if (!opts?.siteKey) throw new Error('siteKey required')
    if (!opts?.apiBase) throw new Error('apiBase required')
    this.siteKey = opts.siteKey
    this.apiBase = opts.apiBase.replace(/\/$/, '')
    this.siteId = opts.siteId || 'site_demo'
    this.projectId = opts.projectId || 'proj_demo'
    this.mode = opts.mode || 'session_pop'
  }

  /**
   * @param {{ action: string, origin?: string, onState?: (s: string) => void }} opts
   */
  async protect(opts) {
    const onState = opts.onState || (() => {})
    onState('checking')
    const origin = opts.origin || (typeof location !== 'undefined' ? location.origin : undefined)

    if (this.mode === 'captcha') {
      const { protectWithCaptcha } = await import('./captcha.js')
      // Default: fixed modal popup (360×480). Optional mount = inline only.
      return protectWithCaptcha({
        siteKey: this.siteKey,
        apiBase: this.apiBase,
        action: opts.action,
        origin,
        preferredType: opts.preferredType,
        onCaptcha: opts.onCaptcha,
        onState,
        mode: opts.mount ? 'inline' : 'modal',
        mount: opts.mount,
      })
    }

    if (this.mode === 'soft_confirm') {
      onState('challenge')
      const challenge = await requestJson(this.apiBase, '/v1/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteKey: this.siteKey,
          action: opts.action,
          channel: 'human',
          clientPublicKey: `ck_${crypto.getRandomValues(new Uint8Array(8)).join('')}`,
          origin,
        }),
      })
      const completed = await requestJson(this.apiBase, `/v1/challenges/${challenge.id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          siteKey: this.siteKey,
          proofType: 'soft_confirm',
          proof: 'soft-confirm',
        }),
      })
      onState('ready')
      return {
        capability: completed.capability,
        class: completed.class,
        securityNote: 'dev_soft_confirm_not_production_security',
      }
    }

    // session_pop
    onState('challenge')
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
    const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const publicKey = pubJwk.x

    const status = await requestJson(this.apiBase, '/status')
    const challenge = await requestJson(this.apiBase, '/v1/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: this.siteKey,
        action: opts.action,
        channel: 'human',
        clientPublicKey: publicKey,
        origin,
      }),
    })

    const message = canonicalChallengeMessage({
      issuer: status.issuer,
      audience: this.siteId,
      nonce: challenge.nonce,
      exp: challenge.exp,
      projectId: this.projectId,
      action: opts.action,
      channel: 'human',
      clientPublicKey: publicKey,
    })
    const sig = await crypto.subtle.sign(
      { name: 'Ed25519' },
      pair.privateKey,
      new TextEncoder().encode(message),
    )
    const proof = b64url(sig)

    const completed = await requestJson(this.apiBase, `/v1/challenges/${challenge.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: this.siteKey,
        proofType: 'session_pop',
        proof,
      }),
    })
    onState('ready')
    return {
      capability: completed.capability,
      class: completed.class,
      expiresIn: completed.expires_in,
      scopes: completed.scopes,
      publicKey,
      securityNote: 'session_pop_key_bound_soft_human',
    }
  }
}

/**
 * Convert base64url to ArrayBuffer for WebAuthn APIs.
 */
function b64urlToBuffer(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

function bufferToB64url(buf) {
  return b64url(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf)
}

/**
 * Register a passkey for hard human path (admin/session may require Cognito).
 * @param {{ siteKey: string, apiBase: string, origin?: string, userName?: string, userId?: string, authHeader?: string }} opts
 */
export async function registerPasskey(opts) {
  if (!opts?.siteKey || !opts?.apiBase) throw new Error('siteKey and apiBase required')
  const origin = opts.origin || (typeof location !== 'undefined' ? location.origin : undefined)
  const headers = { 'content-type': 'application/json' }
  if (opts.authHeader) headers.authorization = opts.authHeader

  const reg = await requestJson(opts.apiBase, '/v1/webauthn/register/options', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      siteKey: opts.siteKey,
      origin,
      userName: opts.userName || 'gate-user',
      userId: opts.userId,
    }),
  })

  const publicKey = {
    ...reg.options,
    challenge: b64urlToBuffer(reg.options.challenge),
    user: {
      ...reg.options.user,
      id: b64urlToBuffer(reg.options.user.id),
    },
  }
  const cred = await navigator.credentials.create({ publicKey })
  if (!cred) throw new Error('passkey registration cancelled')

  const attestation = {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(cred.response.clientDataJSON),
      attestationObject: bufferToB64url(cred.response.attestationObject),
      transports: cred.response.getTransports?.() || [],
    },
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
  }

  const verified = await requestJson(opts.apiBase, '/v1/webauthn/register/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      siteKey: opts.siteKey,
      origin,
      userId: reg.userId,
      expectedChallenge: reg.options.challenge,
      response: attestation,
    }),
  })
  return { userId: reg.userId, credentialId: verified.credentialId }
}

/**
 * Hard human protect via WebAuthn assertion for an action.
 * Requires a registered passkey for the site.
 * @param {{ siteKey: string, apiBase: string, action: string, origin?: string, userId?: string, siteId?: string }} opts
 */
export async function protectWebAuthn(opts) {
  if (!opts?.siteKey || !opts?.apiBase || !opts?.action) {
    throw new Error('siteKey, apiBase, action required')
  }
  const origin = opts.origin || (typeof location !== 'undefined' ? location.origin : undefined)
  const siteId = opts.siteId || 'site_demo'

  const challenge = await requestJson(opts.apiBase, '/v1/challenges', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      siteKey: opts.siteKey,
      action: opts.action,
      channel: 'human',
      clientPublicKey: `wa_${crypto.getRandomValues(new Uint8Array(8)).join('')}`,
      origin,
    }),
  })

  const optRes = await requestJson(
    opts.apiBase,
    `/v1/challenges/${challenge.id}/webauthn-options`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteKey: opts.siteKey, userId: opts.userId }),
    },
  )

  const publicKey = {
    ...optRes.options,
    challenge: b64urlToBuffer(optRes.options.challenge),
    allowCredentials: (optRes.options.allowCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  }
  const assertion = await navigator.credentials.get({ publicKey })
  if (!assertion) throw new Error('passkey assertion cancelled')

  const proof = JSON.stringify({
    id: assertion.id,
    rawId: bufferToB64url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToB64url(assertion.response.clientDataJSON),
      authenticatorData: bufferToB64url(assertion.response.authenticatorData),
      signature: bufferToB64url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? bufferToB64url(assertion.response.userHandle)
        : undefined,
    },
    clientExtensionResults: assertion.getClientExtensionResults?.() || {},
  })

  const completed = await requestJson(opts.apiBase, `/v1/challenges/${challenge.id}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      siteKey: opts.siteKey,
      proofType: 'webauthn',
      proof,
    }),
  })

  return {
    capability: completed.capability,
    class: completed.class,
    expiresIn: completed.expires_in,
    scopes: completed.scopes,
    securityNote: 'webauthn_hard_human',
    siteId,
  }
}

export {
  protectWithCaptcha,
  mountCaptchaWidget,
  mountCaptchaModal,
  protectAction,
  protectPage,
  captchaAssetUrl,
} from './captcha.js'

export default {
  BrowserGate,
  generateSessionKeyPair,
  registerPasskey,
  protectWebAuthn,
  CAPABILITY_HEADER,
}
