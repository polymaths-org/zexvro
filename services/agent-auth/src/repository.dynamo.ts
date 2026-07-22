import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type {
  ActionPolicy,
  AgentRecord,
  ChallengeRecord,
  SiteRecord,
  WebAuthnCredential,
} from './domain.js'
import { createMemoryStores, policyKey, seedDemoTenant, type GateStores } from './stores.js'
import type { GateRepository, JtiRecord } from './repository.js'
import { secretsEqual } from './crypto.js'

/**
 * Dynamo single-table repository.
 * Hot path: challenges, agents, jti.
 * Sites/policies/secrets: loaded into memory cache at boot (+ optional seed demo).
 */
export class DynamoRepository implements GateRepository {
  kind = 'dynamo' as const
  private readonly doc: DynamoDBDocumentClient
  private readonly table: string
  /** Local cache for site config (rarely changes). */
  private readonly cache: GateStores

  constructor(options: { tableName: string; region?: string; client?: DynamoDBClient }) {
    const client =
      options.client ??
      new DynamoDBClient({ region: options.region ?? process.env.AWS_REGION ?? 'us-east-1' })
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    })
    this.table = options.tableName
    this.cache = createMemoryStores()
  }

  async ensureDemoTenant() {
    // Local DX only — never call this under NODE_ENV=production.
    if (process.env.NODE_ENV === 'production') return null
    if (this.cache.sites.size === 0) {
      return seedDemoTenant(this.cache)
    }
    return null
  }

  /**
   * Warm site cache. Production: empty is fine until sites are provisioned.
   * Non-prod: may seed demo tenant into memory + optionally persist (legacy).
   * Never writes demo secrets when NODE_ENV=production.
   */
  async bootstrapFromCacheSeed() {
    if (process.env.NODE_ENV === 'production') {
      // Production: do not seed or persist demo tenants.
      return
    }
    await this.ensureDemoTenant()
    // Dev only: persist demo site keys so multi-instance share site metadata if desired
    for (const site of this.cache.sites.values()) {
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `SITE#${site.siteId}`,
            sk: 'META',
            entity: 'site',
            siteId: site.siteId,
            projectId: site.projectId,
            siteKey: site.siteKey,
            secretHash: site.secretHash,
            secretPlainDevOnly: site.secretPlainDevOnly,
            allowedOrigins: site.allowedOrigins,
            name: site.name,
            createdAt: site.createdAt,
          },
        }),
      )
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `SITEKEY#${site.siteKey}`,
            sk: `SITE#${site.siteId}`,
            entity: 'sitekey',
            siteKey: site.siteKey,
            siteId: site.siteId,
          },
        }),
      )
      const secret = this.cache.secretsBySiteId.get(site.siteId)
      if (secret) {
        await this.doc.send(
          new PutCommand({
            TableName: this.table,
            Item: {
              pk: `SITE#${site.siteId}`,
              sk: 'SECRET',
              entity: 'secret',
              siteId: site.siteId,
              secret,
            },
          }),
        )
      }
    }
    for (const [key, policy] of this.cache.policies) {
      const siteId = key.split('::')[0] ?? ''
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `SITE#${siteId}`,
            sk: `POLICY#${policy.action}`,
            entity: 'policy',
            siteId,
            action: policy.action,
            mode: policy.mode,
            human: policy.human,
            agent: policy.agent,
          },
        }),
      )
    }
  }

  async getSiteByKey(siteKey: string) {
    const cachedId = this.cache.siteKeyIndex.get(siteKey)
    if (cachedId) return this.cache.sites.get(cachedId)

    const q = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `SITEKEY#${siteKey}` },
        Limit: 1,
      }),
    )
    const item = q.Items?.[0]
    if (!item?.siteId) {
      // try cache seed
      return this.cache.sites.get(this.cache.siteKeyIndex.get(siteKey) ?? '')
    }
    const siteId = String(item.siteId)
    const siteRes = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: 'META' },
      }),
    )
    const s = siteRes.Item
    if (!s) return undefined
    const site: SiteRecord = {
      siteId: String(s.siteId),
      projectId: String(s.projectId),
      siteKey: String(s.siteKey),
      secretHash: String(s.secretHash ?? ''),
      secretPlainDevOnly: s.secretPlainDevOnly ? String(s.secretPlainDevOnly) : undefined,
      allowedOrigins: (s.allowedOrigins as string[]) ?? [],
      name: String(s.name ?? ''),
      createdAt: String(s.createdAt ?? ''),
    }
    this.cache.sites.set(site.siteId, site)
    this.cache.siteKeyIndex.set(site.siteKey, site.siteId)
    return site
  }

  async getSiteSecret(siteId: string) {
    const cached = this.cache.secretsBySiteId.get(siteId)
    if (cached) return cached
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: 'SECRET' },
      }),
    )
    const secret = res.Item?.secret ? String(res.Item.secret) : undefined
    if (secret) this.cache.secretsBySiteId.set(siteId, secret)
    return secret
  }

  async findSiteBySecret(siteSecret: string) {
    // Prefer cache scan of secrets (small tenant set)
    for (const site of this.cache.sites.values()) {
      const secret = await this.getSiteSecret(site.siteId)
      if (secret && secretsEqual(secret, siteSecret)) return site
    }
    if (process.env.NODE_ENV !== 'production') {
      await this.ensureDemoTenant()
      for (const site of this.cache.sites.values()) {
        const secret = this.cache.secretsBySiteId.get(site.siteId)
        if (secret && secretsEqual(secret, siteSecret)) return site
      }
    }
    return undefined
  }

  async getPolicy(siteId: string, action: string) {
    const cached = this.cache.policies.get(policyKey(siteId, action))
    if (cached) return cached
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: `POLICY#${action}` },
      }),
    )
    const item = res.Item
    if (!item) return undefined
    const policy: ActionPolicy = {
      action: String(item.action),
      mode: item.mode as ActionPolicy['mode'],
      human: item.human as ActionPolicy['human'],
      agent: item.agent as ActionPolicy['agent'],
    }
    this.cache.policies.set(policyKey(siteId, action), policy)
    return policy
  }

  async putAgent(agent: AgentRecord) {
    this.cache.agents.set(agent.agentId, agent)
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `SITE#${agent.siteId}`,
          sk: `AGENT#${agent.agentId}`,
          gsi1pk: `SITE#${agent.siteId}#PK#${agent.publicKey}`,
          gsi1sk: 'AGENT',
          entity: 'agent',
          ...agent,
        },
      }),
    )
    // also index by public key for lookup
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `SITE#${agent.siteId}#AGENTPK#${agent.publicKey}`,
          sk: 'META',
          entity: 'agentpk',
          agentId: agent.agentId,
          siteId: agent.siteId,
          publicKey: agent.publicKey,
        },
      }),
    )
  }

  async getAgentByPublicKey(siteId: string, publicKey: string) {
    for (const a of this.cache.agents.values()) {
      if (a.siteId === siteId && a.publicKey === publicKey && !a.revokedAt) return a
    }
    const idx = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}#AGENTPK#${publicKey}`, sk: 'META' },
      }),
    )
    const agentId = idx.Item?.agentId ? String(idx.Item.agentId) : undefined
    if (!agentId) return undefined
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: `AGENT#${agentId}` },
      }),
    )
    const item = res.Item
    if (!item) return undefined
    const agent = item as unknown as AgentRecord
    this.cache.agents.set(agent.agentId, agent)
    if (agent.revokedAt) return undefined
    return agent
  }

  async listAgents(siteId: string) {
    // Local/demo: use warm cache; full Dynamo query by site is a follow-up.
    return [...this.cache.agents.values()].filter(
      (a) => a.siteId === siteId && !a.revokedAt,
    )
  }

  async putChallenge(challenge: ChallengeRecord) {
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `CH#${challenge.id}`,
          sk: 'META',
          entity: 'challenge',
          ttl: Math.floor(challenge.expiresAt / 1000),
          ...challenge,
        },
      }),
    )
  }

  async getChallenge(id: string) {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `CH#${id}`, sk: 'META' },
      }),
    )
    return res.Item as ChallengeRecord | undefined
  }

  async saveChallenge(challenge: ChallengeRecord) {
    await this.putChallenge(challenge)
  }

  async completeChallengeIfPending(id: string, nowMs = Date.now()) {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk: `CH#${id}`, sk: 'META' },
          ConditionExpression: '#status = :pending AND expiresAt > :now',
          UpdateExpression: 'SET #status = :completed',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':pending': 'pending',
            ':completed': 'completed',
            ':now': nowMs,
          },
        }),
      )
      return true
    } catch {
      return false
    }
  }

  async registerJti(jti: string, expMs: number, remaining: number) {
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `JTI#${jti}`,
          sk: 'META',
          entity: 'jti',
          jti,
          expMs,
          remaining,
          ttl: Math.floor(expMs / 1000),
        },
      }),
    )
  }

  async getJti(jti: string): Promise<JtiRecord | undefined> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `JTI#${jti}`, sk: 'META' },
      }),
    )
    const item = res.Item
    if (!item) return undefined
    return {
      jti,
      expMs: Number(item.expMs),
      remaining: Number(item.remaining),
    }
  }

  async consumeJti(jti: string, nowMs = Date.now()) {
    const current = await this.getJti(jti)
    if (!current) return false
    if (current.expMs <= nowMs || current.remaining <= 0) {
      return false
    }
    if (current.remaining === 1) {
      // set remaining 0
      try {
        await this.doc.send(
          new UpdateCommand({
            TableName: this.table,
            Key: { pk: `JTI#${jti}`, sk: 'META' },
            ConditionExpression: 'remaining = :one AND expMs > :now',
            UpdateExpression: 'SET remaining = :zero',
            ExpressionAttributeValues: {
              ':one': 1,
              ':zero': 0,
              ':now': nowMs,
            },
          }),
        )
        return true
      } catch {
        return false
      }
    }
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk: `JTI#${jti}`, sk: 'META' },
          ConditionExpression: 'remaining > :one AND expMs > :now',
          UpdateExpression: 'SET remaining = remaining - :one',
          ExpressionAttributeValues: {
            ':one': 1,
            ':now': nowMs,
          },
        }),
      )
      return true
    } catch {
      return false
    }
  }

  async putWebAuthnCredential(cred: WebAuthnCredential) {
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `SITE#${cred.siteId}`,
          sk: `WA#${cred.credentialId}`,
          entity: 'webauthn',
          ...cred,
        },
      }),
    )
  }

  async getWebAuthnCredential(siteId: string, credentialId: string) {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: `WA#${credentialId}` },
      }),
    )
    return res.Item as WebAuthnCredential | undefined
  }

  async listWebAuthnCredentials(siteId: string, userId?: string) {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `SITE#${siteId}`,
          ':sk': 'WA#',
        },
      }),
    )
    const items = (res.Items ?? []) as WebAuthnCredential[]
    return userId ? items.filter((c) => c.userId === userId) : items
  }

  async updateWebAuthnCounter(siteId: string, credentialId: string, counter: number) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { pk: `SITE#${siteId}`, sk: `WA#${credentialId}` },
        UpdateExpression: 'SET #c = :c',
        ExpressionAttributeNames: { '#c': 'counter' },
        ExpressionAttributeValues: { ':c': counter },
      }),
    )
  }

  asMemoryStores() {
    return this.cache
  }
}
