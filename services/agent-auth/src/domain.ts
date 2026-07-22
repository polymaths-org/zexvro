/** Core domain types for ZEXVRO Gate (Agent Auth). */

export type PrincipalClass = 'human' | 'agent' | 'unknown'
export type Channel = 'human' | 'agent'
export type PolicyMode = 'human_only' | 'agent_only' | 'either' | 'dual_path'
export type PayMode = 'self' | 'sponsored' | 'none'
export type ChallengeStatus = 'pending' | 'completed' | 'expired' | 'consumed'

/** Embedded on human challenges when captcha ceremony is issued. */
export type ChallengeCaptchaState = import('./captcha/types.js').CaptchaState

/** Stored WebAuthn credential for hard human path. */
export interface WebAuthnCredential {
  credentialId: string
  publicKey: string
  counter: number
  transports?: string[]
  siteId: string
  /** Opaque user handle (base64url). */
  userId: string
  createdAt: string
}

export interface SiteRecord {
  siteId: string
  projectId: string
  siteKey: string
  secretHash: string
  /** Public verification still needs secret comparison helper; store only hash in durable store. */
  secretPlainDevOnly?: string
  allowedOrigins: string[]
  name: string
  createdAt: string
}

export interface ActionPolicy {
  action: string
  mode: PolicyMode
  human?: {
    allowSilent?: boolean
    ttlSeconds?: number
    scopes?: string[]
  }
  agent?: {
    requireRegisteredKey?: boolean
    ttlSeconds?: number
    scopes?: string[]
    maxReuse?: number
  }
}

export interface AgentRecord {
  agentId: string
  projectId: string
  siteId: string
  /** Stellar G... or raw ed25519 public key (base64/hex). */
  publicKey: string
  name: string
  revokedAt?: string
  createdAt: string
  allowedPayerPublicKeys: string[]
  payMode: PayMode
}

export interface ChallengeRecord {
  id: string
  siteId: string
  action: string
  channel: Channel
  status: ChallengeStatus
  nonce: string
  /** Client-generated pubkey that must complete the challenge (anti-relay). */
  clientPublicKey: string
  origin?: string
  agentPublicKey?: string
  expiresAt: number
  /** Unix seconds used in canonical signed message */
  expSeconds: number
  createdAt: number
  /** base64url webauthn challenge if issued for hard human path */
  webauthnChallenge?: string
  webauthnRpId?: string
  /** Self-hosted multi-type captcha (human only). Secret never returned on API. */
  captcha?: ChallengeCaptchaState
  /** How many captchas issued on this challenge (re-issue budget). */
  captchaIssueCount?: number
  /** Cumulative wrong answers across re-issues. */
  captchaFailCount?: number
}

export interface CapabilityClaims {
  iss: string
  aud: string
  sub: string
  class: Exclude<PrincipalClass, 'unknown'>
  act: string
  chn: Channel
  jti: string
  iat: number
  nbf: number
  exp: number
  conf: number
  amr: string[]
  project_id: string
  site_id: string
  scopes: string[]
  origin?: string
  stellar_pk?: string
  pay_mode?: PayMode
  allowed_payer_pks?: string[]
  cnf?: { jkt?: string; k?: string }
}

export interface IssueChallengeInput {
  siteKey: string
  action: string
  channel: Channel
  clientPublicKey: string
  origin?: string
  agentPublicKey?: string
}

export interface CompleteChallengeInput {
  challengeId: string
  siteKey: string
  /** Proof material: base64 signature over canonical challenge message, or 'soft-confirm' in dev human path. */
  proof: string
  proofType: 'nonce_sign' | 'session_pop' | 'soft_confirm' | 'webauthn' | 'captcha_pass'
}

export interface VerifyInput {
  capability: string
  action: string
  minClass: 'human' | 'agent' | 'either'
  expectedOrigin?: string
  siteSecret: string
  /** Required for agent class when requirePop is true (and always recommended). */
  pop?: {
    signature: string
    htm: string
    htu: string
    iat: number
    bodyHash?: string
  }
  /**
   * When provided by the origin edge, Gate checks Pop request binding
   * (self-asserted pop fields alone are not enough).
   */
  expectedHtm?: string
  expectedHtu?: string
  expectedBodyHash?: string
  /** When true, require Pop for human session_pop capabilities as well. */
  requireHumanPop?: boolean
}

export interface VerifyResultOk {
  ok: true
  claims: CapabilityClaims
}

export interface ProblemBody {
  type: string
  title: string
  status: number
  detail: string
  error_code: string
  challenge?: {
    id: string
    mode: Channel
    expires_in: number
    endpoints: { complete: string }
    protocol: string
    tasks: Array<Record<string, string>>
  }
}

export interface VerifyResultErr {
  ok: false
  status: number
  problem: ProblemBody
}

export type VerifyResult = VerifyResultOk | VerifyResultErr

export interface GateConfig {
  port: number
  issuer: string
  signingSecret: string
  defaultTtlSeconds: number
  challengeTtlSeconds: number
  /** Dev/demo only: soft_confirm human mint. Forced false when NODE_ENV=production. */
  allowDevHuman: boolean
  /** Dev/test only: HMAC-with-publicKey-string proofs. Forced false in production. */
  allowDevHmac: boolean
  isProd: boolean
  /** When true, agent capabilities must present a valid PoP signature. */
  requirePop: boolean
  stateBackend: 'memory' | 'dynamo'
  dynamoTable: string
  adminRequireAuth: boolean
  cognitoUserPoolId?: string
  cognitoClientId?: string
  /**
   * Public URL path prefix (no trailing slash), e.g. `/gate` for https://api.zexvro.in/gate.
   * Empty string = mount at root (local default).
   */
  basePath: string
  /** Browser origins allowed for CORS (comma-configured). Does not replace site.allowedOrigins. */
  corsOrigins: string[]
}

export const CAPABILITY_HEADER = 'x-zexvro-capability'
export const POP_HEADER = 'x-zexvro-pop'
export const SITE_KEY_HEADER = 'x-zexvro-site-key'
export const ACTION_HEADER = 'x-zexvro-action'
export const PROBLEM_TYPE_BASE = 'https://zexvro.dev/problems/gate'
