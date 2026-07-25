/**
 * Authenticated ZEXVRO platform client for Morph.
 */
import { defaultApiBase, defaultDepinUrl, defaultGateUrl, defaultNftUrl } from './paths.mjs'
import { getAccessToken, loadSession, requireToken } from './zexvro-store.mjs'
import { resolveWorkspaceContext } from './project-bind.mjs'

export function apiBase() {
  return (loadSession()?.apiBase || defaultApiBase()).replace(/\/$/, '')
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  const ct = res.headers.get('content-type') || ''
  let body
  if (ct.includes('application/json')) body = await res.json().catch(() => null)
  else body = await res.text().catch(() => '')
  return { status: res.status, ok: res.ok, body }
}

function authHeaders(extra = {}) {
  const token = requireToken()
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...extra,
  }
}

export async function listWorkspaces() {
  const r = await httpJson(`${apiBase()}/api/workspaces`, {
    headers: authHeaders(),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body,
      note:
        r.status === 404
          ? 'Workspaces API may be on a newer backend route — set workspace with: morph use <id>'
          : 'Failed to list workspaces',
    }
  }
  const list = r.body?.workspaces || r.body || []
  return { ok: true, workspaces: Array.isArray(list) ? list : [] }
}

/**
 * Create a workspace. Body: { name, plan? }
 * @param {{ name: string, plan?: string }} input
 */
export async function createWorkspace(input) {
  const name = String(input?.name || '').trim()
  if (!name) {
    return { ok: false, error: 'Workspace name is required' }
  }
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace'
  const r = await httpJson(`${apiBase()}/api/workspaces`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      slug,
      plan: input.plan || 'Team workspace',
    }),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body || 'Create workspace failed',
    }
  }
  const workspace = r.body?.workspace || r.body
  return { ok: true, workspace }
}

export async function listProjects(workspaceId) {
  const ws = encodeURIComponent(workspaceId)
  const r = await httpJson(`${apiBase()}/api/projects?workspaceId=${ws}`, {
    headers: authHeaders(),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body,
    }
  }
  const list = r.body?.projects || r.body || []
  return { ok: true, projects: Array.isArray(list) ? list : [] }
}

/**
 * Create a project under a workspace.
 * @param {{ workspaceId: string, name: string, description?: string, network?: string }} input
 */
export async function createProject(input) {
  const workspaceId = String(input?.workspaceId || '').trim()
  const name = String(input?.name || '').trim()
  if (!workspaceId) return { ok: false, error: 'workspaceId is required' }
  if (!name) return { ok: false, error: 'Project name is required' }
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'project'
  const r = await httpJson(`${apiBase()}/api/projects`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      workspaceId,
      name,
      slug,
      description: input.description || '',
      network: input.network || 'testnet',
      lifecycle: 'draft',
      health: 'setup_required',
      enabledServices: [],
    }),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body || 'Create project failed',
    }
  }
  const project = r.body?.project || r.body
  return { ok: true, project }
}

/** Platform memory document (dashboard + Morph shared). */
export async function memoryGetAll() {
  const r = await httpJson(`${apiBase()}/api/memory`, {
    headers: authHeaders(),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body,
    }
  }
  return {
    ok: true,
    username: r.body?.username,
    memory: r.body?.memory || {},
  }
}

/** Merge keys into platform memory (same as dashboard memoryApi.update). */
export async function memoryPut(patch) {
  if (!patch || typeof patch !== 'object') {
    return { ok: false, error: 'memory patch object required' }
  }
  const r = await httpJson(`${apiBase()}/api/memory`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ memory: patch }),
  })
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.body?.error_description || r.body?.error || r.body,
    }
  }
  return { ok: true, memory: r.body?.memory || {}, status: r.body?.status }
}

export async function memoryGetKey(key) {
  const all = await memoryGetAll()
  if (!all.ok) return all
  return {
    ok: true,
    key,
    value: all.memory?.[key],
    username: all.username,
  }
}

export function serviceUrls() {
  return {
    api: apiBase(),
    gate: defaultGateUrl(),
    nft: defaultNftUrl(),
    depin: defaultDepinUrl(),
  }
}

export function platformContext() {
  const session = loadSession()
  const token = getAccessToken()
  const ctx = resolveWorkspaceContext(session)
  return {
    loggedIn: Boolean(token),
    username: session?.username || null,
    ...ctx,
    urls: serviceUrls(),
    hasGateAdmin: Boolean(
      (process.env.ZEXVRO_GATE_ADMIN_KEY || process.env.GATE_ADMIN_API_KEY || '').trim(),
    ),
  }
}
