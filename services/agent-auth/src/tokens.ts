import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { CapabilityClaims, GateConfig } from './domain.js'
import type { GateRepository } from './repository.js'
import { randomId } from './crypto.js'

function secretKey(config: GateConfig): Uint8Array {
  return new TextEncoder().encode(config.signingSecret)
}

export async function mintCapability(
  config: GateConfig,
  repo: GateRepository,
  claims: Omit<CapabilityClaims, 'iss' | 'iat' | 'nbf' | 'exp' | 'jti'> & {
    ttlSeconds?: number
    maxReuse?: number
  },
): Promise<{ token: string; claims: CapabilityClaims }> {
  const now = Math.floor(Date.now() / 1000)
  const ttl = claims.ttlSeconds ?? config.defaultTtlSeconds
  const jti = randomId('jti')
  const full: CapabilityClaims = {
    iss: config.issuer,
    aud: claims.aud,
    sub: claims.sub,
    class: claims.class,
    act: claims.act,
    chn: claims.chn,
    jti,
    iat: now,
    nbf: now,
    exp: now + ttl,
    conf: claims.conf,
    amr: claims.amr,
    project_id: claims.project_id,
    site_id: claims.site_id,
    scopes: claims.scopes,
    origin: claims.origin,
    stellar_pk: claims.stellar_pk,
    pay_mode: claims.pay_mode,
    allowed_payer_pks: claims.allowed_payer_pks,
    cnf: claims.cnf,
  }

  const token = await new SignJWT({ ...full } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(full.iss)
    .setAudience(full.aud)
    .setSubject(full.sub)
    .setJti(full.jti)
    .setIssuedAt(full.iat)
    .setNotBefore(full.nbf)
    .setExpirationTime(full.exp)
    .sign(secretKey(config))

  const maxReuse = claims.maxReuse ?? 20
  await repo.registerJti(jti, full.exp * 1000, maxReuse)
  return { token, claims: full }
}

export async function readCapability(
  config: GateConfig,
  token: string,
): Promise<CapabilityClaims> {
  const { payload } = await jwtVerify(token, secretKey(config), {
    issuer: config.issuer,
  })
  return payload as unknown as CapabilityClaims
}
