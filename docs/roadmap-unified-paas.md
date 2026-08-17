# ZEXVRO Unified PaaS — Roadmap

> **Status:** Draft (2026-08-09) · Owner: Paris (whole-team input welcome)
> **Why this exists:** "Making ZEXVRO stable" means making it a **unified platform**, not fixing five disconnected products. Every feature/credential/Morph fix is secondary to the base layer that unifies the five services (Zer0 · Morph · REQWID · NFTo · DEDSEC).

---

## 0. Why "stable = unified"

Today ZEXVRO is five standalone products sharing a shell, not one platform. Evidence from the code:

- **4 API origins, 4 auth systems** — platform (API Gateway), NFTo (App Runner), DEDSEC (App Runner), REQWID (`api.zexvro.in/gate`), mail (Brevo via Lambda). Each client reimplements headers/errors/CORS (`api/api.ts`, `services/nft/nftApi.ts`, `services/depin/depinApi.ts`, `services/agent-auth/agentAuthApi.ts`).
- **Service catalog hardcoded ~20×** — same five services redefined in `serviceCatalog.ts`, `landing/…/data/services.ts`, `DashboardLayout.tsx`, `Services.tsx`, `docs/DocsLibrary.tsx`, `agent/platformKb.ts`, `agent/morphActions.ts`, `mock.ts`. `serviceCatalog.ts` is stale (NFTo still `inactive`/"needs chain decision" though it's mainnet).
- **No workspace scoping across services** — platform data is workspace-bound; NFTo/DEDSEC/REQWID are not.
- **Credits exist but aren't the metering layer** — ZCR grants/promos exist; NFTo/DEDSEC/Zer0 don't bill one ledger.
- **No unified health/status plane, no unified audit, no unified agent memory.**

A judge, investor, or first client sees "one platform" only when there is a control plane the services plug into.

---

## 1. North star

ZEXVRO is a **unified Web3 PaaS**: one identity, one workspace, one credits ledger, one control plane — with five pluggable services (private payments, migration agent, human/agent gate, NFTs, paid API access). Vercel/Cloudflare clarity, Stellar rails.

---

## 2. Phases

### Phase A — Unify the spine (weeks 1–3)

Goal: one platform identity, one front door, one auth. Pure-code + one gateway routing layer. No new paid infra.

| # | Base service | Scope | Deliverable |
|---|---|---|---|
| A1 | **Service Registry** | Single `ServiceManifest` type + catalog file as the ONLY source of truth (id, name, icon, routes, status, health URL, capabilities, workspace binding). Consumed by sidebar, Services page, docs, landing, agent KB. | `frontend/src/data/serviceCatalog.ts` rebuilt; ~20 hardcoded copies refactored to consume it |
| A2 | **Unified API Gateway** | Route all service traffic through one origin (API Gateway → path-prefix routing to Lambda / App Runner NFTo / App Runner DEDSEC / REQWID). One auth header, one error shape. | Gateway routes + one shared `apiClient` |
| A3 | **Unified Identity/Session** | One Cognito token accepted by every service API; service SDKs inherit the session instead of own tokens. | Shared session module; NFTo/DEDSEC/REQWID clients use it |
| A0 | **Green gate** | Fix the 12 failing frontend tests (NFT CollectionCreate/Dashboard, stellarWallet, App.routing) + make `npm run lint && npm test && npm run build` clean. | CI green baseline |

Exit criteria: sidebar, services page, docs, landing, and agent all read the same registry; a single logged-in session calls NFTo, DEDSEC, REQWID, and platform through one origin.

### Phase B — Unify value (weeks 4–6)

Goal: services bill one ledger and live inside workspaces.

| # | Base service | Scope |
|---|---|---|
| B1 | **Credits / metering plane** | One ZCR ledger per workspace; NFTo checkout, DEDSEC settle, Zer0 settle all draw/bill it. Balance + usage surfaced in dashboard. |
| B2 | **Workspace provisioning** | NFTo collections, DEDSEC routes, REQWID sites become workspace-scoped instances with per-workspace keys/config. |
| B3 | **Audit + telemetry plane** | One workspace audit log + one `/health`/status endpoint per service surfaced via the registry. |
| B4 | **Onboard NFTo + DEDSEC first** | Most PaaS-like services prove the pattern before Morph/REQWID. |

Exit criteria: creating a workspace provisions real service instances; paying for NFTo/credits updates one ledger; every service reports health through the registry.

### Phase C — Agentic + delivery (weeks 7–10)

| # | Scope |
|---|---|
| C1 | **Morph as a module** on the unified base (registry entry, workspace-scoped memory, shared agent memory that actually persists). |
| C2 | **REQWID as a module** (public host `gate.zexvro.in`, multi-tenant site create, SDK distribution). |
| C3 | **CI/CD on the unified repo** — build + test on every push; deploys via the gateway. |
| C4 | **Cost discipline** — Lambda auto start/stop of the ZK EC2 worker; worker off by default (~$124/mo saved); App Runner at smallest size. |

Exit criteria: all five services are registry-driven modules of one platform; CI green; infra costs predictable.

### Phase D — Programs, team, first client (weeks 10+)

| # | Scope |
|---|---|
| D1 | **Startup programs** — anchor narrative: "3rd place, Stellar Garage Pune" + real SPPU bootcamp usage. Apply (ordered by fit): Stellar Community Fund / Stellar Development Foundation grants → Stellar hackathons/bootcamps → T-Hub, 100x Entrepreneurs, MeitY TIDE → YC/GV later. Keep a per-program tracker. |
| D2 | **Marketing refresh** — update `marketing.zip` + `ZEXVRO.pptx` + landing with the garage win and the control-plane story; README badges + screenshots; fix Dependabot (69 vulns, 2 critical). |
| D3 | **Team expansion** — first hires funded by Phase D wins: security/audit reviewer (weakest claim: ZK + Soroban custody), devrel/community, BD/sales. Keep the Paris/Rushi/Nabil ownership model. |
| D4 | **First client** — land-and-expand: SPPU bootcamp as anchor partner → NFTo indie game studios → cross-sell DEDSEC/Zer0. Freemium wedge: one service free, pay for the rest. |

---

## 3. Explicitly NOT in this roadmap

- Multi-chain support (v1 stays Stellar/Soroban).
- A2A Trade (removed from MVP; do not market).
- New paid infrastructure before Phase B proves the model.
- Any "perfect detection" / anti-farm claims for REQWID.
- Marketing DEDSEC as fully shipped.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Gateway/CORS churn breaks live NFTo/DEDSEC | Green gate + per-origin rollout, one service at a time |
| Registry refactor churns 20 files | Pure data move first; UI consumers adopt incrementally |
| Credits refactor breaks live NFTo checkout | Ledger behind same API shape; B4 onboards NFTo last among billers |
| Team scope creep during Phase A–C | Ownership map stays (Paris/Rushi/Nabil); cross-cutting needs `memory.md` entry |
| Cost creep (EC2, App Runner) | Auto stop/start + smallest App Runner; worker off by default |

---

## 5. Current state snapshot (2026-08-09)

- **Shipped:** NFTo (mainnet WASM + App Runner + USDC checkout), Zer0 (product UI + SDK16/Protocol 27 fix deployed to EC2 worker), Cognito dashboard, labs.zexvro.in bootcamp platform (SPPU), landing site, pitch masters.
- **Fragile:** 12 red frontend tests; Zer0 settle E2E not yet run; service catalog stale; 4 API origins; no CI; credits not unified.
- **Costs:** credits currently cover ~$43/mo usage; worker would add ~$124/mo if left on.

---

## 6. Trackers

- **Test gate:** `cd frontend && npm run lint && npm test && npm run build` must be green by end of Phase A0.
- **Program applications:** per-program table (name, deadline, fit, status) — create once Phase D starts.
- **AWS cost:** re-check Cost Explorer monthly; worker off by default.
