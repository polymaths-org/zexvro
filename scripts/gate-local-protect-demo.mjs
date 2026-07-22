#!/usr/bin/env node
/**
 * Local demo: protect any action with human soft (dev) + agent PoP.
 * Usage: node scripts/gate-local-protect-demo.mjs [action]
 * Requires: npm run dev:agent-auth
 */
import {
  GateAgent,
  generateAgentKeyPair,
  verifyCapabilityRemote,
  CAPABILITY_HEADER,
} from '../packages/agent-auth-sdk/src/index.js'

const base = (process.env.AGENT_AUTH_API_URL || 'http://127.0.0.1:4103').replace(/\/$/, '')
const action = process.argv[2] || 'search.query'

const keysRes = await fetch(`${base}/v1/admin/demo-keys`)
const keys = await keysRes.json()
if (!keysRes.ok) throw new Error(keys.detail || 'demo-keys failed')

// Human soft_confirm via REST (dev) for checkout-like actions; agents for search
const isHumanOnly = action === 'checkout.submit'
if (isHumanOnly) {
  const ch = await fetch(`${base}/v1/challenges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      siteKey: keys.siteKey,
      action,
      channel: 'human',
      clientPublicKey: `demo_${Date.now()}`,
      origin: 'http://localhost:5173',
    }),
  }).then((r) => r.json())
  const completed = await fetch(`${base}/v1/challenges/${ch.id}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      siteKey: keys.siteKey,
      proofType: 'soft_confirm',
      proof: 'soft-confirm',
    }),
  }).then((r) => r.json())
  const v = await verifyCapabilityRemote({
    apiBase: base,
    siteSecret: keys.secretKey,
    capability: completed.capability,
    action,
    minClass: 'human',
    expectedOrigin: 'http://localhost:5173',
  })
  console.log(JSON.stringify({ action, channel: 'human', ok: v.ok, class: v.class, header: CAPABILITY_HEADER }, null, 2))
  process.exit(v.ok ? 0 : 1)
}

const pair = await generateAgentKeyPair()
await fetch(`${base}/v1/admin/agents`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: keys.siteKey,
    publicKey: pair.publicKey,
    name: `demo-${action}`,
  }),
})
const agent = new GateAgent({
  siteKey: keys.siteKey,
  apiBase: base,
  publicKey: pair.publicKey,
  privateKey: pair.privateKey,
  siteId: keys.siteId,
})
const { capability } = await agent.obtainCapability({ action })
const htu = `${base}/protected-demo`
const pop = await agent.createPop({ capability, htm: 'GET', htu })
const v = await verifyCapabilityRemote({
  apiBase: base,
  siteSecret: keys.secretKey,
  capability,
  action,
  minClass: 'agent',
  pop,
  expectedHtm: 'GET',
  expectedHtu: htu,
})
console.log(
  JSON.stringify(
    {
      action,
      channel: 'agent',
      ok: v.ok,
      class: v.class,
      popBound: true,
      header: CAPABILITY_HEADER,
    },
    null,
    2,
  ),
)
process.exit(v.ok ? 0 : 1)
