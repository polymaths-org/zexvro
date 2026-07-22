# ADR-002: ZEXVRO Gate Protocol v0.2 (reconciled)

- **Status:** Accepted for implementation direction (Rushi / Gate)
- **Date:** 2026-07-17
- **Supersedes in spirit:** over-claims in early Phase-1 plan around soft_confirm anti-relay and bearer PoP

## Context

Adversarial review of the Phase-1 plan + scaffold found **internal contradictions**:

| Claim | Reality (Phase-1) |
| --- | --- |
| Anti-relay human path | `soft_confirm` + fixed string is transferable theater |
| PoP capability | `cnf` stored, never checked on verify |
| jti replay protection | jti was presence-only multi-use |
| HMAC agent proofs | publicKey-as-HMAC-secret trains bad habits |
| Confidence scores | hardcoded fake detection |
| dual_path | mostly either + TTL cosmetics |
| DX | multi-package / claim catalog over Turnstile bar |

## Decision (reconciled product)

### What Gate **is**

> Short-lived, **action-bound**, **class-bound** capability issuer with **two channels**.  
> **Agent path is production-grade authenticated agent access.**  
> **Human path is not a farm-stopper until WebAuthn (or equivalent hard ceremony).**  
> Economics remain De-pin’s job.

### What Gate is **not** (do not market)

- A CAPTCHA replacement that stops human farms today
- Perfect bot detection / confidence ML product
- Access Shield / WAF / Cloudflare clone
- Payment settlement

### DX contract (win Turnstile bar without under-building invariants)

| Public surface | Hide until advanced |
| --- | --- |
| One package `@zexvro/gate` | Extra packages |
| `protect` + `verify` / middleware | Ceremony vocabulary |
| 2 env vars: site key + secret | Issuer/JWKS/pay modes |
| Default policy `either` | dual_path matrix day-one |
| Agent `fetch` 428 loop | Full claim catalog |

**Rule:** Under-engineer API surface. Over-engineer invariants.

## Protocol freezes (v0.2)

1. **Class integrity:** class set only by channel ceremony success.
2. **Channel integrity:** human never mints agent; agent never mints human.
3. **Production soft_confirm OFF** (`NODE_ENV=production` forces `allowDevHuman=false`).
4. **Production HMAC-dev OFF** (Ed25519 required for real agents).
5. **jti use-budget:** mint registers `maxReuse`; each verify **consumes** one presentation.
6. **Action match exact:** `claims.act === action` (scopes do not expand action).
7. **Human origin required** at challenge issue.
8. **PoP on verify:** required for production agent path (not yet fully implemented — tracked as M1 blocker before “GA”).
9. **Honesty flag in `/status`:** `humanSoftConfirmIsSecurity: false`.
10. **De-pin bind:** claims only until Nabil enforces payer allowlist on edge.

## Shippable 3-week M1 (one owner)

| Week | Outcome |
| --- | --- |
| W1 | Ed25519 agent path; prod kills soft/HMAC; jti budget; exact act; tests |
| W2 | PoP on verify (agent); asymmetric issuer or honest HS256 single-tenant docs; Dynamo or single-node honesty |
| W3 | `@zexvro/gate` DX polish; threat-model one-pager; dogfood one route |

## 12-week milestones (max 6)

1. **M1 Agent Gate hardened** — invariants above; soft human dev-only
2. **M2 DX package** — one npm mental model; 5-min human demo (dev), 10-min agent
3. **M3 WebAuthn human hard** — only then sell human_only as security
4. **M4 Tenant admin** — Cognito + agent rotate/revoke
5. **M5 De-pin payer bind** — with Nabil; fail closed on mismatch
6. **M6 Design partner + hardening** — dual keys, rate limits, red-team report

## Kill list (confirmed)

- Fake confidence product UI
- Image CAPTCHAs
- HDM in Gate MVP
- On-chain human proof
- dual_path as day-one public API (keep internal if useful)
- Claiming anti-relay for soft_confirm
- Claiming PoP before verify checks `cnf`

## Falsifiable success

| Gate | Pass |
| --- | --- |
| Day 21 | Independent reviewer cannot mint **agent** class without registered key material; prod profile rejects soft_confirm |
| Day 30 | One real ZEXVRO route requires agent capability without permanent bypass |
| Day 60 | One external integrator keeps agent path on a non-prod API |

## Relationship to scaffold (2026-07-17)

Already landed in code:

- Dual-channel class lock
- Prod soft_confirm / HMAC kill switches
- jti presentation budget
- exact action match
- `/status` security honesty
- Human origin required

Still open (do not claim done):

- Real Ed25519 agent fixtures in default tests (HMAC still allowed in dev)
- PoP verification
- WebAuthn
- Dynamo multi-instance
- Cognito admin



## Progress 2026-07-17 late

- **session_pop** human path (Ed25519) allowed in production as soft key-bound ceremony.
- soft_confirm still production-disabled.
- Agent PoP + Ed25519 done.
- Dynamo codec ready (`stores.dynamo.ts`); AWS client wiring pending.
- Express middleware `@zexvro/gate/middleware` shipped.
