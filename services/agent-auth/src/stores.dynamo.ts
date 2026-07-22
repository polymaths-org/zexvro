/**
 * DynamoDB single-table adapter sketch for ZEXVRO Gate.
 *
 * Table design (zexvro-agent-auth):
 *   pk / sk
 *   SITE#siteId / META
 *   SITE#siteId / AGENT#agentId
 *   SITE#siteId / POLICY#action
 *   SITEKEY#siteKey / SITE#siteId
 *   CH#challengeId / META
 *   JTI#jti / META  (TTL = exp epoch seconds)
 *
 * This module provides a pure codec + memory-backed Dynamo-shaped store for tests.
 * Wire AWS SDK DocumentClient in production deploy (App Runner IAM).
 */

import type { ActionPolicy, AgentRecord, ChallengeRecord, SiteRecord } from './domain.js'
import type { GateStores } from './stores.js'
import { createMemoryStores, policyKey } from './stores.js'

export type DynamoItem = Record<string, unknown>

export function encodeSite(site: SiteRecord): DynamoItem {
  return {
    pk: `SITE#${site.siteId}`,
    sk: 'META',
    entity: 'site',
    ...site,
  }
}

export function encodeSiteKey(siteKey: string, siteId: string): DynamoItem {
  return {
    pk: `SITEKEY#${siteKey}`,
    sk: `SITE#${siteId}`,
    entity: 'sitekey',
    siteKey,
    siteId,
  }
}

export function encodeAgent(agent: AgentRecord): DynamoItem {
  return {
    pk: `SITE#${agent.siteId}`,
    sk: `AGENT#${agent.agentId}`,
    entity: 'agent',
    ...agent,
  }
}

export function encodePolicy(siteId: string, policy: ActionPolicy): DynamoItem {
  return {
    pk: `SITE#${siteId}`,
    sk: `POLICY#${policy.action}`,
    entity: 'policy',
    siteId,
    ...policy,
  }
}

export function encodeChallenge(ch: ChallengeRecord): DynamoItem {
  return {
    pk: `CH#${ch.id}`,
    sk: 'META',
    entity: 'challenge',
    ttl: Math.floor(ch.expiresAt / 1000),
    ...ch,
  }
}

export function encodeJti(jti: string, expMs: number, remaining: number): DynamoItem {
  return {
    pk: `JTI#${jti}`,
    sk: 'META',
    entity: 'jti',
    jti,
    expMs,
    remaining,
    ttl: Math.floor(expMs / 1000),
  }
}

/**
 * Export memory stores to Dynamo items (for backup/migration smoke).
 */
export function memoryToDynamoItems(stores: GateStores): DynamoItem[] {
  const items: DynamoItem[] = []
  for (const site of stores.sites.values()) {
    items.push(encodeSite(site))
    items.push(encodeSiteKey(site.siteKey, site.siteId))
  }
  for (const agent of stores.agents.values()) items.push(encodeAgent(agent))
  for (const [key, policy] of stores.policies) {
    const siteId = key.split('::')[0] ?? ''
    items.push(encodePolicy(siteId, policy))
  }
  for (const ch of stores.challenges.values()) items.push(encodeChallenge(ch))
  for (const [jti, expMs] of stores.replay) {
    items.push(encodeJti(jti, expMs, stores.reuseRemaining.get(jti) ?? 0))
  }
  return items
}

/**
 * Hydrate memory stores from Dynamo items (local test of codec).
 */
export function dynamoItemsToMemory(items: DynamoItem[]): GateStores {
  const stores = createMemoryStores()
  for (const item of items) {
    const entity = item.entity as string
    if (entity === 'site') {
      const site = item as unknown as SiteRecord & DynamoItem
      stores.sites.set(site.siteId, {
        siteId: site.siteId,
        projectId: site.projectId,
        siteKey: site.siteKey,
        secretHash: site.secretHash,
        secretPlainDevOnly: site.secretPlainDevOnly,
        allowedOrigins: site.allowedOrigins,
        name: site.name,
        createdAt: site.createdAt,
      })
      if (site.secretPlainDevOnly) {
        stores.secretsBySiteId.set(site.siteId, site.secretPlainDevOnly)
      }
    } else if (entity === 'sitekey') {
      stores.siteKeyIndex.set(String(item.siteKey), String(item.siteId))
    } else if (entity === 'agent') {
      const agent = item as unknown as AgentRecord
      stores.agents.set(agent.agentId, agent)
    } else if (entity === 'policy') {
      const policy = item as unknown as ActionPolicy & { siteId: string }
      stores.policies.set(policyKey(policy.siteId, policy.action), {
        action: policy.action,
        mode: policy.mode,
        human: policy.human,
        agent: policy.agent,
      })
    } else if (entity === 'challenge') {
      const ch = item as unknown as ChallengeRecord
      stores.challenges.set(ch.id, ch)
    } else if (entity === 'jti') {
      stores.replay.set(String(item.jti), Number(item.expMs))
      stores.reuseRemaining.set(String(item.jti), Number(item.remaining))
    }
  }
  return stores
}
