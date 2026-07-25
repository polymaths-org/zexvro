/**
 * ZEXVRO account session store (not LLM provider keys).
 * File: ~/.local/share/morph/zexvro-auth.json  mode 0600
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { morphDataDir, zexvroAuthPath } from './paths.mjs'

/**
 * @typedef {object} ZexvroSession
 * @property {string} accessToken
 * @property {string} [refreshToken]
 * @property {string} [idToken]
 * @property {string} [username]
 * @property {string} [tokenType]
 * @property {string} [apiBase]
 * @property {string} [workspaceId]
 * @property {string} [workspaceName]
 * @property {string} [projectId]
 * @property {string} [projectName]
 * @property {number} [authenticatedAt]
 * @property {number} [expiresAt]
 */

export function loadSession() {
  const path = zexvroAuthPath()
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    if (!data?.accessToken) return null
    return /** @type {ZexvroSession} */ (data)
  } catch {
    return null
  }
}

/** @param {ZexvroSession} session */
export function saveSession(session) {
  const path = zexvroAuthPath()
  mkdirSync(dirname(path), { recursive: true })
  const next = {
    ...session,
    tokenType: session.tokenType || 'Bearer',
    authenticatedAt: session.authenticatedAt || Date.now(),
  }
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
  try {
    chmodSync(path, 0o600)
  } catch {
    /* ignore */
  }
  return next
}

/** @param {Partial<ZexvroSession>} patch */
export function updateSession(patch) {
  const cur = loadSession()
  if (!cur) throw new Error('Not logged in. Run: morph login')
  return saveSession({ ...cur, ...patch })
}

export function clearSession() {
  const path = zexvroAuthPath()
  if (existsSync(path)) unlinkSync(path)
}

export function isLoggedIn() {
  const s = loadSession()
  return Boolean(s?.accessToken)
}

export function getAccessToken() {
  // Env override for CI / break-glass (still prefer login store)
  const env = (process.env.ZEXVRO_ACCESS_TOKEN || '').trim()
  if (env) return env
  return loadSession()?.accessToken || ''
}

export function requireToken() {
  const t = getAccessToken()
  if (!t) {
    throw new Error('Not logged in to ZEXVRO. Run: morph login')
  }
  return t
}

export function sessionSummary() {
  const s = loadSession()
  if (!s) {
    return {
      loggedIn: false,
      hint: 'morph login',
      authPath: zexvroAuthPath(),
      dataDir: morphDataDir(),
    }
  }
  return {
    loggedIn: true,
    username: s.username || '(unknown)',
    workspaceId: s.workspaceId || null,
    workspaceName: s.workspaceName || null,
    projectId: s.projectId || null,
    projectName: s.projectName || null,
    apiBase: s.apiBase || null,
    authenticatedAt: s.authenticatedAt
      ? new Date(s.authenticatedAt).toISOString()
      : null,
    tokenSet: true,
    authPath: zexvroAuthPath(),
  }
}
