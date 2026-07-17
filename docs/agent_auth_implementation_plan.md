# ZEXVRO Gate (Agent Auth) — Production Implementation Plan

> **Reconciled 2026-07-17:** Adversarial review found soft_confirm/PoP/jti over-claims.  
> **Authoritative protocol freezes:** [`docs/adr-002-gate-protocol-v0.2.md`](./adr-002-gate-protocol-v0.2.md).  
> Phase-1 scaffold is useful plumbing; **do not market soft_confirm as security**.

**Status:** Proposed (design accepted for implementation start by owner Rushi / `Wraient`)  
**Product name (recommended):** **ZEXVRO Gate**  
**Service code name:** Agent Auth (legacy name in `context.md` / dashboard routes)  
**Owner:** Rushi / `Wraient`  
**Related:** De-pin / Access Shield (Nabil), Cognito shell (shared), A-2-A Trade (same owner, separate product)  
**Date:** 2026-07-17  

This document is the implementation source of truth for building a **dual-channel human/agent access gate** that developers can drop into any action. It is **not** a classic CAPTCHA product.

---

## 1. One-sentence product

**ZEXVRO Gate** issues short-lived, cryptographically bound **capability tokens** after a **human** or **agent** ceremony, then lets developers enforce **policy** (human-only, agent-only, either, dual-path) on any action—without denying agents by default and without letting humans solve challenges for agents (or vice versa).

---

## 2. Why not “better CAPTCHA”

### Market reality (research summary)

| Incumbent | Strength | Weakness vs our goal |
| --- | --- | --- |
| reCAPTCHA v2/v3 | Ubiquity, risk scores | Human-centric; agents forced to spoof; solver farms; opaque scores |
| hCaptcha | Privacy positioning, enterprise | Still puzzle/score based; agents not first-class |
| Cloudflare Turnstile | Low friction, PAT / Privacy Pass direction | Optimizes “probably human browser”; not dual-policy agent auth |
| Friendly Captcha | PoW, accessibility | Not agent-native capability + policy product |
| World ID / PoP networks | Strong personhood claims | Heavy UX; not a general SDK gate for agent APIs |

**Industry failure modes we must not copy:**

1. **Transferable solutions** — solver APIs (2Captcha-class) work because the “answer” is a string anyone can submit.
2. **Detection arms race** — headless browsers, residential proxies, AI vision beat perception tests.
3. **Binary bot walls** — force legitimate agents to impersonate humans.
4. **Bearer “passed captcha” cookies** — stolen and replayed.

**Our differentiators (must remain load-bearing):**

1. **Honest dual-channel policy** — humans and agents are both valid clients with different rights.
2. **Anti-relay by cryptography** — class is set by which ceremony succeeded; capability is action/origin/key-bound; not a copy-paste puzzle token.
3. **Compose with De-pin economics** — Gate = who/what; De-pin = who pays (Access Shield stack).

---

## 3. Goals and non-goals

### Goals (MVP)

- Developer installs SDK and protects any named **action** in ~5 lines client + server verify.
- Classify request principal as `human` | `agent` | `unknown` with **confidence** (never “perfect detection”).
- Policies: `human_only` | `agent_only` | `either` | `dual_path` (different scopes/TTL per class).
- **Anti-relay:** human ceremony cannot mint `class=agent`; agent ceremony cannot mint `class=human`.
- Calm, professional human UX (silent → soft step-up → passkey); no image grids in v1.
- First-class agent HTTP path (428 challenge → nonce sign → capability).
- Optional Stellar: agent `G…` principals + payer binding for De-pin.
- Dashboard: keys, policies, events, agent registry (thin).
- Privacy model documented; no biometrics/HDM in MVP.

### Non-goals (v1)

- Perfect bot detection or vanity accuracy % in UI.
- Image/audio puzzle CAPTCHAs.
- HDM (Human Data Marketplace) sell flows.
- On-chain attestation per request / Soroban agent registry.
- USDC bonds / slash markets.
- WAF clone or Cloudflare replacement claims.
- Behavioral biometrics by default.
- Payment settlement inside Gate (that is De-pin).
- Multi-chain identity.

---

## 4. Architecture overview

```text
┌──────────────────┐     ┌──────────────────┐
│ Browser (human)  │     │ Agent runtime    │
│ @zexvro/gate     │     │ @zexvro/gate-agent│
└────────┬─────────┘     └────────┬─────────┘
         │ protect()              │ sign challenge
         ▼                        ▼
┌─────────────────────────────────────────────┐
│  services/agent-auth  (ZEXVRO Gate API)     │
│  challenge → ceremony → capability JWT      │
│  site keys · policy · agent registry · jti  │
└────────────────────┬────────────────────────┘
                     │ X-Zexvro-Capability
                     ▼
         ┌───────────────────────┐
         │ Customer origin API   │  verifyCapability()
         │ and/or De-pin edge    │  then optional x402 pay
         └───────────────────────┘
```

### Access Shield order (expensive routes)

```text
rate-limit → capability (Gate) → payment (De-pin) → upstream → settle → release
```

- Missing/invalid capability → **401/403/428** (identity), never 402.
- Missing payment → **402** (economic).
- Identity success never upgrades class; payment never upgrades class.

---

## 5. Core concepts

### 5.1 Principals

| Principal | How established (v1) | `class` |
| --- | --- | --- |
| Human browser session | WebAuthn/passkey step-up and/or soft presence + origin-bound session key | `human` |
| Registered agent | Ed25519 / Stellar `G…` signs challenge; key in project registry | `agent` |
| Unknown | Failed or incomplete ceremony | `unknown` (policy usually deny or challenge) |

`class` is **not** self-asserted. It is set only by which **ceremony** succeeded.

### 5.2 Capability token (JWT)

Minimum claims:

| Claim | Meaning |
| --- | --- |
| `iss` | Gate issuer |
| `aud` | `site_id` (+ origin for browser) |
| `sub` | Opaque principal id |
| `class` | `human` \| `agent` |
| `act` | Bound action (e.g. `checkout.submit`) |
| `chn` | `human` \| `agent` channel |
| `cnf.jkt` or `cnf` | Proof-of-possession key thumbprint (session/agent pubkey) |
| `jti` | Replay id |
| `iat` / `nbf` / `exp` | Short TTL (default 60–300s agents; policy-driven) |
| `conf` | Confidence 0–1 (policy input, not sole security) |
| `amr` | Methods used (`webauthn`, `nonce_sign`, `sep10_link`, …) |
| `stellar_pk` | Optional public key for agent / linked human |
| `pay_mode` | `self` \| `sponsored` \| `none` |
| `allowed_payer_pks` | Who may pay on De-pin when composed |
| `project_id` | Tenant project |
| `scopes` | Fine-grained rights (dual_path) |

**Header (frozen for implementers):** `X-Zexvro-Capability`

### 5.3 Anti-relay invariants (MUST)

1. Human interactive UI **never** returns `class=agent`.
2. Agent solve path **never** returns `class=human`.
3. Challenge init binds `site_key + origin/app + action + client_pubkey + channel`.
4. Capability redeemable only with **PoP** by the key that started the challenge (v1: sign HTTP request or include DPoP-style proof; minimum: capability not usable without matching registered agent key on agent routes).
5. No challenge whose complete answer is a **copy-paste string** without key possession.
6. Domain allowlist enforced at **verify**, not only widget load.
7. Short TTL + `jti` replay cache (Dynamo TTL).
8. Cross-class presentation → **403** `class_mismatch` / `policy_*`.

### 5.4 Policy model

Per **site + action**:

```ts
type PolicyMode = 'human_only' | 'agent_only' | 'either' | 'dual_path'

interface ActionPolicy {
  action: string
  mode: PolicyMode
  human?: { allowSilent?: boolean; ttlSeconds?: number; scopes?: string[] }
  agent?: { requireRegisteredKey?: boolean; ttlSeconds?: number; scopes?: string[]; maxReuse?: number }
}
```

Examples:

| Action | Mode |
| --- | --- |
| `account.delete` | `human_only` |
| `search.query` | `either` |
| `index.bulk` | `agent_only` |
| `trade.execute` | `dual_path` (different scopes/TTL) |

---

## 6. Stellar integration (real value, not theater)

### MVP (do)

1. **Agent service accounts** = Stellar `G…` public keys registered off-chain (Dynamo).
2. Agent challenge = Ed25519 sign over canonical message  
   `zexvro-gate/v1|{iss}|{aud}|{nonce}|{exp}|{project}|{action}|{channel}`.
3. Capability claims include `stellar_pk`, `pay_mode`, `allowed_payer_pks`.
4. **De-pin bind:** after x402 verify, **payer G…** must be ∈ `allowed_payer_pks` (usually equals agent `stellar_pk` for `self`).  
   **Do not bind to `payTo`** (merchant recipient).
5. Optional **SEP-10 (or equivalent) human wallet link** once — not every request.

### Phase 2

- Sponsored project treasury pay mode polish.
- Receipt hash anchors (audit luxury).
- Optional bonds for rate tiers.
- Optional registry root hash on-chain.

### Skip

- “Wallet signature ⇒ human.”
- On-chain classify path.
- Per-request Freighter popups for agents.
- Putting JWT/secrets on-chain.

**Marketing line:** Stellar is for **principal attribution and payment binding**, not for proving humanness.

---

## 7. API surface (v1)

Base: `https://gate…/v1` (local `http://localhost:4103`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Liveness |
| GET | `/status` | public | Capabilities (no secrets) |
| GET | `/.well-known/jwks.json` | public | Issuer public keys |
| POST | `/v1/challenges` | site key | Start challenge (human or agent channel) |
| POST | `/v1/challenges/:id/complete` | site key + proof | Complete ceremony → capability |
| POST | `/v1/verify` | secret key | Server-side verify for origins |
| POST | `/v1/tokens/introspect` | secret or mTLS later | Edge introspect (optional if JWKS local verify) |
| POST | `/v1/appeals` | Cognito or email token | False-positive appeal ticket |
| CRUD | `/v1/admin/sites` | Cognito | Site keys, origins |
| CRUD | `/v1/admin/policies` | Cognito | Action policies |
| CRUD | `/v1/admin/agents` | Cognito | Register/revoke agent `G…` |
| GET | `/v1/admin/events` | Cognito | Telemetry |

### HTTP status contract (agents)

| Status | Meaning |
| --- | --- |
| 401 | Missing/invalid/expired capability |
| 403 | Valid token but policy denies (e.g. human-only) |
| 428 | Challenge required (`challenge_required` problem+json) |
| 429 | Rate limited |
| 200 | OK |

Errors: `application/problem+json` with stable `error_code`.

---

## 8. SDK surfaces (mirror NFT SDK pattern)

```text
packages/agent-auth-sdk/     # @zexvro/gate (browser + headless)
packages/agent-auth-server/  # @zexvro/gate-server (Node verify) — can start inside SDK
packages/agent-auth-types/   # shared claim schemas for De-pin
services/agent-auth/         # API
```

### Developer happy path

```ts
// Browser
import { Gate } from '@zexvro/gate'
const gate = new Gate({ siteKey: 'zk_live_…' })
const { capability } = await gate.protect({ action: 'checkout.submit' })
await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'X-Zexvro-Capability': capability, 'content-type': 'application/json' },
  body: JSON.stringify(order),
})
```

```ts
// Server
import { verifyCapability } from '@zexvro/gate-server'
const v = await verifyCapability(req.headers['x-zexvro-capability'], {
  secretKey: process.env.GATE_SECRET_KEY!,
  action: 'checkout.submit',
  minClass: 'human',
  expectedOrigin: 'https://shop.example',
})
if (!v.ok) return res.status(v.status).json(v.problem)
```

```ts
// Agent
import { GateAgent } from '@zexvro/gate-agent'
const agent = new GateAgent({ siteKey, privateKey }) // Stellar/ed25519
const res = await agent.fetch(url, { action: 'search.query', method: 'POST', body })
```

---

## 9. Human UX (design.md aligned)

Progressive friction:

1. **Silent** — low risk, origin ok, soft signals → mint short human capability.
2. **Soft** — calm modal “Confirm you’re here” (one primary CTA).
3. **Hard** — WebAuthn/passkey (beautiful, accessible).
4. **Fail with dignity** — clear reason + retry; never infinite puzzles.

Copy rules: avoid “captcha”, “prove you’re not a robot”, “bot fight.”  
Prefer: Continue, Verify presence, Capability issued, Policy blocked.

Dashboard IA (replace mock “CAPTCHA checkbox” stub):

1. Overview (24h class mix, challenge rate, top actions)
2. Keys (site/secret, rotate, env)
3. Policies (actions × mode)
4. Agents (registered public keys)
5. Events

---

## 10. Privacy model (MVP)

**Allowed signals:** WebAuthn result, challenge PoP, declared agent credentials, coarse ephemeral automation hints, salted hashed IP/ASN short retention, rate/velocity, optional linked `G…`.

**Forbidden in MVP:** continuous keystroke/mouse biometrics, face/voice video, persistent cross-site fingerprinting as identity, HDM data sale, training on customer page content without DPA.

**Retention:** auth decision logs days; raw risk features hours; secrets never logged.

**Appeal:** `/v1/appeals` + dashboard queue (human false-positive path required by `context.md`).

---

## 11. Repo layout and ownership

```text
services/agent-auth/           # @zexvro/agent-auth-api  Owner: Rushi
  README.md
  src/
    server.ts app.ts config.ts domain.ts
    challenges.ts tokens.ts policy.ts classifier.ts
    registry.ts stores.ts audit.ts auth.ts errors.ts
packages/agent-auth-sdk/       # @zexvro/gate
packages/agent-auth-types/     # shared claims / headers
frontend/src/services/agent-auth/
frontend/src/components/services/AgentAuth.tsx  # wire real API
docs/agent_auth_implementation_plan.md          # this file
docs/agent_auth_privacy.md                      # follow-up one-pager
```

**Do not:** put classifier in `services/depin`.  
**Do not:** break Cognito shell.  
**Do not:** edit Morph / NFT / privacy pool for this workstream.

---

## 12. Data plane (AWS)

| Resource | Purpose |
| --- | --- |
| App Runner `zexvro-agent-auth` | Always-on challenge/verify API (same pattern as NFT/De-pin) |
| DynamoDB `zexvro-agent-auth` (single-table) | sites, policies, agents, challenges, jti, events, appeals |
| Secrets Manager `zexvro/agent-auth/issuer-key` | JWT signing |
| Cognito (existing) | Admin control plane only |
| CloudWatch | Redacted logs |
| Optional later | CloudFront for widget CDN |

Local: `memory` / `file` stores like De-pin; production: Dynamo from day one for multi-instance `jti`.

**Cost note:** third small App Runner; keep min size; stop inventing extra always-on boxes.

---

## 13. Implementation phases

### Phase 0 — Spec freeze (this doc) ✅ in progress

- [x] Product thesis + anti-relay rules
- [x] API / claims / header names
- [x] Stellar MVP scope
- [ ] Team ack of name **ZEXVRO Gate** vs keep “Agent Auth” in UI only
- [ ] Record decisions in `memory.md` + slim summary in `context.md` when Accepted

### Phase 1 — Domain + API skeleton (days)

1. Scaffold `services/agent-auth` Express + Zod + Vitest (clone De-pin tooling).
2. Domain types: Site, Policy, Challenge, CapabilityClaims, AgentRecord.
3. In-memory stores; `/health` `/status`.
4. Challenge issue/complete with **dev ceremony**: agent nonce_sign + human “soft confirm” stub.
5. JWT issue/verify + JWKS; `jti` replay.
6. Unit tests: class isolation, action bind, origin bind, replay, expiry.

### Phase 2 — SDKs (days)

1. `@zexvro/gate` browser `protect()` + theme tokens.
2. `@zexvro/gate-server` `verifyCapability`.
3. `@zexvro/gate-agent` fetch wrapper with 428 loop.
4. README quickstart + problem codes table.

### Phase 3 — Human WebAuthn + production signals (days–week)

1. WebAuthn register/assert for hard step-up.
2. Progressive risk → silent/soft/hard (heuristic only; honest confidence).
3. Accessibility pass; dark/light.
4. Appeal API.

### Phase 4 — Admin dashboard (parallel)

1. Replace `AgentAuth.tsx` mock with Keys / Policies / Agents / Events.
2. Cognito-protected admin routes.
3. Copy-paste install snippets.

### Phase 5 — De-pin composition (coordinate Nabil)

1. Optional De-pin middleware: require capability + check `allowed_payer_pks`.
2. Document header contract in both READMEs + `memory.md`.
3. E2E: agent signs → capability → x402 pay → 200; human token on agent-only → 403; payer mismatch → fail closed.

### Phase 6 — AWS deploy

1. Dynamo table + IAM + Secrets.
2. ECR + App Runner `zexvro-agent-auth`.
3. Deploy script sibling of `deploy-nft-depin-aws.mjs`.
4. Smoke in `memory.md`.

### Phase 7 — Hardening

1. Secret rotation dual-key.
2. Red-team checklist (below).
3. Rate limits, audit redaction.
4. Optional SEP-10 human link.

### Later

- HDM (separate privacy/consent program)
- Bonds, on-chain anchors
- Python agent client PyPI
- Mobile SDKs

---

## 14. Test / red-team plan (ship gate)

| Test | Expected |
| --- | --- |
| Human complete → agent-only action | 403 class/policy |
| Agent complete → human-only action | 403 |
| Capability from site A used on site B | 401 aud |
| Capability action mismatch | 401 |
| Replay same `jti` | 401 |
| Expired capability | 401 |
| Solver-style string without key PoP | cannot mint |
| Evil origin with stolen site key | verify fails domain pin |
| Agent payer ≠ allowed_payer_pks | De-pin fail closed |
| Payment success without capability | still blocked if required |
| XSS-stolen bearer without PoP key | cannot use (once PoP enforced) |

Never ship vanity “98.4% accuracy” without methodology.

---

## 15. Success metrics

| Persona | Metric |
| --- | --- |
| Developer | Time-to-first-protected-action &lt; 15 min |
| Human | High silent pass rate; interactive median &lt; 3s; a11y |
| Agent | Challenges solved without human UI; stable 401/403/428 |
| Platform | Abuse drop on human-only **or** paid agent volume up with De-pin — not “bots blocked %” |

---

## 16. Decision log (Proposed → promote when accepted)

| ID | Decision | Level |
| --- | --- | --- |
| D1 | Product is dual-channel **capability gate**, not CAPTCHA | Proposed → implement as Accepted for Rushi-owned service |
| D2 | Ship name **ZEXVRO Gate**; route may stay `/agent-auth` | Proposed |
| D3 | Header `X-Zexvro-Capability` | Proposed |
| D4 | Human ceremony v1 prioritizes WebAuthn; no image puzzles | Proposed |
| D5 | Agent identity = registered Ed25519/Stellar `G…` | Proposed |
| D6 | Stellar binds principal + De-pin **payer**, not humanness | Proposed |
| D7 | HDM deferred | Proposed |
| D8 | Runtime App Runner + Dynamo single-table | Proposed |
| D9 | Do not implement classifier inside De-pin | Accepted (existing Access Shield) |

---

## 17. Immediate next engineering tasks

1. Land this plan + memory entry.
2. Scaffold `services/agent-auth` with domain + health + challenge/token stubs + tests.
3. Scaffold `packages/agent-auth-types` capability claim zod schema.
4. Scaffold `packages/agent-auth-sdk` README + minimal client stubs.
5. Update root `package.json` scripts and `.env.example` placeholders.
6. Iterate dashboard stub toward Keys/Policies IA (can be visual-only until API).

---

## 18. References (internal)

- `context.md` § Captcha-Like Agent Authentication Service
- `docs/access_shield.md`
- `services/depin/` (challenge/fail-closed/replay patterns)
- `packages/nft-checkout-sdk/` (SDK surface pattern)
- `frontend/src/components/services/AgentAuth.tsx` (current mock UI)
- `design.md` (visual system)

---

*End of plan. Implementation must keep anti-relay and dual-channel honesty; everything else is secondary.*
