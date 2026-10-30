import { randomBytes } from 'node:crypto'
import { Store, HttpError, encode, type Doc } from './store'
import { tokenHash } from './auth'
type User = {
  username: string
  email: string
  displayName: string
  identities: string[]
}
interface InviteRow {
  token: string
  id: string
  workspace_id: string
  email: string
  role: string
  expires_at: number
  accepted_by: string | null
  revoked: number
  data: string
}
const roles = ['Admin', 'Developer', 'Finance', 'Viewer', 'Agent']
const inviteView = (row: InviteRow) => ({
  ...JSON.parse(row.data),
  status: row.revoked
    ? 'revoked'
    : row.accepted_by
      ? 'accepted'
      : row.expires_at <= Date.now()
        ? 'expired'
        : 'pending',
})
export async function previewInvite(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token))
    throw new HttpError(404, 'Invitation not found')
  const row = await db
    .prepare('SELECT * FROM invites WHERE token=?')
    .bind(tokenHash(token))
    .first<InviteRow>()
  if (!row) throw new HttpError(404, 'Invitation not found')
  return { invite: inviteView(row) }
}
export async function inviteRoute(
  path: string,
  method: string,
  body: Doc,
  env: Env,
  user: User,
) {
  const store = new Store(env.DB)
  if (path === '/api/invite/send' && method === 'POST') {
    const id = String(body.workspaceId || '')
    await store.authorize(id, user.identities, true, true)
    const workspace = await store.workspace(id)
    if (!workspace) throw new HttpError(404, 'Workspace not found')
    const email = String(body.email || '')
        .trim()
        .toLowerCase(),
      role = String(body.role || 'Developer')
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !roles.includes(role)
    )
      throw new HttpError(400, 'Valid email and role required')
    const inviteId =
      typeof body.inviteId === 'string'
        ? body.inviteId.slice(0, 100)
        : `inv_${crypto.randomUUID()}`
    const prior = await env.DB.prepare(
      'SELECT accepted_by FROM invites WHERE workspace_id=? AND id=?',
    )
      .bind(id, inviteId)
      .first<{ accepted_by: string | null }>()
    if (prior?.accepted_by)
      throw new HttpError(409, 'Invitation already accepted')
    const token =
        typeof body.token === 'string' &&
        /^[A-Za-z0-9_-]{32,128}$/.test(body.token)
          ? body.token
          : randomBytes(24).toString('hex'),
      hash = tokenHash(token),
      now = Date.now(),
      expiresAt = now + 7 * 86400000
    const invite = {
      id: inviteId,
      workspaceId: id,
      workspaceName: workspace.name,
      email,
      role,
      status: 'pending',
      expiresAt,
      createdAt: now,
      invitedBy: user.displayName,
    }
    const invitations = Array.isArray(workspace.invitations)
      ? (workspace.invitations as Doc[]).filter(
          (i) =>
            i.id !== inviteId &&
            i.status === 'pending' &&
            Number(i.expiresAt) > now,
        )
      : []
    if (invitations.length >= 100)
      throw new HttpError(400, 'At most 100 pending invitations per workspace')
    const updated = {
      ...workspace,
      invitations: [...invitations, invite],
      updatedAt: now,
    }
    const results = await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO invites(token,id,workspace_id,email,role,expires_at,data) SELECT ?,?,?,?,?,?,? FROM workspaces WHERE id=? AND data=? ON CONFLICT(workspace_id,id) DO UPDATE SET token=excluded.token,email=excluded.email,role=excluded.role,expires_at=excluded.expires_at,data=excluded.data,revoked=0',
      ).bind(
        hash,
        inviteId,
        id,
        email,
        role,
        expiresAt,
        encode(invite),
        id,
        encode(workspace),
      ),
      env.DB.prepare(
        'UPDATE workspaces SET data=? WHERE id=? AND data=? AND EXISTS(SELECT 1 FROM invites WHERE token=?) RETURNING id',
      ).bind(encode(updated), id, encode(workspace), hash),
      store.audit(id, user.username, 'invite.created', email, null, true),
    ])
    if (!results[1]?.results.length)
      throw new HttpError(409, 'Workspace changed; reload and retry')
    return {
      status: 'success',
      provider: 'link',
      acceptUrl: `https://console.zexvro.in/invite/accept?token=${token}`,
      invite,
      message:
        'Invitation saved. Share the link; email delivery is not configured.',
    }
  }
  if (path === '/api/invite/accept' && method === 'POST') {
    const hash = tokenHash(String(body.token || '')),
      row = await env.DB.prepare('SELECT * FROM invites WHERE token=?')
        .bind(hash)
        .first<InviteRow>()
    if (!row || row.revoked || row.expires_at <= Date.now())
      throw new HttpError(410, 'Invitation invalid, revoked or expired')
    if (row.email !== user.email.toLowerCase())
      throw new HttpError(403, 'Sign in with the invited email address')
    const workspace = await store.workspace(row.workspace_id)
    if (!workspace) throw new HttpError(404, 'Workspace not found')
    if (row.accepted_by) {
      if (row.accepted_by !== user.username)
        throw new HttpError(403, 'Invitation already used')
      return {
        status: 'success',
        alreadyAccepted: true,
        workspaceId: row.workspace_id,
        workspaceName: workspace.name,
        role: row.role,
        workspace,
      }
    }
    const members = Array.isArray(workspace.members)
        ? (workspace.members as Doc[])
        : [],
      now = Date.now()
    if (members.length >= 500)
      throw new HttpError(400, 'Workspace member limit reached')
    const role = workspace.ownerId === user.username ? 'Owner' : row.role
    const member = {
      id: user.username,
      principalId: user.username,
      email: user.email,
      name: user.displayName,
      role,
      status: 'active',
      joinedAt: now,
      inviteId: row.id,
    }
    const invitations = Array.isArray(workspace.invitations)
      ? (workspace.invitations as Doc[]).map((i) =>
          i.id === row.id ? { ...i, status: 'accepted', acceptedAt: now } : i,
        )
      : []
    const updated = {
      ...workspace,
      members: [
        ...members.filter(
          (m) =>
            m.id !== user.username &&
            String(m.email).toLowerCase() !== user.email.toLowerCase(),
        ),
        member,
      ],
      invitations,
      updatedAt: now,
    }
    const result = await env.DB.batch([
      env.DB.prepare(
        'UPDATE invites SET accepted_by=? WHERE token=? AND accepted_by IS NULL AND revoked=0 AND expires_at>? AND EXISTS(SELECT 1 FROM workspaces WHERE id=? AND data=?) RETURNING token',
      ).bind(user.username, hash, now, row.workspace_id, encode(workspace)),
      env.DB.prepare(
        'UPDATE workspaces SET data=? WHERE id=? AND data=? AND EXISTS(SELECT 1 FROM invites WHERE token=? AND accepted_by=?) RETURNING id',
      ).bind(
        encode(updated),
        row.workspace_id,
        encode(workspace),
        hash,
        user.username,
      ),
      store.audit(
        row.workspace_id,
        user.username,
        'invite.accepted',
        user.email,
        null,
        true,
      ),
    ])
    if (!result[0]?.results.length || !result[1]?.results.length)
      throw new HttpError(
        409,
        'Invitation or workspace changed; reload and retry',
      )
    return {
      status: 'success',
      workspaceId: row.workspace_id,
      workspaceName: workspace.name,
      role,
      email: user.email,
      workspace: updated,
    }
  }
  if (path === '/api/invite/revoke' && method === 'POST') {
    const id = String(body.workspaceId || '')
    await store.authorize(id, user.identities, true, true)
    const result = await env.DB.prepare(
      'UPDATE invites SET revoked=1 WHERE workspace_id=? AND id=? AND accepted_by IS NULL RETURNING token',
    )
      .bind(id, String(body.inviteId || ''))
      .first()
    if (!result) throw new HttpError(404, 'Pending invitation not found')
    const workspace = await store.workspace(id)
    if (workspace) {
      const invitations = Array.isArray(workspace.invitations)
        ? (workspace.invitations as Doc[]).map((i) =>
            i.id === body.inviteId ? { ...i, status: 'revoked' } : i,
          )
        : []
      await store.updateWorkspace(
        workspace,
        { ...workspace, invitations },
        user.username,
      )
    }
    return { status: 'success' }
  }
  return null
}
