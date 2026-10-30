import type { D1Database } from '@cloudflare/workers-types'
import type { GateRepository, JtiRecord } from './repository.js'
import type {
  SiteRecord,
  ActionPolicy,
  AgentRecord,
  ChallengeRecord,
  WebAuthnCredential,
} from './domain.js'
import { createMemoryStores } from './stores.js'
import { hashSecret } from './crypto.js'
const read = <T>(row: { data: string } | null): T | undefined =>
  row ? (JSON.parse(row.data) as T) : undefined
export class D1GateRepository implements GateRepository {
  kind = 'd1' as const
  constructor(
    private readonly db: D1Database,
    private readonly owner: () => string | undefined = () => undefined,
  ) {}
  async ensureDemoTenant() {
    return null
  }
  async hydrateSites() {} // D1 queries are indexed; no full-table bootstrap/cache.
  async getSiteById(id: string) {
    const owner = this.owner()
    return read<SiteRecord>(
      await this.db
        .prepare(
          `SELECT data FROM gate_sites WHERE id=?${owner ? ' AND owner_id=?' : ''}`,
        )
        .bind(...(owner ? [id, owner] : [id]))
        .first<{ data: string }>(),
    )
  }
  async getSiteByKey(key: string) {
    const owner = this.owner()
    return read<SiteRecord>(
      await this.db
        .prepare(
          `SELECT data FROM gate_sites WHERE site_key=?${owner ? ' AND owner_id=?' : ''}`,
        )
        .bind(...(owner ? [key, owner] : [key]))
        .first<{ data: string }>(),
    )
  }
  async getSiteSecret(_id: string): Promise<string | undefined> {
    return undefined
  } // Only hashes are stored; keys are shown once on creation.
  async findSiteBySecret(secret: string) {
    return read<SiteRecord>(
      await this.db
        .prepare('SELECT data FROM gate_sites WHERE secret_hash=?')
        .bind(hashSecret(secret))
        .first<{ data: string }>(),
    )
  }
  async listSites(page: { limit?: number; cursor?: string } = {}) {
    const owner = this.owner()
    if (!owner) return []
    const rows = await this.db
      .prepare(
        'SELECT data FROM gate_sites INDEXED BY gate_owner WHERE owner_id=? AND id>? ORDER BY id LIMIT ?',
      )
      .bind(
        owner,
        page.cursor || '',
        Math.min(101, Math.max(1, page.limit || 100)),
      )
      .all<{ data: string }>()
    return rows.results.map((r) => JSON.parse(r.data) as SiteRecord)
  }
  async createSite(site: SiteRecord, secret: string) {
    const owner = this.owner()
    if (!owner) throw new Error('Authenticated site owner required')
    const safe = { ...site, secretHash: hashSecret(secret) }
    delete safe.secretPlainDevOnly
    await this.db.batch([
      this.db
        .prepare(
          'INSERT INTO gate_sites(id,owner_id,site_key,secret_hash,data) VALUES(?,?,?,?,?)',
        )
        .bind(
          site.siteId,
          owner,
          site.siteKey,
          safe.secretHash,
          JSON.stringify(safe),
        ),
      ...site.allowedOrigins.map((origin) =>
        this.db
          .prepare('INSERT INTO gate_origins(origin,site_id) VALUES(?,?)')
          .bind(origin, site.siteId),
      ),
    ])
  }
  async updateSite(site: SiteRecord) {
    if (!(await this.getSiteById(site.siteId)))
      throw new Error('site_not_found')
    const safe = { ...site }
    delete safe.secretPlainDevOnly
    await this.db.batch([
      this.db
        .prepare(
          'UPDATE gate_sites SET site_key=?,secret_hash=?,data=? WHERE id=? AND data<>?',
        )
        .bind(
          site.siteKey,
          site.secretHash,
          JSON.stringify(safe),
          site.siteId,
          JSON.stringify(safe),
        ),
      this.db
        .prepare('DELETE FROM gate_origins WHERE site_id=?')
        .bind(site.siteId),
      ...site.allowedOrigins.map((origin) =>
        this.db
          .prepare('INSERT INTO gate_origins(origin,site_id) VALUES(?,?)')
          .bind(origin, site.siteId),
      ),
    ])
  }
  async rotateSiteSecret(id: string, secret: string) {
    const site = await this.getSiteById(id)
    if (!site) throw new Error('site_not_found')
    site.secretHash = hashSecret(secret)
    await this.updateSite(site)
  }
  async listAllowedOrigins() {
    return []
  } // Use exact indexed origin checks instead of reading every tenant.
  async isOriginAllowed(origin: string) {
    return Boolean(
      await this.db
        .prepare('SELECT 1 FROM gate_origins WHERE origin=? LIMIT 1')
        .bind(origin)
        .first(),
    )
  }
  async getPolicy(siteId: string, action: string) {
    return read<ActionPolicy>(
      await this.db
        .prepare('SELECT data FROM gate_policies WHERE site_id=? AND action=?')
        .bind(siteId, action)
        .first<{ data: string }>(),
    )
  }
  async putAgent(agent: AgentRecord) {
    await this.db
      .prepare(
        'INSERT INTO gate_agents(id,site_id,public_key,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE gate_agents.data<>excluded.data',
      )
      .bind(agent.agentId, agent.siteId, agent.publicKey, JSON.stringify(agent))
      .run()
  }
  async getAgentByPublicKey(siteId: string, key: string) {
    const agent = read<AgentRecord>(
      await this.db
        .prepare(
          'SELECT data FROM gate_agents WHERE site_id=? AND public_key=?',
        )
        .bind(siteId, key)
        .first<{ data: string }>(),
    )
    return agent?.revokedAt ? undefined : agent
  }
  async listAgents(
    siteId: string,
    page: { limit?: number; cursor?: string } = {},
  ) {
    const rows = await this.db
      .prepare(
        'SELECT data FROM gate_agents INDEXED BY gate_agents_site WHERE site_id=? AND id>? ORDER BY id LIMIT ?',
      )
      .bind(
        siteId,
        page.cursor || '',
        Math.min(101, Math.max(1, page.limit || 100)),
      )
      .all<{ data: string }>()
    return rows.results
      .map((r) => JSON.parse(r.data) as AgentRecord)
      .filter((a) => !a.revokedAt)
  }
  async putChallenge(challenge: ChallengeRecord) {
    await this.db
      .prepare(
        "INSERT INTO gate_challenges(id,site_id,status,expires_at,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,expires_at=excluded.expires_at,data=excluded.data WHERE gate_challenges.data<>excluded.data AND NOT(gate_challenges.status<>'pending' AND excluded.status='pending')",
      )
      .bind(
        challenge.id,
        challenge.siteId,
        challenge.status,
        challenge.expiresAt,
        JSON.stringify(challenge),
      )
      .run()
  }
  async getChallenge(id: string) {
    return read<ChallengeRecord>(
      await this.db
        .prepare('SELECT data FROM gate_challenges WHERE id=?')
        .bind(id)
        .first<{ data: string }>(),
    )
  }
  async saveChallenge(challenge: ChallengeRecord) {
    return this.putChallenge(challenge)
  }
  async completeChallengeIfPending(id: string, now = Date.now()) {
    return Boolean(
      await this.db
        .prepare(
          "UPDATE gate_challenges SET status='completed',data=json_set(data,'$.status','completed') WHERE id=? AND status='pending' AND expires_at>? RETURNING id",
        )
        .bind(id, now)
        .first(),
    )
  }
  async registerJti(jti: string, expires: number, remaining: number) {
    await this.db
      .prepare('INSERT INTO gate_jti(jti,expires_at,remaining) VALUES(?,?,?)')
      .bind(jti, expires, remaining)
      .run()
  }
  async getJti(jti: string): Promise<JtiRecord | undefined> {
    const row = await this.db
      .prepare('SELECT expires_at,remaining FROM gate_jti WHERE jti=?')
      .bind(jti)
      .first<{ expires_at: number; remaining: number }>()
    return row
      ? { jti, expMs: row.expires_at, remaining: row.remaining }
      : undefined
  }
  async consumeJti(jti: string, now = Date.now()) {
    return Boolean(
      await this.db
        .prepare(
          'UPDATE gate_jti SET remaining=remaining-1 WHERE jti=? AND remaining>0 AND expires_at>? RETURNING jti',
        )
        .bind(jti, now)
        .first(),
    )
  }
  async putWebAuthnCredential(cred: WebAuthnCredential) {
    await this.db
      .prepare(
        'INSERT INTO gate_webauthn(site_id,credential_id,user_id,counter,data) VALUES(?,?,?,?,?) ON CONFLICT(site_id,credential_id) DO UPDATE SET counter=excluded.counter,data=excluded.data WHERE gate_webauthn.data<>excluded.data',
      )
      .bind(
        cred.siteId,
        cred.credentialId,
        cred.userId,
        cred.counter,
        JSON.stringify(cred),
      )
      .run()
  }
  async getWebAuthnCredential(siteId: string, id: string) {
    return read<WebAuthnCredential>(
      await this.db
        .prepare(
          'SELECT data FROM gate_webauthn WHERE site_id=? AND credential_id=?',
        )
        .bind(siteId, id)
        .first<{ data: string }>(),
    )
  }
  async listWebAuthnCredentials(siteId: string, userId?: string) {
    const rows = await this.db
      .prepare(
        `SELECT data FROM gate_webauthn WHERE site_id=?${userId ? ' AND user_id=?' : ''} ORDER BY credential_id LIMIT 100`,
      )
      .bind(...(userId ? [siteId, userId] : [siteId]))
      .all<{ data: string }>()
    return rows.results.map((r) => JSON.parse(r.data) as WebAuthnCredential)
  }
  async updateWebAuthnCounter(siteId: string, id: string, counter: number) {
    const result = await this.db
      .prepare(
        "UPDATE gate_webauthn SET counter=?,data=json_set(data,'$.counter',?) WHERE site_id=? AND credential_id=? AND (counter<? OR (counter=0 AND ?=0)) RETURNING credential_id",
      )
      .bind(counter, counter, siteId, id, counter, counter)
      .first()
    if (!result) throw new Error('webauthn_counter_replay')
  }
  asMemoryStores() {
    return createMemoryStores()
  }
}
