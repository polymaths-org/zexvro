# ZEXVRO Access Shield (Proposed)

Status: **Proposed** product framing for teammates and agents.  
Owner of enforcement plane: Nabil / `n4bi10p` (De-pin).  
Related: Agent Auth (Rushi), platform policy/dashboard (shared).

This document explains how ZEXVRO positions **De-pin** (and related layers) as a Web2→Web3 answer to **industrial free-tier and agent API abuse** on large platforms (Grok/xAI-class, OpenAI-class, internal LLM/data APIs).

It is **not** a claim that a full multi-tenant “Access Shield” control plane is shipped. Shipping MVP remains the De-pin gateway in `services/depin`.

---

## One sentence

**Access Shield** turns expensive APIs from *identity-gated free capacity* into *agent-native, pay-per-use capacity*, so free-tier farming and unlimited agent tool-loops stop being a viable business model.

---

## Problem we solve (platform defense)

### What attackers do (observed industry pattern)

Industrial stacks combine:

- Mass free signup (automation + device OAuth)
- Token harvest and multi-account rotation
- Residential / rotating IPs
- A reseller gateway that bills *their* customers while burning *your* free tier
- AI coding agents (Codex, OpenCode, tool-loops) that amplify QPS

### Why classic Web2 gates fail alone

| Web2 control | Why farms and agents beat it |
| --- | --- |
| CAPTCHA | Human farms / solvers; agents avoid it |
| Email / phone | Virtual numbers, OTP bots |
| Free daily quota + ban | Rotation absorbs bans |
| Flat API keys | One key → infinite agent loops |
| IP reputation | Residential proxies |
| Monthly subscription only | Usage not linear with cost |

### What “success” means for a big platform

Not “detect Playwright forever.”  
Success = **free-capacity resale and agent spam become uneconomic**, while legitimate paid/agent access remains attributable and auditable.

---

## Solution architecture

```text
Clients / AI agents / partner SDKs
        │
        ▼
┌───────────────────────────────────────┐
│  ZEXVRO Access Shield (edge)          │
│  1. Agent Auth (who/what)  — Rushi    │
│  2. De-pin x402 (pay)      — Nabil    │
│  3. Policy / rate card     — future   │
│  4. Receipts / audit       — De-pin + │
│                              ledger UX│
└───────────────────┬───────────────────┘
                    │ only allowed + paid traffic
                    ▼
         Customer origin APIs (LLM, data, tools)
```

| Plane | Job | Current status |
| --- | --- | --- |
| **Economic gate (De-pin)** | Unpaid → HTTP 402; verify → upstream once → settle → release body; replay protection | **Working** local/testnet MVP |
| **Agent classification** | Challenge / score / capability token for agents (not “perfect detection”) | **Planned** (Agent Auth, Rushi) |
| **Policy / rate card** | Price per route/model/1k tokens; concurrency; free-demo isolation | **Proposed** |
| **Receipts** | Facilitator/settle proof per call for finops and partners | **Partial** (settle path exists; product UX thin) |

### De-pin mechanics (shipping)

1. Client hits protected route without payment → **402** + `PAYMENT-REQUIRED`.
2. Client returns `PAYMENT-SIGNATURE` (Stellar auth entries for exact USDC).
3. Gateway verifies with facilitator, claims replay fingerprint, calls upstream, buffers success.
4. Settlement succeeds → body + `PAYMENT-RESPONSE` released.
5. Upstream or settle failure → resource withheld (fail closed).

Details: `services/depin/README.md`, `context.md` § De-pin.

### Facilitator note (Stellar)

- Local unpaid probes may use a public facilitator URL.
- Production-like Stellar settle often uses **OpenZeppelin Channels** facilitator URLs with process env **`OZ_API_KEY`** (Bearer). That key is **not** a model API key; it authenticates the payment facilitator so fees can be sponsored and USDC can settle.

---

## How this maps to the abuse pattern

| Abuse pattern | Access Shield response |
| --- | --- |
| Free account farm + rotate into production inference | Production routes sit behind **paid** edge; free accounts cannot extract unlimited origin capacity |
| Reseller gateway monetizing free tier | Resellers must pay per call (or platform captures economics) |
| Agent tool-loop spam | Each call has a price → loops self-limit |
| Shared leaked free cookies/tokens | Token alone insufficient without payment/capability |
| Unpaid scanning | 402 + unpaid rate limits before origin |

**Important:** ZEXVRO does **not** build offensive tools (OTP bots, credential theft, ban evasion). We sell **defense for the platform**.

---

## Product packaging (for sales / roadmap)

### P1 — De-pin Access Edge (MVP, largely code-ready)

- Drop-in gateway in front of configured HTTP routes.
- Exact USDC x402 on Stellar testnet (mainnet later).
- Dashboard today: project De-pin status + unpaid probe.

### P2 — Agent Rate Card (proposed)

- Price matrix: per request, per 1k tokens, per tool call.
- Free demo on a **separate, low-value** surface only.
- Hard concurrency caps bound to payment/customer identity.

### P3 — Hybrid Web2 key + Web3 settle (proposed)

- Keep enterprise API keys for tenancy and support.
- Still require economic settle on expensive routes.
- Key = identity; **payment = abuse brake**.

### P4 — Streaming / session pay (deferred)

- Current De-pin v1: concrete **GET/HEAD**, buffer-and-settle.
- Chat/completions often need POST + stream → roadmap (session deposit / MPP channel patterns).

---

## Positioning (what we say / don’t say)

| Say | Don’t say |
| --- | --- |
| Economic authentication for AI agents | “We replace Cloudflare” |
| Make free-capacity resale unprofitable | “We perfectly detect bots” |
| Web2 platforms keep their APIs; Web3 settles access | “Web3 for hype” |
| Coordinate with Agent Auth for classification | “De-pin alone solves identity” |

**Buyer personas:** API platform security, AI infra, finops at large model/data providers or any AI SaaS bleeding free tier.

**Migration pitch:** Keep REST origin; add ZEXVRO edge; no model rewrite.

---

## Ownership and coordination

| Area | Owner | Rule |
| --- | --- | --- |
| De-pin / x402 edge | Nabil | Do not break exact v2 contract; no custody redesign without docs |
| Agent Auth challenges | Rushi | Do not fork a second classifier under De-pin |
| Morph | Paris | Out of scope for Access Shield |
| Trade pipeline | Rushi | Separate product |

---

## Implementation pointers (repo)

| Path | Purpose |
| --- | --- |
| `services/depin/` | Gateway implementation |
| `services/depin/README.md` | Operator setup, facilitator, smoke |
| `frontend` project De-pin page | Status + unpaid 402 probe |
| `context.md` | Stable product truth |
| `planning.md` | Proposed Access Shield section |
| This file | Teammate-facing product architecture |

---

## Open questions for the team

1. Accept Access Shield naming and big-tech anti-abuse pitch as product direction?
2. Priority of POST/stream metering vs deepening GET/HEAD exact for data APIs first?
3. How Agent Auth capability tokens bind to De-pin payment identity? → **Proposed answer:** capability claims `stellar_pk` + `allowed_payer_pks` + `pay_mode`; edge checks x402 **payer** ∈ allowlist (not `payTo`). See `docs/agent_auth_depin_bind.md` and Gate ADRs for Stellar payer claims.
4. Fiat on-ramp story for enterprises that will not hold USDC operationally?

Until accepted, keep claims in docs marked **Proposed** and do not market “Access Shield GA.”
