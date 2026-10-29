import {runtimeValue} from '../../lib/runtimeConfig';
/**
 * Client for ZEXVRO Gate / REQWID (Agent Auth).
 * Production: set VITE_AGENT_AUTH_API_URL=https://zexvro-platform-api.zexvro.workers.dev/gate
 * Local dev: Vite proxies /api/agent-auth → :4103
 *
 * If VITE_* is missing on a hosted console host, fall back to production Gate
 * so Cloudflare Pages never treats SPA HTML as JSON.
 */

function resolveGateApiBase(): string {
  const fromEnv = String(runtimeValue('VITE_AGENT_AUTH_API_URL') || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // Hosted console / marketing — never use relative /api/agent-auth (SPA shell)
    if (
      host === 'console.zexvro.in' ||
      host.endsWith('.zexvro.pages.dev') ||
      host.endsWith('.pages.dev') ||
      host === 'zexvro.in' ||
      host === 'www.zexvro.in'
    ) {
      return 'https://zexvro-platform-api.zexvro.workers.dev/gate'
    }
  }

  // Shared Cloudflare production default (override explicitly for a local API).
  return 'https://zexvro-platform-api.zexvro.workers.dev/gate'
}

const GATE_API_BASE = resolveGateApiBase()

export type GateStatus = {
  status: string
  service: string
  product: string
  issuer: string
  capabilities: {
    channels: string[]
    policyModes: string[]
    proofTypes: string[]
    captchaTypes?: string[]
    stellar: Record<string, boolean>
    depinBindingClaims: string[]
  }
  securityProfile?: {
    allowDevHuman: boolean
    allowDevHmac: boolean
    isProd: boolean
    humanSoftConfirmIsSecurity: boolean
    popEnforcedOnVerify: boolean
    note: string
  }
  sites: number
  agents: number
  header: string
  stateBackend?: string
  adminRequireAuth?: boolean
}

export type GateSite = {
  siteId: string
  projectId?: string
  siteKey: string
  name: string
  allowedOrigins: string[]
  createdAt?: string
  secretKey?: string
  note?: string
  apiBase?: string
}

export type GateAgentRow = {
  agentId: string
  name: string
  publicKey: string
  payMode?: string
  allowedPayerPublicKeys?: string[]
  createdAt?: string
}

function authHeaders(authHeader?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  return headers
}

async function parseError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { detail?: string; title?: string }
  return body.detail || body.title || `${fallback} (${res.status})`
}

export async function fetchGateHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${GATE_API_BASE}/health`)
  if (!res.ok) throw new Error(`Gate health failed (${res.status})`)
  return res.json()
}

export async function fetchGateStatus(): Promise<GateStatus> {
  const res = await fetch(`${GATE_API_BASE}/status`)
  if (!res.ok) throw new Error(`Gate status failed (${res.status})`)
  return res.json()
}

export async function listGateSites(authHeader?: string): Promise<GateSite[]> {
  const sites:GateSite[]=[];let cursor='';
  for(let page=0;page<100;page++){
    const res=await fetch(`${GATE_API_BASE}/v1/admin/sites${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`,{headers:authHeaders(authHeader)});
    if(!res.ok)throw new Error(await parseError(res,'list sites failed'));
    const body=await res.json() as {sites?:GateSite[];nextCursor?:string|null};sites.push(...(body.sites||[]));
    if(!body.nextCursor)return sites;if(body.nextCursor===cursor)throw new Error('Invalid site pagination');cursor=body.nextCursor;
  }
  throw new Error('Too many sites; narrow the request');
}

export async function createGateSite(
  input: { name: string; allowedOrigins: string[]; projectId?: string },
  authHeader?: string,
): Promise<GateSite> {
  const res = await fetch(`${GATE_API_BASE}/v1/admin/sites`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(authHeader) },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res, 'create site failed'))
  return res.json()
}

export async function updateGateSite(
  siteId: string,
  input: { name?: string; allowedOrigins?: string[] },
  authHeader?: string,
): Promise<GateSite> {
  const res = await fetch(`${GATE_API_BASE}/v1/admin/sites/${encodeURIComponent(siteId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders(authHeader) },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res, 'update site failed'))
  return res.json()
}

export async function rotateGateSiteSecret(
  siteId: string,
  authHeader?: string,
): Promise<{ siteId: string; siteKey: string; secretKey: string; note?: string }> {
  const res = await fetch(
    `${GATE_API_BASE}/v1/admin/sites/${encodeURIComponent(siteId)}/rotate-secret`,
    {
      method: 'POST',
      headers: authHeaders(authHeader),
    },
  )
  if (!res.ok) throw new Error(await parseError(res, 'rotate secret failed'))
  return res.json()
}

export async function fetchGateAgents(
  siteKey: string,
  authHeader?: string,
): Promise<GateAgentRow[]> {
  const q = new URLSearchParams({ siteKey })
  const res = await fetch(`${GATE_API_BASE}/v1/admin/agents?${q}`, {
    headers: authHeaders(authHeader),
  })
  if (!res.ok) throw new Error(await parseError(res, 'list agents failed'))
  const body = (await res.json()) as { agents?: GateAgentRow[] }
  return body.agents || []
}

export async function registerGateAgent(input: {
  siteKey: string
  publicKey: string
  name: string
  payMode?: 'self' | 'sponsored' | 'none'
  authHeader?: string
}): Promise<{ agentId: string; publicKey: string }> {
  const res = await fetch(`${GATE_API_BASE}/v1/admin/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(input.authHeader) },
    body: JSON.stringify({
      siteKey: input.siteKey,
      publicKey: input.publicKey,
      name: input.name,
      payMode: input.payMode || 'self',
    }),
  })
  if (!res.ok) throw new Error(await parseError(res, 'register agent failed'))
  return res.json()
}

export function gateApiBase() {
  return GATE_API_BASE
}

export function gateSdkUrl() {
  return `${GATE_API_BASE}/v1/sdk/captcha.js`
}

/** @deprecated local demo only */
export type DemoKeys = GateSite

/** @deprecated use listGateSites / createGateSite */
export async function fetchDemoKeys(authHeader?: string): Promise<DemoKeys> {
  const sites = await listGateSites(authHeader)
  if (sites[0]) return sites[0]
  throw new Error('No sites yet — create one under Sites')
}
