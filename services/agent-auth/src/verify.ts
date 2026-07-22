import type { GateConfig, VerifyInput, VerifyResult } from './domain.js'
import { actionMatches, classSatisfies, policyAllowsClass } from './policy.js'
import type { GateRepository } from './repository.js'
import { verifyPop } from './crypto.js'
import { readCapability } from './tokens.js'
import { problem } from './challenges.js'

export async function verifyCapability(
  config: GateConfig,
  repo: GateRepository,
  input: VerifyInput,
): Promise<VerifyResult> {
  const site = await repo.findSiteBySecret(input.siteSecret)
  if (!site) {
    return {
      ok: false,
      status: 401,
      problem: problem(401, 'invalid_secret', 'Site secret is not recognized'),
    }
  }

  let claims
  try {
    claims = await readCapability(config, input.capability)
  } catch {
    return {
      ok: false,
      status: 401,
      problem: problem(401, 'invalid_capability', 'Capability token is invalid or expired'),
    }
  }

  if (claims.site_id !== site.siteId || claims.aud !== site.siteId) {
    return {
      ok: false,
      status: 401,
      problem: problem(401, 'audience_mismatch', 'Capability was not issued for this site'),
    }
  }

  const jtiRec = await repo.getJti(claims.jti)
  if (!jtiRec || jtiRec.remaining <= 0 || jtiRec.expMs <= Date.now()) {
    return {
      ok: false,
      status: 401,
      problem: problem(
        401,
        'capability_replay_or_unknown',
        'Capability jti is unknown, exhausted, or expired',
      ),
    }
  }

  if (!actionMatches(claims, input.action)) {
    return {
      ok: false,
      status: 401,
      problem: problem(
        401,
        'action_mismatch',
        `Capability was issued for ${claims.act}, not ${input.action}`,
      ),
    }
  }

  if (claims.class === 'human') {
    if (!claims.origin) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'origin_required', 'Human capability is missing origin claim'),
      }
    }
    if (input.expectedOrigin && claims.origin !== input.expectedOrigin) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'origin_mismatch', 'Capability origin does not match expected origin'),
      }
    }
    if (!site.allowedOrigins.includes(claims.origin)) {
      return {
        ok: false,
        status: 403,
        problem: problem(403, 'origin_not_allowed', 'Capability origin is not allowlisted'),
      }
    }
  }

  if (!classSatisfies(claims.class, input.minClass)) {
    return {
      ok: false,
      status: 403,
      problem: problem(
        403,
        'class_mismatch',
        `Capability class ${claims.class} does not satisfy minClass ${input.minClass}`,
      ),
    }
  }

  const policy = await repo.getPolicy(site.siteId, input.action)
  if (policy && !policyAllowsClass(policy, claims.class)) {
    return {
      ok: false,
      status: 403,
      problem: problem(
        403,
        `policy_${policy.mode}`,
        `Policy ${policy.mode} rejects class ${claims.class} for action ${input.action}`,
      ),
    }
  }

  const isSessionBoundHuman =
    claims.class === 'human' &&
    (claims.amr?.includes('session_pop') || claims.amr?.includes('webauthn'))
  const needsPop =
    (config.requirePop && claims.class === 'agent') ||
    (Boolean(input.requireHumanPop) && isSessionBoundHuman)

  if (needsPop) {
    if (!input.pop?.signature || !input.pop.htm || !input.pop.htu || !input.pop.iat) {
      return {
        ok: false,
        status: 401,
        problem: problem(
          401,
          'pop_required',
          claims.class === 'agent'
            ? 'Agent capability requires X-Zexvro-Pop proof (htm, htu, iat, signature)'
            : 'Human session capability requires presentation Pop (session key) when requireHumanPop is set',
        ),
      }
    }

    // Edge-supplied request binding (recommended). Without these, PoP only proves key for jti.
    if (input.expectedHtm && input.pop.htm.toUpperCase() !== input.expectedHtm.toUpperCase()) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'pop_htm_mismatch', 'PoP htm does not match protected request method'),
      }
    }
    if (input.expectedHtu && input.pop.htu !== input.expectedHtu) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'pop_htu_mismatch', 'PoP htu does not match protected request URL'),
      }
    }
    if (input.expectedBodyHash !== undefined) {
      const got = input.pop.bodyHash || '-'
      if (got !== input.expectedBodyHash) {
        return {
          ok: false,
          status: 401,
          problem: problem(
            401,
            'pop_body_hash_mismatch',
            'PoP bodyHash does not match protected request body',
          ),
        }
      }
    }

    const pub =
      claims.cnf?.k ||
      (claims.class === 'agent'
        ? claims.stellar_pk ||
          (claims.sub.startsWith('agent:') ? claims.sub.slice('agent:'.length) : '')
        : '')
    if (!pub) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'cnf_missing', 'Capability missing cnf key material for PoP'),
      }
    }
    const okPop = verifyPop({
      publicKey: pub,
      jti: claims.jti,
      htm: input.pop.htm,
      htu: input.pop.htu,
      iat: input.pop.iat,
      bodyHash: input.pop.bodyHash || '-',
      signature: input.pop.signature,
      allowDevHmac: config.allowDevHmac,
    })
    if (!okPop) {
      return {
        ok: false,
        status: 401,
        problem: problem(401, 'pop_invalid', 'PoP signature invalid or expired'),
      }
    }
  }

  if (!(await repo.consumeJti(claims.jti))) {
    return {
      ok: false,
      status: 401,
      problem: problem(401, 'capability_exhausted', 'Capability use budget exhausted'),
    }
  }

  return { ok: true, claims }
}
