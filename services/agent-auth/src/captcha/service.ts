/**
 * Glue: issue/verify captcha bound to a Gate challenge.
 * Security: re-issue budgets, siteKey required for assets, preferredType allowlist.
 */

import type { GateConfig } from '../domain.js'
import type { GateRepository } from '../repository.js'
import { problem } from '../challenges.js'
import type { ProblemBody } from '../domain.js'
import {
  CLIENT_FORCEABLE_TYPES,
  getCaptchaAsset,
  getCaptchaPublic,
  issueCaptcha,
  verifyCaptchaAnswer,
} from './engine.js'
import type { CaptchaPublicPayload, CaptchaType } from './types.js'
import { CAPTCHA_TYPES } from './types.js'

/** Max captcha puzzles per challenge (stops attempt-reset via re-issue). */
const MAX_CAPTCHA_ISSUES_PER_CHALLENGE = 3
/** Max wrong answers across all issues on one challenge. */
const MAX_CAPTCHA_FAILS_PER_CHALLENGE = 8

export async function issueCaptchaForChallenge(
  config: GateConfig,
  repo: GateRepository,
  input: {
    challengeId: string
    siteKey: string
    preferredType?: CaptchaType
    types?: CaptchaType[]
    /** Dev/demo only: allow forcing any CAPTCHA_TYPES (QA). Default false in prod. */
    allowForceType?: boolean
  },
): Promise<
  | { captcha: CaptchaPublicPayload; challengeId: string; assetBase: string }
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
  if (challenge.channel !== 'human') {
    return {
      error: problem(400, 'channel_mismatch', 'Captcha is only for human challenges'),
    }
  }
  if (challenge.status !== 'pending') {
    return { error: problem(409, 'challenge_not_pending', 'Challenge is no longer pending') }
  }
  if (challenge.expiresAt <= Date.now()) {
    challenge.status = 'expired'
    await repo.saveChallenge(challenge)
    return { error: problem(401, 'challenge_expired', 'Challenge expired') }
  }

  // Re-issue if previous captcha failed/expired/not solved
  if (challenge.captcha?.status === 'solved') {
    return {
      captcha: getCaptchaPublic(challenge.captcha),
      challengeId: challenge.id,
      assetBase: `/v1/challenges/${challenge.id}/captcha/assets`,
    }
  }

  const issues = challenge.captchaIssueCount ?? 0
  if (issues >= MAX_CAPTCHA_ISSUES_PER_CHALLENGE) {
    return {
      error: problem(
        429,
        'captcha_reissue_limit',
        'Too many captcha re-issues for this challenge — start a new challenge',
      ),
    }
  }
  if ((challenge.captchaFailCount ?? 0) >= MAX_CAPTCHA_FAILS_PER_CHALLENGE) {
    return {
      error: problem(
        429,
        'captcha_fail_limit',
        'Too many incorrect captcha answers for this challenge',
      ),
    }
  }

  // preferredType: never let clients force ultra-easy types in production.
  // Demo/QA may pass allowForceType when not isProd.
  const allowForce = Boolean(input.allowForceType) && !config.isProd
  let preferred: CaptchaType | undefined
  if (input.preferredType && (CAPTCHA_TYPES as readonly string[]).includes(input.preferredType)) {
    if (allowForce || (CLIENT_FORCEABLE_TYPES as readonly string[]).includes(input.preferredType)) {
      preferred = input.preferredType
    }
    // else: ignore client preference (server weighted mix)
  }

  const captcha = issueCaptcha({ preferredType: preferred, types: input.types })
  challenge.captcha = captcha
  challenge.captchaIssueCount = issues + 1
  await repo.saveChallenge(challenge)

  return {
    captcha: getCaptchaPublic(captcha),
    challengeId: challenge.id,
    assetBase: `/v1/challenges/${challenge.id}/captcha/assets`,
  }
}

export async function answerCaptchaForChallenge(
  _config: GateConfig,
  repo: GateRepository,
  input: {
    challengeId: string
    siteKey: string
    value: unknown
    captchaId?: string
  },
): Promise<
  | { ok: true; captchaId: string; attempts_remaining: number; max_attempts: number }
  | { error: ProblemBody & { attempts_remaining?: number; max_attempts?: number } }
> {
  const site = await repo.getSiteByKey(input.siteKey)
  if (!site) {
    return { error: problem(401, 'invalid_site_key', 'Site key is not recognized') }
  }
  const challenge = await repo.getChallenge(input.challengeId)
  if (!challenge || challenge.siteId !== site.siteId) {
    return { error: problem(404, 'challenge_not_found', 'Challenge not found') }
  }
  if (challenge.channel !== 'human') {
    return {
      error: problem(400, 'channel_mismatch', 'Captcha is only for human challenges'),
    }
  }
  if (!challenge.captcha) {
    return {
      error: problem(400, 'captcha_not_issued', 'Issue a captcha first via POST .../captcha'),
    }
  }
  if (input.captchaId && input.captchaId !== challenge.captcha.captchaId) {
    return {
      error: problem(409, 'captcha_id_mismatch', 'captchaId does not match the active puzzle'),
    }
  }

  const result = verifyCaptchaAnswer(challenge.captcha, { value: input.value })
  challenge.captcha = result.state
  if (!result.ok) {
    challenge.captchaFailCount = (challenge.captchaFailCount ?? 0) + 1
  }
  await repo.saveChallenge(challenge)

  if (!result.ok) {
    const err = problem(result.status, result.error_code, result.detail) as ReturnType<
      typeof problem
    > & { attempts_remaining?: number; max_attempts?: number }
    if (typeof result.attemptsRemaining === 'number') {
      err.attempts_remaining = result.attemptsRemaining
      err.max_attempts = result.maxAttempts
    }
    return { error: err }
  }
  return {
    ok: true,
    captchaId: result.state.captchaId,
    attempts_remaining: result.attemptsRemaining,
    max_attempts: result.maxAttempts,
  }
}

export async function loadCaptchaAsset(
  repo: GateRepository,
  input: { challengeId: string; assetPath: string; siteKey?: string },
): Promise<{ contentType: string; body: Buffer } | { error: ProblemBody }> {
  // siteKey required — challengeId alone must not authorize asset fetch
  if (!input.siteKey) {
    return { error: problem(401, 'site_key_required', 'siteKey query param is required for captcha assets') }
  }
  const challenge = await repo.getChallenge(input.challengeId)
  if (!challenge?.captcha) {
    return { error: problem(404, 'captcha_not_found', 'Captcha not found') }
  }
  const site = await repo.getSiteByKey(input.siteKey)
  if (!site || challenge.siteId !== site.siteId) {
    return { error: problem(404, 'captcha_not_found', 'Captcha not found') }
  }
  const path = input.assetPath.replace(/^\/+/, '').split('?')[0] ?? ''
  const asset = getCaptchaAsset(challenge.captcha, path)
  if (!asset) {
    return { error: problem(404, 'asset_not_found', 'Captcha asset not found or expired') }
  }
  return asset
}

export function isCaptchaSolved(challenge: { captcha?: { status: string } | undefined }): boolean {
  return challenge.captcha?.status === 'solved'
}
