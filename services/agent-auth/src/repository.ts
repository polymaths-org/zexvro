/**
 * Async persistence interface for ZEXVRO Gate.
 * Memory backend for tests/dev; Dynamo for multi-instance production.
 */
import type {
  ActionPolicy,
  AgentRecord,
  ChallengeRecord,
  SiteRecord,
  WebAuthnCredential,
} from './domain.js'
import {
  createMemoryStores,
  policyKey,
  seedDemoTenant,
  type GateStores,
} from './stores.js'

export interface JtiRecord {
  jti: string
  expMs: number
  remaining: number
}

export interface GateRepository {
  kind: 'memory' | 'dynamo'
  ensureDemoTenant(): Promise<{ siteKey: string; secretKey: string; siteId: string } | null>
  getSiteByKey(siteKey: string): Promise<SiteRecord | undefined>
  getSiteSecret(siteId: string): Promise<string | undefined>
  findSiteBySecret(siteSecret: string): Promise<SiteRecord | undefined>
  getPolicy(siteId: string, action: string): Promise<ActionPolicy | undefined>
  putAgent(agent: AgentRecord): Promise<void>
  getAgentByPublicKey(siteId: string, publicKey: string): Promise<AgentRecord | undefined>
  listAgents(siteId: string): Promise<AgentRecord[]>
  putChallenge(challenge: ChallengeRecord): Promise<void>
  getChallenge(id: string): Promise<ChallengeRecord | undefined>
  saveChallenge(challenge: ChallengeRecord): Promise<void>
  /**
   * Atomically mark a pending challenge completed.
   * Returns false if missing, not pending, or already completed (CAS failure).
   */
  completeChallengeIfPending(id: string, nowMs?: number): Promise<boolean>
  registerJti(jti: string, expMs: number, remaining: number): Promise<void>
  /** Peek without consume */
  getJti(jti: string): Promise<JtiRecord | undefined>
  /** Atomic consume one presentation; returns false if exhausted/missing/expired */
  consumeJti(jti: string, nowMs?: number): Promise<boolean>
  putWebAuthnCredential(cred: WebAuthnCredential): Promise<void>
  getWebAuthnCredential(siteId: string, credentialId: string): Promise<WebAuthnCredential | undefined>
  listWebAuthnCredentials(siteId: string, userId?: string): Promise<WebAuthnCredential[]>
  updateWebAuthnCounter(siteId: string, credentialId: string, counter: number): Promise<void>
  /** Sync snapshot for legacy createGateApp seed path */
  asMemoryStores(): GateStores
}

export class MemoryRepository implements GateRepository {
  kind = 'memory' as const
  readonly stores: GateStores
  private readonly webauthn = new Map<string, WebAuthnCredential>()

  constructor(stores?: GateStores) {
    this.stores = stores ?? createMemoryStores()
  }

  private waKey(siteId: string, credentialId: string) {
    return `${siteId}::${credentialId}`
  }

  async ensureDemoTenant() {
    if (this.stores.sites.size === 0) return seedDemoTenant(this.stores)
    return null
  }

  async getSiteByKey(siteKey: string) {
    const siteId = this.stores.siteKeyIndex.get(siteKey)
    if (!siteId) return undefined
    return this.stores.sites.get(siteId)
  }

  async getSiteSecret(siteId: string) {
    return this.stores.secretsBySiteId.get(siteId)
  }

  async findSiteBySecret(siteSecret: string) {
    for (const site of this.stores.sites.values()) {
      const secret = this.stores.secretsBySiteId.get(site.siteId)
      if (secret === siteSecret) return site
    }
    return undefined
  }

  async getPolicy(siteId: string, action: string) {
    return this.stores.policies.get(policyKey(siteId, action))
  }

  async putAgent(agent: AgentRecord) {
    this.stores.agents.set(agent.agentId, agent)
  }

  async getAgentByPublicKey(siteId: string, publicKey: string) {
    for (const agent of this.stores.agents.values()) {
      if (agent.siteId === siteId && agent.publicKey === publicKey && !agent.revokedAt) {
        return agent
      }
    }
    return undefined
  }

  async listAgents(siteId: string) {
    return [...this.stores.agents.values()].filter(
      (a) => a.siteId === siteId && !a.revokedAt,
    )
  }

  async putChallenge(challenge: ChallengeRecord) {
    this.stores.challenges.set(challenge.id, challenge)
  }

  async getChallenge(id: string) {
    return this.stores.challenges.get(id)
  }

  async saveChallenge(challenge: ChallengeRecord) {
    this.stores.challenges.set(challenge.id, challenge)
  }

  async completeChallengeIfPending(id: string, nowMs = Date.now()) {
    const challenge = this.stores.challenges.get(id)
    if (!challenge) return false
    if (challenge.status !== 'pending') return false
    if (challenge.expiresAt <= nowMs) {
      challenge.status = 'expired'
      this.stores.challenges.set(id, challenge)
      return false
    }
    challenge.status = 'completed'
    this.stores.challenges.set(id, challenge)
    return true
  }

  async registerJti(jti: string, expMs: number, remaining: number) {
    this.stores.replay.set(jti, expMs)
    this.stores.reuseRemaining.set(jti, remaining)
  }

  async getJti(jti: string) {
    const expMs = this.stores.replay.get(jti)
    const remaining = this.stores.reuseRemaining.get(jti)
    if (expMs === undefined || remaining === undefined) return undefined
    return { jti, expMs, remaining }
  }

  async consumeJti(jti: string, nowMs = Date.now()) {
    const expMs = this.stores.replay.get(jti)
    const remaining = this.stores.reuseRemaining.get(jti)
    if (expMs === undefined || remaining === undefined) return false
    if (expMs <= nowMs || remaining <= 0) {
      this.stores.replay.delete(jti)
      this.stores.reuseRemaining.delete(jti)
      return false
    }
    if (remaining === 1) {
      this.stores.replay.delete(jti)
      this.stores.reuseRemaining.delete(jti)
      return true
    }
    this.stores.reuseRemaining.set(jti, remaining - 1)
    return true
  }

  async putWebAuthnCredential(cred: WebAuthnCredential) {
    this.webauthn.set(this.waKey(cred.siteId, cred.credentialId), cred)
  }

  async getWebAuthnCredential(siteId: string, credentialId: string) {
    return this.webauthn.get(this.waKey(siteId, credentialId))
  }

  async listWebAuthnCredentials(siteId: string, userId?: string) {
    return [...this.webauthn.values()].filter(
      (c) => c.siteId === siteId && (userId === undefined || c.userId === userId),
    )
  }

  async updateWebAuthnCounter(siteId: string, credentialId: string, counter: number) {
    const c = this.webauthn.get(this.waKey(siteId, credentialId))
    if (c) {
      c.counter = counter
      this.webauthn.set(this.waKey(siteId, credentialId), c)
    }
  }

  asMemoryStores() {
    return this.stores
  }
}
