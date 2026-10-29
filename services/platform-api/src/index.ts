import { authenticate, authRoute } from './auth'
import { creditRoute } from './credits'
import { inviteRoute, previewInvite } from './invites'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  Store,
  HttpError,
  decode,
  encode,
  uid,
  pageSize,
  type Doc,
} from './store'

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256)
    throw new HttpError(400, `${name} is required (maximum 256 characters)`)
  return value.trim()
}
function recordId(value: unknown, prefix: string) {
  if (value === undefined) return uid(prefix)
  if (typeof value !== 'string' || !/^[A-Za-z0-9_#.-]{3,100}$/.test(value))
    throw new HttpError(400, 'Invalid record id')
  return value
}
async function readBody(request: Request): Promise<Doc> {
  if (['GET', 'HEAD', 'DELETE'].includes(request.method)) return {}
  // Stream limit also covers missing/spoofed Content-Length.
  const reader = request.body?.getReader()
  if (!reader) return {}
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 65536) {
      await reader.cancel()
      throw new HttpError(413, 'Request body exceeds 64 KiB')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.length
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error()
    return body as Doc
  } catch {
    throw new HttpError(400, 'Expected a JSON object')
  }
}
const resources = [
  {
    path: '/api/projects',
    kind: 'project',
    idKey: 'projectId',
    plural: 'projects',
    singular: 'project',
  },
  {
    path: '/api/employees',
    kind: 'employee',
    idKey: 'employeeId',
    plural: 'employees',
    singular: 'employee',
  },
  {
    path: '/api/payroll/runs',
    kind: 'run',
    idKey: 'runId',
    plural: 'runs',
    singular: 'run',
  },
  {
    path: '/api/payroll/taxonomy',
    kind: 'taxonomy',
    idKey: 'taxonomyId',
    plural: 'items',
    singular: 'item',
  },
]
export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname.replace(/\/$/, ''),
    method = request.method,
    store = new Store(env.DB)
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  if (!(await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })).success)
    throw new HttpError(429, 'Too many requests')
  if (path === '/nft/health' && method === 'GET')
    return json({
      status: 'ok',
      service: 'nft-service',
      capabilities: {
        network: 'stellar:pubnet',
        networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
        rpcUrl: env.STELLAR_RPC_URL,
        paymentTokenAddress: env.STELLAR_PAYMENT_TOKEN,
        pinningConfigured: true,
        stellarConfigured: Boolean(
          env.STELLAR_SPONSOR_SECRET && env.NFT_COLLECTION_WASM_HASH,
        ),
        storageMode: 'r2',
      },
    })
  if (path === '/gate/health' && method === 'GET')
    return json({
      status: 'ok',
      service: 'agent-auth',
      product: 'zexvro-gate',
      issuer: 'https://zexvro-platform-api.zexvro.workers.dev/gate',
      basePath: '/gate',
    })
  if (path === '/gate/v1/sdk/captcha.js' && method === 'GET')
    return new Response(
      (await import('../../../packages/agent-auth-sdk/src/captcha.js')).default,
      {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public,max-age=300',
        },
      },
    )
  const assetId = path.match(/^\/nft\/v1\/assets\/([a-f0-9]{64})$/)?.[1]
  if (assetId && ['GET', 'HEAD'].includes(method)) {
    const object =
      method === 'HEAD'
        ? await env.NFT_MEDIA.head(assetId)
        : await env.NFT_MEDIA.get(assetId, { onlyIf: request.headers })
    if (!object) throw new HttpError(404, 'Asset not found')
    const headers = {
      'Content-Type':
        object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public,max-age=31536000,immutable',
      ETag: object.httpEtag,
      'Access-Control-Allow-Origin': '*',
    }
    if (method === 'HEAD') return new Response(null, { headers })
    if (!('body' in object) || !(object.body instanceof ReadableStream))
      return new Response(null, { status: 304, headers })
    return new Response(object.body, { headers })
  }
  if (
    path === '/nft' ||
    path.startsWith('/nft/') ||
    path === '/gate' ||
    path.startsWith('/gate/') ||
    path === '/depin' || path.startsWith('/depin/')
  )
    return (
      await import('./services').catch((error) => {
        console.error(
          JSON.stringify({
            event: 'service_module_failed',
            message: error instanceof Error ? error.stack : 'unknown',
          }),
        )
        throw error
      })
    ).serviceFetch(request)
  if (method === 'GET' && path === '/api/health')
    return json({
      status: 'ok',
      database: 'd1',
      release: env.RELEASE_SHA,
      reset: true,
      auth: 'd1-accounts',
      version: 1,
    })
  if (path === '/api/waitlist' && method === 'POST') {
    if (!(await env.AUTH_RATE_LIMITER.limit({ key: `waitlist:${ip}` })).success)
      throw new HttpError(429, 'Too many requests')
    const data = await readBody(request),
      email = String(data.email || '')
        .trim()
        .toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new HttpError(400, 'Enter a valid email')
    await env.DB.prepare(
      'INSERT INTO waitlist(email,source,created_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING',
    )
      .bind(
        email,
        String(data.source || 'landing').slice(0, 64),
        Math.floor(Date.now() / 1000),
      )
      .run()
    return json({ status: 'joined' }, 201)
  }
  if (method === 'GET' && /^\/api\/invite\/[^/]+$/.test(path))
    return json(
      await previewInvite(env.DB, decodeURIComponent(path.split('/').at(-1)!)),
    )
  if (path.startsWith('/auth/'))
    return json(await authRoute(path, request, await readBody(request), env))
  const user = await authenticate(request, env)
  if (
    !(await env.API_RATE_LIMITER.limit({ key: `user:${user.username}` }))
      .success
  )
    throw new HttpError(429, 'Too many requests')
  if (
    !['GET', 'HEAD'].includes(method) &&
    !(await env.WRITE_RATE_LIMITER.limit({ key: user.username })).success
  )
    throw new HttpError(429, 'Write rate exceeded')
  const body = await readBody(request),
    limit = pageSize(url.searchParams.get('limit')),
    cursor = url.searchParams.get('cursor') || ''
  if (cursor.length > 256) throw new HttpError(400, 'Invalid cursor')
  // D1 handles records; browser snarkjs handles proofs until compute is configured.
  if (path.startsWith('/api/zk-worker/')) {
    const message = 'Remote proving is not configured. Proofs run locally in your browser.'
    if (path === '/api/zk-worker/status' && method === 'GET')
      return json({configured:false,provider:'browser',state:'unconfigured',online:false,message})
    if (['/api/zk-worker/prove','/api/zk-worker/merkle','/api/zk-worker/settle'].includes(path) && method === 'POST')
      return json({mode:'browser_fallback',reason:'worker_unconfigured',message})
    if (['/api/zk-worker/start','/api/zk-worker/stop'].includes(path) && method === 'POST')
      throw new HttpError(503,message)
    throw new HttpError(404,'Prover job not found')
  }
  const inviteResult = await inviteRoute(path, method, body, env, user)
  if (inviteResult !== null) return json(inviteResult)
  const creditResult = await creditRoute(path, method, body, url, env, user)
  if (creditResult !== null) return json(creditResult)
  if (path === '/api/workspaces' || path === '/api/me/workspaces') {
    if (method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT w.id,w.data FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.identity IN (${user.identities.map(() => '?').join(',')}) AND m.workspace_id>? GROUP BY m.workspace_id ORDER BY m.workspace_id LIMIT ?`,
      )
        .bind(...user.identities, cursor, limit + 1)
        .all<{ id: string; data: string }>()
      const page = rows.results.slice(0, limit)
      return json({
        workspaces: page.map((r) => JSON.parse(r.data)),
        nextCursor: rows.results.length > limit ? page.at(-1)!.id : null,
      })
    }
    if (method === 'POST') {
      const id = recordId(body.workspaceId || body.id, 'ws'),
        name = required(body.name, 'name'),
        now = Date.now()
      const workspace = {
        id,
        workspaceId: id,
        ownerId: user.username,
        name,
        slug: id,
        plan: 'Team workspace',
        createdAt: now,
        settings: { environment: 'testnet', defaultNetwork: 'Stellar Testnet' },
        members: [
          {
            id: user.username,
            email: user.email || '',
            name: user.displayName,
            role: 'Owner',
            status: 'active',
            joinedAt: now,
          },
        ],
      }
      return json({
        status: 'success',
        workspace: await store.createWorkspace(
          workspace,
          user.username,
          Number(env.CREDITS_STARTER_GRANT),
        ),
      })
    }
  }
  const wsMatch = path.match(/^\/api\/workspaces\/([^/]+)(?:\/(.*))?$/)
  if (wsMatch) {
    const id = decodeURIComponent(wsMatch[1]),
      action = wsMatch[2] || ''
    await store.authorize(
      id,
      user.identities,
      method !== 'GET' && action !== 'leave',
      ['', 'environment', 'invite'].includes(action) && method !== 'GET',
    )
    const workspace = await store.workspace(id)
    if (!workspace) throw new HttpError(404, 'Workspace not found')
    const memberAction = action.match(/^members\/([^/]+)(?:\/role)?$/)
    if (
      (memberAction && ['POST', 'DELETE'].includes(method)) ||
      (action === 'leave' && method === 'POST')
    ) {
      const memberId =
        action === 'leave'
          ? user.username
          : decodeURIComponent(memberAction![1])
      if (memberId === workspace.ownerId)
        throw new HttpError(
          403,
          'Owner must transfer ownership before leaving or changing their role',
        )
      if (action !== 'leave')
        await store.authorize(id, user.identities, true, true)
      const members = Array.isArray(workspace.members)
        ? (workspace.members as Doc[])
        : []
      if (!members.some((m) => m.id === memberId))
        throw new HttpError(404, 'Member not found')
      const remove = method === 'DELETE' || action === 'leave'
      if (
        !remove &&
        !['Admin', 'Developer', 'Finance', 'Viewer', 'Agent'].includes(
          String(body.role),
        )
      )
        throw new HttpError(400, 'Invalid role')
      const updated = {
        ...workspace,
        members: remove
          ? members.filter((m) => m.id !== memberId)
          : members.map((m) =>
              m.id === memberId ? { ...m, role: body.role } : m,
            ),
      }
      return json({
        status: 'success',
        workspace: await store.updateWorkspace(
          workspace,
          updated,
          user.username,
        ),
      })
    }
    if (action === 'members' && method === 'GET')
      return json({ members: workspace.members || [] })
    if (!action) {
      if (method === 'GET') return json({ workspace })
      if (method === 'PUT') {
        // Roster changes go through dedicated invite/accept endpoints; no client-supplied privileges.
        const allowed = ['name', 'settings', 'description', 'icon']
        const updates: Doc = {}
        for (const key of allowed) if (key in body) updates[key] = body[key]
        if ('name' in updates) updates.name = required(updates.name, 'name')
        if (updates.settings) {
          if (
            typeof updates.settings !== 'object' ||
            Array.isArray(updates.settings)
          )
            throw new HttpError(400, 'Invalid settings')
          updates.settings = {
            ...(workspace.settings as Doc),
            ...(updates.settings as Doc),
          }
        }
        return json({
          status: 'success',
          workspace: await store.updateWorkspace(
            workspace,
            { ...workspace, ...updates },
            user.username,
          ),
        })
      }
      if (method === 'DELETE') {
        if ((await store.role(id, user.identities)) !== 'Owner')
          throw new HttpError(403, 'Only the owner may delete a workspace')
        await env.DB.prepare('DELETE FROM workspaces WHERE id=?').bind(id).run()
        return json({ status: 'success' })
      }
    }
    if (action === 'environment' && method === 'POST') {
      if (!['testnet', 'mainnet'].includes(String(body.environment)))
        throw new HttpError(400, 'Invalid environment')
      const settings = {
        ...(workspace.settings as Doc),
        environment: body.environment,
        defaultNetwork:
          body.environment === 'mainnet'
            ? 'Stellar Mainnet'
            : 'Stellar Testnet',
      }
      return json({
        status: 'success',
        environment: body.environment,
        workspace: await store.updateWorkspace(
          workspace,
          { ...workspace, settings },
          user.username,
        ),
      })
    }
    if (action === 'audit' && method === 'GET') {
      await store.requirePermission(id,user.identities,'audit.view')
      const projectId = url.searchParams.get('projectId')
      const rows = await env.DB.prepare(
        projectId
          ? 'SELECT id,data FROM audit_events WHERE workspace_id=? AND project_id=? AND id<? ORDER BY id DESC LIMIT ?'
          : 'SELECT id,data FROM audit_events WHERE workspace_id=? AND id<? ORDER BY id DESC LIMIT ?',
      )
        .bind(
          ...(projectId
            ? [id, projectId, cursor || '~', limit + 1]
            : [id, cursor || '~', limit + 1]),
        )
        .all<{ id: string; data: string }>()
      const page = rows.results.slice(0, limit)
      return json({
        workspaceId: id,
        events: page.map((r) => JSON.parse(r.data)),
        nextCursor: rows.results.length > limit ? page.at(-1)!.id : null,
      })
    }
    if (['credits', 'credits/ledger'].includes(action) && method === 'GET') {
      const recent = await env.DB.prepare(
        'SELECT id,data FROM credit_ledger WHERE workspace_id=? AND id<? ORDER BY id DESC LIMIT ?',
      )
        .bind(id, cursor || '~', action === 'credits' ? 10 : limit + 1)
        .all<{ id: string; data: string }>()
      if (action === 'credits/ledger')
        return json({
          workspaceId: id,
          events: recent.results
            .slice(0, limit)
            .map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
          nextCursor:
            recent.results.length > limit ? recent.results[limit - 1].id : null,
        })
      const balance = await env.DB.prepare(
        'SELECT balance,updated_at FROM credit_balances WHERE workspace_id=?',
      )
        .bind(id)
        .first<{ balance: number; updated_at: number }>()
      const environment = (workspace.settings as Doc)?.environment || 'testnet'
      return json({
        credits: {
          workspaceId: id,
          balance: balance?.balance || 0,
          currency: 'ZCR',
          updatedAt: balance?.updated_at,
        },
        environment,
        burnsOnUse: environment === 'mainnet',
        recent: recent.results.map((r) => ({
          id: r.id,
          ...JSON.parse(r.data),
        })),
      })
    }
  }
  if (path === '/api/employees/bulk' && method === 'POST') {
    const workspaceId = required(body.workspaceId, 'workspaceId')
    await store.requirePermission(workspaceId,user.identities,'finance.manage')
    let rows: unknown = body.employees
    if (!Array.isArray(rows)) {
      try {
        rows = parseCsv(String(body.csv || ''), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          max_record_size: 65536,
        })
      } catch {
        throw new HttpError(400, 'Invalid CSV')
      }
    }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 25)
      throw new HttpError(400, 'Submit between 1 and 25 employees per batch')
    const now = Date.now(),
      employees = rows.map((value: unknown) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new HttpError(400, 'Invalid employee')
        const row = value as Doc,
          id = recordId(row.employeeId || row.id, 'emp'),
          salary = Number(row.salary || 0)
        if (!Number.isFinite(salary) || salary < 0)
          throw new HttpError(400, 'Invalid salary')
        return {
          ...row,
          id,
          employeeId: id,
          workspaceId,
          salary,
          currency: row.currency || 'USDC',
          frequency: row.frequency || 'monthly',
          status: row.status || 'active',
          createdAt: now,
          updatedAt: now,
        }
      })
    await env.DB.batch([
      ...employees.map((employee) =>
        env.DB.prepare(
          'INSERT INTO records(kind,id,workspace_id,data,created_at) VALUES(?,?,?,?,?)',
        ).bind('employee', employee.id, workspaceId, encode(employee), now),
      ),
      store.audit(
        workspaceId,
        user.username,
        'employees.imported',
        String(employees.length),
      ),
    ])
    return json({ status: 'success', count: employees.length, employees })
  }
  for (const resource of resources) {
    if (path !== resource.path && !path.startsWith(`${resource.path}/`))
      continue
    const id =
      path === resource.path
        ? ''
        : decodeURIComponent(path.slice(resource.path.length + 1))
    if (id.includes('/')) break
    const previous = id ? await store.record(resource.kind, id) : null
    if (id && !previous) throw new HttpError(404, 'Record not found')
    const workspaceId = required(
      previous?.workspaceId ||
        body.workspaceId ||
        url.searchParams.get('workspaceId'),
      'workspaceId',
    )
    await store.requirePermission(workspaceId,user.identities,resource.kind==='project'
      ? method==='GET'?'workspace.view':method==='POST'?'project.create':method==='DELETE'?'project.delete':'project.edit'
      : method==='GET'?'finance.view':resource.kind==='run'?'finance.pay':'finance.manage')
    if (method === 'GET' && !id) {
      const page = await store.listRecords(
        resource.kind,
        workspaceId,
        limit,
        cursor,
      )
      return json({
        [resource.plural]: page.items,
        ...(resource.kind === 'taxonomy'
          ? {
              roles: page.items.filter((x) => x.type === 'role'),
              departments: page.items.filter((x) => x.type === 'department'),
            }
          : {}),
        nextCursor: page.nextCursor,
      })
    }
    if (method === 'GET' && id) return json({ [resource.singular]: previous })
    if ((method === 'POST' && !id) || (method === 'PUT' && id)) {
      const newId =
          id || recordId(body[resource.idKey] || body.id, resource.kind),
        now = Date.now()
      const doc: Doc = {
        ...previous,
        ...body,
        id: newId,
        [resource.idKey]: newId,
        workspaceId,
        createdAt: previous?.createdAt || now,
      }
      if (
        resource.kind === 'taxonomy' &&
        (!['role', 'department'].includes(String(doc.type)) ||
          !String(doc.name || '').trim())
      )
        throw new HttpError(400, 'Valid taxonomy type and name required')
      if (resource.kind === 'employee') {
        doc.salary = Number(doc.salary || 0)
        if (!Number.isFinite(doc.salary) || Number(doc.salary) < 0)
          throw new HttpError(400, 'Invalid salary')
        doc.currency ??= 'USDC'
        doc.frequency ??= 'monthly'
        doc.status ??= 'active'
      }
      if (resource.kind === 'run') {
        doc.status ??= 'pending_approval'
        doc.createdBy = previous?.createdBy || user.username
      }
      return json({
        status: 'success',
        [resource.singular]: await store.saveRecord(
          resource.kind,
          doc,
          user.username,
          previous,
        ),
      })
    }
    if (method === 'DELETE' && id) {
      await env.DB.batch([
        env.DB.prepare(
          'DELETE FROM records WHERE kind=? AND id=? AND workspace_id=?',
        ).bind(resource.kind, id, workspaceId),
        store.audit(workspaceId, user.username, `${resource.kind}.deleted`, id),
      ])
      return json({ status: 'success' })
    }
  }
  if (path === '/api/memory') {
    if (method === 'GET') {
      const memory =
        decode(
          await env.DB.prepare('SELECT data FROM user_memory WHERE username=?')
            .bind(user.username)
            .first<{ data: string }>(),
        ) || {}
      return json({ username: user.username, memory })
    }
    if (method === 'POST') {
      if (
        !body.memory ||
        typeof body.memory !== 'object' ||
        Array.isArray(body.memory)
      )
        throw new HttpError(400, 'memory must be an object')
      // One SQL statement merges top-level fields without read-modify-write races.
      // json_patch intentionally treats null as deletion (documented API behavior).
      const row = await env.DB.prepare(
        "INSERT INTO user_memory(username,data) VALUES(?,json_patch('{}',?)) ON CONFLICT(username) DO UPDATE SET data=json_patch(user_memory.data,?) WHERE user_memory.data<>json_patch(user_memory.data,?) RETURNING data",
      )
        .bind(
          user.username,
          encode(body.memory),
          encode(body.memory),
          encode(body.memory),
        )
        .first<{ data: string }>()
      return json({
        status: 'success',
        memory:
          decode(row) ||
          decode(
            await env.DB.prepare(
              'SELECT data FROM user_memory WHERE username=?',
            )
              .bind(user.username)
              .first<{ data: string }>(),
          ) ||
          {},
      })
    }
  }
  for (const [base, kind, plural, singular] of [
    ['/api/proofs', 'proof', 'proofs', 'proof'],
    ['/api/zk-notes', 'note', 'notes', 'note'],
  ]) {
    if (path !== base && !path.startsWith(`${base}/`)) continue
    const id =
      path === base ? '' : decodeURIComponent(path.slice(base.length + 1))
    if (method === 'GET' && !id) {
      const projectId =
        url.searchParams.get('projectId') || url.searchParams.get('workspaceId')
      const rows = await env.DB.prepare(
        projectId
          ? 'SELECT id,data FROM personal_records INDEXED BY personal_project WHERE username=? AND kind=? AND project_id=? AND id>? ORDER BY id LIMIT ?'
          : 'SELECT id,data FROM personal_records WHERE username=? AND kind=? AND id>? ORDER BY id LIMIT ?',
      )
        .bind(
          ...(projectId
            ? [user.username, kind, projectId, cursor, limit + 1]
            : [user.username, kind, cursor, limit + 1]),
        )
        .all<{ id: string; data: string }>()
      return json({
        [plural]: rows.results.slice(0, limit).map((r) => JSON.parse(r.data)),
        nextCursor:
          rows.results.length > limit ? rows.results[limit - 1].id : null,
      })
    }
    if ((method === 'POST' && !id) || (method === 'PUT' && id)) {
      const key = id || uid(kind),
        old = decode(
          await env.DB.prepare(
            'SELECT data FROM personal_records WHERE username=? AND kind=? AND id=?',
          )
            .bind(user.username, kind, key)
            .first<{ data: string }>(),
        )
      if (kind === 'note' && method === 'PUT' && !old)
        throw new HttpError(404, 'Note not found')
      if (kind === 'note' && method === 'POST') {
        const commitment = required(body.commitment, 'commitment')
        const existing = decode(
          await env.DB.prepare(
            "SELECT data FROM personal_records WHERE username=? AND kind='note' AND json_extract(data,'$.commitment')=?",
          )
            .bind(user.username, commitment)
            .first<{ data: string }>(),
        )
        if (existing) return json({ status: 'success', note: existing })
      }
      const doc = {
        ...old,
        ...body,
        id: key,
        createdAt: old?.createdAt || Date.now(),
      }
      await env.DB.prepare(
        'INSERT INTO personal_records(username,kind,id,data) VALUES(?,?,?,?) ON CONFLICT(username,kind,id) DO UPDATE SET data=excluded.data WHERE personal_records.data<>excluded.data',
      )
        .bind(user.username, kind, key, encode(doc))
        .run()
      return json({ status: 'success', [singular]: doc })
    }
    if (method === 'DELETE' && id) {
      await env.DB.prepare(
        'DELETE FROM personal_records WHERE username=? AND kind=? AND id=?',
      )
        .bind(user.username, kind, id)
        .run()
      return json({ status: 'success' })
    }
  }
  if (
    path.startsWith('/api/zk-worker') ||
    path.includes('/credits/') ||
    path.startsWith('/api/invite') ||
    path.startsWith('/api/platform') ||
    path.startsWith('/auth/')
  )
    throw new HttpError(
      503,
      'This operation is unavailable after the reset',
    )
  throw new HttpError(404, 'Route not found')
}
export default {
  async scheduled(_event: ScheduledController, env: Env) {
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare('DELETE FROM depin_replays WHERE key IN (SELECT key FROM depin_replays WHERE expires_at<? LIMIT 1000)').bind(now),
      env.DB.prepare(
        'DELETE FROM sessions WHERE access_hash IN (SELECT access_hash FROM sessions WHERE refresh_expires<? LIMIT 1000)',
      ).bind(now),
      env.DB.prepare(
        'DELETE FROM device_codes WHERE device_code IN (SELECT device_code FROM device_codes WHERE expires_at<? LIMIT 1000)',
      ).bind(now),
      env.DB.prepare(
        'DELETE FROM gate_jti WHERE jti IN (SELECT jti FROM gate_jti WHERE expires_at<? LIMIT 1000)',
      ).bind(now),
      env.DB.prepare(
        'DELETE FROM gate_challenges WHERE id IN (SELECT id FROM gate_challenges WHERE expires_at<? LIMIT 1000)',
      ).bind(now - 86400000),
    ])
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .includes(origin || '')
    let response: Response
    try {
      const servicePath = new URL(request.url).pathname.match(
        /^\/(gate|nft|depin)(?:\/|$)/,
      )
      if (origin && !allowed && !servicePath)
        throw new HttpError(403, 'Origin not allowed')
      response =
        request.method === 'OPTIONS' && (allowed || !servicePath)
          ? new Response(null, { status: 204 })
          : await route(request, env)
    } catch (error) {
      if (error instanceof HttpError)
        response = json({ error: error.message }, error.status)
      else if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint')
      )
        response = json({ error: 'That record already exists' }, 409)
      else if (
        error instanceof Error &&
        error.message.includes('memory_size_limit')
      )
        response = json(
          { error: 'User memory exceeds 64 KiB; remove old fields first' },
          413,
        )
      else {
        console.error(
          JSON.stringify({
            event: 'request_failed',
            type: error instanceof Error ? error.name : 'unknown',
          }),
        )
        response = json({ error: 'Internal server error' }, 500)
      }
    }
    response = new Response(response.body, response)
    if (new URL(request.url).pathname.startsWith('/nft/v1/assets/'))
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      )
    if (allowed && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Vary', 'Origin')
    }
    if (!response.headers.has('Access-Control-Allow-Headers'))
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type,Authorization,Idempotency-Key,PAYMENT-SIGNATURE,X-Request-Id,X-Zexvro-Capability,X-Zexvro-Pop,X-Zexvro-Site-Key,X-Zexvro-Action,X-Zexvro-Expected-Htu',
      )
    if (!response.headers.has('Access-Control-Allow-Methods'))
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      )
    response.headers.set('X-Content-Type-Options', 'nosniff')
    if (response.status === 429) response.headers.set('Retry-After', '60')
    return response
  },
} satisfies ExportedHandler<Env>
