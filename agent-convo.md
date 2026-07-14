# Say hello

> say hello

Hello! How can I help you today?

> analyze memory.md [context.md](context.md) [planning.md](planning.md) [README.md](README.md) and understand the context properly by analyzing the repo branches git history and then tell me about this project use the proper agents and skills for it

<details><summary>4 previous messages</summary>

> I'll read the project docs and skill guidance, then inspect git history and branches in parallel.
>
> Reading the core docs and the analyze-project skill next.
>
> User asked for proper agents — I'll pull recent memory and spawn explorers for services and frontend in parallel.
>
> Filling remaining gaps on blockers, team ownership, and routing before the overview.
</details>

# ZEXVRO — Project Overview

## What it is
**ZEXVRO** is a unified **Web3 PaaS** (product style: Vercel/Cloudflare clarity) for teams moving Web2 products onto private, verifiable, **agent-ready** infrastructure — primarily on **Stellar**, with **AWS** for cloud pieces.
Repo: `https://github.com/polymaths-org/zexvro`

One-liner from product docs: *help teams get Web3 benefits without raw blockchain complexity.*

---

## Operating model (docs as source of truth)
| File | Role |
| --- | --- |
| `README.md` | Brand-level public summary |
| `context.md` | Stable product/architecture/ownership |
| `memory.md` | Chronological decisions, blockers, handoffs |
| `planning.md` | Proposed UX/architecture (not all implemented) |
| `design.md` | UI/theme/brand rules |
| `pages.md` | Route-by-route completion map |

Agents are expected to boot: README → context → memory → git status → scoped change → update memory.

---

## Team & MVP services
Three owners, six MVP services first (generic PaaS later):

| Owner | Services | Status |
| --- | --- | --- |
| **Paris** (`paris-29`) | ZK Privacy Pool · **Morph** (Transformation Agent) | Privacy: planned · Morph: CLI built (`services/transformation-agent/cli/`) |
| **Rushi** (`Wraient`) | A-2-A Trade Pipeline · Captcha-like Agent Auth | Planned / UI placeholders |
| **Nabil** (`n4bi10p`) | **NFT Service** · **De-pin** (x402 gateway) | Most advanced — working local/testnet paths |

---

## What’s actually built

### 1. Frontend (`frontend/`)
- **Stack:** Vite + React 19, Tailwind, Zustand, **TanStack Router**, Cognito auth, Framer Motion/Three for marketing polish.
- **Shape:** Marketing `/` → dashboard under `/dashboard/w/:workspaceId/...` and project scope `/dashboard/w/:workspaceId/p/:projectId/...`.
- **Real integrations:** NFT + De-pin client modules; Cognito; partial AWS APIs (workspaces, projects, payroll, `/api/memory`).
- **Prototype / partial:** Zer0 privacy/payroll/proofs (much AWS-memory backed), Morph web panel, Trade, Agent Auth, Security/Analytics.
- **Note:** `planning.md` once proposed React Router; **accepted decision is TanStack Router**. Some older planning text still lags.

### 2. NFT Service (`services/nft-service/`) — Nabil
- **Contract:** Rust/Soroban, one collection per contract (OpenZeppelin Stellar NFT base).
- **API:** TypeScript/Express — media, collections, mint intents, primary USDC checkout (buyer signs auth entries; sponsor pays envelope).
- **Auth:** Cognito on workspace routes; public health/asset/buyer pages.
- **Dev storage:** Local content-addressed mode; **production Pinata IPFS still blocked**.
- **Testnet:** WASM deployed; sponsor/buyer identities + USDC smoke paths documented in memory.

### 3. De-pin (`services/depin/`) — Nabil
- Fail-closed **x402 v2 exact** reverse proxy for idempotent `GET`/`HEAD`.
- Flow: 402 → verify → fulfill+buffer → settle → release body.
- Live **0.001 USDC** Stellar testnet settlement recorded.
- Config is machine-local; **in-memory replay/rate-limit** → not multi-instance safe.

### 4. Morph (`services/transformation-agent/`) — Paris
- Python Typer CLI/TUI, SQLite memory, tools skeleton, Stellar KB hooks.
- Web panel and full LLM wiring still next; **do not reshape without Paris**.

### 5. Shared / AWS
- Cognito frontend auth.
- DynamoDB + Lambda for workspaces/projects/employees/payroll/taxonomy and temporary `/api/memory`.
- Stellar credentials for broader platform (Zer0 pool, custody model) still requested from Nabil.

---

## Git history & branches
**Current branch:** `feature/nft-service` (1 commit ahead of `main`: NFT asset/mint endpoint tests).
**Remote:** `origin` → polymaths-org/zexvro.

**Evolution (compressed):**
1. Docs + brand foundation
2. Frontend scaffold + design system
3. Morph CLI + auth/memory (`feat/Morph`, merged via PR #1)
4. Routing + Zer0 prototype (`updates-routing-and-zer0`)
5. NFT + De-pin foundations, dashboard wiring, testnet smoke
6. NFT lifecycle/public buyer, sale config, sponsor auto-submit, root `npm run dev`

**Other remotes:** `main`, `feat/Morph`, `updates-routing-and-zer0`, `gh-pages`.

**Working tree:** many local uncommitted/untracked items (root `.env.example`, `package.json`, `scripts/`, README/memory tweaks, service `.env.example`s) — recent “root env and dev runner” work.

---

## Local run (accepted direction)
```bash
cp .env.example .env
npm run dev        # NFT API + frontend
npm run dev:all    # + De-pin
```
Root runner injects env; can load Stellar CLI identity when `STELLAR_SPONSOR_SECRET` is empty. Secrets stay out of `VITE_*` and out of git.

---

## Active blockers (from `memory.md`)
1. **NFT production:** Pinata, managed sponsor secrets, shared persistence.
2. **De-pin scale:** shared replay/rate-limit store before multi-instance.
3. Broader **Stellar custody/wallet** policy still open for Zer0 and non-sponsor signing UX.

**Active handoff:** Nabil — signed-in frontend collection deploy smoke, then prod credential/infra; leave Morph and Rushi services alone.

---

## Product principles that actually matter day-to-day
- Dashboard-first, not crypto-casino UI.
- Agents are first-class; actions should be proposal-first/auditable when automated.
- No fake “live” balances/settlements/tax claims.
- Scope ownership hard — cross-service contracts go in `memory.md`.
- Prefer Stellar where it fits; AWS for app backends.

---

## Maturity snapshot
| Area | Maturity |
| --- | --- |
| Agent docs workflow | Strong |
| NFT contract + API + FE | Strong local/testnet MVP |
| De-pin gateway | Strong local/testnet MVP |
| Dashboard shell/routing | Solid prototype + partial AWS |
| Morph CLI | Built; deeper product integration pending |
| Privacy pool / Trade / Agent Auth | Planned / UI stubs |
| Production multi-tenant platform | Not there yet |

---

## If you work in this repo next
1. Read `context.md` + latest `memory.md` entries.
2. Stay in your service boundary (or record a handoff).
3. Prefer smallest change + memory entry.
4. For Nabil path: signed-in NFT collection deploy, then Pinata/shared persistence/De-pin config promotion.

I used the project’s agent boot docs (context/memory/planning) plus git history and codebase inspection. Multi-agent spawn isn’t enabled in this session, so exploration was done directly rather than via sub-agents.

Want a deeper dive next on **NFT checkout flow**, **De-pin payment path**, or **dashboard/AWS data map**?

> check my last commit and you will understand

Got it — your last commit makes the active focus clear.

**Last commit:** `767df50` — `test: cover NFT asset and mint endpoints`
**Branch:** `feature/nft-service` (in sync with origin)
**Scope:** only `services/nft-service/api/src/app.test.ts` (+61 / −2)

What it locks in:

1. **Local asset serving** — `GET /v1/assets/:assetId` returns bytes + `Content-Type` + ETag, 404s unknown hashes, 400s bad IDs
2. **Creator mint flow** — `POST .../mints/intent` → prepare with `requiredSigners`, then `POST .../mints/submit` → confirmed hash
3. **Fake chain fix** — `prepareMint` now takes `operatorAddress` and returns it as a required signer (matches real sponsor/owner auth)

So the live track is **Nabil’s NFT API**: asset delivery + mint intent/submit, not Morph/De-pin product redesign.

**Also sitting uncommitted** (not in that commit): root env/dev runner work — `.env.example`, `package.json`, `scripts/`, README/memory, service env pointers, vite config. That’s the “root `npm run dev`” follow-up from the latest memory entry.

Want me to:
- harden more NFT API tests,
- review/commit the root env runner stack, or
- run the full NFT API suite next?

> do one thing analyze the .codex folder from home directory and look for my previous context history

<details><summary>3 previous messages</summary>

> Digging into memories, session index, and history for ZEXVRO-related context.
>
> Searching recent sessions and history for ZEXVRO/NFT context.
>
> Pulling a clean list of ZEXVRO thread prompts and recent session titles.
</details>

# `~/.codex` context analysis

## What’s in `~/.codex`
| Path | Role | Useful for ZEXVRO? |
| --- | --- | --- |
| `sessions/2026/07/.../*.jsonl` | Full conversation rollouts | **Yes — main history** |
| `state_5.sqlite` → `threads` | Thread index (cwd, branch, first message) | **Yes** |
| `history.jsonl` | Compact prompt log (121 lines) | Partial / older |
| `session_index.jsonl` | Older named threads | Sparse; not ZEXVRO-heavy |
| `memories/` | Durable memory | **Empty / pruned** — no project memory |
| `memories_1.sqlite`, `goals_1.sqlite` | Memory/goals DB | Little durable ZEXVRO content |
| `config.toml`, `auth.json` | Config / auth | Config only (not product context) |
| `logs_2.sqlite` | Runtime logs (~148MB) | Ops, not product intent |

**Bottom line:** Your previous ZEXVRO context lives almost entirely in **session rollouts + `state_5.sqlite`**, not in durable memory files.

---

## Durable memory is empty
- `memories/MEMORY.md` → no consolidated task memories
- `raw_memories.md` → “No raw memories yet”
- Prior rollout summaries were pruned

So Codex will **not** auto-recall ZEXVRO across threads unless you re-open a session or re-read repo docs (`context.md` / `memory.md`).

---

## ZEXVRO threads found

| Thread | When | Branch | What it is |
| --- | --- | --- | --- |
| `019f46ee-...` | Jul 9 → Jul 11 | `feature/nft-service` | **Main Nabil NFT/De-pin implementation thread** (~25MB rollout) |
| `019f52af-...` | Jul 12 | same lineage | Continuation / fork of that work (env merge / root dev) |
| `200ba26e-...` | Jul 11–12 | `feature/nft-service` | **This current “Say hello” session** |
| Several short child rollouts | Jul 10–12 | zexvro cwd | Approval/approval side sessions of the same work |

Other history in `~/.codex` is unrelated: rice/HyDE UI, ClawDroid, vibe-code tmux, storage cleanup, etc.

---

## Main prior storyline (from session `019f46ee`)
You as **Nabil**, owning **NFT + De-pin**, in order:

1. Read `context.md` / repo, ask questions
2. Plan Nabil’s side; you had Stellar CLI ready
3. **Implement** the Nabil services plan (NFT FE → contract/API → De-pin x402)
4. Test setup: Stellar + De-pin help; frontend↔API wiring
5. Cognito token confusion; AWS CLI checks / billing asides
6. Merge with `updates-routing-and-zer0`
7. Stellar credentials for Paris; client vs backend config Q&A
8. Sidebar regroup for NFT/De-pin
9. Debug deploy: missing final identifiers
10. Add lifecycle: delete/retry/edit + public buy URL
11. Sale-config / auth-entry bugs (`authorization_not_required`, sale UI state)
12. Endpoint tests + real-image deploy/sell/buy smoke
13. Branch `feature/nft-service` + push
14. **Last big ask:** single root `.env` + run frontend + NFT API from repo root

That last item matches the **uncommitted** root env/dev runner work still in the working tree.

---

## What this means for *this* session
- You’re on the right branch: `feature/nft-service`
- Last **git** commit: NFT asset + mint endpoint tests
- Last **Codex** product direction from history: root unified env + `npm run dev` for FE+NFT
- Durable Codex memory won’t help next time — **repo `memory.md` is the real shared brain**

---

## Not recovered as durable facts
No long-lived secrets/preferences stored in `memories/`.
Stellar identities / sponsor flow live in **repo docs + local CLI**, not Codex memory.

If you want, next I can:
1. resume exactly from the **root env / `npm run dev`** unfinished work, or
2. re-open a specific past prompt (e.g. real-user buy/sell smoke) and continue from that point.

> yes read the main history for zexvro

# Main ZEXVRO history (Nabil thread)

**Source:** `~/.codex/sessions/.../019f46ee-...jsonl` (~26MB)
**Cwd:** `/home/n4bi10p/Buildbox/zexvro`
**Branch end-state:** `feature/nft-service`
**You:** Nabil — owner of **NFT Service** + **De-pin**
**Hard boundaries:** do not reshape Paris’s Morph or Rushi’s Trade/Agent Auth

---

## Arc in one line
Understand Nabil’s scope → implement NFT + De-pin → wire FE → fix real testnet/UX bugs → branch/push → start unified root env/dev runner (last open work).

---

## Phase 1 — Onboarding (turns 1–4)
1. Read `context.md`, analyze repo, ask questions.
2. Re-check `memory.md` / `context.md` / `cli.md` after your answers.
3. Plan “our side” with recommendations.
4. Stellar CLI installed → start recommended work.

**Established:** six MVP services, Nabil owns NFT + De-pin; Morph/Paris and Trade/Auth/Rushi off-limits.

---

## Phase 2 — Implementation plan approved (turn 5)
You ordered full build of **Nabil Services Implementation Plan**:

| Area | Intent |
| --- | --- |
| Docs | Correct handoff in `memory.md`; De-pin scoped, not blocked |
| Frontend | Routes + NFT wizard/dashboard (initially React Router; later evolved with TanStack workspace routes) |
| NFT contract | One Soroban collection per contract, OZ NFT base, USDC primary sale |
| NFT API | Express, Pinata/local media, Cognito, mint/checkout intents |
| De-pin | x402 v2 exact reverse proxy, GET/HEAD only, Stellar testnet USDC |

Preserve Cognito, CLI activation, Morph polling, workspace behavior.

---

## Phase 3 — Test setup + FE↔API wiring (turns 6–14)
- How to test Stellar + De-pin → you asked agent to do setup.
- Wire frontend to NFT API; you test from the browser.
- **“A valid access token is required”** → Cognito access token after sign-in.
- AWS CLI checks / billing asides.
- Vite proxy `ECONNREFUSED 127.0.0.1:4101` → NFT API not running.
- Commit Nabil’s work; pull/merge `updates-routing-and-zer0`.

---

## Phase 4 — Product understanding (turns 17–22)
- Stellar credentials to share with Paris (public identities / non-secret config only).
- Backend vs client config matrix.
- “Is our side done?” + local env checklist.
- What De-pin is and future scope (streaming, sessions, marketplace deferred).
- Regroup NFT + De-pin into proper sidebar categories (not dumped under generic Services).
- Full walkthrough: royalty, client workflow, backend workflow.

---

## Phase 5 — Real bugs while testing NFT (turns 23–27)
| Issue | Resolution in history |
| --- | --- |
| “Stellar accepted deploy but no final identifiers” | Parse deployment result identifiers properly |
| Missing delete / retry / edit / public buy | Lifecycle actions + public collection page |
| “prepared call did not require expected creator/buyer auth” | Sponsor-owned sale: when invoker is owner, no non-invoker auth entry is valid → auto-submit sale config |
| Sale still shows “Prepare” after signing | Persist `primarySale` after successful submit so UI shows configured/update state |

---

## Phase 6 — Verification & branch (turns 28–30)
- Full NFT API endpoint tests (incl. buy/sell paths) → suite green (later **33/33** with asset + mint coverage).
- Live testnet flow with real image `assets/brand/brand-design.png`:
  - Deploy collection, set **0.01 USDC** sale, mint/buy path exercised.
  - Contract example recorded in session: `CAEGVXKQ...` (sponsor `GCD4...`, buyer `GDYJ...`).
- Create/push **`feature/nft-service`**.
- Last git commit on that branch: `767df50 test: cover NFT asset and mint endpoints`.

---

## Phase 7 — Last unfinished ask (turn 31)
Unify all env files into **one root `.env`** and run **frontend + NFT API from repo root**.

**Done in that session (uncommitted / local):**
- Root `.env.example`, `.gitignore`, `package.json`
- `scripts/dev.mjs` → `npm run dev` / `dev:all`
- Folder `.env.example` files as pointers
- README/memory updates

**Still true now:** that stack is in the working tree, not necessarily all committed on the branch tip.

---

## Outcomes that stuck

**Built**
- NFT Soroban contract + TypeScript API
- De-pin x402 gateway + testnet smoke
- Cognito-protected FE flows, collection lifecycle, public buyer page
- Root dev orchestration direction

**Accepted product rules**
- Stellar/Soroban only for NFT v1
- Primary sale = USDC transfer + mint atomic
- Buyer signs auth entries; sponsor pays envelope
- De-pin = exact per-request payments, GET/HEAD
- No secrets in repo / no `VITE_*` for sponsor secrets

**Open from history**
1. Commit root env/dev runner cleanly (if you want it on the branch)
2. Production Pinata + managed sponsor secret injection
3. Shared NFT persistence (not local JSON only)
4. De-pin multi-instance store (replay/rate-limit)
5. Full wallet UX for non-sponsor creators/public buyers

---

## Where *this* session sits
You reopened with “say hello” on `feature/nft-service`.
Main history ends at: **branch pushed + root unified env/dev started**.

I can continue from that exact last task next: finish/commit the root env + `npm run dev` stack, or re-run the live NFT deploy/sell/buy smoke. Which do you want?

> finish the last unfinished task continue it

<details><summary>5 previous messages</summary>

> Continuing the root env + unified `npm run dev` work. Checking what's already in place and what's still incomplete.
>
> Implementation is mostly done but uncommitted. I'll harden root env loading, fix remaining docs gaps, verify, and commit.
>
> Polishing remaining gaps: root `.env` fallback in Vite, `context.md` setup notes, clearer dev runner UX, then verify and commit.
>
> Verification looks good. Running a short root `npm run dev` smoke test, then committing.
>
> Fixing the memory verification hash to match the final commit.
</details>

# Finished: root env + unified dev runner

The last unfinished task is done and committed on `feature/nft-service`.

**Commit:** `05ef184` — `feat: unify local env and root dev runner`
**Branch:** ahead of origin by 1 (not pushed)

## What you get
- **One root env:** `.env.example` → copy to `.env`
- **One command:**
  - `npm run dev` → NFT API + frontend
  - `npm run dev:all` → + De-pin
  - `npm run dev:frontend` / `dev:nft` / `dev:depin` for single targets
- **Runner** (`scripts/dev.mjs`):
  - Loads root `.env` / `.env.local`
  - Injects env into child processes
  - Loads `zexvro-provider` from Stellar CLI when `STELLAR_SPONSOR_SECRET` is empty
  - Startup banner + absolute De-pin config path warning
- **Folder `.env.example` files** are pointers only
- **Vite** also loads root env if you run frontend alone
- **Docs:** `README.md`, `context.md`, service READMEs, `memory.md` updated

## How to run
```bash
cp .env.example .env
npm run dev
```

Smoke checked: NFT API on `4101`, Vite on `3000`, Stellar identity loaded from CLI.

## Left untouched (on purpose)
- Morph `.gitignore` / `morph_memory.db`
- `.vscode/`, `cli.md`

## Not done (next product work)
- Push branch if you want it remote
- Signed-in frontend collection deploy smoke
- Production Pinata / managed secrets / shared persistence

Want me to **push** `feature/nft-service` next?

## Handoff after Phase 1-2 — smoke harness + Freighter sale submit

- Branch / tip: `feature/nft-service` (commit pending this phase)
- Done:
  - `npm run nft:smoke` + runbook in `services/nft-service/README.md`
  - Freighter wallet module + dashboard **Sign with wallet** for non-auto sale config
  - Public collection **Connect wallet** + **Sign & submit** checkout client
- Next phase: Phase 3 live buyer verification if needed, then Phase 4 creator mint UI, then Pinata (5)
- Commands to re-verify:
  - `npm run nft:smoke`
  - `npm --prefix frontend run lint && npm --prefix frontend test && npm --prefix frontend run build`
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Freighter detection fix
- Branch / tip: `feature/nft-service` (uncommitted freighter fix until commit)
- Done: Official `@stellar/freighter-api` integration; async availability; better errors
- Next: Manual Freighter smoke on localhost, then Phase 4 mint UI
- Commands: `npm --prefix frontend test`, `npm --prefix frontend run lint`, then browser Connect wallet
- Do not touch: Morph, Trade, Agent Auth

## Handoff after Phase 4 — creator mint UI + Freighter JSON auth signing
- Branch / tip: `feature/nft-service` (commit pending this handoff)
- Done:
  - Official `@stellar/freighter-api` connect/sign path
  - AssembledTransaction JSON auth-entry signing for sale/mint/checkout submit
  - Dashboard **Mint token** modal: prepare → Sign with wallet → submit
  - Clearer NFT API simulation error mapping for trustline/balance
- Next: Phase 5 Pinata readiness; optional live Freighter mint smoke
- Commands:
  - `npm --prefix frontend run lint && npm --prefix frontend test && npm --prefix frontend run build`
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 8 — inventory + archive
- Branch / tip: `feature/nft-service` (commit pending this handoff)
- Done:
  - `MintedItemRecord` + repository list/get/save
  - Owner inventory + archive/unarchive routes; public inventory/nextTokenId; sold token metadata
  - Public buy page disables sold tokens and suggests next free ID
  - Dashboard inventory modal, minted counts, archive/restore
- Next: Phase 5 Pinata readiness, then shared persistence / De-pin durable stores
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test`
  - `npm --prefix frontend run lint && npm --prefix frontend test -- --run src/services/nft`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 5 — Pinata readiness
- Branch / tip: `feature/nft-service` (Phase 8 + Phase 5 uncommitted)
- Done:
  - Pinata service hardened + mocked unit tests (success / 502 / unreachable / no JWT leak)
  - App tests for pinata media + collection metadata ipfs URIs + baseMetadataUri required
  - server warn when pinata mode without JWT; health already reports storageMode
  - README + `.env.example` Pinata docs; `NFT_SMOKE_PINATA=1` media smoke path
- Next: Phase 6 shared NFT persistence (Dynamo option), or manual Pinata JWT smoke
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test`
  - `npm run nft:smoke` (optional `NFT_SMOKE_PINATA=1` + access token)
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 5 — AWS S3 media (AWS-first storage)
- Branch / tip: `feature/nft-service` (Phase 8 inventory + Phase 5 S3 uncommitted)
- Done:
  - Product decision: S3+CDN media, Dynamo records (next), Secrets Manager for sponsor
  - `S3AssetPinningService` + mocked tests; config/server modes `local|s3|pinata`
  - FE storage labels for AWS S3; docs/env examples updated
- Next: Phase 6 DynamoDB NFT repository, or real S3 smoke with bucket/role
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test`
  - For S3: set `NFT_STORAGE_MODE=s3 NFT_S3_BUCKET=... NFT_S3_REGION=...` (+ optional `NFT_CDN_BASE_URL`), AWS creds/role, restart API
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 6 — DynamoDB NFT repository
- Branch / tip: `feature/nft-service` (Phase 8 inventory + Phase 5 S3 + Phase 6 Dynamo uncommitted)
- Done:
  - `DynamoNftRepository` single-table design (`zexvro-nft`) + GSIs + atomic checkout claim
  - `NFT_REPOSITORY=file|dynamo` factory; file default for local
  - Mocked Dynamo unit tests; README + `.env.example` table/env docs
  - Build fixes: mint submit exactOptional fields; stripKeys generics; S3 optional typing
- Next: Phase 7 managed sponsor secret (Secrets Manager gate), or live S3/Dynamo smoke
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test && npm --prefix services/nft-service/api run build`
  - Dynamo: `NFT_REPOSITORY=dynamo NFT_DYNAMO_TABLE=zexvro-nft` (+ region/GSIs), AWS creds/role, restart API
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 7 — Managed sponsor secret gate
- Branch / tip: `feature/nft-service` (Phases 5–8 NFT work uncommitted)
- Done:
  - Fail-fast when `NODE_ENV=production` or `NFT_REQUIRE_SPONSOR=1` without sponsor secret + wasm hash
  - Config unit tests; README + aws_deployment + `.env.example` docs
  - Local CLI identity path preserved for `npm run dev`
- Next: Phase 9–10 De-pin durable replay/rate-limit + managed config; then Phase 11 docs/PR
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test && npm --prefix services/nft-service/api run build`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 9–10 — De-pin stores + managed config
- Branch / tip: `feature/nft-service` (NFT Phases 5–8 + De-pin 9–10 uncommitted)
- Done:
  - Pluggable replay/rate-limit stores (`memory`|`file`; redis reserved)
  - Config sources: inline JSON / URL / file path with documented priority
  - `/status` + FE types include `configSource` and `stateBackend`
- Next: Phase 11 docs sync + PR readiness; optional commit/push with user confirm
- Commands:
  - `npm --prefix services/depin run lint && npm --prefix services/depin test && npm --prefix services/depin run build`
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test && npm --prefix services/nft-service/api run build`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)

## Handoff after Phase 11 — Docs sync + PR readiness
- Branch / tip: `feature/nft-service` (all plan phases 5–11 code/docs uncommitted)
- Done:
  - `pages.md` / `planning.md` / `context.md` / `plan.md` reflect NFT + De-pin as working local/testnet MVPs
  - Full matrix re-verified: NFT API 60/60 + De-pin 34/34, lint/build green
- Next (user-gated):
  1. Commit Nabil work (prefer logical commits: NFT AWS stack, De-pin stores/config, docs)
  2. Optional PR `feature/nft-service` → `main` after push confirm
  3. Live AWS/Freighter ops smokes when credentials ready
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test && npm --prefix services/nft-service/api run build`
  - `npm --prefix services/depin run lint && npm --prefix services/depin test && npm --prefix services/depin run build`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)
- Do not commit secrets, local scratch scripts, or Morph dirt

### 2026-07-13 20:44 UTC — Live verification matrix
Completed full live AWS + local API smoke after unit green. NFT API running on 4101 with S3/Dynamo/Secrets Manager; De-pin on 4102 with file state. CloudFront 200; Dynamo integration OK; nft-smoke health OK; FE NFT tests 28/28. No commit. Remaining: browser Cognito/Freighter E2E + container host + IAM tighten.

## Handoff after commit + push — phases 5–11 landed on branch
- Branch / tip: `feature/nft-service` pushed to origin (no PR)
- Done: Committed NFT AWS stack, inventory, De-pin stores/config, docs/AWS runbook; excluded secrets/Morph/scratch
- Next: Auto token IDs (always allocate server-side); multi-surface checkout (public API + web popup SDK + headless); then browser Freighter E2E
- Commands:
  - `npm --prefix services/nft-service/api run lint && npm --prefix services/nft-service/api test && npm --prefix services/nft-service/api run build`
  - `npm --prefix services/depin run lint && npm --prefix services/depin test && npm --prefix services/depin run build`
- Do not touch: Morph (Paris), Trade/Agent Auth (Rushi)
