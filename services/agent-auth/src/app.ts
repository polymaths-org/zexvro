import express from 'express'
import { z } from 'zod'
import type { GateConfig } from './domain.js'
import { CAPABILITY_HEADER } from './domain.js'
import { completeChallenge, issueChallenge, problem, resolveSiteByKey } from './challenges.js'
import { randomId } from './crypto.js'
import type { GateRepository } from './repository.js'
import { verifyCapability } from './verify.js'
import { createAdminAuthMiddleware } from './adminAuth.js'
import {
  buildRegistrationOptions,
  issueWebAuthnAuthOptionsForChallenge,
  randomWebAuthnUserId,
  verifyWebAuthnRegistration,
} from './webauthn.js'
import {
  answerCaptchaForChallenge,
  issueCaptchaForChallenge,
  loadCaptchaAsset,
} from './captcha/service.js'
import { CAPTCHA_TYPES } from './captcha/types.js'
import { CAPTCHA_DEMO_HTML } from './captcha/demoPage.js'
import { MERCHANT_DEMO_HTML } from './captcha/merchantDemoPage.js'
import { CURATE_HTML } from './captcha/curatePage.js'
import {
  CURATE_LABELS,
  listCandidates,
  listLabelStats,
  publishVerifiedToBank,
  resolveCandidate,
  ensureCandidateIndexed,
  saveVerified,
  processPageSelection,
  type CurateLabel,
} from './captcha/curate.js'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { invalidatePhotoBankCache, photoBankStats } from './captcha/assets.js'
import { fileURLToPath } from 'node:url'

export function createGateApp(config: GateConfig, repo: GateRepository) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '64kb' }))

  const adminAuth = createAdminAuthMiddleware({
    requireAuth: config.adminRequireAuth,
    userPoolId: config.cognitoUserPoolId,
    clientId: config.cognitoClientId,
  })

  // Seed demo tenant asynchronously on first requests via ensure; also kick off now
  void repo.ensureDemoTenant()

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'agent-auth', product: 'zexvro-gate' })
  })

  app.get('/status', async (_req, res) => {
    const stores = repo.asMemoryStores()
    res.json({
      status: 'ok',
      service: 'agent-auth',
      product: 'zexvro-gate',
      issuer: config.issuer,
      capabilities: {
        channels: ['human', 'agent'],
        policyModes: ['human_only', 'agent_only', 'either', 'dual_path'],
        proofTypes: ['soft_confirm', 'session_pop', 'nonce_sign', 'webauthn', 'captcha_pass'],
        captchaTypes: [...CAPTCHA_TYPES],
        captchaUi: { mode: 'modal', width: 360, height: 456, imageGrid: '3x3', softGate: false, heroTypes: ['image_select','odd_one_out','pair_match','label_pick','count_objects','binary_pick','majority_select','photo_rotate'], attemptsChip: true },
        captchaPhotoBank: photoBankStats(),
        stellar: { agentRegistry: true, sep10: false, onChainAttestation: false },
        depinBindingClaims: ['pay_mode', 'allowed_payer_pks', 'stellar_pk'],
      },
      securityProfile: {
        allowDevHuman: config.allowDevHuman,
        allowDevHmac: config.allowDevHmac,
        isProd: config.isProd,
        humanSoftConfirmIsSecurity: false,
        humanSessionPopIsPresentationBound: false,
        popEnforcedOnVerify: config.requirePop,
        popHeader: 'x-zexvro-pop',
        requestBoundPopSupported: true,
        note: 'soft_confirm is dev-only; captcha_pass is self-hosted multi-type human friction (not farm-proof / not request-bound); preferredType is server-filtered; session_pop key-bound soft; WebAuthn hard human. Agent requires PoP when requirePop=true. Pass expectedHtm/Htu/bodyHash for request-bound Pop.',
      },
      sites: stores.sites.size,
      agents: stores.agents.size,
      header: CAPABILITY_HEADER,
      stateBackend: config.stateBackend,
      dynamoTable: config.dynamoTable,
      repository: repo.kind,
      adminRequireAuth: config.adminRequireAuth,
    })
  })

  app.post('/v1/challenges', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        action: z.string().min(1).max(128),
        channel: z.enum(['human', 'agent']),
        clientPublicKey: z.string().min(8),
        origin: z.string().url().optional(),
        agentPublicKey: z.string().min(8).optional(),
      })
      .safeParse(req.body)

    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }

    const result = await issueChallenge(config, repo, body.data)
    if ('error' in result) {
      res.status(result.error.status).json(result.error)
      return
    }

    res.status(201).json({
      id: result.challengeId,
      mode: result.channel,
      expires_in: result.expiresIn,
      exp: result.expSeconds,
      nonce: result.nonce,
      protocol: 'zexvro.gate.v1',
      endpoints: {
        complete: `${config.issuer}/v1/challenges/${result.challengeId}/complete`,
      },
      tasks:
        result.channel === 'agent'
          ? [{ type: 'nonce_sign', nonce: result.nonce, alg: 'ed25519' }]
          : [
              {
                type: 'captcha',
                status: 'available',
                hint: 'Recommended human path: POST .../captcha, solve widget, POST .../captcha/answer, complete with proofType=captcha_pass.',
              },
              {
                type: 'session_pop',
                nonce: result.nonce,
                alg: 'ed25519',
                hint: 'Sign challenge with ephemeral client key (production soft human). soft_confirm is dev-only.',
              },
              {
                type: 'webauthn_get',
                status: 'available',
                hint: 'Hard human path: POST .../webauthn-options then complete with proofType=webauthn. Presentation is still bearer unless requireHumanPop + session key.',
              },
            ],
    })
  })

  app.post('/v1/challenges/:id/complete', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        proof: z.string().min(1),
        proofType: z.enum(['nonce_sign', 'session_pop', 'soft_confirm', 'webauthn', 'captcha_pass']),
      })
      .safeParse(req.body)

    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }

    const result = await completeChallenge(config, repo, {
      challengeId: req.params.id ?? '',
      ...body.data,
    })
    if ('error' in result) {
      res.status(result.error.status).json(result.error)
      return
    }

    res.json({
      capability: result.capability,
      class: result.class,
      expires_in: result.expiresIn,
      scopes: result.scopes,
      header: CAPABILITY_HEADER,
    })
  })

  app.post('/v1/verify', async (req, res) => {
    const body = z
      .object({
        capability: z.string().min(10),
        action: z.string().min(1),
        minClass: z.enum(['human', 'agent', 'either']).default('either'),
        expectedOrigin: z.string().url().optional(),
        siteSecret: z.string().min(8),
        pop: z
          .object({
            signature: z.string().min(1),
            htm: z.string().min(1),
            htu: z.string().min(1),
            iat: z.number().int(),
            bodyHash: z.string().optional(),
          })
          .optional(),
        expectedHtm: z.string().min(1).optional(),
        expectedHtu: z.string().min(1).optional(),
        expectedBodyHash: z.string().min(1).optional(),
        requireHumanPop: z.boolean().optional(),
      })
      .safeParse(req.body)

    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }

    const result = await verifyCapability(config, repo, body.data)
    if (!result.ok) {
      res.status(result.status).json(result.problem)
      return
    }

    res.json({
      ok: true,
      class: result.claims.class,
      action: result.claims.act,
      scopes: result.claims.scopes,
      confidence: result.claims.conf,
      ceremony_strength: result.claims.conf,
      expires_at: new Date(result.claims.exp * 1000).toISOString(),
      challenge_binding: result.claims.cnf,
      stellar_pk: result.claims.stellar_pk,
      pay_mode: result.claims.pay_mode,
      allowed_payer_pks: result.claims.allowed_payer_pks,
    })
  })

  app.post('/v1/admin/agents', adminAuth, async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        publicKey: z.string().min(8),
        name: z.string().min(1).max(120),
        payMode: z.enum(['self', 'sponsored', 'none']).default('self'),
        allowedPayerPublicKeys: z.array(z.string()).optional(),
      })
      .safeParse(req.body)

    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }

    const site = await resolveSiteByKey(repo, body.data.siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }

    const agentId = randomId('agent')
    await repo.putAgent({
      agentId,
      projectId: site.projectId,
      siteId: site.siteId,
      publicKey: body.data.publicKey,
      name: body.data.name,
      createdAt: new Date().toISOString(),
      payMode: body.data.payMode,
      allowedPayerPublicKeys: body.data.allowedPayerPublicKeys ?? [body.data.publicKey],
    })

    res.status(201).json({ agentId, publicKey: body.data.publicKey })
  })

  app.get('/v1/admin/demo-keys', adminAuth, async (_req, res) => {
    await repo.ensureDemoTenant()
    const stores = repo.asMemoryStores()
    const site = [...stores.sites.values()][0]
    if (!site) {
      res.status(404).json(problem(404, 'no_site', 'No site configured'))
      return
    }
    res.json({
      siteId: site.siteId,
      projectId: site.projectId,
      siteKey: site.siteKey,
      secretKey: await repo.getSiteSecret(site.siteId),
      allowedOrigins: site.allowedOrigins,
      note: 'Demo only. Never expose secrets in production admin APIs without auth.',
    })
  })

  app.get('/v1/admin/agents', adminAuth, async (req, res) => {
    const siteKey = typeof req.query.siteKey === 'string' ? req.query.siteKey : ''
    if (siteKey.length < 8) {
      res.status(400).json(problem(400, 'invalid_body', 'siteKey query required'))
      return
    }
    const site = await resolveSiteByKey(repo, siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }
    const agents = await repo.listAgents(site.siteId)
    res.json({
      siteId: site.siteId,
      agents: agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        publicKey: a.publicKey,
        payMode: a.payMode,
        allowedPayerPublicKeys: a.allowedPayerPublicKeys,
        createdAt: a.createdAt,
      })),
    })
  })


  // --- WebAuthn registration (hard human credentials) ---
  app.post('/v1/webauthn/register/options', adminAuth, async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        origin: z.string().url(),
        userName: z.string().min(1).max(120).default('gate-user'),
        userId: z.string().min(4).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const site = await resolveSiteByKey(repo, body.data.siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }
    if (!site.allowedOrigins.includes(body.data.origin)) {
      res.status(403).json(problem(403, 'origin_not_allowed', 'Origin not allowlisted'))
      return
    }
    const userId = body.data.userId ?? randomWebAuthnUserId()
    const options = await buildRegistrationOptions({
      site,
      userId,
      userName: body.data.userName,
      origin: body.data.origin,
    })
    res.json({ userId, options })
  })

  app.post('/v1/webauthn/register/verify', adminAuth, async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        origin: z.string().url(),
        userId: z.string().min(4),
        expectedChallenge: z.string().min(8),
        response: z.record(z.string(), z.unknown()),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const site = await resolveSiteByKey(repo, body.data.siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }
    const verified = await verifyWebAuthnRegistration({
      site,
      expectedChallenge: body.data.expectedChallenge,
      expectedOrigin: body.data.origin,
      response: body.data.response as never,
    })
    if (!verified.ok) {
      res.status(401).json(problem(401, 'webauthn_registration_failed', verified.reason))
      return
    }
    await repo.putWebAuthnCredential({
      ...verified.credential,
      siteId: site.siteId,
      userId: body.data.userId,
      createdAt: new Date().toISOString(),
    })
    res.status(201).json({
      ok: true,
      credentialId: verified.credential.credentialId,
      userId: body.data.userId,
    })
  })

  app.post('/v1/challenges/:id/webauthn-options', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        userId: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const site = await resolveSiteByKey(repo, body.data.siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }
    const challenge = await repo.getChallenge(req.params.id ?? '')
    if (!challenge || challenge.siteId !== site.siteId) {
      res.status(404).json(problem(404, 'challenge_not_found', 'Challenge not found'))
      return
    }
    if (challenge.channel !== 'human') {
      res.status(400).json(problem(400, 'channel_mismatch', 'WebAuthn options only for human challenges'))
      return
    }
    const options = await issueWebAuthnAuthOptionsForChallenge({
      repo,
      site,
      challenge,
      userId: body.data.userId,
    })
    res.json({ options, protocol: 'webauthn' })
  })


  // --- Self-hosted multi-type CAPTCHA (human channel) ---
  app.post('/v1/challenges/:id/captcha', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        preferredType: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const result = await issueCaptchaForChallenge(config, repo, {
      challengeId: req.params.id ?? '',
      siteKey: body.data.siteKey,
      preferredType: body.data.preferredType as never,
      // QA/demo only: allow preferredType force for non-prod (e.g. /demo/captcha?type=)
      allowForceType: !config.isProd,
    })
    if ('error' in result) {
      res.status(result.error.status).json(result.error)
      return
    }
    res.status(201).json({
      challengeId: result.challengeId,
      captcha: result.captcha,
      assetBase: result.assetBase,
      completeWith: {
        proofType: 'captcha_pass',
        proof: result.captcha.captchaId,
      },
    })
  })

  app.post('/v1/challenges/:id/captcha/answer', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        value: z.unknown(),
        captchaId: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const result = await answerCaptchaForChallenge(config, repo, {
      challengeId: req.params.id ?? '',
      siteKey: body.data.siteKey,
      value: body.data.value,
      captchaId: body.data.captchaId,
    })
    if ('error' in result) {
      res.status(result.error.status).json(result.error)
      return
    }
    res.json({
      ok: true,
      captchaId: result.captchaId,
      next: 'complete_with_captcha_pass',
      attempts_remaining: result.attempts_remaining,
      max_attempts: result.max_attempts,
    })
  })

  app.get('/v1/challenges/:id/captcha/assets/:assetPath', async (req, res) => {
    const siteKey = typeof req.query.siteKey === 'string' ? req.query.siteKey : undefined
    const result = await loadCaptchaAsset(repo, {
      challengeId: req.params.id ?? '',
      assetPath: req.params.assetPath ?? '',
      siteKey,
    })
    if ('error' in result) {
      res.status(result.error.status).json(result.error)
      return
    }
    res.setHeader('content-type', result.contentType)
    res.setHeader('cache-control', 'no-store')
    res.send(result.body)
  })

  /** Tiny public demo page — sample “user site” protecting a button */

  // --- Local photo curation (human-verified bank) ---
  // Never expose write/publish on production Gate instances.
  const curateEnabled = !config.isProd
  app.get('/demo/curate', (_req, res) => {
    if (!curateEnabled) {
      res.status(404).json(problem(404, 'not_found', 'Not found'))
      return
    }

    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(CURATE_HTML)
  })

  app.get('/demo/curate/api/labels', (_req, res) => {
    res.json({ labels: listLabelStats() })
  })

  app.get('/demo/curate/api/candidates', (req, res) => {
    const label = String(req.query.label || '')
    if (!(CURATE_LABELS as readonly string[]).includes(label)) {
      res.status(400).json(problem(400, 'invalid_label', 'Unknown label'))
      return
    }
    const offset = Math.max(0, Number(req.query.offset || 0) || 0)
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 50) || 50))
    try {
      res.json(listCandidates(label as CurateLabel, offset, limit))
    } catch (e) {
      res.status(500).json(problem(500, 'curate_failed', e instanceof Error ? e.message : 'failed'))
    }
  })

  app.get('/demo/curate/asset', (req, res) => {
    const id = String(req.query.id || '')
    const label = typeof req.query.label === 'string' ? req.query.label : undefined
    let path =
      resolveCandidate(id) ||
      (label && (CURATE_LABELS as readonly string[]).includes(label)
        ? ensureCandidateIndexed(id, label as CurateLabel)
        : undefined)
    // Operator batch id map (scripts/curate_batch.py)
    if (!path || !existsSync(path)) {
      try {
        const mapPath = join(process.cwd(), 'captcha-assets', 'batches', '_idmap.json')
        if (existsSync(mapPath)) {
          const map = JSON.parse(readFileSync(mapPath, 'utf8')) as Record<string, string>
          if (map[id] && existsSync(map[id])) path = map[id]
        }
      } catch {
        /* */
      }
    }
    if (!path || !existsSync(path)) {
      res.status(404).json(problem(404, 'asset_not_found', 'Candidate not found — reload page'))
      return
    }
    const ext = extname(path).toLowerCase()
    const type =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    res.setHeader('content-type', type)
    res.setHeader('cache-control', 'private, max-age=300')
    createReadStream(path).pipe(res)
  })

  app.post('/demo/curate/api/save', (req, res) => {
    const body = z
      .object({
        label: z.string(),
        /** Selected images = BAD (to reject). */
        ids: z.array(z.string()).max(200).default([]),
        /** Unselected images on current page = GOOD (to verify). */
        goodIds: z.array(z.string()).max(200).default([]),
        mode: z.enum(['select_bad', 'select_good']).default('select_good'),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    if (!(CURATE_LABELS as readonly string[]).includes(body.data.label)) {
      res.status(400).json(problem(400, 'invalid_label', 'Unknown label'))
      return
    }
    try {
      const label = body.data.label as CurateLabel
      if (body.data.mode === 'select_bad') {
        const result = processPageSelection(label, body.data.ids, body.data.goodIds)
        res.json({ ok: true, mode: 'select_bad', ...result })
      } else {
        const result = saveVerified(label, body.data.ids)
        res.json({ ok: true, mode: 'select_good', ...result })
      }
    } catch (e) {
      res.status(500).json(problem(500, 'save_failed', e instanceof Error ? e.message : 'failed'))
    }
  })

  app.post('/demo/curate/api/publish', (_req, res) => {
    if (!curateEnabled) { res.status(404).json(problem(404, 'not_found', 'Not found')); return }
    try {
      const result = publishVerifiedToBank(6)
      invalidatePhotoBankCache()
      res.json({ ok: true, ...result })
    } catch (e) {
      res
        .status(500)
        .json(problem(500, 'publish_failed', e instanceof Error ? e.message : 'failed'))
    }
  })

  app.get('/demo/captcha', (_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.send(CAPTCHA_DEMO_HTML)
  })


  // --- Sample merchant site: dual-channel (human captcha vs agent crypto) ---
  app.get('/demo/site', (_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(MERCHANT_DEMO_HTML)
  })

  app.get('/demo/site/sdk/captcha.js', (_req, res) => {
    // Serve monorepo SDK captcha module for the static demo page (local only)
    const candidates = [
      join(process.cwd(), '../../packages/agent-auth-sdk/src/captcha.js'),
      join(process.cwd(), '../packages/agent-auth-sdk/src/captcha.js'),
      join(process.cwd(), 'packages/agent-auth-sdk/src/captcha.js'),
      join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/agent-auth-sdk/src/captcha.js'),
    ]
    const path = candidates.find((p) => existsSync(p))
    if (!path) {
      res.status(404).type('text/plain').send('captcha sdk not found')
      return
    }
    res.setHeader('content-type', 'text/javascript; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(readFileSync(path, 'utf8'))
  })

  app.get('/demo/site/api/public', (_req, res) => {
    res.json({ ok: true, open: true, message: 'No Gate required' })
  })

  app.post('/demo/site/api/checkout', async (req, res) => {
    // Merchant edge: require human capability (as if developer wired Gate on checkout)
    const capability =
      (typeof req.header(CAPABILITY_HEADER) === 'string' && req.header(CAPABILITY_HEADER)) ||
      (typeof req.header('x-zexvro-capability') === 'string' && req.header('x-zexvro-capability')) ||
      ''
    const site = await repo.getSiteByKey('zk_test_demo_public')
    const secret = site?.secretPlainDevOnly
    if (!secret) {
      res.status(500).json(problem(500, 'demo_misconfigured', 'Demo site secret unavailable'))
      return
    }
    const result = await verifyCapability(config, repo, {
      capability: String(capability),
      action: 'checkout.submit',
      minClass: 'human',
      siteSecret: secret,
      expectedOrigin: req.header('origin') || undefined,
    })
    if (!result.ok) {
      res.status(result.status).json(result.problem)
      return
    }
    res.json({
      ok: true,
      channel: 'human',
      class: result.ok ? result.claims.class : undefined,
      orderId: randomId('ord'),
      message: 'Checkout accepted for human principal',
    })
  })

  app.get('/demo/site/api/search', async (req, res) => {
    // Merchant edge: agent path — capability + request-bound PoP
    const capability =
      (typeof req.header(CAPABILITY_HEADER) === 'string' && req.header(CAPABILITY_HEADER)) ||
      (typeof req.header('x-zexvro-capability') === 'string' && req.header('x-zexvro-capability')) ||
      ''
    const popRaw = req.header('x-zexvro-pop') || ''
    let pop: unknown
    if (popRaw) {
      try {
        pop = JSON.parse(popRaw)
      } catch {
        pop = popRaw
      }
    }
    const site = await repo.getSiteByKey('zk_test_demo_public')
    const secret = site?.secretPlainDevOnly
    if (!secret) {
      res.status(500).json(problem(500, 'demo_misconfigured', 'Demo site secret unavailable'))
      return
    }
    const htu = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`
    // Prefer absolute URL agent used; accept configured issuer host variants via expectedHtu from agent
    const result = await verifyCapability(config, repo, {
      capability: String(capability),
      action: 'search.query',
      minClass: 'agent',
      siteSecret: secret,
      pop: pop as never,
      expectedHtm: 'GET',
      expectedHtu: req.header('x-zexvro-expected-htu') || htu,
    })
    if (!result.ok) {
      res.status(result.status).json(result.problem)
      return
    }
    res.json({
      ok: true,
      channel: 'agent',
      class: result.ok ? result.claims.class : undefined,
      results: [
        { id: 'sku_1', title: 'Nebula Widget', score: 0.98 },
        { id: 'sku_2', title: 'Orbit Cable', score: 0.91 },
      ],
      message: 'Search allowed for registered agent with PoP',
    })
  })



  /** Human captcha feedback (broken image / wrong challenge / accessibility). No auth required for siteKey demos. */
  app.post('/v1/captcha/report', async (req, res) => {
    const body = z
      .object({
        siteKey: z.string().min(8),
        challengeId: z.string().optional(),
        captchaId: z.string().optional(),
        reason: z.enum([
          'broken_image',
          'wrong_answer',
          'unclear',
          'accessibility',
          'offensive',
          'other',
        ]),
        note: z.string().max(500).optional(),
        captchaType: z.string().max(64).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      res.status(400).json(problem(400, 'invalid_body', body.error.message))
      return
    }
    const site = await resolveSiteByKey(repo, body.data.siteKey)
    if (!site) {
      res.status(401).json(problem(401, 'invalid_site_key', 'Site key is not recognized'))
      return
    }
    // Intentionally no PII storage beyond optional free-text note; durable store later.
    console.info(
      JSON.stringify({
        event: 'captcha_report',
        siteId: site.siteId,
        reason: body.data.reason,
        challengeId: body.data.challengeId,
        captchaId: body.data.captchaId,
        captchaType: body.data.captchaType,
        noteLen: body.data.note?.length ?? 0,
        at: new Date().toISOString(),
      }),
    )
    res.status(202).json({
      ok: true,
      received: true,
      message: 'Thanks — we will review this challenge.',
    })
  })

  return app
}
