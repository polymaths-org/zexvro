/**
 * Optional ZEXVRO Gate capability check for Access Shield composition.
 * Does NOT classify humans/agents — only verifies a capability token via Gate /v1/verify
 * and optionally binds payment payer to allowed_payer_pks.
 */
import { createHash } from 'node:crypto'
import type { Request } from 'express'

export interface CapabilityGateConfig {
  /** Gate API base URL, e.g. http://127.0.0.1:4103 */
  gateApiBase: string
  /** Site secret for Gate /v1/verify */
  siteSecret: string
  /** Action name bound in capability (defaults to depin.<METHOD>.<route>) */
  action?: string
  /** human | agent | either */
  minClass?: 'human' | 'agent' | 'either'
  /** When true, require X-Zexvro-Capability header */
  required?: boolean
  /** When true and payment present, enforce payer allowlist from verify response */
  bindPayer?: boolean
}

export interface CapabilityVerifyOk {
  ok: true
  class: string
  action: string
  stellar_pk?: string
  pay_mode?: string
  allowed_payer_pks?: string[]
}

export interface CapabilityVerifyErr {
  ok: false
  status: number
  problem: Record<string, unknown>
}

export type CapabilityVerifyResult = CapabilityVerifyOk | CapabilityVerifyErr

export function assertPayerAllowed(
  claims: {
    stellar_pk?: string
    pay_mode?: string
    allowed_payer_pks?: string[]
  },
  payerPublicKey: string | undefined,
): { ok: true } | { ok: false; code: string; detail: string } {
  if (!payerPublicKey) {
    return { ok: false, code: 'payer_missing', detail: 'Payment payer public key required' }
  }
  const allow = Array.isArray(claims.allowed_payer_pks) ? claims.allowed_payer_pks : []
  const self = claims.stellar_pk
  const payMode = claims.pay_mode || 'self'
  if (payMode === 'none') return { ok: true }
  if (allow.length > 0) {
    if (allow.includes(payerPublicKey)) return { ok: true }
    return {
      ok: false,
      code: 'payer_not_allowlisted',
      detail: 'Payment payer is not in capability allowed_payer_pks',
    }
  }
  if (payMode === 'self' && self && self === payerPublicKey) return { ok: true }
  return {
    ok: false,
    code: 'payer_mismatch',
    detail: 'Payment payer does not match capability stellar_pk',
  }
}

function parsePopHeader(request: Request): Record<string, unknown> | undefined {
  const raw = request.header('X-Zexvro-Pop') ?? request.header('x-zexvro-pop')
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
}

export async function verifyCapabilityWithGate(
  request: Request,
  gate: CapabilityGateConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<CapabilityVerifyResult> {
  const capability =
    request.header('X-Zexvro-Capability') ?? request.header('x-zexvro-capability')
  if (!capability) {
    if (gate.required === false) {
      return {
        ok: true,
        class: 'unknown',
        action: gate.action ?? 'unspecified',
      }
    }
    return {
      ok: false,
      status: 401,
      problem: {
        type: 'https://zexvro.dev/problems/gate/missing-capability',
        title: 'missing_capability',
        status: 401,
        detail: 'X-Zexvro-Capability header is required for this provider',
        error_code: 'missing_capability',
      },
    }
  }

  const action =
    gate.action ??
    `depin.${request.method.toLowerCase()}.${request.path.replace(/\//g, '.').replace(/^\./, '')}`

  const pop = parsePopHeader(request)
  const body = {
    capability,
    action,
    minClass: gate.minClass ?? 'either',
    siteSecret: gate.siteSecret,
    pop,
  }

  try {
    const response = await fetchImpl(`${gate.gateApiBase.replace(/\/$/, '')}/v1/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      return {
        ok: false,
        status: response.status >= 400 ? response.status : 401,
        problem: json,
      }
    }
    const cls = typeof json.class === 'string' ? json.class : 'unknown'
    const act = typeof json.action === 'string' ? json.action : action
    const stellarPk = typeof json.stellar_pk === 'string' ? json.stellar_pk : undefined
    const payMode = typeof json.pay_mode === 'string' ? json.pay_mode : undefined
    const allow = Array.isArray(json.allowed_payer_pks)
      ? json.allowed_payer_pks.filter((x): x is string => typeof x === 'string')
      : undefined
    const okResult: CapabilityVerifyOk = {
      ok: true,
      class: cls,
      action: act,
    }
    if (stellarPk !== undefined) okResult.stellar_pk = stellarPk
    if (payMode !== undefined) okResult.pay_mode = payMode
    if (allow !== undefined) okResult.allowed_payer_pks = allow
    return okResult
  } catch {
    return {
      ok: false,
      status: 502,
      problem: {
        type: 'https://zexvro.dev/problems/gate/verify-unavailable',
        title: 'gate_verify_unavailable',
        status: 502,
        detail: 'Gate capability verification is temporarily unavailable',
        error_code: 'gate_verify_unavailable',
      },
    }
  }
}

/** Best-effort extract Stellar G... payer from verified x402 payment payload. */
export function extractPayerFromPaymentPayload(paymentPayload: unknown): string | undefined {
  try {
    const payload = paymentPayload as {
      payload?: { transaction?: string; accepted?: { extra?: { payer?: string } } }
      accepted?: { extra?: { payer?: string } }
    }
    const direct =
      payload?.payload?.accepted?.extra?.payer ??
      payload?.accepted?.extra?.payer
    if (typeof direct === 'string' && direct.startsWith('G')) return direct

    // Heuristic: scan JSON for G... account
    const text = JSON.stringify(paymentPayload)
    const match = /G[A-Z2-7]{55}/.exec(text)
    return match?.[0]
  } catch {
    return undefined
  }
}

export function capabilityFingerprint(capability: string): string {
  return createHash('sha256').update(capability).digest('hex').slice(0, 16)
}
