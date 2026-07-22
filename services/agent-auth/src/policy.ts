import type { ActionPolicy, CapabilityClaims, PrincipalClass } from './domain.js'
import type { GateStores } from './stores.js'
import { policyKey } from './stores.js'

export function getPolicy(
  stores: GateStores,
  siteId: string,
  action: string,
): ActionPolicy | undefined {
  return stores.policies.get(policyKey(siteId, action))
}

export function defaultPolicy(action: string): ActionPolicy {
  return {
    action,
    mode: 'either',
    human: { allowSilent: true, ttlSeconds: 300, scopes: [action] },
    agent: { requireRegisteredKey: true, ttlSeconds: 120, scopes: [action], maxReuse: 5 },
  }
}

export function classSatisfies(
  tokenClass: Exclude<PrincipalClass, 'unknown'>,
  minClass: 'human' | 'agent' | 'either',
): boolean {
  if (minClass === 'either') return true
  return tokenClass === minClass
}

export function policyAllowsClass(
  policy: ActionPolicy,
  tokenClass: Exclude<PrincipalClass, 'unknown'>,
): boolean {
  switch (policy.mode) {
    case 'human_only':
      return tokenClass === 'human'
    case 'agent_only':
      return tokenClass === 'agent'
    case 'either':
    case 'dual_path':
      return true
    default:
      return false
  }
}

export function scopesForClass(
  policy: ActionPolicy,
  tokenClass: Exclude<PrincipalClass, 'unknown'>,
): string[] {
  if (tokenClass === 'human') return policy.human?.scopes ?? [policy.action]
  return policy.agent?.scopes ?? [policy.action]
}

export function ttlForClass(
  policy: ActionPolicy,
  tokenClass: Exclude<PrincipalClass, 'unknown'>,
  fallback: number,
): number {
  if (tokenClass === 'human') return policy.human?.ttlSeconds ?? fallback
  return policy.agent?.ttlSeconds ?? fallback
}

/**
 * v0.2: action must match claim act exactly.
 * Scopes refine rights; they do NOT expand which action a token authorizes.
 */
export function actionMatches(claims: CapabilityClaims, action: string): boolean {
  return claims.act === action
}

export function scopeAllows(claims: CapabilityClaims, requiredScope?: string): boolean {
  const need = requiredScope ?? claims.act
  return claims.scopes.includes(need)
}
