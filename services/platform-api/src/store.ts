import {roleHasPermission,type Permission} from '../../../packages/platform-permissions/src';
export type Doc = Record<string, unknown>
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export const encode = (value: unknown) => JSON.stringify(value)
export const decode = (row: { data: string } | null): Doc | null =>
  row ? JSON.parse(row.data) : null
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
export function pageSize(raw: string | null) {
  const n = raw === null ? 50 : Number(raw)
  if (!Number.isInteger(n) || n < 1)
    throw new HttpError(400, 'limit must be a positive integer')
  return Math.min(n, 100)
}
export class Store {
  db: D1Database
  constructor(db: D1Database) {
    this.db = db
  }
  async workspace(id: string) {
    return decode(
      await this.db
        .prepare('SELECT data FROM workspaces WHERE id=?')
        .bind(id)
        .first<{ data: string }>(),
    )
  }
  async role(id: string, identities: string[]) {
    const rows = await this.db
      .prepare(
        `SELECT role FROM memberships WHERE identity IN (${identities.map(() => '?').join(',')}) AND workspace_id=?`,
      )
      .bind(...identities, id)
      .all<{ role: string }>()
    const roles = ['Owner', 'Admin', 'Developer', 'Finance', 'Viewer', 'Agent']
    return roles.find((r) => rows.results.some((row) => row.role === r))
  }
  async authorize(
    id: string,
    identities: string[],
    write = false,
    admin = false,
  ) {
    const role = await this.role(id, identities)
    if (
      !role ||
      (write && role === 'Viewer') ||
      (admin && !['Owner', 'Admin'].includes(role))
    )
      throw new HttpError(403, 'Workspace access denied')
    return role
  }
  async requirePermission(id:string,identities:string[],permission:Permission) {
    const role=await this.role(id,identities)
    if(!role || !roleHasPermission(role,permission))throw new HttpError(403,'Workspace permission denied')
    return role
  }
  audit(
    workspaceId: string,
    actorId: string,
    action: string,
    target: string,
    projectId: string | null = null,
    conditional = false,
  ) {
    const id = `${String(Date.now()).padStart(13, '0')}_${crypto.randomUUID()}`
    const event = {
      id,
      workspaceId,
      actorId,
      action,
      target,
      projectId,
      createdAt: Date.now(),
      severity: 'info',
    }
    return this.db
      .prepare(
        `INSERT INTO audit_events(workspace_id,id,project_id,data) SELECT ?,?,?,?${conditional ? ' WHERE changes()>0' : ''}`,
      )
      .bind(workspaceId, id, projectId, encode(event))
  }
  async createWorkspace(doc: Doc, actor: string, starter: number) {
    const existing = await this.db
      .prepare('SELECT data FROM workspaces WHERE owner_id=? AND name=?')
      .bind(actor, doc.name)
      .first<{ data: string }>()
    if (existing) return decode(existing)!
    const id = String(doc.id),
      now = Date.now()
    await this.db.batch([
      this.db
        .prepare(
          'INSERT INTO workspaces(id,owner_id,name,data,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(id, actor, doc.name, encode(doc), now),
      this.db
        .prepare(
          'INSERT INTO credit_balances(workspace_id,balance,updated_at) VALUES(?,?,?)',
        )
        .bind(id, 0, now),
      this.db
        .prepare(
          'INSERT INTO credit_ledger(workspace_id,id,ref,data) VALUES(?,?,?,?)',
        )
        .bind(
          id,
          `${now}_starter`,
          `starter:${id}`,
          encode({
            id: `${now}_starter`,
            workspaceId: id,
            type: 'grant',
            amount: starter,
            delta: starter,
            balanceAfter: starter,
            reason: 'starter_grant',
            createdAt: now,
          }),
        ),
      this.audit(id, actor, 'workspace.created', id),
    ])
    return doc
  }
  async updateWorkspace(previous: Doc, doc: Doc, actor: string) {
    if (encode(previous) === encode(doc)) return previous
    const id = String(doc.id)
    doc.updatedAt = Date.now()
    // Compare-and-swap prevents concurrent roster/settings updates overwriting one another.
    const statements = [
      this.db
        .prepare(
          'UPDATE workspaces SET name=?,data=? WHERE id=? AND data=? RETURNING id',
        )
        .bind(doc.name, encode(doc), id, encode(previous)),
    ]
    const result = await this.db.batch([
      ...statements,
      this.audit(id, actor, 'workspace.updated', id, null, true),
    ])
    if (!result[0].results.length)
      throw new HttpError(409, 'Workspace changed; reload and retry')
    // SQL triggers keep membership indexes atomic with the workspace document.
    return doc
  }
  async listRecords(
    kind: string,
    workspaceId: string,
    limit: number,
    cursor: string,
  ) {
    const rows = await this.db
      .prepare(
        'SELECT id,data FROM records INDEXED BY records_workspace WHERE kind=? AND workspace_id=? AND id>? ORDER BY id LIMIT ?',
      )
      .bind(kind, workspaceId, cursor, limit + 1)
      .all<{ id: string; data: string }>()
    const more = rows.results.length > limit,
      page = rows.results.slice(0, limit)
    return {
      items: page.map((row) => JSON.parse(row.data)),
      nextCursor: more ? page.at(-1)!.id : null,
    }
  }
  async record(kind: string, id: string) {
    return decode(
      await this.db
        .prepare('SELECT data FROM records WHERE kind=? AND id=?')
        .bind(kind, id)
        .first<{ data: string }>(),
    )
  }
  async saveRecord(
    kind: string,
    doc: Doc,
    actor: string,
    previous: Doc | null,
  ) {
    if (previous && encode(previous) === encode(doc)) return previous
    doc.updatedAt = Date.now()
    const workspaceId = String(doc.workspaceId),
      id = String(doc.id)
    // Insert-only on create: supplied IDs can never move another tenant's record.
    const statement = previous
      ? this.db
          .prepare(
            'UPDATE records SET data=? WHERE kind=? AND id=? AND workspace_id=? AND data=? RETURNING id',
          )
          .bind(encode(doc), kind, id, workspaceId, encode(previous))
      : this.db
          .prepare(
            'INSERT INTO records(kind,id,workspace_id,data,created_at) VALUES(?,?,?,?,?) RETURNING id',
          )
          .bind(kind, id, workspaceId, encode(doc), doc.createdAt)
    // Conditional audit only when mutation succeeded.
    const audit = this.audit(
      workspaceId,
      actor,
      `${kind}.${previous ? 'updated' : 'created'}`,
      id,
      kind === 'project' ? id : null,
      true,
    )
    const results = await this.db.batch([statement, audit])
    if (!results[0].results.length)
      throw new HttpError(409, 'Record changed; reload and retry')
    return doc
  }
}
