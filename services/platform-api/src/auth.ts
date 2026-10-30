import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { HttpError, type Doc } from './store'
const accessLife = 60 * 60 * 1000,
  refreshLife = 30 * 24 * 60 * 60 * 1000
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex')
const randomToken = (prefix: string) =>
  `${prefix}_${randomBytes(32).toString('base64url')}`
// OWASP's equivalent low-memory scrypt profile: N=2^14, r=8, p=5 (16 MiB).
async function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  )
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$16384$8$5$${salt}$${(await derive(password, salt)).toString('hex')}`
}
async function checkPassword(password: string, stored: string) {
  const parts = stored.split('$')
  const key = await derive(password, parts[4])
  const expected = Buffer.from(parts[5], 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}
interface Account {
  id: string
  username: string
  email: string
  password_hash: string
  recovery_hash: string
  version: number
}
function text(body: Doc, key: string, max = 256) {
  const value = body[key]
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new HttpError(400, `Invalid ${key}`)
  return value.trim()
}
function password(body: Doc) {
  const value = body.password
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new HttpError(400, 'Password must be between 12 and 128 characters')
  return value
}
export async function createSession(env: Env, account: Account) {
  const token = randomToken('zx'),
    refreshToken = randomToken('zxr'),
    now = Date.now(),
    expiresAt = now + accessLife
  const result = await env.DB.prepare(
    'INSERT INTO sessions(access_hash,refresh_hash,user_id,version,access_expires,refresh_expires,created_at) SELECT ?,?,id,version,?,?,? FROM accounts WHERE id=? AND version=?',
  )
    .bind(
      tokenHash(token),
      tokenHash(refreshToken),
      expiresAt,
      now + refreshLife,
      now,
      account.id,
      account.version,
    )
    .run()
  if (!result.meta.changes)
    throw new HttpError(401, 'Account changed; sign in again')
  // Bound each user's session storage, including expired rows, without a global scan.
  await env.DB.prepare(
    'DELETE FROM sessions WHERE user_id=? AND access_hash NOT IN (SELECT access_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 10)',
  )
    .bind(account.id, account.id)
    .run()
  return {
    username: account.username,
    email: account.email,
    token,
    refreshToken,
    expiresAt,
  }
}
export async function authenticate(request: Request, env: Env) {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (zx_[A-Za-z0-9_-]{43})$/)?.[1]
  if (!token) throw new HttpError(401, 'Sign in to continue')
  const user = await env.DB.prepare(
    'SELECT a.id,a.username,a.email FROM sessions s JOIN accounts a ON a.id=s.user_id AND a.version=s.version WHERE s.access_hash=? AND s.access_expires>?',
  )
    .bind(tokenHash(token), Date.now())
    .first<{ id: string; username: string; email: string }>()
  if (!user) throw new HttpError(401, 'Session expired or signed out')
  // Email remains unverified: it is a login identifier, never a membership credential.
  return {
    username: user.id,
    displayName: user.username,
    email: user.email,
    identities: [user.id.toLowerCase()],
    token,
  }
}
export async function authRoute(
  path: string,
  request: Request,
  body: Doc,
  env: Env,
) {
  if (request.method !== 'POST') throw new HttpError(405, 'Use POST')
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  if (path === '/auth/token') {
    const code = text(body, 'device_code', 100),
      hash = tokenHash(code),
      now = Date.now()
    if (!(await env.DEVICE_RATE_LIMITER.limit({ key: hash })).success)
      throw new HttpError(400, 'slow_down')
    const row = await env.DB.prepare(
      'SELECT status,username,account_version,expires_at FROM device_codes WHERE device_code=?',
    )
      .bind(hash)
      .first<{
        status: string
        username: string
        account_version: number
        expires_at: number
      }>()
    if (!row || row.expires_at <= now) throw new HttpError(400, 'expired_token')
    if (row.status === 'pending')
      throw new HttpError(400, 'authorization_pending')
    const consumed = await env.DB.prepare(
      "DELETE FROM device_codes WHERE device_code=? AND status<>'pending' AND expires_at>? RETURNING device_code",
    )
      .bind(hash, now)
      .first()
    if (!consumed) throw new HttpError(400, 'expired_token')
    if (row.status === 'rejected') throw new HttpError(400, 'access_denied')
    const account = await env.DB.prepare(
      'SELECT * FROM accounts WHERE id=? AND version=?',
    )
      .bind(row.username, row.account_version)
      .first<Account>()
    if (!account) throw new HttpError(400, 'expired_token')
    const session = await createSession(env, account)
    return {
      access_token: session.token,
      refresh_token: session.refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      username: session.username,
    }
  }
  if (!(await env.AUTH_RATE_LIMITER.limit({ key: `ip:${ip}` })).success)
    throw new HttpError(429, 'Too many sign-in attempts; try again shortly')
  if (path === '/auth/device-code') {
    const deviceCode = randomToken('device'),
      userCode = randomBytes(4)
        .toString('hex')
        .toUpperCase()
        .replace(/^(.{4})/, '$1-'),
      expires = Date.now() + 300000
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM device_codes WHERE device_code IN (SELECT device_code FROM device_codes WHERE expires_at<? LIMIT 1000)',
      ).bind(Date.now()),
      env.DB.prepare(
        'INSERT INTO device_codes(device_code,user_code,expires_at) VALUES(?,?,?)',
      ).bind(tokenHash(deviceCode), userCode, expires),
    ])
    return {
      device_code: deviceCode,
      user_code: userCode,
      expires_in: 300,
      interval: 10,
      verification_uri: 'https://console.zexvro.in',
      verification_uri_complete: `https://console.zexvro.in/dashboard?code=${userCode}`,
    }
  }
  if (path === '/auth/activate') {
    const user = await authenticate(request, env),
      code = text(body, 'user_code', 20).toUpperCase(),
      action = text(body, 'action', 10)
    if (!['approve', 'reject'].includes(action))
      throw new HttpError(400, 'Invalid action')
    const result = await env.DB.prepare(
      "UPDATE device_codes SET status=?,username=?,account_version=(SELECT version FROM accounts WHERE id=?) WHERE user_code=? AND status='pending' AND expires_at>? RETURNING device_code",
    )
      .bind(
        action === 'approve' ? 'authorized' : 'rejected',
        user.username,
        user.username,
        code,
        Date.now(),
      )
      .first()
    if (!result)
      throw new HttpError(
        400,
        'Invalid, expired or already used authorization code',
      )
    return { status: 'success' }
  }
  if (path === '/auth/signup') {
    // Public sign-ups stay closed while ZEXVRO is on the waitlist. Existing accounts keep signing in.
    if (String(env.SIGNUPS_OPEN) !== 'true')
      throw new HttpError(403, 'Sign-ups are on the waitlist. Join at zexvro.in to be invited.')
    const username = text(body, 'username', 32).toLowerCase(),
      email = text(body, 'email', 254).toLowerCase()
    if (!/^[a-z0-9_.-]{3,32}$/.test(username))
      throw new HttpError(
        400,
        'Username must be 3–32 letters, numbers, dots, underscores or hyphens',
      )
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, 'Enter a valid email')
    const secret = password(body),
      recoveryKey = randomToken('recovery'),
      hash = await hashPassword(secret)
    try {
      await env.DB.prepare(
        'INSERT INTO accounts(id,username,email,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)',
      )
        .bind(
          crypto.randomUUID(),
          username,
          email,
          hash,
          tokenHash(recoveryKey),
          Date.now(),
        )
        .run()
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE'))
        throw new HttpError(409, 'That username or email is already registered')
      throw error
    }
    return { UserConfirmed: true, recoveryKey }
  }
  if (path === '/auth/signin') {
    const login = text(body, 'username', 254).toLowerCase(),
      secret = body.password
    if (typeof secret !== 'string' || !secret || secret.length > 128)
      throw new HttpError(400, 'Enter your password')
    if (
      !(
        await env.AUTH_RATE_LIMITER.limit({
          key: `account:${tokenHash(login)}`,
        })
      ).success
    )
      throw new HttpError(429, 'Too many sign-in attempts; try again shortly')
    const account = await env.DB.prepare(
      'SELECT * FROM accounts WHERE username=? OR email=? LIMIT 1',
    )
      .bind(login, login)
      .first<Account>()
    // Perform the same KDF for unknown identities; never expose account existence on login.
    const valid = await checkPassword(
      secret,
      account?.password_hash ||
        'scrypt$16384$8$5$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000',
    )
    if (!account || !valid)
      throw new HttpError(401, 'Incorrect username/email or password')
    return createSession(env, account)
  }
  if (path === '/auth/refresh') {
    const old = text(body, 'refreshToken', 100),
      token = randomToken('zx'),
      refreshToken = randomToken('zxr'),
      now = Date.now()
    const row = await env.DB.prepare(
      'UPDATE sessions SET access_hash=?,refresh_hash=?,access_expires=?,refresh_expires=? WHERE refresh_hash=? AND refresh_expires>? AND version=(SELECT version FROM accounts WHERE id=sessions.user_id) RETURNING user_id',
    )
      .bind(
        tokenHash(token),
        tokenHash(refreshToken),
        now + accessLife,
        now + refreshLife,
        tokenHash(old),
        now,
      )
      .first<{ user_id: string }>()
    if (!row) throw new HttpError(401, 'Session expired; sign in again')
    const account = await env.DB.prepare(
      'SELECT username,email FROM accounts WHERE id=?',
    )
      .bind(row.user_id)
      .first<{ username: string; email: string }>()
    return { ...account, token, refreshToken, expiresAt: now + accessLife }
  }
  if (path === '/auth/signout') {
    const user = await authenticate(request, env)
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?')
      .bind(user.username)
      .run()
    return { status: 'success' }
  }
  if (path === '/auth/reset-password') {
    const login = text(body, 'username', 254).toLowerCase(),
      recoveryKey = text(body, 'recoveryKey', 100),
      secret = password(body)
    const account = await env.DB.prepare(
      'SELECT id,version FROM accounts WHERE (username=? OR email=?) AND recovery_hash=?',
    )
      .bind(login, login, tokenHash(recoveryKey))
      .first<{ id: string; version: number }>()
    if (!account) throw new HttpError(400, 'Invalid account or recovery key')
    const newKey = randomToken('recovery'),
      hash = await hashPassword(secret)
    const results = await env.DB.batch([
      env.DB.prepare(
        'UPDATE accounts SET password_hash=?,recovery_hash=?,version=version+1 WHERE id=? AND recovery_hash=? AND version=? RETURNING id',
      ).bind(
        hash,
        tokenHash(newKey),
        account.id,
        tokenHash(recoveryKey),
        account.version,
      ),
      env.DB.prepare(
        'DELETE FROM sessions WHERE user_id=? AND version<>(SELECT version FROM accounts WHERE id=?)',
      ).bind(account.id, account.id),
    ])
    if (!results[0].results.length)
      throw new HttpError(400, 'Recovery key already used')
    return { status: 'success', recoveryKey: newKey }
  }
  throw new HttpError(404, 'Auth route not found')
}
