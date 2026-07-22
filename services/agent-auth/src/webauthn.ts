/**
 * WebAuthn hard-human ceremony for ZEXVRO Gate (M3).
 * Uses @simplewebauthn/server for options + verification.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import type { ChallengeRecord, SiteRecord, WebAuthnCredential } from './domain.js'
import type { GateRepository } from './repository.js'
import { randomBytes } from 'node:crypto'

function originToRpId(origin: string): string {
  try {
    return new URL(origin).hostname
  } catch {
    return 'localhost'
  }
}

export function randomWebAuthnUserId(): string {
  return randomBytes(16).toString('base64url')
}

export async function buildRegistrationOptions(input: {
  site: SiteRecord
  userId: string
  userName: string
  origin: string
  rpName?: string
}) {
  const rpID = originToRpId(input.origin)
  return generateRegistrationOptions({
    rpName: input.rpName ?? 'ZEXVRO Gate',
    rpID,
    userName: input.userName,
    userID: Buffer.from(input.userId),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
}

export async function buildAuthenticationOptions(input: {
  site: SiteRecord
  challenge: ChallengeRecord
  credentials: WebAuthnCredential[]
  origin?: string
}) {
  const origin = input.origin ?? input.challenge.origin ?? input.site.allowedOrigins[0] ?? 'http://localhost:5173'
  const rpID = originToRpId(origin)
  return generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: input.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[] | undefined,
    })),
    // Use challenge nonce so complete path can re-bind
    challenge: input.challenge.nonce,
  })
}

/** @deprecated name kept for older tests */
export function buildWebAuthnGetOptions(input: {
  site: SiteRecord
  challenge: ChallengeRecord
  rpId?: string
}) {
  const origin = input.challenge.origin ?? input.site.allowedOrigins[0] ?? 'http://localhost:5173'
  const rpId = input.rpId ?? originToRpId(origin)
  return {
    challenge: input.challenge.nonce,
    timeout: 60_000,
    rpId,
    allowCredentials: [] as Array<{ type: 'public-key'; id: string }>,
    userVerification: 'preferred' as const,
  }
}

export async function verifyWebAuthnRegistration(input: {
  site: SiteRecord
  expectedChallenge: string
  expectedOrigin: string
  response: RegistrationResponseJSON
}): Promise<
  | { ok: true; credential: Omit<WebAuthnCredential, 'siteId' | 'userId' | 'createdAt'> }
  | { ok: false; reason: string }
> {
  try {
    const rpID = originToRpId(input.expectedOrigin)
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })
    if (!verification.verified || !verification.registrationInfo) {
      return { ok: false, reason: 'webauthn_registration_failed' }
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    void credentialDeviceType
    void credentialBackedUp
    return {
      ok: true,
      credential: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports as string[] | undefined,
      },
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'webauthn_registration_error',
    }
  }
}

export async function verifyWebAuthnAssertion(input: {
  site: SiteRecord
  challenge: ChallengeRecord
  credential: WebAuthnCredential
  response: AuthenticationResponseJSON
  expectedOrigin?: string
}): Promise<{ ok: true; newCounter: number } | { ok: false; reason: string }> {
  try {
    const origin =
      input.expectedOrigin ??
      input.challenge.origin ??
      input.site.allowedOrigins[0] ??
      'http://localhost:5173'
    const rpID = input.challenge.webauthnRpId ?? originToRpId(origin)
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: input.challenge.webauthnChallenge ?? input.challenge.nonce,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: input.credential.credentialId,
        publicKey: Buffer.from(input.credential.publicKey, 'base64url'),
        counter: input.credential.counter,
        transports: input.credential.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: false,
    })
    if (!verification.verified || !verification.authenticationInfo) {
      return { ok: false, reason: 'webauthn_authentication_failed' }
    }
    return {
      ok: true,
      newCounter: verification.authenticationInfo.newCounter,
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'webauthn_authentication_error',
    }
  }
}

export async function issueWebAuthnAuthOptionsForChallenge(input: {
  repo: GateRepository
  site: SiteRecord
  challenge: ChallengeRecord
  userId?: string
}) {
  const credentials = await input.repo.listWebAuthnCredentials(
    input.site.siteId,
    input.userId,
  )
  const options = await buildAuthenticationOptions({
    site: input.site,
    challenge: input.challenge,
    credentials,
    origin: input.challenge.origin,
  })
  // persist challenge fields for verify
  input.challenge.webauthnChallenge = options.challenge
  input.challenge.webauthnRpId = originToRpId(
    input.challenge.origin ?? input.site.allowedOrigins[0] ?? 'http://localhost:5173',
  )
  await input.repo.saveChallenge(input.challenge)
  return options
}
