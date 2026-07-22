#!/usr/bin/env node
/**
 * Full production / testnet readiness suite (manual or CI).
 *
 * Default: hit live prod URLs (services already on Stellar testnet for NFT/Depin).
 *
 *   node scripts/e2e-testnet.mjs
 *   npm run e2e:testnet
 *
 * Optional secrets (deeper checks):
 *   GATE_ADMIN_API_KEY     — Gate admin sites + agent register
 *   NFT_SMOKE_ACCESS_TOKEN — authenticated NFT routes
 *   DEPIN_URL              — override De-pin base
 *
 * Exit 0 only if all required checks pass (after retries).
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  sign as signSync,
  createHash,
  randomBytes,
} from 'node:crypto'

const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')

function env(name, fallback = '') {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : fallback
}

const cfg = {
  consoleUrl: env('CONSOLE_URL', 'https://console.zexvro.in').replace(/\/$/, ''),
  landUrl: env('LAND_URL', 'https://zexvro.in').replace(/\/$/, ''),
  gateUrl: env('GATE_URL', 'https://api.zexvro.in/gate').replace(/\/$/, ''),
  nftUrl: env('NFT_URL', env('NFT_API_BASE', 'https://iyk6idmup6.us-east-1.awsapprunner.com')).replace(
    /\/$/,
    '',
  ),
  depinUrl: env(
    'DEPIN_URL',
    env('VITE_DEPIN_API_URL', 'https://sr9k3xpmbj.us-east-1.awsapprunner.com'),
  ).replace(/\/$/, ''),
  platformUrl: env(
    'PLATFORM_API_URL',
    env('VITE_API_URL', 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com'),
  ).replace(/\/$/, ''),
  gateAdminKey: env('GATE_ADMIN_API_KEY'),
  nftToken: env('NFT_SMOKE_ACCESS_TOKEN', env('COGNITO_ACCESS_TOKEN')),
  retries: Number(process.env.E2E_RETRIES || 8),
  retryMs: Number(process.env.E2E_RETRY_MS || 8000),
  stableHits: Number(process.env.E2E_STABLE_HITS || 2),
}

const results = []
let failed = 0

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${level} ${msg}`)
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  log('OK  ', `${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  failed += 1
  results.push({ name, ok: false, detail })
  log('FAIL', `${name}${detail ? ` — ${detail}` : ''}`)
}

function skip(name, detail = '') {
  results.push({ name, ok: true, skipped: true, detail })
  log('SKIP', `${name}${detail ? ` — ${detail}` : ''}`)
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchOnce(url, init = {}) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Number(process.env.E2E_TIMEOUT_MS || 20000))
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const ct = res.headers.get('content-type') || ''
    let body
    if (ct.includes('application/json')) {
      body = await res.json().catch(() => null)
    } else {
      body = await res.text().catch(() => '')
    }
    return { res, body, status: res.status }
  } finally {
    clearTimeout(t)
  }
}

/** Retry until stable consecutive successes */
async function stableCheck(name, fn) {
  let streak = 0
  let lastErr = ''
  for (let i = 1; i <= cfg.retries; i += 1) {
    try {
      const detail = await fn()
      streak += 1
      if (streak >= cfg.stableHits) {
        pass(name, typeof detail === 'string' ? detail : '')
        return true
      }
    } catch (e) {
      streak = 0
      lastErr = e instanceof Error ? e.message : String(e)
      log('….', `${name} attempt ${i}/${cfg.retries}: ${lastErr}`)
    }
    if (i < cfg.retries) await sleep(cfg.retryMs)
  }
  fail(name, lastErr || 'unstable')
  return false
}

// ─── Health matrix ───────────────────────────────────────────────

async function checkHttpOk(name, url, { accept = [200], jsonPred } = {}) {
  return stableCheck(name, async () => {
    const { status, body } = await fetchOnce(url)
    if (!accept.includes(status)) {
      throw new Error(`HTTP ${status} for ${url}`)
    }
    if (jsonPred && !jsonPred(body)) {
      throw new Error(`JSON predicate failed for ${url}`)
    }
    return `${status}`
  })
}

// ─── Gate deep ───────────────────────────────────────────────────

function genEd25519() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' })
  return {
    publicKey: pubDer.subarray(pubDer.length - 32).toString('base64url'),
    privateKey: privDer.subarray(privDer.length - 32).toString('base64url'),
  }
}

function signRaw(privB64, message) {
  const raw = Buffer.from(privB64, 'base64url')
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8, raw]),
    format: 'der',
    type: 'pkcs8',
  })
  return signSync(null, Buffer.from(message, 'utf8'), key).toString('base64url')
}

async function gateJson(path, init = {}) {
  const headers = { ...(init.headers || {}) }
  if (init.json) {
    headers['content-type'] = 'application/json'
  }
  const { status, body, res } = await fetchOnce(`${cfg.gateUrl}${path}`, {
    ...init,
    headers,
    body: init.json ? JSON.stringify(init.json) : init.body,
  })
  if (!res.ok) {
    const detail = body?.detail || body?.error_code || body?.title || JSON.stringify(body)
    const err = new Error(`${path} → ${status}: ${detail}`)
    err.status = status
    err.body = body
    throw err
  }
  return body
}

async function runGateDeep() {
  await checkHttpOk('gate.health', `${cfg.gateUrl}/health`, {
    jsonPred: (b) => b?.status === 'ok' && (b?.service === 'agent-auth' || b?.product === 'zexvro-gate'),
  })

  await checkHttpOk('gate.status', `${cfg.gateUrl}/status`, {
    jsonPred: (b) => b?.status === 'ok',
  })

  await checkHttpOk('gate.sdk.captcha', `${cfg.gateUrl}/v1/sdk/captcha.js`, {
    accept: [200],
  })

  // Verify SDK body looks like JS (not HTML error)
  try {
    const { status, body } = await fetchOnce(`${cfg.gateUrl}/v1/sdk/captcha.js`)
    if (status !== 200 || typeof body !== 'string' || !body.includes('protectWithCaptcha')) {
      fail('gate.sdk.body', 'missing protectWithCaptcha export')
    } else {
      pass('gate.sdk.body', `${body.length} bytes`)
    }
  } catch (e) {
    fail('gate.sdk.body', e instanceof Error ? e.message : String(e))
  }

  if (!cfg.gateAdminKey) {
    skip('gate.admin.sites', 'GATE_ADMIN_API_KEY not set')
    skip('gate.agent.flow', 'GATE_ADMIN_API_KEY not set')
    skip('gate.human.challenge', 'GATE_ADMIN_API_KEY not set')
    return
  }

  const adminHeaders = { 'x-gate-admin-key': cfg.gateAdminKey }

  // List sites
  try {
    const listed = await gateJson('/v1/admin/sites', { headers: adminHeaders })
    const sites = listed.sites || []
    pass('gate.admin.sites', `${sites.length} site(s)`)
  } catch (e) {
    fail('gate.admin.sites', e instanceof Error ? e.message : String(e))
    return
  }

  // Prefer a live site that allows console origin
  const consoleOrigin = 'https://console.zexvro.in'
  let siteKey
  let secretKey
  let siteId

  try {
    const created = await gateJson('/v1/admin/sites', {
      method: 'POST',
      headers: adminHeaders,
      json: {
        name: `e2e-${Date.now()}`,
        allowedOrigins: [consoleOrigin, 'http://localhost:3000', 'https://example.com'],
      },
    })
    siteKey = created.siteKey
    secretKey = created.secretKey
    siteId = created.siteId
    pass('gate.admin.createSite', siteKey.slice(0, 20) + '…')
  } catch (e) {
    fail('gate.admin.createSite', e instanceof Error ? e.message : String(e))
    return
  }

  // Human challenge + captcha issue
  try {
    const ch = await gateJson('/v1/challenges', {
      method: 'POST',
      headers: { origin: consoleOrigin },
      json: {
        siteKey,
        action: 'e2e.checkout',
        channel: 'human',
        clientPublicKey: `ck_e2e_${randomBytes(16).toString('hex')}`,
        origin: consoleOrigin,
      },
    })
    const issued = await gateJson(`/v1/challenges/${ch.id}/captcha`, {
      method: 'POST',
      headers: { origin: consoleOrigin },
      json: { siteKey },
    })
    const ctype = issued.captcha?.type || issued.type || '?'
    pass('gate.human.challenge+captcha', `type=${ctype} id=${ch.id}`)
  } catch (e) {
    fail('gate.human.challenge+captcha', e instanceof Error ? e.message : String(e))
  }

  // Evil origin blocked
  try {
    await gateJson('/v1/challenges', {
      method: 'POST',
      json: {
        siteKey,
        action: 'e2e.checkout',
        channel: 'human',
        clientPublicKey: `ck_e2e_evil_${randomBytes(8).toString('hex')}`,
        origin: 'https://evil.example',
      },
    })
    fail('gate.human.origin_block', 'expected 403')
  } catch (e) {
    if (e.status === 403) pass('gate.human.origin_block', '403 as expected')
    else fail('gate.human.origin_block', e instanceof Error ? e.message : String(e))
  }

  // Agent crypto path end-to-end (nonce_sign + PoP verify)
  try {
    const kp = genEd25519()
    const status = await gateJson('/status')
    const issuer = (status.issuer || cfg.gateUrl).replace(/\/$/, '')

    await gateJson('/v1/admin/agents', {
      method: 'POST',
      headers: adminHeaders,
      json: {
        siteKey,
        publicKey: kp.publicKey,
        name: `e2e-agent-${Date.now()}`,
        payMode: 'self',
      },
    })

    const ch = await gateJson('/v1/challenges', {
      method: 'POST',
      json: {
        siteKey,
        action: 'e2e.search',
        channel: 'agent',
        clientPublicKey: kp.publicKey,
        agentPublicKey: kp.publicKey,
      },
    })

    // Wire format matches services/agent-auth/src/crypto.ts canonicalChallengeMessage
    const msg = [
      'zexvro-gate/v1',
      issuer,
      siteId,
      ch.nonce,
      String(ch.exp),
      'proj_default',
      'e2e.search',
      'agent',
      kp.publicKey,
    ].join('|')

    const completed = await gateJson(`/v1/challenges/${ch.id}/complete`, {
      method: 'POST',
      json: {
        siteKey,
        proofType: 'nonce_sign',
        proof: signRaw(kp.privateKey, msg),
      },
    })
    const capability = completed.capability || completed.token
    if (!capability) throw new Error('no capability from agent complete')

    const claims = JSON.parse(Buffer.from(capability.split('.')[1], 'base64url').toString('utf8'))
    const iat = Math.floor(Date.now() / 1000)
    const htm = 'GET'
    const htu = 'https://api.example/e2e-search'
    const popMsg = ['zexvro-pop/v0.2', claims.jti, htm, htu, String(iat), '-'].join('|')

    const verified = await gateJson('/v1/verify', {
      method: 'POST',
      json: {
        capability,
        siteSecret: secretKey,
        action: 'e2e.search',
        minClass: 'agent',
        pop: {
          signature: signRaw(kp.privateKey, popMsg),
          htm,
          htu,
          iat,
          bodyHash: '-',
        },
      },
    })
    const klass = verified.class || verified.claims?.class
    if (klass && klass !== 'agent') {
      throw new Error(`verify class=${klass} body=${JSON.stringify(verified).slice(0, 180)}`)
    }
    pass('gate.agent.flow', `class=${klass || 'agent'} jti=${claims.jti}`)
  } catch (e) {
    fail('gate.agent.flow', e instanceof Error ? e.message : String(e))
  }
}

// ─── NFT ─────────────────────────────────────────────────────────

async function runNft() {
  await checkHttpOk('nft.health', `${cfg.nftUrl}/health`, {
    jsonPred: (b) => b?.status === 'ok' || b?.service === 'nft-service',
  })

  try {
    const { status, body } = await fetchOnce(`${cfg.nftUrl}/health`)
    if (status === 200 && body?.capabilities) {
      const net = body.capabilities.network || body.network || '?'
      const stellar = body.capabilities.stellarConfigured
      pass(
        'nft.capabilities',
        `network=${net} stellar=${String(stellar)} storage=${body.capabilities.storageMode || '?'}`,
      )
      if (String(net).toLowerCase().includes('public') && !String(net).includes('test')) {
        fail('nft.network_guard', `expected testnet-ish network, got ${net}`)
      }
    }
  } catch (e) {
    fail('nft.capabilities', e instanceof Error ? e.message : String(e))
  }

  if (!cfg.nftToken) {
    skip('nft.authenticated', 'NFT_SMOKE_ACCESS_TOKEN not set')
    return
  }

  try {
    const { status, body } = await fetchOnce(`${cfg.nftUrl}/v1/collections`, {
      headers: {
        authorization: `Bearer ${cfg.nftToken}`,
        accept: 'application/json',
      },
    })
    // 200 list or 400 missing workspace still proves auth middleware
    if (status === 200 || status === 400 || status === 401 || status === 403) {
      if (status === 401 || status === 403) {
        fail('nft.authenticated', `token rejected HTTP ${status}`)
      } else {
        pass('nft.authenticated', `HTTP ${status}`)
      }
    } else {
      fail('nft.authenticated', `HTTP ${status} ${JSON.stringify(body).slice(0, 120)}`)
    }
  } catch (e) {
    fail('nft.authenticated', e instanceof Error ? e.message : String(e))
  }
}

// ─── De-pin ──────────────────────────────────────────────────────

async function runDepin() {
  await checkHttpOk('depin.health', `${cfg.depinUrl}/health`, {
    jsonPred: (b) => b?.status === 'ok' || b?.service === 'depin',
  })

  try {
    const { status, body } = await fetchOnce(`${cfg.depinUrl}/status`)
    if (status !== 200) throw new Error(`status HTTP ${status}`)
    const providers = body?.providers || body?.routes || []
    const settleReady = body?.capabilities?.settleReady
    pass(
      'depin.status',
      `providers=${Array.isArray(providers) ? providers.length : '?'} settleReady=${String(settleReady)}`,
    )

    // Unpaid probe: pick first path-like provider
    let probePath = process.env.DEPIN_PROBE_PATH || ''
    if (!probePath && Array.isArray(providers) && providers[0]) {
      const p = providers[0]
      probePath = p.path || p.route || p.prefix || ''
    }
    if (!probePath) {
      // common demo path
      probePath = '/v1/weather'
    }
    if (!probePath.startsWith('/')) probePath = `/${probePath}`

    const probe = await fetchOnce(`${cfg.depinUrl}${probePath}`, {
      headers: { accept: 'application/json' },
    })
    // Expect 402 Payment Required for protected route, or 404 if route missing
    if (probe.status === 402) {
      pass('depin.unpaid_402', probePath)
    } else if (probe.status === 404) {
      skip('depin.unpaid_402', `${probePath} not found (configure DEPIN_PROBE_PATH)`)
    } else if (probe.status === 200) {
      // open route
      pass('depin.probe_open', `${probePath} HTTP 200 (no payment required)`)
    } else {
      fail('depin.unpaid_402', `${probePath} HTTP ${probe.status}`)
    }
  } catch (e) {
    fail('depin.status', e instanceof Error ? e.message : String(e))
  }
}

// ─── Frontends + platform ────────────────────────────────────────

async function runFrontends() {
  await checkHttpOk('console.http', cfg.consoleUrl + '/', { accept: [200] })
  await checkHttpOk('land.http', cfg.landUrl + '/', { accept: [200] })

  // Console should reference Gate API in modern bundle (soft check)
  try {
    const { body } = await fetchOnce(cfg.consoleUrl + '/')
    const html = typeof body === 'string' ? body : ''
    const asset = html.match(/assets\/index-[^"]+\.js/)
    if (asset) {
      const { body: js } = await fetchOnce(`${cfg.consoleUrl}/${asset[0]}`)
      if (typeof js === 'string' && js.includes('api.zexvro.in/gate')) {
        pass('console.gate_wired', asset[0])
      } else if (typeof js === 'string' && (js.includes('Create site') || js.includes('Protect your website'))) {
        pass('console.agent_auth_ui', 'customer UI strings present')
      } else {
        fail('console.gate_wired', 'bundle missing Gate URL / Agent Auth UI')
      }
    } else {
      skip('console.gate_wired', 'no index asset found')
    }
  } catch (e) {
    fail('console.gate_wired', e instanceof Error ? e.message : String(e))
  }
}

async function runPlatform() {
  // Unauthenticated should not 5xx
  try {
    const { status } = await fetchOnce(`${cfg.platformUrl}/api/memory`, {
      headers: { authorization: 'Bearer invalid' },
    })
    if (status >= 500) fail('platform.api', `5xx ${status}`)
    else pass('platform.api', `HTTP ${status} (auth wall ok)`)
  } catch (e) {
    fail('platform.api', e instanceof Error ? e.message : String(e))
  }
}

// ─── Main ────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════')
console.log(' ZEXVRO e2e-testnet (manual / GitHub Actions)')
console.log('══════════════════════════════════════════════')
console.log(`console  ${cfg.consoleUrl}`)
console.log(`land     ${cfg.landUrl}`)
console.log(`gate     ${cfg.gateUrl}`)
console.log(`nft      ${cfg.nftUrl}`)
console.log(`depin    ${cfg.depinUrl}`)
console.log(`platform ${cfg.platformUrl}`)
console.log(`adminKey ${cfg.gateAdminKey ? 'set' : 'missing'}`)
console.log(`nftToken ${cfg.nftToken ? 'set' : 'missing'}`)
console.log('')

const t0 = Date.now()

await runFrontends()
await runPlatform()
await runGateDeep()
await runNft()
await runDepin()

const ms = Date.now() - t0
console.log('')
console.log('──────────────────────────────────────────────')
const okCount = results.filter((r) => r.ok && !r.skipped).length
const skipCount = results.filter((r) => r.skipped).length
console.log(`done in ${(ms / 1000).toFixed(1)}s · pass=${okCount} fail=${failed} skip=${skipCount}`)

if (failed > 0) {
  console.log('\nFailed checks:')
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ✗ ${r.name}: ${r.detail}`)
  }
  process.exit(1)
}

console.log('\nAll required checks passed.')
process.exit(0)
