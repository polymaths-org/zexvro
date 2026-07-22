import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createGateApp } from './app.js'
import { loadConfig } from './config.js'
import { MemoryRepository } from './repository.js'
import {
  canonicalChallengeMessage,
  canonicalPopMessage,
  generateEd25519KeyPair,
  hmacSign,
  signEd25519,
} from './crypto.js'
import { readCapability } from './tokens.js'

async function setup(env: Record<string, string> = {}) {
  const config = loadConfig({
    AGENT_AUTH_PORT: '4103',
    AGENT_AUTH_ISSUER: 'http://localhost:4103',
    AGENT_AUTH_SIGNING_SECRET: 'test-signing-secret-32b-minimum',
    GATE_ALLOW_DEV_HUMAN: 'true',
    GATE_ALLOW_DEV_HMAC: 'true',
    GATE_REQUIRE_POP: 'true',
    ...env,
  })
  const repo = new MemoryRepository()
  await repo.ensureDemoTenant()
  const app = createGateApp(config, repo)
  return { app, config, repo }
}

async function demoKeys(app: ReturnType<typeof createGateApp>) {
  const keys = await request(app).get('/v1/admin/demo-keys')
  return keys.body as { siteKey: string; secretKey: string; siteId: string }
}

describe('ZEXVRO Gate dual-channel', () => {
  it('status exposes pop enforcement honesty', async () => {
    const { app } = await setup()
    const status = await request(app).get('/status')
    expect(status.body.securityProfile.popEnforcedOnVerify).toBe(true)
    expect(status.body.securityProfile.humanSoftConfirmIsSecurity).toBe(false)
  })

  it('human soft-confirm works in dev; agent-only policy rejects human class', async () => {
    const { app } = await setup()
    const { siteKey, secretKey } = await demoKeys(app)

    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'index.bulk',
        channel: 'human',
        clientPublicKey: 'human-session-key-demo-0001',
        origin: 'http://localhost:5173',
      })
    expect(issued.status).toBe(201)

    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    expect(completed.status).toBe(200)
    expect(completed.body.class).toBe('human')

    const verified = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'index.bulk',
        minClass: 'either',
        siteSecret: secretKey,
        expectedOrigin: 'http://localhost:5173',
      })
    expect(verified.status).toBe(403)
  })

  it('agent Ed25519 + PoP verify; missing PoP fails; class lock holds', async () => {
    const { app, config } = await setup({ GATE_ALLOW_DEV_HMAC: 'false' })
    const { siteKey, secretKey, siteId } = await demoKeys(app)
    const kp = generateEd25519KeyPair()

    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: kp.publicKey, name: 'Ed25519 Agent' })

    const issuedBad = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: kp.publicKey,
        agentPublicKey: kp.publicKey,
      })
    const soft = await request(app)
      .post(`/v1/challenges/${issuedBad.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    expect(soft.status).toBe(403)
    expect(soft.body.error_code).toBe('channel_mismatch')

    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: kp.publicKey,
        agentPublicKey: kp.publicKey,
      })
    expect(issued.status).toBe(201)
    const ch = issued.body
    const message = canonicalChallengeMessage({
      issuer: config.issuer,
      audience: siteId,
      nonce: ch.nonce,
      exp: ch.exp,
      projectId: 'proj_demo',
      action: 'search.query',
      channel: 'agent',
      clientPublicKey: kp.publicKey,
    })
    const proof = signEd25519({ privateKey: kp.privateKey, message })
    expect(proof).toBeTruthy()

    const completed = await request(app)
      .post(`/v1/challenges/${ch.id as string}/complete`)
      .send({ siteKey, proofType: 'nonce_sign', proof })
    expect(completed.status).toBe(200)
    expect(completed.body.class).toBe('agent')

    const noPop = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'agent',
        siteSecret: secretKey,
      })
    expect(noPop.status).toBe(401)
    expect(noPop.body.error_code).toBe('pop_required')

    const claims = await readCapability(config, completed.body.capability)
    const iat = Math.floor(Date.now() / 1000)
    const popMessage = canonicalPopMessage({
      jti: claims.jti,
      htm: 'POST',
      htu: 'https://api.example/v1/search',
      iat,
      bodyHash: '-',
    })
    const popSig = signEd25519({ privateKey: kp.privateKey, message: popMessage })
    expect(popSig).toBeTruthy()

    const ok = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'agent',
        siteSecret: secretKey,
        pop: {
          signature: popSig,
          htm: 'POST',
          htu: 'https://api.example/v1/search',
          iat,
          bodyHash: '-',
        },
      })
    expect(ok.status).toBe(200)
    expect(ok.body.class).toBe('agent')
    expect(ok.body.allowed_payer_pks).toContain(kp.publicKey)

    const humanOnly = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'human',
        siteSecret: secretKey,
        pop: {
          signature: popSig,
          htm: 'POST',
          htu: 'https://api.example/v1/search',
          iat,
          bodyHash: '-',
        },
      })
    // budget may be partially spent; class check may run before or after
    // After first success remaining uses exist for agent maxReuse=5; class_mismatch expected
    expect(humanOnly.status).toBe(403)
    expect(humanOnly.body.error_code).toBe('class_mismatch')
  })

  it('HMAC agent proofs rejected when GATE_ALLOW_DEV_HMAC=false', async () => {
    const { app, config } = await setup({ GATE_ALLOW_DEV_HMAC: 'false' })
    const { siteKey, siteId } = await demoKeys(app)
    const agentPk = 'not-a-real-ed25519-key-material!!'
    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: agentPk, name: 'hmac-agent' })
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: agentPk,
        agentPublicKey: agentPk,
      })
    const message = canonicalChallengeMessage({
      issuer: config.issuer,
      audience: siteId,
      nonce: issued.body.nonce,
      exp: issued.body.exp,
      projectId: 'proj_demo',
      action: 'search.query',
      channel: 'agent',
      clientPublicKey: agentPk,
    })
    const proof = hmacSign(agentPk, message)
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'nonce_sign', proof })
    expect(completed.status).toBe(401)
    expect(completed.body.error_code).toBe('invalid_proof')
  })

  it('rejects evil origin and missing human origin', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const evil = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-evil-origin-key-01',
        origin: 'https://evil.example',
      })
    expect(evil.status).toBe(403)
    const missing = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-no-origin-key01',
      })
    expect(missing.status).toBe(400)
    expect(missing.body.error_code).toBe('origin_required')
  })

  it('action mismatch fails verify', async () => {
    const { app } = await setup()
    const { siteKey, secretKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-session-key-demo-0002',
        origin: 'http://localhost:5173',
      })
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    const verified = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'human',
        siteSecret: secretKey,
      })
    expect(verified.status).toBe(401)
    expect(verified.body.error_code).toBe('action_mismatch')
  })

  it('human capability passes human_only checkout without PoP', async () => {
    const { app } = await setup()
    const { siteKey, secretKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-session-checkout-ok',
        origin: 'http://localhost:5173',
      })
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    const verified = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'checkout.submit',
        minClass: 'human',
        siteSecret: secretKey,
        expectedOrigin: 'http://localhost:5173',
      })
    expect(verified.status).toBe(200)
    expect(verified.body.class).toBe('human')
  })

  it('unregistered agent cannot start agent challenge', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: 'unknown-agent-key-xxxxxxxx',
        agentPublicKey: 'unknown-agent-key-xxxxxxxx',
      })
    expect(issued.status).toBe(403)
    expect(issued.body.error_code).toBe('agent_not_registered')
  })

  it('production profile rejects soft_confirm human mint', async () => {
    // setup() still seeds a memory tenant; demo-keys HTTP is off in production.
    const { app, config } = await setup({
      NODE_ENV: 'production',
      GATE_ALLOW_DEV_HUMAN: 'true',
      GATE_ALLOW_DEV_HMAC: 'true',
      GATE_ADMIN_REQUIRE_AUTH: 'false',
    })
    expect(config.allowDevHuman).toBe(false)
    const siteKey = 'zk_test_demo_public'
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-prod-block',
        origin: 'http://localhost:5173',
      })
    expect(issued.status).toBe(201)
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    expect(completed.status).toBe(403)
    expect(completed.body.error_code).toBe('dev_human_disabled')
  })

  it('jti reuse budget eventually exhausts', async () => {
    const { app } = await setup()
    const { siteKey, secretKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'human-reuse-budget-key',
        origin: 'http://localhost:5173',
      })
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    // Human soft/session path maxReuse=1 (anti-relay blast radius)
    const first = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'checkout.submit',
        minClass: 'human',
        siteSecret: secretKey,
        expectedOrigin: 'http://localhost:5173',
      })
    expect(first.status).toBe(200)
    const second = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'checkout.submit',
        minClass: 'human',
        siteSecret: secretKey,
        expectedOrigin: 'http://localhost:5173',
      })
    expect(second.status).toBe(401)
  })

  it('agent channel requires clientPublicKey === agentPublicKey', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const kp = generateEd25519KeyPair()
    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: kp.publicKey, name: 'bind-agent' })
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: 'attacker-ephemeral-key-material',
        agentPublicKey: kp.publicKey,
      })
    expect(issued.status).toBe(400)
    expect(issued.body.error_code).toBe('agent_key_mismatch')
  })

  it('request-bound PoP rejects htu mismatch', async () => {
    const { app, config } = await setup({ GATE_ALLOW_DEV_HMAC: 'false' })
    const { siteKey, secretKey, siteId } = await demoKeys(app)
    const kp = generateEd25519KeyPair()
    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: kp.publicKey, name: 'htu-agent' })
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: kp.publicKey,
        agentPublicKey: kp.publicKey,
      })
    const message = canonicalChallengeMessage({
      issuer: config.issuer,
      audience: siteId,
      nonce: issued.body.nonce as string,
      exp: issued.body.exp as number,
      projectId: 'proj_demo',
      action: 'search.query',
      channel: 'agent',
      clientPublicKey: kp.publicKey,
    })
    const proof = signEd25519({ privateKey: kp.privateKey, message })
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'nonce_sign', proof })
    const claims = await readCapability(config, completed.body.capability as string)
    const iat = Math.floor(Date.now() / 1000)
    const popMsg = [
      'zexvro-pop/v0.2',
      claims.jti,
      'POST',
      'https://api.example/v1/search',
      String(iat),
      '-',
    ].join('|')
    const popSig = signEd25519({ privateKey: kp.privateKey, message: popMsg })
    const verified = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'agent',
        siteSecret: secretKey,
        expectedHtu: 'https://api.example/v1/other',
        pop: {
          signature: popSig,
          htm: 'POST',
          htu: 'https://api.example/v1/search',
          iat,
          bodyHash: '-',
        },
      })
    expect(verified.status).toBe(401)
    expect(verified.body.error_code).toBe('pop_htu_mismatch')
  })

  it('invalid PoP signature fails without consuming budget for success path', async () => {
    const { app, config } = await setup({ GATE_ALLOW_DEV_HMAC: 'false' })
    const { siteKey, secretKey, siteId } = await demoKeys(app)
    const kp = generateEd25519KeyPair()
    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: kp.publicKey, name: 'pop-agent' })
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: kp.publicKey,
        agentPublicKey: kp.publicKey,
      })
    const message = canonicalChallengeMessage({
      issuer: config.issuer,
      audience: siteId,
      nonce: issued.body.nonce,
      exp: issued.body.exp,
      projectId: 'proj_demo',
      action: 'search.query',
      channel: 'agent',
      clientPublicKey: kp.publicKey,
    })
    const proof = signEd25519({ privateKey: kp.privateKey, message })
    const completed = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'nonce_sign', proof })
    const claims = await readCapability(config, completed.body.capability)
    const iat = Math.floor(Date.now() / 1000)
    const bad = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'agent',
        siteSecret: secretKey,
        pop: {
          signature: 'AAAA',
          htm: 'POST',
          htu: 'https://api.example/v1/search',
          iat,
        },
      })
    expect(bad.status).toBe(401)
    expect(bad.body.error_code).toBe('pop_invalid')

    // valid pop still works (budget not burned by bad pop)
    const popMessage = canonicalPopMessage({
      jti: claims.jti,
      htm: 'GET',
      htu: 'https://api.example/v1/search',
      iat,
      bodyHash: '-',
    })
    const popSig = signEd25519({ privateKey: kp.privateKey, message: popMessage })
    const ok = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'search.query',
        minClass: 'agent',
        siteSecret: secretKey,
        pop: {
          signature: popSig,
          htm: 'GET',
          htu: 'https://api.example/v1/search',
          iat,
          bodyHash: '-',
        },
      })
    expect(ok.status).toBe(200)
  })
})

  it('human session_pop (Ed25519) works when soft_confirm disabled', async () => {
    const { app, config } = await setup({
      GATE_ALLOW_DEV_HUMAN: 'false',
      GATE_ALLOW_DEV_HMAC: 'false',
    })
    expect(config.allowDevHuman).toBe(false)
    const { siteKey, secretKey, siteId } = await demoKeys(app)
    const kp = generateEd25519KeyPair()

    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: kp.publicKey,
        origin: 'http://localhost:5173',
      })
    expect(issued.status).toBe(201)

    const soft = await request(app)
      .post(`/v1/challenges/${issued.body.id as string}/complete`)
      .send({ siteKey, proofType: 'soft_confirm', proof: 'soft-confirm' })
    expect(soft.status).toBe(403)

    const issued2 = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: kp.publicKey,
        origin: 'http://localhost:5173',
      })
    const message = canonicalChallengeMessage({
      issuer: config.issuer,
      audience: siteId,
      nonce: issued2.body.nonce,
      exp: issued2.body.exp,
      projectId: 'proj_demo',
      action: 'checkout.submit',
      channel: 'human',
      clientPublicKey: kp.publicKey,
    })
    const proof = signEd25519({ privateKey: kp.privateKey, message })
    const completed = await request(app)
      .post(`/v1/challenges/${issued2.body.id as string}/complete`)
      .send({ siteKey, proofType: 'session_pop', proof })
    expect(completed.status).toBe(200)
    expect(completed.body.class).toBe('human')

    const verified = await request(app)
      .post('/v1/verify')
      .send({
        capability: completed.body.capability,
        action: 'checkout.submit',
        minClass: 'human',
        siteSecret: secretKey,
        expectedOrigin: 'http://localhost:5173',
      })
    expect(verified.status).toBe(200)
  })

  it('webauthn registration options issue for allowlisted origin', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const res = await request(app)
      .post('/v1/webauthn/register/options')
      .send({
        siteKey,
        origin: 'http://localhost:5173',
        userName: 'tester@zexvro.dev',
      })
    expect(res.status).toBe(200)
    expect(res.body.userId).toBeTruthy()
    expect(res.body.options.challenge).toBeTruthy()
    expect(res.body.options.rp.id).toBe('localhost')
  })

  it('webauthn registration options reject evil origin', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const res = await request(app)
      .post('/v1/webauthn/register/options')
      .send({
        siteKey,
        origin: 'https://evil.example',
        userName: 'attacker',
      })
    expect(res.status).toBe(403)
    expect(res.body.error_code).toBe('origin_not_allowed')
  })

  it('status reports adminRequireAuth false in test defaults', async () => {
    const { app } = await setup()
    const status = await request(app).get('/status')
    expect(status.body.adminRequireAuth).toBe(false)
  })

  it('production config defaults adminRequireAuth true', async () => {
    const { config } = await setup({ NODE_ENV: 'production', GATE_ADMIN_REQUIRE_AUTH: 'true' })
    // setup spreads env into loadConfig - production forces admin auth true
    expect(config.isProd).toBe(true)
    expect(config.adminRequireAuth).toBe(true)
  })

describe('ZEXVRO Gate self-hosted captcha', () => {
  it('human captcha_pass mints human capability; wrong answer fails', async () => {
    const { app, repo } = await setup()
    const { siteKey, secretKey } = await demoKeys(app)

    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'ck_captcha_human_1',
        origin: 'http://localhost:3000',
      })
    expect(issued.status).toBe(201)

    const cap = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha`)
      .send({ siteKey, preferredType: 'text_distorted' })
    expect(cap.status).toBe(201)
    expect(cap.body.captcha.type).toBe('text_distorted')
    expect(cap.body.captcha.ui.assetPath).toBeTruthy()

    // asset serves svg
    const asset = await request(app).get(
      `/v1/challenges/${issued.body.id}/captcha/assets/main?siteKey=${siteKey}`,
    )
    expect(asset.status).toBe(200)
    expect(asset.headers['content-type']).toMatch(/svg/)

    const wrong = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha/answer`)
      .send({ siteKey, value: 'NOPE1' })
    expect(wrong.status).toBe(401)

    // pull secret from repo for test only
    const ch = await repo.getChallenge(issued.body.id as string)
    const text = (ch?.captcha?.secret as { text: string }).text

    const ans = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha/answer`)
      .send({ siteKey, value: text })
    expect(ans.status).toBe(200)

    const early = await request(app)
      .post(`/v1/challenges/${issued.body.id}/complete`)
      .send({ siteKey, proofType: 'captcha_pass', proof: cap.body.captcha.captchaId })
    // should succeed
    expect(early.status).toBe(200)
    expect(early.body.class).toBe('human')

    const verified = await request(app).post('/v1/verify').send({
      capability: early.body.capability,
      action: 'checkout.submit',
      minClass: 'human',
      siteSecret: secretKey,
    })
    expect(verified.status).toBe(200)
    expect(verified.body.class).toBe('human')
  })

  it('agent cannot complete with captcha_pass', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const keys = generateEd25519KeyPair()
    await request(app)
      .post('/v1/admin/agents')
      .send({ siteKey, publicKey: keys.publicKey, name: 'bot' })

    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'search.query',
        channel: 'agent',
        clientPublicKey: keys.publicKey,
        agentPublicKey: keys.publicKey,
      })
    expect(issued.status).toBe(201)

    const complete = await request(app)
      .post(`/v1/challenges/${issued.body.id}/complete`)
      .send({ siteKey, proofType: 'captcha_pass', proof: 'captcha-pass' })
    expect(complete.status).toBe(403)
  })

  it('serves curate labeling page and labels API', async () => {
    const { app } = await setup()
    const page = await request(app).get('/demo/curate')
    expect(page.status).toBe(200)
    expect(page.text).toContain('Curate trusted captcha photos')
    const labels = await request(app).get('/demo/curate/api/labels')
    expect(labels.status).toBe(200)
    expect(labels.body.labels.length).toBeGreaterThan(5)
    expect(labels.body.labels[0]).toHaveProperty('prompt')
  })

  it('serves captcha demo page', async () => {
    const { app } = await setup()
    const page = await request(app).get('/demo/captcha')
    expect(page.status).toBe(200)
    expect(page.text.toLowerCase()).toContain('claim daily reward')
    expect(page.text).toContain('zg-panel')
    expect(page.text).toContain('360px')
    expect(page.text).toContain('minmax(0,1fr)')
    expect(page.text).toContain('captcha_pass')
  })

  it('production does not register demo or curate routes', async () => {
    const { app } = await setup({
      NODE_ENV: 'production',
      AGENT_AUTH_SIGNING_SECRET: 'prod-test-signing-secret-32b',
    })
    expect((await request(app).get('/demo/captcha')).status).toBe(404)
    expect((await request(app).get('/demo/curate')).status).toBe(404)
    expect((await request(app).get('/demo/site')).status).toBe(404)
    expect((await request(app).get('/v1/admin/demo-keys')).status).toBe(404)
  })

  it('accepts captcha report feedback', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const res = await request(app).post('/v1/captcha/report').send({
      siteKey,
      reason: 'broken_image',
      note: 'tile blank in demo',
      captchaType: 'image_select',
    })
    expect(res.status).toBe(202)
    expect(res.body.ok).toBe(true)
  })

  it('image_select issues exact 3x3 tiles with photo assets', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'reward.claim',
        channel: 'human',
        clientPublicKey: 'ck_grid9_test',
        origin: 'http://localhost:3000',
      })
    const cap = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha`)
      .send({ siteKey, preferredType: 'image_select' })
    expect(cap.status).toBe(201)
    // Without a local verified photo bank, engine falls back off image_select.
    if (cap.body.captcha?.type !== 'image_select') return
    expect(cap.body.captcha.ui.tiles).toHaveLength(9)
    expect(cap.body.captcha.ui.columns).toBe(3)
    expect(cap.body.captcha.ui.referenceAssetPath).toBe('reference')
    expect(cap.body.captcha.prompt).not.toMatch(/\(/)
    const tile = cap.body.captcha.ui.tiles[0].assetPath as string
    const asset = await request(app).get(
      `/v1/challenges/${issued.body.id}/captcha/assets/${tile}?siteKey=${siteKey}`,
    )
    expect(asset.status).toBe(200)
    expect(asset.headers['content-type']).toMatch(/image\//)
    const ref = await request(app).get(
      `/v1/challenges/${issued.body.id}/captcha/assets/reference?siteKey=${siteKey}`,
    )
    expect(ref.status).toBe(200)
    expect(ref.headers['content-type']).toMatch(/image\//)
    expect(asset.headers['content-type']).not.toMatch(/svg/)
  })

  it('rejects captcha_pass soft proof token captcha-pass', async () => {
    const { app, repo } = await setup()
    const { siteKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'checkout.submit',
        channel: 'human',
        clientPublicKey: 'ck_captcha_hard_proof',
        origin: 'http://localhost:3000',
      })
    const cap = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha`)
      .send({ siteKey, preferredType: 'text_distorted' })
    const ch = await repo.getChallenge(issued.body.id as string)
    const text = (ch?.captcha?.secret as { text: string }).text
    await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha/answer`)
      .send({ siteKey, value: text })
    const soft = await request(app)
      .post(`/v1/challenges/${issued.body.id}/complete`)
      .send({ siteKey, proofType: 'captcha_pass', proof: 'captcha-pass' })
    expect(soft.status).toBe(401)
    const ok = await request(app)
      .post(`/v1/challenges/${issued.body.id}/complete`)
      .send({ siteKey, proofType: 'captcha_pass', proof: cap.body.captcha.captchaId })
    expect(ok.status).toBe(200)
  })

  it('requires siteKey for captcha assets', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'reward.claim',
        channel: 'human',
        clientPublicKey: 'ck_asset_auth',
        origin: 'http://localhost:3000',
      })
    const cap = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha`)
      .send({ siteKey, preferredType: 'text_distorted' })
    const noKey = await request(app).get(
      `/v1/challenges/${issued.body.id}/captcha/assets/main`,
    )
    expect(noKey.status).toBe(401)
    const withKey = await request(app).get(
      `/v1/challenges/${issued.body.id}/captcha/assets/main?siteKey=${siteKey}`,
    )
    expect(withKey.status).toBe(200)
    expect(cap.body.captcha.type).toBe('text_distorted')
  })

  it('limits captcha re-issues per challenge', async () => {
    const { app } = await setup()
    const { siteKey } = await demoKeys(app)
    const issued = await request(app)
      .post('/v1/challenges')
      .send({
        siteKey,
        action: 'reward.claim',
        channel: 'human',
        clientPublicKey: 'ck_reissue_limit',
        origin: 'http://localhost:3000',
      })
    for (let i = 0; i < 3; i++) {
      const cap = await request(app)
        .post(`/v1/challenges/${issued.body.id}/captcha`)
        .send({ siteKey, preferredType: 'text_distorted' })
      expect(cap.status).toBe(201)
    }
    const blocked = await request(app)
      .post(`/v1/challenges/${issued.body.id}/captcha`)
      .send({ siteKey, preferredType: 'text_distorted' })
    expect(blocked.status).toBe(429)
  })
})
