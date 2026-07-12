# Nabil Services Gap Closure Plan

## Context

Nabil (`n4bi10p`) owns **NFT Service** and **De-pin**. Core verticals already exist:

- Soroban collection contract + WASM deployed on testnet
- Express NFT API with Cognito, local pinning, sale config, mint/checkout prepare+submit
- Frontend NFT wizard/dashboard/public page + De-pin dashboard probe
- De-pin x402 exact gateway with a live 0.001 USDC testnet settlement
- Root `npm run dev` unified env runner

**Remaining gaps** (from status review + code inspection):

| Gap | Current code reality |
| --- | --- |
| Signed-in E2E smoke | Paths exist; no recorded full UI deploy→sale→buy loop in memory |
| Wallet sign/submit UX | API submit routes exist; FE only prepares txs (no Freighter/wallet adapter, no submit call from UI) |
| Pinata production path | `PinataPinningService` exists; needs JWT + mode + smoke |
| Shared NFT persistence | `FileNftRepository` (JSON file) — fine for local, not multi-instance prod |
| Managed sponsor secrets | Env + CLI identity already supported; need hosted injection docs/path |
| Mint inventory / archive | Not implemented |
| De-pin multi-instance safety | `ReplayGuard` / `UnpaidRateLimiter` use in-memory `Map` |
| De-pin managed config | Machine-local `depin.config.json` only |

**Working rules for every phase:**

1. Implement the smallest complete slice.
2. Run the phase verification suite (must pass).
3. Commit with a concise conventional message.
4. Append a memory entry to `memory.md` and a short handoff note to `agent-convo.md`.
5. Only then start the next phase.
6. Do not touch Morph (Paris) or Trade/Agent Auth (Rushi).
7. Never commit secrets (`.env`, JWT, sponsor seeds).

**Branch:** continue on `feature/nft-service` (already ahead of origin by root env commit).

---

## Recommended approach

Close the **product loop first** (smoke + wallet UX), then **production plumbing** (Pinata, secrets, shared stores), then **secondary product polish** (inventory, archive, De-pin managed config). Production infra that depends on credentials you do not have yet is **gated** — implement code + env hooks, verify with mocks/local substitutes, and mark credential smoke as a manual gate.

---

## Critical files

### NFT
- `services/nft-service/api/src/app.ts` — routes (sale/mint/checkout submit already present)
- `services/nft-service/api/src/service.ts` — domain operations
- `services/nft-service/api/src/stellarGateway.ts` — Soroban prepare/submit
- `services/nft-service/api/src/repository.ts` — `InMemoryNftRepository` / `FileNftRepository`
- `services/nft-service/api/src/pinning.ts` — `PinataPinningService` (reuse)
- `services/nft-service/api/src/domain.ts` — status/records
- `frontend/src/services/nft/nftApi.ts` — client (prepare exists; submit clients missing)
- `frontend/src/services/nft/CollectionDashboard.tsx` — sale prep UI
- `frontend/src/services/nft/PublicCollection.tsx` — checkout prep UI
- `frontend/src/services/nft/CollectionCreate.tsx` — wizard
- `frontend/e2e/nft.spec.ts` — Playwright journeys

### De-pin
- `services/depin/src/replay.ts` — in-memory replay
- `services/depin/src/rateLimit.ts` — in-memory rate limit
- `services/depin/src/proxy.ts` — injects guards
- `services/depin/src/config.ts` — provider config load
- `frontend/src/services/depin/depinApi.ts` — dashboard client

### Docs / handoff
- `memory.md` — chronological work log after each phase
- `agent-convo.md` — agent switch brief after each phase
- `context.md` — only if stable product status changes
- `.env.example` — document new env vars (no secrets)

---

## Reuse (do not reinvent)

| Capability | Where |
| --- | --- |
| Prepare/submit sale config | `NftService.prepareSaleConfig` / `submitSaleConfig`, routes in `app.ts` |
| Prepare/submit checkout | `createCheckoutIntent` / `submitCheckoutIntent` (+ public variants) |
| Pinata upload | `PinataPinningService` in `pinning.ts` |
| Local file persistence | `FileNftRepository` interface `NftRepository` |
| Sponsor auto-submit path | `stellarGateway.prepareSaleConfig` when no non-invoker signer |
| De-pin guard interfaces | `ReplayGuard.claim`, `UnpaidRateLimiter.consume` — swap storage behind same API |
| Auth | Cognito access token already on private NFT routes |
| Root runner | `scripts/dev.mjs`, root `.env.example` |

---

## Phase plan (step by step)

### Phase 0 — Baseline verification + push hygiene

**Goal:** Confirm current tree is green before new work; capture branch state for agent switches.

**Work:**
1. Run baseline tests (no feature code).
2. Push `feature/nft-service` if remote is behind (only after user-approved push in execute mode).
3. Document baseline in `memory.md` / `agent-convo.md` if not already current.

**Verify:**
```bash
npm --prefix frontend run lint && npm --prefix frontend run test && npm --prefix frontend run build
npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api run test && npm --prefix services/nft-service/api run build
npm --prefix services/depin run lint && npm --prefix services/depin run test && npm --prefix services/depin run build
```

**Commit (only if docs/hygiene change):**
```
chore: record nabil services baseline and branch state
```

**Handoff fields:** baseline command results, branch tip hash.

---

### Phase 1 — Signed-in NFT smoke runbook + automated smoke harness

**Goal:** Prove and document the local product loop without inventing production claims.

**Work:**
1. Add a short runbook section to `services/nft-service/README.md` (and/or root README link): Cognito sign-in → create collection → deploy → sale config (sponsor path) → open public page → prepare checkout.
2. Add a **scripted smoke helper** (preferred: `services/nft-service/api` or `scripts/`) that, when env + health are ready:
   - hits `/health`
   - creates/lists collections with a test access token if available
   - fails clearly when Cognito/sponsor/Stellar not configured
3. Optionally extend Playwright with a **mocked** signed-in journey that asserts UI states for sale configured + public checkout prepared (keep real Stellar out of CI).

**Verify:**
- README steps are complete and match current routes.
- Smoke helper exits non-zero on missing health; unit/e2e mocks pass.
- Frontend + NFT API lint/test/build green.

**Commit:**
```
docs: add signed-in NFT smoke runbook and harness
```

**Memory/agent-convo:** Record smoke commands, known manual steps, any live tx hashes if a real run is performed.

**Success criteria:** Another agent can run the harness and know exactly what still requires Nabil’s Cognito browser session.

---

### Phase 2 — Frontend wallet adapter + submit for sale config

**Goal:** Non-sponsor creators can complete primary sale setup from the dashboard.

**Work:**
1. Add Stellar wallet adapter module (Freighter-first for testnet):
   - New: `frontend/src/services/nft/stellarWallet.ts`
   - Functions: `isWalletAvailable()`, `getPublicKey()`, `signTransaction(xdr|network)`, clear errors if extension missing
2. Extend `nftApi.ts`:
   - `submitNftSaleConfig({ collectionId, serializedTransaction, accessToken })` → existing `POST /v1/collections/:id/sale-config/submit`
   - Optionally `submitNftMint` for symmetry (can be Phase 3 if needed)
3. Update `CollectionDashboard.tsx`:
   - When prepare returns **without** `autoSubmitted`, show “Sign with wallet” → sign → submit → refresh `primarySale`
   - Keep sponsor auto-submit path unchanged
   - Never put secret seeds in the browser
4. Tests:
   - Unit/mock wallet + dashboard action tests
   - API tests already cover submit; keep them green

**Verify:**
```bash
npm --prefix frontend run test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix services/nft-service/api run test
```
Manual (when Freighter + identities available): non-sponsor owner sale config end-to-end.

**Commit:**
```
feat: wire Freighter sale-config sign and submit
```

**Memory/agent-convo:** Wallet choice (Freighter), endpoints used, remaining buyer path.

---

### Phase 3 — Public buyer wallet checkout submit

**Goal:** Public collection page completes purchase after prepare.

**Work:**
1. `nftApi.ts`: `submitPublicCheckoutIntent({ intentId, serializedTransaction })` → `POST /v1/public/checkout/intents/:id/submit` (reuse auth-less public route already in `app.ts`)
2. `PublicCollection.tsx`:
   - After prepare, button: Connect wallet / Sign & submit
   - On success show confirmed hash + explorer link; never claim bought until confirmed
   - Prefer wallet pubkey over manual address when connected (still allow paste for prepare-only)
3. Persist already handled server-side via `submitCheckoutIntent` + repository claim
4. Tests: component + API; Playwright mock journey for sign→confirmed UI

**Verify:** frontend test/lint/build + NFT API tests; optional live buyer smoke with funded testnet USDC identity.

**Commit:**
```
feat: complete public NFT checkout with wallet submit
```

**Memory/agent-convo:** Public route behavior, any testnet buyer tx hash.

---

### Phase 4 — Creator mint from dashboard (optional but recommended next)

**Goal:** Studio can mint a token to a recipient without leaving NFT UI.

**Work:**
1. FE clients for prepare/submit mint (API already has routes).
2. Dashboard modal: recipient + tokenId → prepare → wallet sign if needed → submit.
3. Surface errors: `token_already_minted`, auth missing.

**Verify:** NFT API mint tests + FE unit tests + lint/build.

**Commit:**
```
feat: add creator mint flow to NFT dashboard
```

---

### Phase 5 — Pinata mode readiness (code + gated credential smoke)

**Goal:** Production metadata path is switchable and verified without committing secrets.

**Work:**
1. Confirm `NFT_STORAGE_MODE=pinata` + `PINATA_JWT` path in `server.ts` / health capabilities (already mostly wired).
2. Add integration test with mocked Pinata HTTP (extend `pinning.test.ts` / app tests) for success + 502 mapping.
3. Document root `.env.example` fields and a one-command smoke:
   - upload media → create collection → assert `storageMode: pinata` and `ipfs://` URIs
4. **Manual gate (Nabil):** set real `PINATA_JWT` locally, run one upload, record CID in memory (not the JWT).

**Verify:**
```bash
npm --prefix services/nft-service/api run test
```
Manual only if JWT present.

**Commit:**
```
feat: harden Pinata storage mode and document smoke
```

---

### Phase 6 — Shared NFT persistence interface (Dynamo-ready)

**Goal:** Replace single-process file store with a repository that can run multi-instance.

**Work:**
1. Keep `NftRepository` interface as the seam.
2. Implement `DynamoNftRepository` (or Postgres if team prefers — default Dynamo to match platform tables naming `zexvro-*`):
   - PK patterns for collections by workspace, checkout intents by id/idempotency key
   - Atomic claim for checkout submit (conditional update)
3. Factory in `server.ts` selected by env: `NFT_REPOSITORY=file|dynamo` (file remains default for local).
4. Contract tests against the interface (shared test suite for in-memory + dynamo mock).
5. Do **not** require live AWS in CI; use mocked AWS SDK or local file fallback.

**Verify:** repository unit tests + existing app tests with in-memory/file; lint/build.

**Commit:**
```
feat: add pluggable NFT repository with Dynamo option
```

**Memory/agent-convo:** Table names, env vars, migration note from JSON file.

---

### Phase 7 — Managed sponsor secret injection (docs + runtime hardening)

**Goal:** Hosted deploy can inject `STELLAR_SPONSOR_SECRET` without CLI identity.

**Work:**
1. Fail fast at startup if production mode and sponsor secret missing (detect via `NODE_ENV` or `NFT_REQUIRE_SPONSOR=1`).
2. Document AWS Secrets Manager → env injection in `services/nft-service/README.md` and `docs/aws_deployment.md` if appropriate.
3. Keep local CLI identity path for dev (`ZEXVRO_STELLAR_IDENTITY` via `scripts/dev.mjs`).
4. Health endpoint already reports `stellarConfigured` — ensure accuracy.

**Verify:** unit tests for config validation; lint/build; no secret leakage in logs.

**Commit:**
```
feat: require managed sponsor secret in production mode
```

---

### Phase 8 — Mint inventory + archive semantics

**Goal:** Studios see minted items and can hide live collections without implying on-chain delete.

**Work:**
1. Domain:
   - `status: live | failed | deploying | archived` (or `visibility: public|archived` keeping chain live)
   - Optional `MintedItemRecord` list (tokenId, owner, mintTx, mintedAt) written on successful mint/checkout submit
2. API: list items for collection; archive/unarchive endpoints (owner-auth only)
3. FE: inventory table on dashboard; archive action with clear copy (“hides from studio lists; contract remains live”)
4. Tests for status transitions and public page 404/hidden when archived

**Verify:** API + FE tests; lint/build.

**Commit:**
```
feat: track minted inventory and archive live collections
```

---

### Phase 9 — De-pin durable replay + rate-limit store

**Goal:** Multi-instance-safe abuse controls.

**Work:**
1. Introduce interfaces:
   - `ReplayStore.claim(key, ttlMs): Promise<boolean>`
   - `RateLimitStore.consume(key, max, windowMs): Promise<RateLimitResult>`
2. Keep in-memory implementations as default.
3. Add file-backed or Redis/Dynamo implementation behind `DEPIN_STATE_BACKEND=memory|file|redis`.
4. Wire into `proxy.ts` without changing x402 payment order.
5. Extend tests for shared store behavior (replay still fails second fulfill).

**Verify:**
```bash
npm --prefix services/depin run test
npm --prefix services/depin run lint
npm --prefix services/depin run build
```

**Commit:**
```
feat: add pluggable depin replay and rate-limit stores
```

---

### Phase 10 — De-pin managed provider configuration

**Goal:** Provider routes not only from machine-local JSON.

**Work:**
1. Support config from env path **or** remote/managed JSON URL **or** Dynamo document (start with env path + optional `DEPIN_CONFIG_JSON` inline for containers).
2. Validate with existing config schema; hot-reload optional (v1: load on boot).
3. Dashboard status already lists providers — ensure source is reported.
4. Document production config ownership.

**Verify:** depin config tests + lint/build.

**Commit:**
```
feat: support managed depin provider configuration sources
```

---

### Phase 11 — Docs sync + PR readiness

**Goal:** `planning.md` / `pages.md` / `context.md` match reality; PR is reviewable.

**Work:**
1. Update `pages.md` NFT/De-pin rows from “UI partial 35%” to accurate completion.
2. Update `planning.md` ownership table (NFT not Planned; De-pin not Blocked).
3. Final memory handoff summarizing all phases and open blockers.
4. Open/update PR from `feature/nft-service` → `main` (execute mode only, with user confirm for push).

**Verify:** doc links; full test matrix green.

**Commit:**
```
docs: sync nabil service status across planning pages and memory
```

---

## Per-phase commit & handoff template

After each successful phase:

### Commit message style
```
<type>: <≤72 char imperative summary>
```
Types: `feat`, `fix`, `test`, `docs`, `chore`. No AI fluff.

### `memory.md` entry (append bottom)
```md
## YYYY-MM-DD - Codex with Nabil - <phase title>

- Service or area:
- Files changed:
- Summary:
- Decisions:
- Follow-ups:
- Blockers:
- Verification:
```

### `agent-convo.md` snippet (append short section)
```md
## Handoff after Phase N — <title>
- Branch / tip:
- Done:
- Next phase:
- Commands to re-verify:
- Do not touch:
```

This is what makes agent switches safe after rate limits.

---

## Verification matrix (orchestrator)

| Phase | Frontend unit | Frontend e2e | NFT API | De-pin | Manual |
| --- | --- | --- | --- | --- | --- |
| 0 | ✓ | optional | ✓ | ✓ | — |
| 1 | ✓ | ✓ mocked | ✓ | — | signed-in UI if possible |
| 2 | ✓ | optional | ✓ | — | Freighter sale if available |
| 3 | ✓ | ✓ mocked | ✓ | — | buyer Freighter if available |
| 4 | ✓ | optional | ✓ | — | optional live mint |
| 5 | — | — | ✓ | — | Pinata JWT smoke |
| 6 | — | — | ✓ | — | — |
| 7 | — | — | ✓ | — | — |
| 8 | ✓ | optional | ✓ | — | — |
| 9 | — | — | — | ✓ | — |
| 10 | optional | optional | — | ✓ | — |
| 11 | docs only | — | full matrix | full matrix | PR review |

Never claim production Pinata, multi-instance De-pin, or live wallet success until the phase verification row is green **and** any manual gate is recorded in `memory.md`.

---

## Execution order summary

```text
0 Baseline
1 Smoke runbook/harness
2 Wallet sale-config submit
3 Wallet public checkout submit
4 Creator mint UI
5 Pinata readiness (+ manual JWT)
6 Pluggable NFT repository
7 Managed sponsor secret gate
8 Inventory + archive
9 De-pin durable stores
10 De-pin managed config
11 Docs sync + PR
```

Phases 2–3 are the highest product value. Phases 5–7 are production gates. Phases 9–10 make De-pin deployable beyond one process.

---

## Out of scope (do not pull into this plan)

- Morph / Transformation Agent changes
- A-2-A Trade, Agent Auth
- Zer0 privacy contracts / live Stellar balances for payroll
- Multi-chain NFT
- Streaming De-pin payments / sessions / custom facilitators
- Root npm workspaces migration

---

## Risk notes

| Risk | Mitigation |
| --- | --- |
| Freighter unavailable in CI | Mock wallet module; keep e2e hermetic |
| Pinata JWT missing | Code path + mock tests; manual gate |
| Dynamo not provisioned | File default; Dynamo optional via env |
| Scope creep into Paris/Rushi areas | Explicit out-of-scope list |
| Claiming “production ready” early | memory.md verification discipline |

---

## Definition of done (overall)

- [ ] Signed-in NFT path documented and harnessed
- [ ] Non-sponsor sale config completable via wallet UI
- [ ] Public buyer checkout completable via wallet UI
- [ ] Pinata mode verified (mock always; live if JWT)
- [ ] NFT repository pluggable beyond single file
- [ ] Production sponsor secret requirement explicit
- [ ] Inventory + archive without lying about on-chain delete
- [ ] De-pin replay/rate-limit pluggable for multi-instance
- [ ] De-pin config loadable from managed sources
- [ ] `memory.md` + `agent-convo.md` updated every phase
- [ ] Each phase tested before commit
