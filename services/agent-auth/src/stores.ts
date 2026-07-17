import type {
  ActionPolicy,
  AgentRecord,
  ChallengeRecord,
  SiteRecord,
} from './domain.js'

export interface GateStores {
  sites: Map<string, SiteRecord>
  siteKeyIndex: Map<string, string>
  policies: Map<string, ActionPolicy>
  agents: Map<string, AgentRecord>
  challenges: Map<string, ChallengeRecord>
  /** jti -> expiresAt ms */
  replay: Map<string, number>
  /** jti -> remaining presentations */
  reuseRemaining: Map<string, number>
  secretsBySiteId: Map<string, string>
}

export function createMemoryStores(): GateStores {
  return {
    sites: new Map(),
    siteKeyIndex: new Map(),
    policies: new Map(),
    agents: new Map(),
    challenges: new Map(),
    replay: new Map(),
    reuseRemaining: new Map(),
    secretsBySiteId: new Map(),
  }
}

export function policyKey(siteId: string, action: string): string {
  return `${siteId}::${action}`
}

export function seedDemoTenant(stores: GateStores): {
  siteKey: string
  secretKey: string
  siteId: string
} {
  const siteId = 'site_demo'
  const siteKey = 'zk_test_demo_public'
  const secretKey = 'sk_test_demo_secret_do_not_use_prod'
  const site: SiteRecord = {
    siteId,
    projectId: 'proj_demo',
    siteKey,
    secretHash: '',
    secretPlainDevOnly: secretKey,
    allowedOrigins: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4103', 'http://127.0.0.1:4103', 'http://127.0.0.1:3000', 'https://zexvrodashboard.xyz'],
    name: 'Demo site',
    createdAt: new Date().toISOString(),
  }
  // hash filled by caller optionally; keep plain for verify in memory mode
  stores.sites.set(siteId, site)
  stores.siteKeyIndex.set(siteKey, siteId)
  stores.secretsBySiteId.set(siteId, secretKey)

  stores.policies.set(
    policyKey(siteId, 'reward.claim'),
    {
      action: 'reward.claim',
      mode: 'human_only',
      human: { allowSilent: true, ttlSeconds: 300, scopes: ['reward.claim'] },
    },
  )
  stores.policies.set(
    policyKey(siteId, 'checkout.submit'),
    {
      action: 'checkout.submit',
      mode: 'human_only',
      human: { allowSilent: true, ttlSeconds: 300, scopes: ['checkout.submit'] },
    },
  )
  stores.policies.set(
    policyKey(siteId, 'search.query'),
    {
      action: 'search.query',
      mode: 'either',
      human: { allowSilent: true, ttlSeconds: 300, scopes: ['search.query'] },
      agent: { requireRegisteredKey: true, ttlSeconds: 120, scopes: ['search.query'], maxReuse: 5 },
    },
  )
  stores.policies.set(
    policyKey(siteId, 'index.bulk'),
    {
      action: 'index.bulk',
      mode: 'agent_only',
      agent: { requireRegisteredKey: true, ttlSeconds: 120, scopes: ['index.bulk'], maxReuse: 1 },
    },
  )

  stores.policies.set(
    policyKey(siteId, 'trade.execute'),
    {
      action: 'trade.execute',
      mode: 'dual_path',
      human: { allowSilent: false, ttlSeconds: 180, scopes: ['trade.execute', 'trade.execute:human'] },
      agent: { requireRegisteredKey: true, ttlSeconds: 60, scopes: ['trade.execute', 'trade.execute:agent'], maxReuse: 1 },
    },
  )

  return { siteKey, secretKey, siteId }
}
