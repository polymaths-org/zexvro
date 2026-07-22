#!/usr/bin/env node
/**
 * Local smoke for ZEXVRO Gate.
 * Requires: npm --prefix services/agent-auth run dev
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  sign as signSync,
  createHash,
} from 'node:crypto'

const base = (process.env.AGENT_AUTH_API_URL || 'http://127.0.0.1:4103').replace(/\/$/, '')
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')

async function j(path, init) {
  const res = await fetch(`${base}${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.detail || body.error_code || `HTTP ${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

function gen() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' })
  return {
    publicKey: pubDer.subarray(pubDer.length - 32).toString('base64url'),
    privateKey: privDer.subarray(privDer.length - 32).toString('base64url'),
  }
}

function sign(privB64, message) {
  const raw = Buffer.from(privB64, 'base64url')
  const key = createPrivateKey({ key: Buffer.concat([PKCS8, raw]), format: 'der', type: 'pkcs8' })
  return signSync(null, Buffer.from(message, 'utf8'), key).toString('base64url')
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
}

const health = await j('/health')
const keys = await j('/v1/admin/demo-keys')
if (!keys.siteKey || !keys.secretKey || !keys.siteId) {
  throw new Error('demo-keys missing required fields')
}
if (!Array.isArray(keys.allowedOrigins) || keys.allowedOrigins.length === 0) {
  throw new Error('demo-keys missing allowedOrigins')
}
const status = await j('/status')
const listedBefore = await j(`/v1/admin/agents?siteKey=${encodeURIComponent(keys.siteKey)}`)
if (!Array.isArray(listedBefore.agents)) throw new Error('list agents failed shape')
const kp = gen()

await j('/v1/admin/agents', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ siteKey: keys.siteKey, publicKey: kp.publicKey, name: 'smoke-agent' }),
})
const listedAfter = await j(`/v1/admin/agents?siteKey=${encodeURIComponent(keys.siteKey)}`)
if (!listedAfter.agents.some((a) => a.publicKey === kp.publicKey)) {
  throw new Error('registered agent not listed')
}

// Human (dev)
const humanCh = await j('/v1/challenges', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    action: 'checkout.submit',
    channel: 'human',
    clientPublicKey: 'smoke-human-ck',
    origin: 'http://localhost:5173',
  }),
})
const humanCap = await j(`/v1/challenges/${humanCh.id}/complete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ siteKey: keys.siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' }),
})
const vHuman = await j('/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: humanCap.capability,
    action: 'checkout.submit',
    minClass: 'human',
    siteSecret: keys.secretKey,
    expectedOrigin: 'http://localhost:5173',
  }),
})

// Human session_pop (production soft path shape)
const humanKp = gen()
const humanPopCh = await j('/v1/challenges', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    action: 'checkout.submit',
    channel: 'human',
    clientPublicKey: humanKp.publicKey,
    origin: 'http://localhost:5173',
  }),
})
const humanPopMsg = [
  'zexvro-gate/v1',
  status.issuer,
  keys.siteId,
  humanPopCh.nonce,
  String(humanPopCh.exp),
  'proj_demo',
  'checkout.submit',
  'human',
  humanKp.publicKey,
].join('|')
const humanPopCap = await j(`/v1/challenges/${humanPopCh.id}/complete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    proofType: 'session_pop',
    proof: sign(humanKp.privateKey, humanPopMsg),
  }),
})
const vHumanSession = await j('/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: humanPopCap.capability,
    action: 'checkout.submit',
    minClass: 'human',
    siteSecret: keys.secretKey,
    expectedOrigin: 'http://localhost:5173',
  }),
})

// Agent + PoP
const agentCh = await j('/v1/challenges', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    action: 'search.query',
    channel: 'agent',
    clientPublicKey: kp.publicKey,
    agentPublicKey: kp.publicKey,
  }),
})
const msg = [
  'zexvro-gate/v1',
  status.issuer,
  keys.siteId,
  agentCh.nonce,
  String(agentCh.exp),
  'proj_demo',
  'search.query',
  'agent',
  kp.publicKey,
].join('|')
const agentCap = await j(`/v1/challenges/${agentCh.id}/complete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    proofType: 'nonce_sign',
    proof: sign(kp.privateKey, msg),
  }),
})
const claims = decodeJwt(agentCap.capability)
const iat = Math.floor(Date.now() / 1000)
const popMsg = ['zexvro-pop/v0.2', claims.jti, 'GET', 'https://api.example/search', String(iat), '-'].join('|')
const vAgent = await j('/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: agentCap.capability,
    action: 'search.query',
    minClass: 'agent',
    siteSecret: keys.secretKey,
    pop: {
      signature: sign(kp.privateKey, popMsg),
      htm: 'GET',
      htu: 'https://api.example/search',
      iat,
      bodyHash: '-',
    },
  }),
})

console.log(
  JSON.stringify(
    {
      health: health.status,
      human: vHuman.class,
      humanSessionPop: vHumanSession.class,
      agent: vAgent.class,
      agentsListed: listedAfter.agents.length,
      popEnforced: status.securityProfile?.popEnforcedOnVerify,
      agentPayers: vAgent.allowed_payer_pks,
    },
    null,
    2,
  ),
)
