/**
 * Shared claim / header constants for ZEXVRO Gate (Agent Auth).
 * De-pin and origin servers should import these rather than hardcoding strings.
 */

/** @typedef {'human' | 'agent' | 'unknown'} PrincipalClass */
/** @typedef {'human_only' | 'agent_only' | 'either' | 'dual_path'} PolicyMode */
/** @typedef {'self' | 'sponsored' | 'none'} PayMode */

export const CAPABILITY_HEADER = 'x-zexvro-capability'
export const SITE_KEY_HEADER = 'x-zexvro-site-key'
export const ACTION_HEADER = 'x-zexvro-action'
export const PROBLEM_TYPE_BASE = 'https://zexvro.dev/problems/gate'

/**
 * @typedef {object} CapabilityClaims
 * @property {string} iss
 * @property {string} aud
 * @property {string} sub
 * @property {'human'|'agent'} class
 * @property {string} act
 * @property {'human'|'agent'} chn
 * @property {string} jti
 * @property {number} iat
 * @property {number} nbf
 * @property {number} exp
 * @property {number} conf
 * @property {string[]} amr
 * @property {string} project_id
 * @property {string} site_id
 * @property {string[]} scopes
 * @property {string} [origin]
 * @property {string} [stellar_pk]
 * @property {PayMode} [pay_mode]
 * @property {string[]} [allowed_payer_pks]
 */

/**
 * Minimal runtime check for required capability claim keys.
 * @param {Record<string, unknown>} claims
 */
export function hasRequiredCapabilityClaims(claims) {
  const required = ['iss', 'aud', 'sub', 'class', 'act', 'chn', 'jti', 'exp', 'site_id']
  return required.every((k) => claims && claims[k] !== undefined && claims[k] !== null)
}
