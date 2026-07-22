import { describe, expect, it } from 'vitest'
import {
  actionMatches,
  classSatisfies,
  policyAllowsClass,
  scopesForClass,
} from './policy.js'
import type { ActionPolicy, CapabilityClaims } from './domain.js'

describe('policy helpers', () => {
  const dual: ActionPolicy = {
    action: 'trade.execute',
    mode: 'dual_path',
    human: { scopes: ['trade.execute:human'] },
    agent: { scopes: ['trade.execute:agent'] },
  }

  it('classSatisfies either', () => {
    expect(classSatisfies('human', 'either')).toBe(true)
    expect(classSatisfies('agent', 'agent')).toBe(true)
    expect(classSatisfies('human', 'agent')).toBe(false)
  })

  it('policy modes', () => {
    expect(policyAllowsClass({ action: 'a', mode: 'human_only' }, 'human')).toBe(true)
    expect(policyAllowsClass({ action: 'a', mode: 'human_only' }, 'agent')).toBe(false)
    expect(policyAllowsClass({ action: 'a', mode: 'agent_only' }, 'agent')).toBe(true)
    expect(policyAllowsClass(dual, 'human')).toBe(true)
    expect(policyAllowsClass(dual, 'agent')).toBe(true)
  })

  it('dual_path scopes differ by class', () => {
    expect(scopesForClass(dual, 'human')).toEqual(['trade.execute:human'])
    expect(scopesForClass(dual, 'agent')).toEqual(['trade.execute:agent'])
  })

  it('actionMatches is exact act only; scopes are separate', () => {
    const claims = {
      act: 'trade.execute',
      scopes: ['trade.execute:agent'],
    } as CapabilityClaims
    expect(actionMatches(claims, 'trade.execute')).toBe(true)
    expect(actionMatches(claims, 'trade.execute:agent')).toBe(false)
    expect(actionMatches(claims, 'other')).toBe(false)
  })
})
