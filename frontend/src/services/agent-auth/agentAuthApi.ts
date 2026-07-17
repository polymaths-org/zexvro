/**
 * Client for ZEXVRO Gate (Agent Auth) status + local demo admin helpers.
 * Production capability issue should use @zexvro/gate from the integrating site.
 */

const GATE_API_BASE = (import.meta.env.VITE_AGENT_AUTH_API_URL || '/api/agent-auth').replace(
  /\/$/,
  '',
)

export type GateStatus = {
  status: string
  service: string
  product: string
  issuer: string
  capabilities: {
    channels: string[]
    policyModes: string[]
    proofTypes: string[]
    stellar: Record<string, boolean>
    depinBindingClaims: string[]
  }
  securityProfile?: {
    allowDevHuman: boolean
    allowDevHmac: boolean
    isProd: boolean
    humanSoftConfirmIsSecurity: boolean
    humanSessionPopIsPresentationBound?: boolean
    popEnforcedOnVerify: boolean
    requestBoundPopSupported?: boolean
    popHeader?: string
    note: string
  }
  sites: number
  agents: number
  header: string
  stateBackend?: string
  adminRequireAuth?: boolean
}

export type DemoKeys = {
  siteId: string
  projectId?: string
  siteKey: string
  secretKey: string
  allowedOrigins?: string[]
  note?: string
}

export type GateAgentRow = {
  agentId: string
  name: string
  publicKey: string
  payMode?: string
  allowedPayerPublicKeys?: string[]
  createdAt?: string
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

/** Local/dev only — production admin routes require Cognito. */
export async function fetchDemoKeys(authHeader?: string): Promise<DemoKeys> {
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  const res = await fetch(`${GATE_API_BASE}/v1/admin/demo-keys`, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { detail?: string }))
    throw new Error(body.detail || `demo-keys failed (${res.status})`)
  }
  return res.json()
}

export async function fetchGateAgents(
  siteKey: string,
  authHeader?: string,
): Promise<GateAgentRow[]> {
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  const q = new URLSearchParams({ siteKey })
  const res = await fetch(`${GATE_API_BASE}/v1/admin/agents?${q}`, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { detail?: string }))
    throw new Error(body.detail || `list agents failed (${res.status})`)
  }
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
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (input.authHeader) headers.authorization = input.authHeader
  const res = await fetch(`${GATE_API_BASE}/v1/admin/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      siteKey: input.siteKey,
      publicKey: input.publicKey,
      name: input.name,
      payMode: input.payMode || 'self',
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { detail?: string }))
    throw new Error(body.detail || `register agent failed (${res.status})`)
  }
  return res.json()
}

export function gateApiBase() {
  return GATE_API_BASE
}
