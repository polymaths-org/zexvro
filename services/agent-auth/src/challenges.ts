import type {
  Channel,
  CompleteChallengeInput,
  GateConfig,
  IssueChallengeInput,
  ProblemBody,
  SiteRecord,
} from './domain.js'
import {
  canonicalChallengeMessage,
  hmacVerify,
  jwkThumbprintEd25519,
  randomId,
  randomNonce,
  secretsEqual,
  verifyEd25519,
} from './crypto.js'
import { defaultPolicy, scopesForClass, ttlForClass } from './policy.js'
import { verifyWebAuthnAssertion } from './webauthn.js'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import type { GateRepository } from './repository.js'
import { mintCapability } from './tokens.js'
import { PROBLEM_TYPE_BASE } from './domain.js'

export async function resolveSiteByKey(
  repo: GateRepository,
  siteKey: string,
): Promise<SiteRecord | undefined> {
  return repo.getSiteByKey(siteKey)
}

export async function issueChallenge(
  config: GateConfig,
  repo: GateRepository,
  input: IssueChallengeInput,
): Promise<
  | { challengeId: string; nonce: string; expiresIn: number; channel: Channel; expSeconds: number }
  | { error: ProblemBody }
> {
  const site = await repo.getSiteByKey(input.siteKey)
  if (!site) {
    return { error: problem(401, 'invalid_site_key', 'Site key is not recognized') }
  }

  if (input.channel === 'human') {
    if (!input.origin) {
      return { error: problem(400, 'origin_required', 'origin is required for human channel') }
    }
    if (!site.allowedOrigins.includes(input.origin)) {
      return {
        error: problem(
          403,
          'origin_not_allowed',
          `Origin ${input.origin} is not allowlisted for this site`,
        ),
      }
    }
  }

  if (input.channel === 'agent') {
    if (!input.agentPublicKey) {
      return {
        error: problem(400, 'agent_key_required', 'agentPublicKey is required for agent channel'),
      }
    }
    // Prevent cnf.k / registry identity split: PoP key must be the registered agent key.
    if (input.clientPublicKey !== input.agentPublicKey) {
      return {
        error: problem(
          400,
          'agent_key_mismatch',
          'For agent channel, clientPublicKey must equal agentPublicKey (PoP binding)',
        ),
      }
    }
    const agent = await repo.getAgentByPublicKey(site.siteId, input.agentPublicKey)
    if (!agent) {
      return {
        error: problem(
          403,
          'agent_not_registered',
          'Agent public key is not registered for this site',
        ),
      }
    }
  }

  if (!input.clientPublicKey || input.clientPublicKey.length < 8) {
    return {
      error: problem(400, 'client_pubkey_required', 'clientPublicKey is required for anti-relay binding'),
    }
  }

  const id = randomId('ch')
  const nonce = randomNonce()
  const expiresAt = Date.now() + config.challengeTtlSeconds * 1000
  const expSeconds = Math.floor(expiresAt / 1000)
  await repo.putChallenge({
    id,
    siteId: site.siteId,
    action: input.action,
    channel: input.channel,
    status: 'pending',
    nonce,
    clientPublicKey: input.clientPublicKey,
    origin: input.origin,
    agentPublicKey: input.agentPublicKey,
    expiresAt,
    expSeconds,
    createdAt: Date.now(),
  })

  return {
    challengeId: id,
    nonce,
    expiresIn: config.challengeTtlSeconds,
    channel: input.channel,
    expSeconds,
  }
}

export async function completeChallenge(
  config: GateConfig,
  repo: GateRepository,
  input: CompleteChallengeInput,
): Promise<
  | { capability: string; class: 'human' | 'agent'; expiresIn: number; scopes: string[] }
  | { error: ProblemBody }
> {
  const site = await repo.getSiteByKey(input.siteKey)
  if (!site) {
    return { error: problem(401, 'invalid_site_key', 'Site key is not recognized') }
  }

  const challenge = await repo.getChallenge(input.challengeId)
  if (!challenge || challenge.siteId !== site.siteId) {
    return { error: problem(404, 'challenge_not_found', 'Challenge not found') }
  }
  if (challenge.status !== 'pending') {
    return { error: problem(409, 'challenge_not_pending', 'Challenge is no longer pending') }
  }
  if (challenge.expiresAt <= Date.now()) {
    challenge.status = 'expired'
    await repo.saveChallenge(challenge)
    return { error: problem(401, 'challenge_expired', 'Challenge expired') }
  }

  const message = canonicalChallengeMessage({
    issuer: config.issuer,
    audience: site.siteId,
    nonce: challenge.nonce,
    exp: challenge.expSeconds,
    projectId: site.projectId,
    action: challenge.action,
    channel: challenge.channel,
    clientPublicKey: challenge.clientPublicKey,
  })

  if (challenge.channel === 'human') {
    if (challenge.agentPublicKey) {
      return {
        error: problem(403, 'channel_mismatch', 'Agent keys cannot complete human challenges'),
      }
    }
    if (input.proofType === 'soft_confirm') {
      if (!config.allowDevHuman) {
        return {
          error: problem(
            403,
            'dev_human_disabled',
            'soft_confirm is dev-only. Use session_pop (Ed25519) or WebAuthn in production.',
          ),
        }
      }
      if (input.proof !== 'soft-confirm') {
        return { error: problem(401, 'invalid_proof', 'Human challenge proof failed') }
      }
    } else if (input.proofType === 'session_pop' || input.proofType === 'nonce_sign') {
      const edOk = verifyEd25519({
        publicKey: challenge.clientPublicKey,
        message,
        signatureBase64: input.proof,
      })
      const hmacOk =
        config.allowDevHmac && hmacVerify(challenge.clientPublicKey, message, input.proof)
      if (!edOk && !hmacOk) {
        return {
          error: problem(
            401,
            'invalid_proof',
            'Human session_pop proof failed (Ed25519 signature over challenge required)',
          ),
        }
      }
    } else if (input.proofType === 'webauthn') {
      let assertion: AuthenticationResponseJSON
      try {
        assertion = JSON.parse(input.proof) as AuthenticationResponseJSON
      } catch {
        return {
          error: problem(400, 'invalid_proof', 'webauthn proof must be JSON assertion response'),
        }
      }
      const credId = assertion.id
      const cred = await repo.getWebAuthnCredential(site.siteId, credId)
      if (!cred) {
        return {
          error: problem(404, 'webauthn_credential_not_found', 'Passkey not registered for this site'),
        }
      }
      const verified = await verifyWebAuthnAssertion({
        site,
        challenge,
        credential: cred,
        response: assertion,
        expectedOrigin: challenge.origin,
      })
      if (!verified.ok) {
        return {
          error: problem(401, 'invalid_proof', verified.reason),
        }
      }
      await repo.updateWebAuthnCounter(site.siteId, cred.credentialId, verified.newCounter)
    } else if (input.proofType === 'captcha_pass') {
      if (challenge.captcha?.status !== 'solved') {
        return {
          error: problem(
            401,
            'captcha_not_solved',
            'Solve the captcha first (POST .../captcha then .../captcha/answer)',
          ),
        }
      }
      // Require exact captchaId — no soft token "captcha-pass" free complete.
      if (!input.proof || input.proof !== challenge.captcha.captchaId) {
        return {
          error: problem(401, 'invalid_proof', 'captcha_pass proof must equal the solved captchaId'),
        }
      }
    } else {
      return { error: problem(400, 'invalid_proof_type', 'Unsupported human proofType') }
    }
  } else {
    if (
      input.proofType === 'soft_confirm' ||
      input.proofType === 'webauthn' ||
      input.proofType === 'session_pop' ||
      input.proofType === 'captcha_pass'
    ) {
      return {
        error: problem(
          403,
          'channel_mismatch',
          'Human proofs cannot complete agent challenges',
        ),
      }
    }
    const agentKey = challenge.agentPublicKey ?? ''
    const edOk = verifyEd25519({
      publicKey: agentKey,
      message,
      signatureBase64: input.proof,
    })
    const hmacOk = config.allowDevHmac && hmacVerify(agentKey, message, input.proof)
    if (!edOk && !hmacOk) {
      return {
        error: problem(
          401,
          'invalid_proof',
          config.allowDevHmac
            ? 'Agent challenge proof failed'
            : 'Agent challenge proof failed (Ed25519 required; dev HMAC disabled)',
        ),
      }
    }
    if (!secretsEqual(agentKey, challenge.agentPublicKey ?? '')) {
      return { error: problem(403, 'key_mismatch', 'Proof key does not match challenge binding') }
    }
  }

  const principalClass = challenge.channel
  const policy =
    (await repo.getPolicy(site.siteId, challenge.action)) ?? defaultPolicy(challenge.action)
  const scopes = scopesForClass(policy, principalClass)
  const ttl = ttlForClass(policy, principalClass, config.defaultTtlSeconds)

  const agent = challenge.agentPublicKey
    ? await repo.getAgentByPublicKey(site.siteId, challenge.agentPublicKey)
    : undefined

  const captchaType = challenge.captcha?.type
  const amr =
    input.proofType === 'soft_confirm'
      ? ['dev_soft_confirm']
      : input.proofType === 'webauthn'
        ? ['webauthn']
        : input.proofType === 'captcha_pass'
          ? captchaType
            ? ['captcha', captchaType]
            : ['captcha']
          : input.proofType === 'session_pop' ||
              (input.proofType === 'nonce_sign' && challenge.channel === 'human')
            ? ['session_pop']
            : [input.proofType]

  // Honest ceremony strength — not ML detection. Never claim perfect conf.
  // Captcha stops casual bots; not a farm-stopper (score mid-range).
  const conf =
    input.proofType === 'soft_confirm'
      ? 0
      : input.proofType === 'session_pop' ||
          (input.proofType === 'nonce_sign' && challenge.channel === 'human')
        ? 0.35
        : input.proofType === 'captcha_pass'
          ? 0.55
          : input.proofType === 'webauthn'
            ? 0.8
            : 0.9

  // Human capabilities are presentation-transferable unless edge enforces Pop.
  // Default human maxReuse=1 to limit post-mint relay blast radius.
  const maxReuse =
    principalClass === 'agent'
      ? (policy.agent?.maxReuse ?? 5)
      : input.proofType === 'webauthn'
        ? 3
        : 1

  // CAS: one successful ceremony → one mint attempt (no double-complete race)
  const claimed = await repo.completeChallengeIfPending(challenge.id)
  if (!claimed) {
    return {
      error: problem(
        409,
        'challenge_not_pending',
        'Challenge is no longer pending (already completed, expired, or concurrent complete)',
      ),
    }
  }

  const { token, claims } = await mintCapability(config, repo, {
    aud: site.siteId,
    sub:
      principalClass === 'agent'
        ? `agent:${challenge.agentPublicKey ?? 'unknown'}`
        : `human:${challenge.clientPublicKey}`,
    class: principalClass,
    act: challenge.action,
    chn: challenge.channel,
    conf,
    amr,
    project_id: site.projectId,
    site_id: site.siteId,
    scopes,
    origin: challenge.origin,
    stellar_pk: challenge.agentPublicKey,
    pay_mode: agent?.payMode ?? (principalClass === 'agent' ? 'self' : 'none'),
    allowed_payer_pks:
      agent?.allowedPayerPublicKeys ??
      (challenge.agentPublicKey ? [challenge.agentPublicKey] : []),
    cnf: {
      k: challenge.clientPublicKey,
      jkt: (() => {
        try {
          return jwkThumbprintEd25519(challenge.clientPublicKey)
        } catch {
          return undefined
        }
      })(),
    },
    ttlSeconds: ttl,
    maxReuse,
  })

  return {
    capability: token,
    class: principalClass,
    expiresIn: claims.exp - claims.iat,
    scopes,
  }
}

export function problem(status: number, error_code: string, detail: string): ProblemBody {
  return {
    type: `${PROBLEM_TYPE_BASE}/${error_code.replaceAll('_', '-')}`,
    title: error_code,
    status,
    detail,
    error_code,
  }
}
