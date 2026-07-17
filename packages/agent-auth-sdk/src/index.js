/**
 * @zexvro/gate — ZEXVRO Gate client SDK
 *
 * Human soft_confirm: works in browser (Web Crypto for random ids).
 * Agent Ed25519 + PoP: Node runtime (node:crypto). For browsers use a bundler
 * that polyfills node:crypto or call the REST API from your agent host.
 */

export const CAPABILITY_HEADER = 'x-zexvro-capability'
export const POP_HEADER = 'x-zexvro-pop'

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined)

  if (!response.ok) {
    const error = new Error(
      body && typeof body === 'object' && body.detail
        ? body.detail
        : `Gate API error (${response.status})`,
    )
    error.status = response.status
    error.problem = body
    throw error
  }
  return body
}

function randomClientKey() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return `ck_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
  }
  return `ck_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
}

function decodeJwtPayload(token) {
  const part = token.split('.')[1]
  if (!part) throw new Error('invalid jwt')
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
  const json =
    typeof atob === 'function'
      ? atob(normalized)
      : Buffer.from(part, 'base64url').toString('utf8')
  return JSON.parse(json)
}

export { decodeJwtPayload }

async function loadNodeCrypto() {
  return import('node:crypto')
}

const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
])

/**
 * Generate Ed25519 keypair (Node). Returns base64url raw keys.
 */
export async function generateAgentKeyPair() {
  const crypto = await loadNodeCrypto()
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' })
  return {
    publicKey: pubDer.subarray(pubDer.length - 32).toString('base64url'),
    privateKey: privDer.subarray(privDer.length - 32).toString('base64url'),
  }
}

async function signEd25519Raw(privateKeyBase64Url, message) {
  const crypto = await loadNodeCrypto()
  const raw = Buffer.from(privateKeyBase64Url, 'base64url')
  const key = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from(ED25519_PKCS8_PREFIX), raw]),
    format: 'der',
    type: 'pkcs8',
  })
  return crypto.sign(null, Buffer.from(message, 'utf8'), key).toString('base64url')
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

function canonicalPopMessage(input) {
  return [
    'zexvro-pop/v0.2',
    input.jti,
    input.htm.toUpperCase(),
    input.htu,
    String(input.iat),
    input.bodyHash || '-',
  ].join('|')
}

/**
 * Human Gate client.
 * - In browsers: prefer `import { BrowserGate } from '@zexvro/gate/browser'` (session_pop).
 * - soft_confirm requires `{ allowInsecureDev: true }` and is rejected by production Gate.
 */
export class Gate {
  constructor(opts) {
    if (!opts?.siteKey) throw new Error('siteKey is required')
    if (!opts?.apiBase) throw new Error('apiBase is required')
    this.siteKey = opts.siteKey
    this.apiBase = opts.apiBase.replace(/\/$/, '')
    this.allowInsecureDev = Boolean(opts.allowInsecureDev)
  }

  async protect(opts) {
    if (!this.allowInsecureDev && opts?.mode !== 'soft_confirm') {
      // Guide integrators: soft path is not default production security.
      const err = new Error(
        'Gate.protect soft_confirm is insecure. Use BrowserGate (session_pop) from @zexvro/gate/browser, or pass allowInsecureDev: true for local demos only.',
      )
      err.code = 'use_browser_gate_session_pop'
      throw err
    }
    if (!this.allowInsecureDev && opts?.mode === 'soft_confirm') {
      const err = new Error('soft_confirm requires Gate({ allowInsecureDev: true })')
      err.code = 'soft_confirm_requires_allow_insecure_dev'
      throw err
    }

    const clientPublicKey = opts.clientPublicKey || randomClientKey()
    const origin =
      opts.origin ||
      (typeof globalThis.location?.origin === 'string' ? globalThis.location.origin : undefined)
    const challenge = await requestJson(this.apiBase, '/v1/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: this.siteKey,
        action: opts.action,
        channel: 'human',
        clientPublicKey,
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

    return {
      capability: completed.capability,
      class: completed.class,
      expiresIn: completed.expires_in,
      scopes: completed.scopes,
      clientPublicKey,
      securityNote: 'dev_soft_confirm_not_production_security',
    }
  }
}

/** Agent client (Node Ed25519 + PoP). */
export class GateAgent {
  constructor(opts) {
    if (!opts?.siteKey) throw new Error('siteKey is required')
    if (!opts?.apiBase) throw new Error('apiBase is required')
    if (!opts?.publicKey) throw new Error('publicKey is required')
    if (!opts?.privateKey) throw new Error('privateKey is required')
    this.siteKey = opts.siteKey
    this.apiBase = opts.apiBase.replace(/\/$/, '')
    this.publicKey = opts.publicKey
    this.privateKey = opts.privateKey
    this.siteId = opts.siteId || 'site_demo'
    this.projectId = opts.projectId || 'proj_demo'
  }

  async obtainCapability(opts) {
    const status = await requestJson(this.apiBase, '/status')
    const challenge = await requestJson(this.apiBase, '/v1/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: this.siteKey,
        action: opts.action,
        channel: 'agent',
        clientPublicKey: this.publicKey,
        agentPublicKey: this.publicKey,
      }),
    })

    const message = canonicalChallengeMessage({
      issuer: status.issuer,
      audience: this.siteId,
      nonce: challenge.nonce,
      exp: challenge.exp,
      projectId: this.projectId,
      action: opts.action,
      channel: 'agent',
      clientPublicKey: this.publicKey,
    })
    const proof = await signEd25519Raw(this.privateKey, message)

    const completed = await requestJson(this.apiBase, `/v1/challenges/${challenge.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: this.siteKey,
        proofType: 'nonce_sign',
        proof,
      }),
    })

    return {
      capability: completed.capability,
      class: completed.class,
      expiresIn: completed.expires_in,
      scopes: completed.scopes,
    }
  }

  async createPop(opts) {
    const claims = decodeJwtPayload(opts.capability)
    const iat = Math.floor(Date.now() / 1000)
    let bodyHash = '-'
    if (opts.body) {
      const crypto = await loadNodeCrypto()
      bodyHash = crypto.createHash('sha256').update(opts.body).digest('base64url')
    }
    const message = canonicalPopMessage({
      jti: claims.jti,
      htm: opts.htm,
      htu: opts.htu,
      iat,
      bodyHash,
    })
    return {
      signature: await signEd25519Raw(this.privateKey, message),
      htm: opts.htm,
      htu: opts.htu,
      iat,
      bodyHash,
    }
  }
}

export async function verifyCapabilityRemote(input) {
  const response = await fetch(`${input.apiBase.replace(/\/$/, '')}/v1/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capability: input.capability,
      action: input.action,
      minClass: input.minClass || 'either',
      expectedOrigin: input.expectedOrigin,
      siteSecret: input.siteSecret,
      pop: input.pop,
      expectedHtm: input.expectedHtm,
      expectedHtu: input.expectedHtu,
      expectedBodyHash: input.expectedBodyHash,
      requireHumanPop: input.requireHumanPop,
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, status: response.status, problem: body }
  }
  return { ok: true, ...body }
}



/** Attach capability (+ optional PoP) headers to a HeadersInit-like object. */
export function withCapabilityHeaders(headers, capability, pop) {
  const out = new Headers(headers || {})
  out.set(CAPABILITY_HEADER, capability)
  if (pop) {
    out.set(POP_HEADER, typeof pop === 'string' ? pop : JSON.stringify(pop))
  }
  return out
}

/**
 * Agent helper: obtain capability, create PoP for this request, fetch.
 * @param {GateAgent} agent
 * @param {string} action
 * @param {string} url
 * @param {RequestInit & { body?: string }} [init]
 */
export async function gateFetch(agent, action, url, init = {}) {
  const { capability } = await agent.obtainCapability({ action })
  const method = (init.method || 'GET').toUpperCase()
  const body =
    typeof init.body === 'string'
      ? init.body
      : init.body != null
        ? JSON.stringify(init.body)
        : undefined
  const pop = await agent.createPop({
    capability,
    htm: method,
    htu: url,
    body,
  })
  const headers = withCapabilityHeaders(init.headers, capability, pop)
  if (body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return fetch(url, { ...init, method, headers, body })
}

export default {
  Gate,
  GateAgent,
  verifyCapabilityRemote,
  generateAgentKeyPair,
  decodeJwtPayload,
  withCapabilityHeaders,
  gateFetch,
  CAPABILITY_HEADER,
  POP_HEADER,
}

