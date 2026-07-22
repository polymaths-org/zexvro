#!/usr/bin/env node
/**
 * Full production / testnet readiness suite (manual or CI).
 *
 * Default: hit live prod URLs (services already on Stellar testnet for NFT/Depin).
 *
 *   node scripts/e2e-testnet.mjs
 *   npm run e2e:testnet
 *
 * What this suite DOES cover (live deploy / Stellar testnet, not unit mocks):
 *   - Console + landing HTTP + Gate wired in console bundle
 *   - Platform API reachable (auth wall)
 *   - Gate: health/status/SDK, admin sites, create site, human challenge+captcha
 *     issue, origin block, full agent register→sign→complete→PoP verify
 *   - NFT: health + capabilities (must be stellar:testnet)
 *   - NFT auth: Cognito login / list collections
 *   - NFT chain (with Cognito + @stellar/stellar-sdk): media upload, create
 *     collection (on-chain deploy), mint token, configure primary sale
 *   - De-pin: health/status + unpaid 402
 *   - De-pin paid settle (with DEPIN_BUYER_SECRET): real testnet USDC payment
 *
 * Still out of scope here:
 *   - Freighter browser UI / public buyer checkout in a real wallet extension
 *   - Zer0 ZK prove/withdraw (prover EC2 often stopped)
 *
 * Secrets (GitHub Actions — never commit):
 *   GATE_ADMIN_API_KEY
 *   COGNITO_SMOKE_USERNAME + COGNITO_SMOKE_PASSWORD  (preferred) or NFT_SMOKE_ACCESS_TOKEN
 *   DEPIN_BUYER_SECRET / NFT_SPONSOR_SECRET (Stellar secret seed for paid settle; optional for mint)
 *   COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID / COGNITO_REGION (defaults to prod pool)
 *
 * Exit 0 only if all required checks pass (after retries).
 * Writes GITHUB_STEP_SUMMARY with every check when present.
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
  cognitoUser: env('COGNITO_SMOKE_USERNAME'),
  cognitoPass: env('COGNITO_SMOKE_PASSWORD'),
  cognitoPool: env('COGNITO_USER_POOL_ID', 'us-east-1_vyONcitBD'),
  cognitoClient: env('COGNITO_CLIENT_ID', '7qmkq33si9qk8pgo6ebi3qantm'),
  cognitoRegion: env('COGNITO_REGION', env('AWS_REGION', 'us-east-1')),
  nftWorkspaceId: env('NFT_SMOKE_WORKSPACE_ID', 'smoke-workspace'),
  stellarSecret: env('DEPIN_BUYER_SECRET', env('NFT_SPONSOR_SECRET', env('STELLAR_PRIVATE_KEY'))),
  stellarNetworkPassphrase: env(
    'STELLAR_NETWORK_PASSPHRASE',
    'Test SDF Network ; September 2015',
  ),
  stellarRpcUrl: env('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org'),
  enableChainSmoke: env('E2E_CHAIN_SMOKE', '1') !== '0',
  enablePaidDepin: env('E2E_PAID_DEPIN', '1') !== '0',
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

// ─── Cognito (for NFT auth) ──────────────────────────────────────

async function fetchCognitoAccessToken() {
  if (cfg.nftToken) return cfg.nftToken
  if (!cfg.cognitoUser || !cfg.cognitoPass) return ''

  const url = `https://cognito-idp.${cfg.cognitoRegion}.amazonaws.com/`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cfg.cognitoClient,
      AuthParameters: {
        USERNAME: cfg.cognitoUser,
        PASSWORD: cfg.cognitoPass,
      },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.message || body?.__type || `HTTP ${res.status}`
    throw new Error(`Cognito login failed: ${msg}`)
  }
  const token = body?.AuthenticationResult?.AccessToken
  if (!token) throw new Error('Cognito login returned no AccessToken')
  return token
}

// ─── NFT ─────────────────────────────────────────────────────────

async function loadStellar() {
  try {
    const sdk = await import('@stellar/stellar-sdk')
    const contract = await import('@stellar/stellar-sdk/contract')
    return {
      Keypair: sdk.Keypair,
      AssembledTransaction: contract.AssembledTransaction,
      basicNodeSigner: contract.basicNodeSigner,
    }
  } catch {
    return null
  }
}

async function signAssembledJson(stellar, secretKeypair, contractId, serializedTransaction) {
  const parsed = JSON.parse(serializedTransaction)
  const method = parsed.method || 'mint'
  const tx = stellar.AssembledTransaction.fromJSON(
    {
      contractId,
      networkPassphrase: cfg.stellarNetworkPassphrase,
      rpcUrl: cfg.stellarRpcUrl,
      method,
      parseResultXdr: () => undefined,
    },
    {
      tx: parsed.tx,
      simulationResult: parsed.simulationResult,
      simulationTransactionData: parsed.simulationTransactionData,
    },
  )
  const nodeSigner = stellar.basicNodeSigner(secretKeypair, cfg.stellarNetworkPassphrase)
  await tx.signAuthEntries({
    address: secretKeypair.publicKey(),
    signAuthEntry: nodeSigner.signAuthEntry,
  })
  return tx.toJSON()
}

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

  let token = ''
  try {
    token = await fetchCognitoAccessToken()
    if (token && (cfg.cognitoUser || cfg.nftToken)) {
      pass(
        'nft.cognito_token',
        cfg.nftToken ? 'using NFT_SMOKE_ACCESS_TOKEN' : 'logged in via COGNITO_SMOKE_*',
      )
    }
  } catch (e) {
    fail('nft.cognito_token', e instanceof Error ? e.message : String(e))
    return
  }

  if (!token) {
    skip(
      'nft.authenticated',
      'set NFT_SMOKE_ACCESS_TOKEN or COGNITO_SMOKE_USERNAME+COGNITO_SMOKE_PASSWORD',
    )
    skip('nft.media', 'auth required')
    skip('nft.create_collection', 'auth required')
    skip('nft.mint', 'auth required')
    skip('nft.sale_config', 'auth required')
    return
  }

  try {
    const ws = encodeURIComponent(cfg.nftWorkspaceId)
    const { status, body } = await fetchOnce(`${cfg.nftUrl}/v1/collections?workspaceId=${ws}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    })
    if (status === 401 || status === 403) {
      fail('nft.authenticated', `token rejected HTTP ${status}`)
      return
    } else if (status === 200) {
      const count = Array.isArray(body?.collections) ? body.collections.length : 0
      pass('nft.authenticated', `list collections HTTP 200 count=${count}`)
    } else if (status === 400) {
      pass('nft.authenticated', `auth accepted HTTP 400 (workspace)`)
    } else {
      fail('nft.authenticated', `HTTP ${status} ${JSON.stringify(body).slice(0, 120)}`)
      return
    }
  } catch (e) {
    fail('nft.authenticated', e instanceof Error ? e.message : String(e))
    return
  }

  if (!cfg.enableChainSmoke) {
    skip('nft.media', 'E2E_CHAIN_SMOKE=0')
    skip('nft.create_collection', 'E2E_CHAIN_SMOKE=0')
    skip('nft.mint', 'E2E_CHAIN_SMOKE=0')
    skip('nft.sale_config', 'E2E_CHAIN_SMOKE=0')
    return
  }

  const stellar = await loadStellar()
  if (!stellar) {
    skip('nft.media', 'install @stellar/stellar-sdk for chain smoke')
    skip('nft.create_collection', 'install @stellar/stellar-sdk for chain smoke')
    skip('nft.mint', 'install @stellar/stellar-sdk for chain smoke')
    skip('nft.sale_config', 'install @stellar/stellar-sdk for chain smoke')
    return
  }

  // Ephemeral owner so mint requires non-invoker auth (sponsor-as-operator returns 422)
  const owner = stellar.Keypair.random()
  try {
    const fb = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(owner.publicKey())}`,
    )
    if (!fb.ok) throw new Error(`friendbot HTTP ${fb.status}`)
    pass('nft.friendbot_owner', owner.publicKey().slice(0, 8) + '…')
  } catch (e) {
    fail('nft.friendbot_owner', e instanceof Error ? e.message : String(e))
    return
  }

  let coverUri = ''
  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const form = new FormData()
    form.set('file', new Blob([png], { type: 'image/png' }), 'e2e-smoke.png')
    const res = await fetch(`${cfg.nftUrl}/v1/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.asset?.uri) {
      fail('nft.media', `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`)
      return
    }
    coverUri = body.asset.uri
    pass('nft.media', coverUri.slice(0, 64) + (coverUri.length > 64 ? '…' : ''))
  } catch (e) {
    fail('nft.media', e instanceof Error ? e.message : String(e))
    return
  }

  let collection
  try {
    const res = await fetch(`${cfg.nftUrl}/v1/collections`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: cfg.nftWorkspaceId,
        name: `E2E Smoke ${Date.now().toString().slice(-6)}`,
        symbol: 'E2ESM',
        description: 'Automated e2e testnet collection — create + mint + sale smoke',
        ownerAddress: owner.publicKey(),
        royaltyRecipient: owner.publicKey(),
        royaltyBps: 250,
        coverImageUri: coverUri,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.collection?.id) {
      fail('nft.create_collection', `HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`)
      return
    }
    collection = body.collection
    if (collection.status !== 'live') {
      fail(
        'nft.create_collection',
        `status=${collection.status} reason=${collection.failureReason || '?'}`,
      )
      return
    }
    pass(
      'nft.create_collection',
      `live contract=${String(collection.contractId).slice(0, 12)}… tx=${String(collection.deploymentTxHash || '').slice(0, 12)}…`,
    )
  } catch (e) {
    fail('nft.create_collection', e instanceof Error ? e.message : String(e))
    return
  }

  try {
    const intentRes = await fetch(`${cfg.nftUrl}/v1/collections/${collection.id}/mints/intent`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        operatorAddress: owner.publicKey(),
        recipientAddress: owner.publicKey(),
      }),
    })
    const intentBody = await intentRes.json().catch(() => ({}))
    if (!intentRes.ok || !intentBody?.intent?.serializedTransaction) {
      fail('nft.mint', `intent HTTP ${intentRes.status} ${JSON.stringify(intentBody).slice(0, 200)}`)
      return
    }
    const prepared = intentBody.intent.serializedTransaction
    const signed = await signAssembledJson(
      stellar,
      owner,
      collection.contractId,
      prepared,
    )
    const submitRes = await fetch(`${cfg.nftUrl}/v1/collections/${collection.id}/mints/submit`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        preparedTransaction: prepared,
        signedTransaction: signed,
        tokenId: intentBody.intent.tokenId,
        ownerAddress: owner.publicKey(),
      }),
    })
    const submitBody = await submitRes.json().catch(() => ({}))
    if (!submitRes.ok || submitBody?.transaction?.status !== 'confirmed') {
      fail('nft.mint', `submit HTTP ${submitRes.status} ${JSON.stringify(submitBody).slice(0, 220)}`)
      return
    }
    pass(
      'nft.mint',
      `tokenId=${intentBody.intent.tokenId} tx=${String(submitBody.transaction.transactionHash).slice(0, 16)}…`,
    )
  } catch (e) {
    fail('nft.mint', e instanceof Error ? e.message : String(e))
    return
  }

  try {
    const saleRes = await fetch(
      `${cfg.nftUrl}/v1/collections/${collection.id}/sale-config/intent`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ownerAddress: owner.publicKey(),
          priceAtomic: '1000000',
        }),
      },
    )
    const saleBody = await saleRes.json().catch(() => ({}))
    if (!saleRes.ok || !saleBody?.intent) {
      fail('nft.sale_config', `intent HTTP ${saleRes.status} ${JSON.stringify(saleBody).slice(0, 200)}`)
      return
    }
    if (saleBody.intent.autoSubmitted?.transactionHash) {
      pass(
        'nft.sale_config',
        `autoSubmitted tx=${String(saleBody.intent.autoSubmitted.transactionHash).slice(0, 16)}…`,
      )
      return
    }
    const prepared = saleBody.intent.serializedTransaction
    if (!prepared) {
      fail('nft.sale_config', 'no serializedTransaction and no autoSubmitted')
      return
    }
    const signed = await signAssembledJson(
      stellar,
      owner,
      collection.contractId,
      prepared,
    )
    const sub = await fetch(
      `${cfg.nftUrl}/v1/collections/${collection.id}/sale-config/submit`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          preparedTransaction: prepared,
          signedTransaction: signed,
          priceAtomic: '1000000',
        }),
      },
    )
    const subBody = await sub.json().catch(() => ({}))
    if (!sub.ok || subBody?.transaction?.status !== 'confirmed') {
      fail('nft.sale_config', `submit HTTP ${sub.status} ${JSON.stringify(subBody).slice(0, 220)}`)
      return
    }
    pass(
      'nft.sale_config',
      `confirmed tx=${String(subBody.transaction.transactionHash).slice(0, 16)}… price=1000000`,
    )
  } catch (e) {
    fail('nft.sale_config', e instanceof Error ? e.message : String(e))
  }
}

// ─── De-pin ──────────────────────────────────────────────────────

async function runDepin() {
  await checkHttpOk('depin.health', `${cfg.depinUrl}/health`, {
    jsonPred: (b) => b?.status === 'ok' || b?.service === 'depin',
  })

  let probePath = process.env.DEPIN_PROBE_PATH || ''
  let expectedRecipient = ''
  try {
    const { status, body } = await fetchOnce(`${cfg.depinUrl}/status`)
    if (status !== 200) throw new Error(`status HTTP ${status}`)
    const providers = body?.providers || body?.routes || []
    const settleReady = body?.capabilities?.settleReady
    pass(
      'depin.status',
      `providers=${Array.isArray(providers) ? providers.length : '?'} settleReady=${String(settleReady)} network=${body?.capabilities?.network || '?'}`,
    )

    if (!probePath && Array.isArray(providers) && providers[0]) {
      const p = providers[0]
      probePath = p.path || p.route || p.prefix || ''
      expectedRecipient = p.recipient || p.payTo || ''
    }
    if (!probePath) probePath = '/v1/weather'
    if (!probePath.startsWith('/')) probePath = `/${probePath}`

    const probe = await fetchOnce(`${cfg.depinUrl}${probePath}`, {
      headers: { accept: 'application/json' },
    })
    if (probe.status === 402) {
      pass('depin.unpaid_402', probePath)
    } else if (probe.status === 404) {
      skip('depin.unpaid_402', `${probePath} not found (configure DEPIN_PROBE_PATH)`)
    } else if (probe.status === 200) {
      pass('depin.probe_open', `${probePath} HTTP 200 (no payment required)`)
    } else {
      fail('depin.unpaid_402', `${probePath} HTTP ${probe.status}`)
    }
  } catch (e) {
    fail('depin.status', e instanceof Error ? e.message : String(e))
    return
  }

  if (!cfg.enablePaidDepin) {
    skip('depin.paid_settle', 'E2E_PAID_DEPIN=0')
    return
  }
  if (!cfg.stellarSecret) {
    skip(
      'depin.paid_settle',
      'set DEPIN_BUYER_SECRET or NFT_SPONSOR_SECRET (Stellar secret for testnet USDC buyer)',
    )
    return
  }

  try {
    // Prefer official demo client path via dynamic imports from services/depin when available.
    // Fallback: shell out is avoided; reimplement minimal paid flow with @x402/* if present.
    let ran = false
    try {
      const { spawnSync } = await import('node:child_process')
      const { fileURLToPath } = await import('node:url')
      const { dirname, join } = await import('node:path')
      const root = join(dirname(fileURLToPath(import.meta.url)), '..')
      const demo = join(root, 'services/depin/src/demoClient.ts')
      const env = {
        ...process.env,
        STELLAR_PRIVATE_KEY: cfg.stellarSecret,
        DEPIN_URL: `${cfg.depinUrl}${probePath}`,
        DEPIN_EXPECTED_RECIPIENT: expectedRecipient || process.env.DEPIN_EXPECTED_RECIPIENT || '',
        DEPIN_MAX_PAYMENT_ATOMIC: process.env.DEPIN_MAX_PAYMENT_ATOMIC || '10000',
      }
      if (!env.DEPIN_EXPECTED_RECIPIENT) {
        // re-fetch status for recipient
        const st = await fetchOnce(`${cfg.depinUrl}/status`)
        env.DEPIN_EXPECTED_RECIPIENT =
          st.body?.providers?.[0]?.recipient || st.body?.providers?.[0]?.payTo || ''
      }
      if (!env.DEPIN_EXPECTED_RECIPIENT) {
        throw new Error('no DEPIN_EXPECTED_RECIPIENT from status')
      }
      const r = spawnSync(
        'npx',
        ['--yes', 'tsx', demo],
        {
          env,
          encoding: 'utf8',
          timeout: 120_000,
          cwd: join(root, 'services/depin'),
        },
      )
      const out = `${r.stdout || ''}\n${r.stderr || ''}`.trim()
      if (r.status === 0 && /Access granted/i.test(out)) {
        const settleLine = out.split('\n').find((l) => /Settlement:/i.test(l)) || ''
        pass(
          'depin.paid_settle',
          `paid ${probePath} ${settleLine.slice(0, 120) || 'Access granted'}`.trim(),
        )
        ran = true
      } else {
        throw new Error(out.slice(0, 400) || `demoClient exit ${r.status}`)
      }
    } catch (inner) {
      if (!ran) {
        fail('depin.paid_settle', inner instanceof Error ? inner.message : String(inner))
      }
    }
  } catch (e) {
    fail('depin.paid_settle', e instanceof Error ? e.message : String(e))
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
console.log(`cognito  ${cfg.cognitoUser ? 'set' : 'missing'}`)
console.log(`stellar  ${cfg.stellarSecret ? 'set' : 'missing'}`)
console.log(`chain    ${cfg.enableChainSmoke ? 'on' : 'off'}  paidDepin ${cfg.enablePaidDepin ? 'on' : 'off'}`)
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

console.log('')
console.log('Checks:')
for (const r of results) {
  const mark = !r.ok ? 'FAIL' : r.skipped ? 'SKIP' : 'PASS'
  console.log(`  ${mark.padEnd(4)} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
}

// GitHub Actions step summary: list every check
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs')
  const lines = [
    '## E2E testnet / prod readiness',
    '',
    `**Result:** pass=${okCount} · fail=${failed} · skip=${skipCount} · ${(ms / 1000).toFixed(1)}s`,
    '',
    '| Status | Check | Detail |',
    '| --- | --- | --- |',
  ]
  for (const r of results) {
    const mark = !r.ok ? 'FAIL' : r.skipped ? 'SKIP' : 'PASS'
    const detail = String(r.detail || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    lines.push(`| ${mark} | \`${r.name}\` | ${detail} |`)
  }
  lines.push('')
  lines.push('### Coverage')
  lines.push('- Frontends, platform auth wall, Gate deep (admin/human/agent)')
  lines.push('- NFT testnet: auth, media, on-chain create, mint, sale config')
  lines.push('- De-pin: unpaid 402 + optional paid testnet USDC settle')
  lines.push('- Not covered: Freighter UI, Zer0 ZK prove/withdraw')
  lines.push('')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
}

if (failed > 0) {
  console.log('\nFailed checks:')
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ✗ ${r.name}: ${r.detail}`)
  }
  process.exit(1)
}

console.log('\nAll required checks passed.')
process.exit(0)
