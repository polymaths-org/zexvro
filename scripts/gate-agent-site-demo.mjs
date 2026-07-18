#!/usr/bin/env node
/**
 * Autonomous AGENT path demo against a Gate-protected merchant site.
 *
 * This is the real product story:
 *   Developer site wires Gate:
 *     - humans → captcha / human ceremony
 *     - agents → registered Ed25519 key + challenge sign + PoP
 *   An autonomous agent completes the agent path WITHOUT captcha UI.
 *
 * Requires Gate running: npm run dev:agent-auth
 * Run: npm run gate:agent-site-demo
 */
import {
  GateAgent,
  generateAgentKeyPair,
  CAPABILITY_HEADER,
  POP_HEADER,
} from '../packages/agent-auth-sdk/src/index.js'

const base = (process.env.AGENT_AUTH_API_URL || 'http://127.0.0.1:4103').replace(/\/$/, '')
const siteBase = process.env.GATE_MERCHANT_URL || base

function log(step, data) {
  console.log(JSON.stringify({ step, ...data }, null, 2))
}

async function j(url, init) {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.detail || body.error_code || `HTTP ${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function main() {
  log('start', {
    gate: base,
    merchant: siteBase,
    story: 'Autonomous agent uses crypto channel — never captcha',
  })

  // 0) Health
  const health = await j(`${base}/health`)
  log('gate_health', health)

  // 1) Public merchant surface (no Gate)
  const pub = await j(`${siteBase}/demo/site/api/public`)
  log('merchant_public', pub)

  // 2) Agent tries protected search WITHOUT capability → deny
  {
    const res = await fetch(`${siteBase}/demo/site/api/search`)
    const body = await res.json().catch(() => ({}))
    log('agent_denied_without_capability', { status: res.status, body })
    if (res.ok) throw new Error('expected 401 without capability')
  }

  // 3) Demo keys from Gate (developer issued siteKey to this website)
  const keys = await j(`${base}/v1/admin/demo-keys`)
  log('developer_keys', {
    siteKey: keys.siteKey,
    siteId: keys.siteId,
    note: 'Website embeds siteKey; secret stays on merchant server (demo uses Gate-hosted verify)',
  })

  // 4) Autonomous agent generates keypair and registers with developer site
  const pair = await generateAgentKeyPair()
  await j(`${base}/v1/admin/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      siteKey: keys.siteKey,
      publicKey: pair.publicKey,
      name: 'autonomous-demo-agent',
      payMode: 'self',
    }),
  })
  log('agent_registered', { publicKey: pair.publicKey.slice(0, 16) + '…' })

  // 5) Agent obtains capability for search.query (channel=agent, signed challenge)
  const agent = new GateAgent({
    siteKey: keys.siteKey,
    apiBase: base,
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    siteId: keys.siteId,
    projectId: keys.projectId || 'proj_demo',
  })
  const { capability, class: klass } = await agent.obtainCapability({ action: 'search.query' })
  if (klass !== 'agent') throw new Error(`expected class=agent, got ${klass}`)
  log('agent_capability_minted', { class: klass, capabilityPrefix: capability.slice(0, 24) + '…' })

  // 6) Prove agent cannot use captcha ceremony to mint human for agent channel
  {
    const ch = await fetch(`${base}/v1/challenges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: keys.siteKey,
        action: 'checkout.submit',
        channel: 'agent',
        clientPublicKey: pair.publicKey,
        agentPublicKey: pair.publicKey,
      }),
    }).then((r) => r.json())
    const complete = await fetch(`${base}/v1/challenges/${ch.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: keys.siteKey,
        proofType: 'captcha_pass',
        proof: 'captcha-pass',
      }),
    })
    const body = await complete.json().catch(() => ({}))
    log('agent_cannot_use_captcha_pass', { status: complete.status, body })
    if (complete.ok) throw new Error('agent must not complete with captcha_pass')
  }

  // 7) Agent calls merchant search with capability + request-bound PoP
  const searchUrl = `${siteBase}/demo/site/api/search`
  const pop = await agent.createPop({ capability, htm: 'GET', htu: searchUrl })
  const searchRes = await fetch(searchUrl, {
    headers: {
      [CAPABILITY_HEADER]: capability,
      [POP_HEADER]: JSON.stringify(pop),
      'x-zexvro-expected-htu': searchUrl,
    },
  })
  const searchBody = await searchRes.json().catch(() => ({}))
  log('agent_search_success', { status: searchRes.status, body: searchBody })
  if (!searchRes.ok || !searchBody.ok || searchBody.channel !== 'agent') {
    throw new Error('agent search failed: ' + JSON.stringify(searchBody))
  }
  if (searchBody.class && searchBody.class !== 'agent') {
    throw new Error('unexpected class: ' + searchBody.class)
  }

  // 8) Agent capability must not pass human-only checkout
  {
    const res = await fetch(`${siteBase}/demo/site/api/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CAPABILITY_HEADER]: capability,
      },
      body: JSON.stringify({ item: 'sku_1' }),
    })
    const body = await res.json().catch(() => ({}))
    log('agent_blocked_on_human_checkout', { status: res.status, body })
    if (res.ok) throw new Error('agent must not pass human-only checkout')
  }

  log('done', {
    ok: true,
    summary:
      'Developer site protected by Gate. Autonomous agent registered, minted agent capability, used PoP, searched successfully, could not use captcha or human checkout.',
  })
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, status: e.status, body: e.body }, null, 2))
  process.exit(1)
})
