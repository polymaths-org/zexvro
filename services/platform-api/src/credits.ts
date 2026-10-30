import { HttpError, Store, encode, type Doc } from './store'
const rates: Record<string, number> = {
  'nft.collection_deploy': 50,
  'nft.mint_batch': 5,
  'morph.run': 10,
  'depin.request': 1,
  'zer0.prove': 20,
  'platform.premium': 1,
}
export const creditBalance = async (db: D1Database, id: string) => {
  const row = await db
    .prepare(
      'SELECT balance,updated_at FROM credit_balances WHERE workspace_id=?',
    )
    .bind(id)
    .first<{ balance: number; updated_at: number }>()
  if (!row) throw new HttpError(404, 'Credit account not found')
  return {
    workspaceId: id,
    balance: row.balance,
    currency: 'ZCR',
    updatedAt: row.updated_at,
  }
}
export async function applyCredit(
  db: D1Database,
  id: string,
  delta: number,
  ref: string,
  details: Doc,
) {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1000000)
    throw new HttpError(400, 'Invalid credit amount')
  if (!ref || ref.length > 256)
    throw new HttpError(
      400,
      'A reference of at most 256 characters is required',
    )
  const now = Date.now(),
    eventId = `${now}_${crypto.randomUUID()}`,
    event = {
      ...details,
      amount: Math.abs(delta),
      delta,
      createdAt: now,
      workspaceId: id,
      ref,
      id: eventId,
    }
  let result: D1Result<{ data: string }>[]
  try {
    result = await db.batch<{ data: string }>([
      db
        .prepare(
          "INSERT INTO credit_ledger(workspace_id,id,ref,data) SELECT ?,?,?,json_set(?,'$.balanceAfter',balance+?) FROM credit_balances WHERE workspace_id=? ON CONFLICT(workspace_id,ref) DO NOTHING",
        )
        .bind(id, eventId, ref, encode(event), delta, id),
      db
        .prepare(
          'SELECT data FROM credit_ledger WHERE workspace_id=? AND ref=?',
        )
        .bind(id, ref),
    ])
  } catch (error) {
    if (error instanceof Error && error.message.includes('credit_insufficient'))
      throw new HttpError(402, 'Insufficient credits')
    throw error
  }
  const row = result[1]?.results[0]
  if (!row) throw new HttpError(404, 'Credit account not found')
  const tx = JSON.parse(row.data) as Doc
  if (
    tx.delta !== delta ||
    tx.type !== details.type ||
    tx.service !== details.service ||
    tx.action !== details.action
  )
    throw new HttpError(409, 'Reference already used for a different operation')
  return {
    balance: await creditBalance(db, id),
    tx,
    idempotent: result[0]?.meta.changes === 0,
  }
}
function promoCode(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(value))
    throw new HttpError(400, 'Invalid promo code')
  return value.toUpperCase()
}
export async function promo(db: D1Database, value: unknown) {
  const code = promoCode(value),
    row = await db
      .prepare(
        'SELECT data,amount,remaining,starts_at,expires_at,status FROM promo_codes WHERE code=?',
      )
      .bind(code)
      .first<{
        data: string
        amount: number
        remaining: number
        starts_at: number
        expires_at: number | null
        status: string
      }>()
  if (!row) throw new HttpError(400, 'Invalid promo code')
  const valid =
    row.status === 'active' &&
    row.remaining > 0 &&
    row.starts_at <= Date.now() &&
    (!row.expires_at || row.expires_at > Date.now())
  return {
    ...JSON.parse(row.data),
    code,
    creditAmount: row.amount,
    remainingRedemptions: row.remaining,
    valid,
    status: valid ? 'active' : 'unavailable',
  }
}
export async function redeem(db: D1Database, id: string, code: unknown) {
  const normalized = promoCode(code)
  try {
    await db
      .prepare(
        'INSERT INTO promo_redemptions(code,workspace_id,created_at) VALUES(?,?,?)',
      )
      .bind(normalized, id, Date.now())
      .run()
  } catch (error) {
    if (error instanceof Error && /promo_invalid|UNIQUE/.test(error.message))
      throw new HttpError(400, 'Promo invalid, exhausted or already redeemed')
    throw error
  }
  const row = await db
    .prepare('SELECT id,data FROM credit_ledger WHERE workspace_id=? AND ref=?')
    .bind(id, `promo:${normalized}`)
    .first<{ id: string; data: string }>()
  return {
    balance: await creditBalance(db, id),
    tx: row ? { id: row.id, ...JSON.parse(row.data) } : null,
  }
}
export async function isPlatformAdmin(db: D1Database, id: string) {
  return Boolean(
    await db
      .prepare('SELECT 1 FROM platform_admins WHERE account_id=?')
      .bind(id)
      .first(),
  )
}
export async function creditRoute(
  path: string,
  method: string,
  body: Doc,
  url: URL,
  env: Env,
  user: {
    username: string
    email: string
    identities: string[]
    displayName?: string
  },
) {
  const store = new Store(env.DB)
  if (path === '/api/credits/packs' && method === 'GET')
    return {
      packs: [],
      purchaseMode: 'unconfigured',
      currency: 'ZCR',
      paymentAsset: 'XLM',
      custom: {
        enabled: false,
        min: 1,
        max: 1000000,
        unitPriceUsdc: 0.01,
        note: 'Credit checkout must be configured with the replacement NFT service before purchasing.',
      },
    }
  const match = path.match(
    /^\/api\/workspaces\/([^/]+)\/credits\/(consume|redeem|validate-promo|purchase)$/,
  )
  if (match) {
    const id = decodeURIComponent(match[1]!),
      action = match[2]!
    await store.authorize(id, user.identities, true, action !== 'consume')
    if (method !== 'POST') throw new HttpError(405, 'Use POST')
    if (action === 'purchase')
      throw new HttpError(
        503,
        'On-chain credit checkout is not configured after the reset; no charge or grant was made',
      )
    if (action === 'validate-promo') {
      const p = await promo(env.DB, body.code)
      const used = await env.DB.prepare(
        'SELECT 1 FROM promo_redemptions WHERE code=? AND workspace_id=?',
      )
        .bind(p.code, id)
        .first()
      return {
        ...p,
        valid: p.valid && !used,
        message: used
          ? 'Already redeemed'
          : p.valid
            ? 'Ready to redeem'
            : 'Promo unavailable',
        promo: p,
      }
    }
    if (action === 'redeem')
      return { status: 'success', ...(await redeem(env.DB, id, body.code)) }
    const service = String(body.service || ''),
      actionName = String(body.action || ''),
      key = actionName.startsWith(`${service}.`)
        ? actionName
        : `${service}.${actionName}`,
      cost = rates[key]
    if (!cost) throw new HttpError(400, 'Unknown service action')
    const workspace = await store.workspace(id),
      environment = (workspace?.settings as Doc)?.environment
    if (environment !== 'mainnet')
      return {
        status: 'success',
        charged: false,
        skipped: true,
        cost,
        balance: await creditBalance(env.DB, id),
      }
    const ref =
      typeof body.ref === 'string' && body.ref
        ? body.ref
        : `consume:${crypto.randomUUID()}`
    return {
      status: 'success',
      charged: true,
      cost,
      ...(await applyCredit(env.DB, id, -cost, ref, {
        type: 'consume',
        service,
        action: actionName,
        actorId: user.username,
        environment,
      })),
    }
  }
  if (path === '/api/platform/me' && method === 'GET')
    return {
      username: user.displayName || user.username,
      email: user.email,
      platformAdmin: await isPlatformAdmin(env.DB, user.username),
    }
  if (path.startsWith('/api/platform/')) {
    if (!(await isPlatformAdmin(env.DB, user.username)))
      throw new HttpError(403, 'Platform administrator access required')
    if (path === '/api/platform/analytics' && method === 'GET') {
      const row = await env.DB.prepare(
        "SELECT count(*) AS workspaceCount,count(DISTINCT w.owner_id) AS ownerCount,coalesce(sum(b.balance),0) AS totalZcrInCirculation,sum(CASE WHEN json_extract(w.data,'$.settings.environment')='mainnet' THEN 1 ELSE 0 END) AS mainnet FROM workspaces w LEFT JOIN credit_balances b ON b.workspace_id=w.id",
      ).first<{
        workspaceCount: number
        ownerCount: number
        totalZcrInCirculation: number
        mainnet: number
      }>()
      const promos = await env.DB.prepare(
        "SELECT count(*) AS total,sum(CASE WHEN status='active' AND remaining>0 AND (expires_at IS NULL OR expires_at>?) THEN 1 ELSE 0 END) AS active FROM promo_codes",
      )
        .bind(Date.now())
        .first<{ total: number; active: number }>()
      return {
        ...row,
        environmentCounts: {
          mainnet: row?.mainnet || 0,
          testnet: (row?.workspaceCount || 0) - (row?.mainnet || 0),
        },
        creditAccountCount: row?.workspaceCount || 0,
        promoCount: promos?.total || 0,
        activePromoCount: promos?.active || 0,
      }
    }
    if (path === '/api/platform/workspaces' && method === 'GET') {
      const rows = await env.DB.prepare(
        "SELECT w.id,w.data,b.balance,(SELECT count(*) FROM records INDEXED BY records_workspace WHERE kind='project' AND workspace_id=w.id) AS project_count FROM workspaces w LEFT JOIN credit_balances b ON b.workspace_id=w.id WHERE w.id>? ORDER BY w.id LIMIT 101",
      )
        .bind(url.searchParams.get('cursor') || '')
        .all<{
          id: string
          data: string
          balance: number
          project_count: number
        }>()
      return {
        workspaces: rows.results.slice(0, 100).map((r) => {
          const w = JSON.parse(r.data),
            members = Array.isArray(w.members) ? w.members : []
          return {
            ...w,
            workspaceId: r.id,
            memberCount: members.length,
            pendingInvites: (w.invitations || []).filter(
              (i: Doc) =>
                i.status === 'pending' && Number(i.expiresAt) > Date.now(),
            ).length,
            environment: w.settings?.environment || 'testnet',
            projectCount: r.project_count,
            zcrBalance: r.balance,
            services: [],
            roles: Object.fromEntries(
              ['Owner', 'Admin', 'Developer', 'Finance', 'Viewer', 'Agent'].map(
                (role) => [
                  role === 'Finance' ? 'finance' : role.toLowerCase() + 's',
                  members.filter((m: Doc) => m.role === role),
                ],
              ),
            ),
          }
        }),
        count: Math.min(rows.results.length, 100),
        nextCursor: rows.results.length > 100 ? rows.results[99]!.id : null,
      }
    }
    if (path === '/api/platform/waitlist' && method === 'GET') {
      const rows = await env.DB.prepare(
        'SELECT email,source,created_at FROM waitlist WHERE email>? ORDER BY email LIMIT 101',
      )
        .bind(url.searchParams.get('cursor') || '')
        .all<{ email: string; source: string; created_at: number }>()
      return {
        entries: rows.results.slice(0, 100),
        nextCursor: rows.results.length > 100 ? rows.results[99]!.email : null,
      }
    }
    if (path === '/api/platform/credits/grant' && method === 'POST') {
      const amount = Number(body.amount)
      if (amount <= 0) throw new HttpError(400, 'Positive amount required')
      return {
        status: 'success',
        ...(await applyCredit(
          env.DB,
          String(body.workspaceId || ''),
          amount,
          String(body.ref || `admin:${crypto.randomUUID()}`),
          {
            type: 'grant',
            actorId: user.username,
            reason: String(body.reason || 'platform_admin_grant'),
          },
        )),
      }
    }
    if (path === '/api/platform/promo-codes' && method === 'POST') {
      const code = body.code
          ? promoCode(body.code)
          : crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase(),
        amount = Number(body.creditAmount),
        max = Number(body.maxRedemptions || 1)
      if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 1000000 ||
        !Number.isSafeInteger(max) ||
        max < 1 ||
        max > 1000000
      )
        throw new HttpError(400, 'Invalid amount or redemption count')
      const starts = Number(body.startsAt || 0),
        expires = body.expiresAt
          ? Number(body.expiresAt)
          : body.expiresInDays
            ? Date.now() + Number(body.expiresInDays) * 86400000
            : null
      if (
        !Number.isFinite(starts) ||
        (expires !== null && !Number.isFinite(expires))
      )
        throw new HttpError(400, 'Invalid dates')
      const p = {
        code,
        creditAmount: amount,
        maxRedemptions: max,
        maxPerWorkspace: 1,
        status: 'active',
        createdAt: Date.now(),
        createdBy: user.username,
        note: String(body.note || '').slice(0, 1000),
        startsAt: starts,
        expiresAt: expires,
      }
      await env.DB.prepare(
        'INSERT INTO promo_codes(code,amount,remaining,starts_at,expires_at,data) VALUES(?,?,?,?,?,?)',
      )
        .bind(code, amount, max, starts, expires, encode(p))
        .run()
      return { status: 'success', promo: p }
    }
    if (path === '/api/platform/promo-codes' && method === 'GET') {
      const cursor = url.searchParams.get('cursor') || '',
        rows = await env.DB.prepare(
          'SELECT code,data,remaining,status FROM promo_codes WHERE code>? ORDER BY code LIMIT 101',
        )
          .bind(cursor)
          .all<{
            code: string
            data: string
            remaining: number
            status: string
          }>()
      return {
        promos: rows.results
          .slice(0, 100)
          .map((row) => ({
            ...JSON.parse(row.data),
            remainingRedemptions: row.remaining,
            status: row.status,
          })),
        nextCursor: rows.results.length > 100 ? rows.results[99]!.code : null,
      }
    }
    const disable = path.match(
      /^\/api\/platform\/promo-codes\/([^/]+)\/disable$/,
    )
    if (disable && method === 'POST') {
      const code = promoCode(decodeURIComponent(disable[1]!))
      await env.DB.prepare(
        "UPDATE promo_codes SET status='disabled' WHERE code=? AND status<>'disabled'",
      )
        .bind(code)
        .run()
      return { status: 'success', promo: await promo(env.DB, code) }
    }
  }
  return null
}
