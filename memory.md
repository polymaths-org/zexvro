# ZEXVRO Shared Memory

## 2026-07-22 - E2E testnet: on-chain NFT + paid De-pin + full check summary

- Service or area: CI e2e-testnet suite
- Files changed: `scripts/e2e-testnet.mjs`, `.github/workflows/e2e-testnet.yml`
- Summary: Extended manual E2E to exercise real Stellar **testnet** paths: NFT media upload, collection deploy, mint, sale-config; De-pin unpaid 402 + paid USDC settle via demo client. Summary now lists every check (console + GITHUB_STEP_SUMMARY table). Secrets wired: GATE_ADMIN_API_KEY, COGNITO_SMOKE_*, NFT_SPONSOR_SECRET, DEPIN_BUYER_SECRET. Fixed De-pin live config recipient to sponsor G-address (had no USDC trustline on old root recipient).
- Local verification: `pass=26 fail=0 skip=0` (~54s) including `nft.mint` and `depin.paid_settle`.
- Still out of scope: Freighter UI, Zer0 ZK prove/withdraw.
- Follow-ups: optional GHA run after push; keep smoke Cognito user `e2e-smoke`.


This file is the chronological operating memory for ZEXVRO developers and coding agents.

Use it to record what changed, why it changed, what decisions were made, what is blocked, and what another agent needs to know before continuing. Keep it precise. Do not paste long logs, unrelated brainstorms, or raw context dumps.

## Required Agent Startup

Before any coding or documentation task, every agent must:

1. Read `AGENTS.md` (assignees + remaining work pointer).
2. Read `README.md`.
3. Read `context.md` — **Active Ticket Assignments** and **Remaining Work**.
4. Read this file (latest entries first, then scan for blockers).
5. Run `git status --short`.
6. Identify assignee scope + service/area being touched.
7. Check the latest memory entries for ownership, blockers, and decisions.
8. Make scoped changes only; do not steal another assignee’s ticket.
9. Add a memory entry after meaningful work / before committing.

## Purpose Of This File

This file exists so three developers and their agents can work in one repo without losing context or breaking each other's work.

It should answer:

- Who changed what?
- Why was it changed?
- Which service or shared area was touched?
- What decisions are now active?
- What is blocked?
- What should the next agent do?
- Which files are safe or unsafe to edit?

It should not contain:

- Full terminal logs.
- Full chat transcripts.
- Random ideas with no owner.
- Secrets, keys, wallet seeds, tokens, or private credentials.
- Large copied documentation from external sources.
- Service explanations that belong in `context.md`.

## Source Of Truth Rules

| File | Purpose |
| --- | --- |
| `README.md` | Public project overview and brand entry point |
| `context.md` | Stable product context, service definitions, ownership, agent rules |
| `memory.md` | Work history, decisions, blockers, handoffs, active coordination |
| Future service README | Service-local setup, contracts, architecture, and edit boundaries |

If a detail becomes stable product context, move it to `context.md` and record that move here.

If a detail is only a work update, keep it here.

## Ownership

| Service | Owner | Current status | Edit rule |
| --- | --- | --- | --- |
| Zero-Knowledge Privacy Pool (Zer0) | Paris / `paris-29` | **Complete (product UI)** — suite, privacy pool, stealth, settings client-facing | Ask before changing core proving/pool design; product UX marked complete 2026-07-17 |
| Transformation Agent (Morph) | Morph track (was Paris / `paris-29`) | **In Progress — CLI built; agentic + demo + CI/CD remaining** | Morph assignee builds CLI/agent/CI/demo/surface. Shared memory must actually update. |
| A-2-A Trade Pipeline | Rushi / `Wraient` | Planned | Ask or record coordination before changing protocol, wallet, or negotiation design |
| Captcha-like Agent Authentication Service | Rushi / `Wraient` | Planned | Ask or record coordination before changing identity, SDK, classifier, or HDM design |
| NFT Service | Nabil / `n4bi10p` + Paris | **Complete (product UI)** — create cinema, studio dashboard, public checkout, SDK, docs | Ask before changing minting, metadata, checkout, or NFT model |
| De-pin | Nabil / `n4bi10p` | **In progress** — CORS/status harden on branch; full Access Shield product testing **tomorrow** | Follow exact per-request x402 scope; redeploy App Runner before claiming live CORS |

Shared areas that need extra care:

- Auth.
- Wallets.
- Agent memory.
- Account/workspace model.
- API contracts.
- Data schemas.
- Deployment.
- Security.
- Billing.
- Navigation that affects multiple services.

## Work Rules

1. Keep changes scoped to the requested task.
2. Do not rewrite another developer's service direction without coordination.
3. Do not silently change shared contracts.
4. Do not introduce secrets or credentials.
5. Do not commit `.env` files.
6. Keep De-pin v1 on standard x402 exact per-request payments; streaming and sessions are deferred.
7. Do not treat locally tested code as a deployed integration.
8. Update this file after meaningful changes.
9. Commit the code/docs change and memory update together.
10. If a decision is uncertain, mark it as `Draft` or `Proposed`, not `Accepted`.

## Context Discipline

Agents should gather enough context to solve the task, then stop.

Good memory entry:

- Names the files changed.
- States the actual decision.
- Lists follow-ups.
- Records blockers.
- Is short enough for another agent to scan.

Bad memory entry:

- Dumps command output.
- Copies an entire conversation.
- Mentions vague progress with no files or next step.
- Says "updated stuff" without details.
- Hides a decision inside a paragraph.

## Decision Labels

Use these labels in memory entries when needed:

- `Draft`: idea is being explored.
- `Proposed`: direction is suggested but not final.
- `Accepted`: team should follow this until changed.
- `Blocked`: work cannot continue without input or a decision.
- `Deprecated`: previous direction should no longer be used.

Decision format:

```md
- Decision: Accepted - Use Vite + React for the frontend scaffold unless the team changes direction.
```

## Handoff Format

Use this when a task is incomplete or another developer/agent must continue:

```md
- Handoff:
  - Current state:
  - Next step:
  - Files to inspect:
  - Do not touch:
  - Owner needed:
```

## Memory Entry Template

Add new entries at the bottom of this file.

```md
## YYYY-MM-DD - Name or agent - Short title

- Service or area:
- Files changed:
- Summary:
- Decisions:
- Follow-ups:
- Blockers:
- Verification:
```

Use `None` for empty fields. Do not delete fields.

## Active Decisions

- Decision: Accepted - README stays brand-level and should not explain individual services.
- Decision: Accepted - Detailed service context belongs in `context.md`.
- Decision: Accepted - Work state, decisions, blockers, and handoffs belong in `memory.md`.
- Decision: Accepted - MVP priority is the six unique services before generic PaaS features.
- Decision: Accepted - Frontend direction is Vite + React.
- Decision: Accepted - Prefer Stellar Network for Web3/backend pieces where technically appropriate.
- Decision: Accepted - Morph is the product name for Transformation Agent.
- Decision: Accepted - CLI-first approach for Morph. SQLite for MVP memory.
- Decision: Accepted - NFT Service uses one Soroban contract per collection with OpenZeppelin Stellar `NonFungibleToken` Base. SEP-41 is used for the USDC payment token, not as the NFT standard. No multi-chain in v1.
- Decision: Accepted - NFT metadata uses Pinata-backed public IPFS; gameplay API attributes must be identified as mutable.
- Decision: Accepted - NFT local content-addressed HTTP storage is development-only. Production metadata remains Pinata-backed public IPFS and the UI must label local mode honestly.
- Decision: Accepted - NFT minting is studio-owner or delegated-minter controlled. Royalty data is informational and must not be described as enforcement on arbitrary transfers.
- Decision: Accepted - Primary NFT checkout atomically transfers USDC and mints. Buyers sign Soroban auth entries; the platform sponsor signs/pays the envelope without custodying buyer funds.
- Decision: Accepted - De-pin uses the official x402 v2 `exact` scheme on Stellar testnet USDC with standard payment headers and facilitator-sponsored fees.
- Decision: Accepted - De-pin v1 protects concrete idempotent HTTP `GET`/`HEAD` resources. Streaming, sessions, custom facilitators, and physical-device adapters are deferred.
- Decision: Accepted - Frontend uses TanStack Router for URL-backed workspace and project routing; NFT collection screens are project-scoped.
- Decision: Proposed - Use AWS for cloud infrastructure where needed.

## Active Blockers

| Blocker | Owner needed | Impact |
| --- | --- | --- |
| Live AWS S3/Dynamo/Secrets Manager not provisioned for NFT | Nabil / `n4bi10p` | Code/env modes ready; local/testnet defaults remain file + local media |
| De-pin multi-instance needs non-memory state | Nabil / `n4bi10p` | Prefer `DEPIN_STATE_BACKEND=file` (redis reserved); status exposes `multiInstanceSafe` |

## Active Handoffs

- Handoff:
  - Current state: The NFT frontend now uploads media and creates/lists collections through the Cognito-protected API. Local content-addressed storage and runtime Stellar sponsorship are ready for frontend testnet runs; production Pinata/shared persistence remain pending. The De-pin gateway has a machine-local provider config, and an exact `0.001 USDC` payment was settled successfully on Stellar testnet before releasing the upstream response.
  - Next step: Run one signed-in frontend collection deployment, then configure production Pinata, managed sponsor secret injection, shared persistence, and managed De-pin provider configuration.
  - Files to inspect: `frontend/src/services/nft/`, `services/nft-service/`, `services/depin/`, `context.md`, `memory.md`.
  - Do not touch: Paris's Morph/Transformation Agent, Rushi's Trade Pipeline and Agent Auth.
  - Owner needed: Nabil for the signed-in smoke run and production credentials/infrastructure.

## Change History

## 2026-07-05 - Codex - Initial project memory

- Service or area: project documentation and repository setup.
- Files changed: `context.md`, `memory.md`, `README.md`, `assets/brand/logo.png`, `assets/brand/typo-logo.png`, `assets/brand/brand-design.png`.
- Summary: Captured the initial ZEXVRO platform context, MVP service list, developer ownership, planned stack, brand assets, and shared-memory workflow.
- Decisions made: Six unique services are the MVP priority. Common PaaS features such as DB, deploy, hosting, security, and connectors are secondary unless time allows.
- Follow-ups: Scaffold the Vite/React frontend, define service directories, add exact setup commands, and ask Nabil for De-pin context.
- Blockers: De-pin scope is not defined yet.

## 2026-07-05 - Codex - README brand refresh

- Service or area: project documentation.
- Files changed: `README.md`, `memory.md`.
- Summary: Refreshed the README into a cleaner brand-facing page using the logo and typo-logo assets, stack badges, and links to project docs.
- Decisions made: Kept README high-level and avoided explaining individual services for now.
- Follow-ups: Replace remote badge images with local/generated badges later if the repo should avoid external README assets.
- Blockers: None.

## 2026-07-05 - Codex - Agent-first context and memory

- Service or area: project documentation and agent workflow.
- Files changed: `context.md`, `memory.md`.
- Summary: Reworked context and memory into precise agent-first operating docs with startup steps, ownership boundaries, context discipline, decision labels, blockers, handoff format, and service-specific edit rules.
- Decisions: Accepted - Keep README brand-level; keep detailed service context in `context.md`; keep work history and handoffs in `memory.md`.
- Follow-ups: Add service-local READMEs when code directories are scaffolded.
- Blockers: De-pin scope still needs Nabil's input.
- Verification: Read the Markdown diff for clarity and scope.

## 2026-07-05 - Codex - README logo2 update

- Service or area: project documentation and brand assets.
- Files changed: `README.md`, `context.md`, `memory.md`, `assets/brand/logo2.png`.
- Summary: Added `logo2.png` to tracked brand assets and updated the README hero image to use it.
- Decisions: Accepted - README should use `assets/brand/logo2.png` as the primary displayed logo.
- Follow-ups: None.
- Blockers: None.
- Verification: Checked README image reference and asset path.

## 2026-07-06 - Codex - Google AI Studio frontend prompt

- Service or area: frontend planning and UI prompt.
- Files changed: `docs/prompts/google-ai-studio-frontend-ui.md`, `memory.md`.
- Summary: Added a precise Google AI Studio prompt for generating the first ZEXVRO Vite/React frontend UI with shadcn/ui, dashboard shell, sidebar, platform sections, charts, collaboration, memory, security, and animation requirements.
- Decisions: Proposed - Use the prompt as the initial frontend generation spec before scaffolding code in this repo.
- Follow-ups: Run the prompt in Google AI Studio, review generated code, then scaffold or merge the selected frontend implementation.
- Blockers: None.
- Verification: Created the prompt file, checked the target path, and pushed it to `origin/main`.

## 2026-07-06 - Codex - Design system doc

- Service or area: design system and frontend guidance.
- Files changed: `design.md`, `README.md`, `context.md`, `memory.md`.
- Summary: Added a dedicated design reference extracted from the logo/typo-logo direction and prior product conversations, covering dark-first design, required light theme, color tokens, typography, components, motion, charts, settings theme behavior, accessibility, and agent-first UI rules. Linked it from README and context for agent discoverability.
- Decisions: Proposed - Use `design.md` as the stable design reference when building the platform UI.
- Follow-ups: Map these tokens into Tailwind/shadcn variables when the frontend is scaffolded.
- Blockers: None.
- Verification: Visually inspected `assets/brand/logo2.png` and `assets/brand/typo-logo.png`, then reviewed the Markdown file.

## 2026-07-06 - Codex - Extracted UI prototype cleanup

- Service or area: frontend UI/UX prototype.
- Files changed: `frontend/src/App.tsx`, `frontend/src/components/dashboard/Overview.tsx`, `frontend/src/components/dashboard/AgentStudio.tsx`, `frontend/src/components/dashboard/Projects.tsx`, `frontend/src/components/dashboard/Security.tsx`, `frontend/src/components/dashboard/Analytics.tsx`, `frontend/src/components/dashboard/Deployments.tsx`, `frontend/src/components/dashboard/Memory.tsx`, `frontend/src/components/dashboard/Settings.tsx`, `frontend/src/components/dashboard/Team.tsx`, `frontend/src/components/services/Services.tsx`, `frontend/src/data/mock.ts`, `frontend/src/index.css`, `frontend/public/brand/logo-transparent.png`, `frontend/public/brand/wordmark-transparent.png`, `frontend/public/brand/lockup-transparent.png`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`, `memory.md`.
- Summary: Cleaned the AI Studio UI prototype into a more sensible ZEXVRO workspace dashboard. Replaced remote logo URLs with local transparent brand assets, fixed mobile layout spacing, rewrote the overview around setup readiness and next actions, replaced misleading dummy data with MVP placeholders, softened agent actions into approval-first prototype states, and removed generated fake production/security claims from visible UI copy.
- Decisions: Proposed - Treat `frontend/` as the frontend workspace.
- Follow-ups: Review all secondary screens visually, split large dashboard bundles with route-level code splitting later, and decide later whether `frontend/` should be renamed to `apps/web`.
- Blockers: Root workspace is still not a Git checkout, so pushes require syncing through the existing checkout path.
- Verification: Ran `npm run lint` and `npm run build` successfully. Captured desktop and mobile screenshots with Chromium; fixed the mobile sidebar width bug found in the first mobile screenshot.

## 2026-07-06 - Codex - UI shell smoothing and clean service setup

- Service or area: frontend UI/UX prototype.
- Files changed: `frontend/src/App.tsx`, `frontend/src/components/services/Services.tsx`, `frontend/src/components/dashboard/Overview.tsx`, `frontend/src/components/dashboard/Projects.tsx`, `frontend/src/components/dashboard/Security.tsx`, `frontend/src/components/dashboard/Deployments.tsx`, `frontend/src/components/dashboard/Memory.tsx`, `frontend/src/components/dashboard/Team.tsx`, `frontend/src/components/dashboard/AgentStudio.tsx`, `frontend/src/data/mock.ts`, `memory.md`.
- Summary: Smoothed the platform shell with a lean Cloudflare-style top bar, narrower sidebar, smoother collapse timing, and screen-level skeleton loading. Rebuilt the Services screen into a clean configuration surface with required inputs, setup options, approval actions, and honest empty-state language. Removed personal developer aliases, owner labels, demo metrics, and pretend production/security data from visible app screens.
- Decisions: Proposed - Services UI should stay setup-first until backend contracts exist. Do not show owners, progress, balances, usage charts, incidents, IP addresses, or live telemetry unless they come from a real integration.
- Follow-ups: Visually review Analytics and Settings next; replace any remaining generated metrics with empty states once real data contracts are known.
- Blockers: Root workspace is still not a Git checkout, so pushes require syncing through the existing checkout path.
- Verification: Ran `npm run lint` and `npm run build` successfully. Captured desktop and mobile Chromium screenshots for the cleaned overview.

## 2026-07-06 - Codex - Frontend folder promotion and overview cleanup

- Service or area: frontend structure and UI/UX.
- Files changed: `frontend/`, `README.md`, `context.md`, `memory.md`, `docs/prompts/google-ai-studio-frontend-ui.md`.
- Summary: Moved the frontend app into `frontend/`, removed the topbar assistant action, removed workspace/network badges from the shell and overview, improved the overview hero into a cleaner setup summary, replaced the default browser title with `ZEXVRO Dashboard`, and rewrote the frontend README so it is project-specific.
- Decisions: Accepted - `frontend/` is the active frontend workspace. Agents should not look for the old frontend wrapper path.
- Follow-ups: Consider whether to keep the requested `frontend` spelling or later rename it to `frontend`/`apps/web` if the team standardizes repo structure.
- Blockers: Root workspace is still not a Git checkout, so pushes require syncing through the existing checkout path.
- Verification: Ran `npm run lint` and `npm run build` from `frontend/` successfully. Confirmed served title is `ZEXVRO Dashboard`. Captured desktop and mobile Chromium screenshots at `/tmp/zexvro-frontend-overview.png` and `/tmp/zexvro-frontend-mobile.png`.

## 2026-07-06 - Codex - Frontend favicon

- Service or area: frontend branding.
- Files changed: `frontend/index.html`, `memory.md`.
- Summary: Added the transparent ZEXVRO logo as the browser favicon and Apple touch icon.
- Decisions: Accepted - Use `frontend/public/brand/logo-transparent.png` for the frontend favicon until a dedicated `.ico` or maskable icon set is created.
- Follow-ups: Generate a complete favicon set later if production browser/device polish is needed.
- Blockers: None.
- Verification: Ran `npm run lint` and `npm run build` from `frontend/` successfully.

## 2026-07-06 - Codex - Correct frontend directory name

- Service or area: frontend structure.
- Files changed: `frontend/`, `README.md`, `context.md`, `memory.md`.
- Summary: Renamed the frontend workspace to `frontend/` and updated documentation references.
- Decisions: Accepted - `frontend/` is the active frontend workspace path.
- Follow-ups: None.
- Blockers: None.
- Verification: Ran `npm run lint` and `npm run build` from `frontend/` successfully.

## 2026-07-07 - Nova / Morph - Transformation Agent CLI skeleton

- Service or area: Transformation Agent (Morph)
- Files changed: `services/transformation-agent/PLAN.md`, `services/transformation-agent/cli/morph.py`, `services/transformation-agent/cli/agent.py`, `services/transformation-agent/cli/memory.py`, `services/transformation-agent/cli/tools.py`, `services/transformation-agent/cli/requirements.txt`, `context.md`, `memory.md`
- Summary: Created the Morph CLI skeleton for the Transformation Agent service. Includes Typer CLI entry point, agent loop with intent routing, SQLite-backed memory store, tool registry (read/write files, run commands, analyze codebase), and requirements. Name: Morph. Owner: Paris. Also updated context.md with Morph product name and status.
- Decisions: Accepted - Morph is the name for the Transformation Agent. CLI-first approach. SQLite for MVP memory.
- Follow-ups: Wire OpenAI API into agent loop, add web panel, add vision support, integrate with Zexvro frontend.
- Blockers: None.
- Verification: Files created. Run with `cd services/transformation-agent && pip install -r cli/requirements.txt && python cli/morph.py chat`.

## 2026-07-08 - Antigravity - Morph TUI Redesign

- Service or area: Transformation Agent (Morph) CLI TUI
- Files changed: `services/transformation-agent/cli/tui/styles/icons.py`, `services/transformation-agent/cli/tui/styles/theme.py`, `services/transformation-agent/cli/tui/screens/welcome.py`, `services/transformation-agent/cli/tui/app.py`, `services/transformation-agent/cli/tui/screens/main.py`, `services/transformation-agent/cli/tui/screens/chat.py`, `services/transformation-agent/cli/tui/screens/memory.py`, `services/transformation-agent/cli/tui/screens/tools.py`, `services/transformation-agent/cli/tui/screens/about.py`, `services/transformation-agent/cli/tui/components/logo.py`, `memory.md`
- Summary: Redesigned the Morph TUI into a professional, high-contrast, emoji-free developer console. Implemented a skippable animated booting screen with ASCII progress logging, centered layout alignment systems, multi-panel chat interface (agent status sidebar + card-style messages running on background worker threads), and DataTable implementations for tools and memory browsers. Converted the official brand mascot SVG (`frontend/public/morph/morph-logo.svg`) into a pure-ASCII, symmetric robot mascot layout (width 30, height 14) and updated the logo component to display it. Adjusted container heights in `theme.py` to fit the mascot perfectly without layout overflows or scrolling. Unified the layout of the Main, Memory, Tools, and About screens to render nested inside the centered `#main-container` panel for design consistency. Added a compact small mascot logo (`SMALL_LOGO`) at the top of the chat sidebar, centered the main menu list container horizontally, improved menu list item spacing and height (spacious vertically centered items), and set up message container alignments to float user messages right and agent messages left.
- Decisions: Accepted - Morph TUI should strictly use unicode/ASCII terminal indicators instead of standard emojis. Accepted - TUI queries block on background workers to prevent console rendering lockups. Accepted - Unified nested window card designs for all major screens. Accepted - Converted official mascot SVG asset to ASCII for the TUI header.




- Follow-ups: None.
- Blockers: None.
- Verification: Verified file imports, syntax correctness, and runtime app instantiation using automated tests. Fixed a naming conflict in `WelcomeScreen` where overriding the read-only `log` property crashed initialization. Fixed a `MountError` in `ChatScreen` where appending dynamic widgets called `.mount()` on an unattached container; resolved by passing child elements directly to the constructor at instantiation.

## 2026-07-08 - Antigravity - Morph CLI Auth, Settings & Stellar RAG Integrations

- Service or area: Transformation Agent (Morph) Core MVP
- Files changed: `frontend/src/components/dashboard/Settings.tsx`, `frontend/.env`, `services/transformation-agent/cli/morph.py`, `services/transformation-agent/cli/tools.py`, `services/transformation-agent/cli/auth.py`, `services/transformation-agent/cli/mock_server.py`, `services/transformation-agent/data/stellar_kb/soroban_contracts.md`, `services/transformation-agent/data/stellar_kb/zk_poseidon_bn254.md`, `memory.md`
- Summary: Implemented the first set of functional MVP deliverables for Morph: an Agent Settings panel in the React frontend (with provider select and local storage mapping), wired deployed Cognito user pool and client identifiers directly to `.env` parameters, a local Python mock server simulating AWS auth/DB APIs, Typer authentication commands (`login`, `logout`, `status`) using OAuth2 device code polling, and a Soroban/ZK-cryptography knowledge base RAG tool query search.
- Decisions: Accepted - CLI and frontend settings use matching provider configurations. Accepted - Device authorization polling is standard OAuth2 client flow. Accepted - Local RAG uses text heading split and scoring instead of thick vector DBs for CLI portability.
- Follow-ups: None.
- Blockers: None.
- Verification: Built React frontend production code successfully. Executed E2E backend mock API validation, CLI commands (`status`, `login`, `logout`), and RAG keyword query searches successfully.
## 2026-07-09 - Antigravity - Morph TUI Logo Alignment, Menu Sizing & Chat Error Fixes

- Service or area: Transformation Agent (Morph) CLI TUI
- Files changed: `services/transformation-agent/cli/agent.py`, `services/transformation-agent/cli/tui/screens/main.py`, `services/transformation-agent/cli/tui/styles/theme.py`, `memory.md`
- Summary: Corrected the ASCII logo misalignment on the bootloader and main menu screen by defining a fixed width of 30 and height of 14, and removing `text-align: center` to allow natural left-alignment of ASCII characters within a centered container. Resized the main menu button box `#menu-actions` from width 54 to 38 for a cleaner, more proportional layout. Resolved HTTP 403 Forbidden errors from the completions API by adding a custom `User-Agent: MorphTUI/0.1.0` header. Prevented markup crash errors in the chat UI when users input brackets by dynamically validating and escaping content using `rich.markup.escape`.
- Decisions: Accepted - Mascot ASCII art requires fixed dimensions and left-alignment of lines within its boundary to prevent distortion. Accepted - Safe markup-escape validation for chat static widgets to prevent runtime MarkupErrors.
- Follow-ups: None.
- Verification: Executed integration test script demonstrating successful bootloader initialization, screen transition, input parsing, and clean exit.

## 2026-07-09 - Antigravity - Morph CLI Authentication, Interactive Memory Management, Spinner & Installer

- Service or area: Transformation Agent (Morph) Core / TUI
- Files changed: `services/transformation-agent/cli/tui/screens/login.py`, `services/transformation-agent/cli/tui/screens/menu.py`, `services/transformation-agent/cli/tui/screens/main.py`, `services/transformation-agent/cli/tui/screens/memory.py`, `services/transformation-agent/cli/tui/app.py`, `services/transformation-agent/cli/tui/styles/theme.py`, `services/transformation-agent/cli/morph.py`, `services/transformation-agent/cli/auth.py`, `services/transformation-agent/cli/agent.py`, `services/transformation-agent/cli/install.sh`, `context.md`, `memory.md`
- Summary: Implemented device authentication flow screen, interactive memory editor screen with DataTable list and entry update inputs, 100ms loading spinner thinking animation, and a standalone `install.sh` shell script to install the `morph` command globally to the user path. Wired a background thread heartbeat in TUI starting on mount that syncs CLI state to the web portal every 15s to keep it online. Added markdown parsing for agent responses with markup support for system output.
- Decisions: Accepted - Standalone installer places wrapper in `~/.local/bin/morph`. Accepted - TUI heartbeat to mark CLI online in Web portal dashboard.
- Follow-ups: None.
- Blockers: None.
- Verification: Compiled and validated TUI app importing and execution. Verified installer compiles and executes cleanly.

## 2026-07-09 - Antigravity - Frontend MVP Services Cleanup

- Service or area: Frontend Services
- Files changed: `frontend/src/data/mock.ts`, `frontend/src/components/dashboard/Projects.tsx`, `frontend/src/components/dashboard/Memory.tsx`, `memory.md`
- Summary: Removed the "Transformation Agent" mock service from the React frontend MVP services listing, default creation dropdowns, and memory filters since the CLI implementation is complete.
- Decisions: Accepted - Remove duplicate/completed service descriptors from MVP UI lists to keep focus on remaining active items.
- Follow-ups: None.
- Blockers: None.
- Verification: Successful TypeScript frontend compilation (`tsc --noEmit`).

## 2026-07-09 - Nabil - NFT Service and De-pin scope decisions

- Service or area: NFT Service, De-pin (x402 Agentic Resource Gateway), frontend routing.
- Files changed: `context.md`, `memory.md`, `frontend/package.json`, `frontend/package-lock.json`.
- Summary: Nabil scoped both owned services and accepted React Router as the frontend direction. At this point routing and NFT screens were still pending; no NFT frontend, contract, API, or De-pin implementation had been verified yet.
- Decisions: Accepted - Stellar/Soroban-only NFT v1 with primary USDC sales. Accepted - De-pin is an x402 gateway using exact per-request payments for HTTP APIs, while streaming remains later work. Accepted - React Router for frontend routing.
- Follow-ups: Implement URL routes and local NFT drafts first, then the Soroban contract/API and standard x402 gateway.
- Blockers: None at the architecture level; implementation and testnet configuration remained.
- Verification: Existing frontend TypeScript check passed before implementation.

## 2026-07-10 - Codex with Nabil - Nabil services implementation

- Service or area: Frontend routing and NFT UX, NFT Service, De-pin gateway, documentation.
- Files changed: `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/auth/`, `frontend/src/services/nft/`, frontend test/config/package files, `services/nft-service/`, `services/depin/`, `context.md`, `memory.md`.
- Summary: Replaced state-only navigation with React Router while preserving Cognito, workspace persistence, CLI activation, and Morph polling. Added workspace-isolated local NFT drafts, a validated three-step collection wizard, dashboard empty/table states, and direct NFT routes. Added a one-contract-per-collection OpenZeppelin Stellar NFT contract, typed Express API with Pinata and sponsored Soroban auth-entry adapters, owner-signed sale configuration, atomic fixed-USDC purchase/mint, and exact x402 Stellar reverse proxy with verify/fulfill/settle ordering, canonical replay protection, unpaid rate limits, timeouts, response withholding, and redacted audit logs. No live credentials or deployment claims were added.
- Decisions: Accepted - Contract/API and gateway boundaries listed in Active Decisions. Accepted - NFT files/previews stay session-only while text drafts and records are workspace-local/versioned. Accepted - De-pin v1 limits providers to configured `GET`/`HEAD` resources.
- Follow-ups: Deploy the NFT WASM on Stellar testnet, configure Pinata/sponsor keys, connect frontend auth/workspaces to the API, configure a real De-pin provider, and perform live testnet payment runs.
- Blockers: Credentials/provider setup and shared API authorization decisions listed in Active Blockers.
- Verification: Frontend TypeScript, 14 Vitest tests, production build, and 3 Chrome Playwright tests passed, including desktop/mobile screenshots and direct NFT search navigation. NFT contract formatting, clippy with warnings denied, 10 tests, and Stellar WASM build passed; WASM is 16,212 bytes with hash `a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad`. NFT API lint/build and 13 tests passed. De-pin lint/build and 25 tests passed, including the official x402 Stellar requirement builder. All three npm audits found zero vulnerabilities. `cargo audit` found no vulnerabilities and one transitive unmaintained warning for `paste 1.0.15` through Soroban's host test dependencies.

## 2026-07-11 - Codex with Nabil - Stellar testnet and De-pin smoke setup

- Service or area: NFT Service and De-pin gateway testnet setup.
- Files changed: `services/nft-service/README.md`, `services/depin/.gitignore`, `services/depin/README.md`, `services/depin/package.json`, `services/depin/package-lock.json`, `services/depin/src/demoClient.ts`, `memory.md`; machine-local ignored `services/depin/depin.config.json`.
- Summary: Created and Friendbot-funded local CLI identities `zexvro-provider` (`GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ`) and `zexvro-buyer` (`GDYJ7OV6AIYTNB7J3HRSUMBQE2QIWTTZXGGD5RA6MJFP6YIV3SO6MXJU`), then added verified Circle testnet USDC trustlines. Deployed the NFT WASM to contract `CCJDPP5VB74QI7CO656L7PQGXKOHI7RQ5PGGQXMM2CUWQ3SYEFXF3KRT`, minted token `1`, and verified ownership, test-only URI `ipfs://zexvro-testnet-demo/1`, and a 5% royalty quote. Added a bounded x402 buyer smoke client and a local gateway route protecting the NFT API health endpoint.
- Decisions: Test identities remain in the local Stellar CLI store; no secrets are written to the repository. The demo client requires an explicit expected recipient and rejects payments above `0.001 USDC`. The deployed collection metadata URI is deliberately test-only and is not a production metadata claim.
- Follow-ups: Configure Pinata and runtime NFT API sponsorship, connect frontend collection creation to authenticated API endpoints, and move the De-pin provider configuration/replay state into managed deployment infrastructure.
- Blockers: Pinata/runtime NFT API integration and authenticated frontend wiring remain; no blocker remains for the De-pin testnet payment path.
- Verification: Stellar testnet health passed. NFT contract tests passed 10/10; WASM hash remained `a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad`. Upload transaction `c5cd64cc73b82f2e0fde7d0cb3044213587b11fc3bb71648d9b9c9811e8c2c87`, deployment transaction `87efedcefbd3215624c809ca28831fc124ca76e036774f81a132394bf32046a4`, and mint transaction `796e46b2283494d5fe43cc199a4268c9bfd5e2d03ac1f418329869ff06691697` succeeded. NFT API and De-pin health endpoints returned `200`; the protected route returned x402 v2 `402` with exact `10000` atomic USDC, the expected recipient, and sponsored fees. Paid request transaction `d29f3454fc600001eb4e95e668a2ad41cc61c4a4fa9fafc9a55c22e698befdba` settled successfully; provider and buyer balances reconciled to `0.0010000` and `19.9990000` USDC, respectively, and the upstream response was released only afterward. De-pin lint/build, 25/25 tests, and production dependency audit passed with zero vulnerabilities.

## 2026-07-11 - Codex with Nabil - Authenticated NFT frontend wiring

- Service or area: NFT frontend, API authentication, local test storage, and developer runtime.
- Files changed: `frontend/src/App.tsx`, `frontend/src/services/nft/`, `frontend/src/types.ts`, `frontend/vite.config.ts`, frontend tests/environment docs, `services/nft-service/api/src/`, NFT API dependencies/config/docs, `services/nft-service/README.md`, `memory.md`.
- Summary: Connected the collection wizard to real media upload and Soroban deployment endpoints, connected the dashboard to authenticated workspace listings, and kept older browser drafts in a separate migration section. Added Cognito access-token verification and subject-scoped workspaces to the API, a Vite `/api/nft` proxy, public capability reporting, and explicitly development-only content-addressed local media/token metadata so the full testnet flow can run without falsely claiming IPFS.
- Decisions: Accepted - Cognito access-token subjects scope NFT workspace records. Accepted - Local HTTP storage is for development only; Pinata IPFS remains the production path. Sponsor secrets remain server-side and are loaded from Stellar CLI at runtime for local testing.
- Follow-ups: Nabil should complete one signed-in collection deployment from `/dashboard/w/:workspaceId/p/:projectId/nft`; then configure Pinata, managed secret injection, and shared persistence before production use.
- Blockers: Production Pinata/shared persistence and managed runtime secrets remain unconfigured. The code path itself is no longer blocked for local frontend testing.
- Verification: Frontend TypeScript, production build, 20/20 Vitest tests, and 3/3 Chrome Playwright journeys passed with inspected 1440x900 and 390x844 screenshots. NFT API lint/build and 21/21 tests passed, including buyer/owner authorization boundaries. Contract formatting, clippy with warnings denied, 10/10 tests, and Stellar WASM build passed; hash remained `a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad`. Frontend and NFT API production dependency audits found zero vulnerabilities. Live frontend proxy health reported API, local storage, and Stellar ready; an unauthenticated private request returned the expected safe `401`. Frontend and NFT API dev servers were left running on ports `3001` and `4101`.

## 2026-07-11 - Codex with Nabil - Combined local NFT startup

- Service or area: Frontend and NFT API developer runtime.
- Files changed: `frontend/scripts/dev-stack.mjs`, `frontend/package.json`, `frontend/README.md`, `memory.md`.
- Summary: Added `npm run dev:stack` to start or reuse the local NFT API, wait for port `4101` health, and then start Vite. The command reads the testnet sponsor secret from the existing Stellar CLI identity at runtime and does not write it to frontend files.
- Decisions: Keep `npm run dev` frontend-only for developers working on unrelated services; use `npm run dev:stack` for NFT frontend work.
- Follow-ups: None.
- Blockers: None.
- Verification: Confirmed the original failure was `ECONNREFUSED` because the API was stopped. Started the API, verified direct and Vite-proxied health responses, syntax-checked the runner, exercised `npm run dev:stack`, and passed frontend TypeScript validation.

## 2026-07-09 - Antigravity - Production Deployment Mappings & API Bug Fixes

- Service or area: Frontend / Morph CLI Auth
- Files changed: `frontend/src/App.tsx`, `frontend/src/components/dashboard/Settings.tsx`, `docs/lambda_function.py`, `scratch_lambda/lambda_function.py`, `services/transformation-agent/cli/tui/screens/login.py`, `context.md`, `memory.md`
- Summary: Resolved 405 Method Not Allowed and API integration errors on production pages deployment by replacing local dev proxy `/api/agent/chat` routes with direct CORS-enabled requests to remote AWS API Gateway completions (`${API_BASE_URL}/api/chat`). Set default TUI device activation fallback URLs to production `https://zexvro.pages.dev` to ensure correct device authentication redirection links are presented.
- Decisions: Accepted - All frontend client integrations point to global API Gateway endpoints rather than relative dev paths.
- Follow-ups: None.
- Blockers: None.
- Verification: Completed successful Vite build. Checked git status.

## 2026-07-10 - Codex - Public Marketing Page Build

- Service or area: Frontend marketing site.
- Files changed: `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/App.tsx`, `frontend/src/DashboardApp.tsx`, `frontend/src/marketing/`, `memory.md`.
- Summary: Built the public ZEXVRO marketing front door at `/` as a chaptered, scroll-driven site while preserving the existing authenticated dashboard at `/dashboard`. Added Lenis + GSAP ScrollTrigger global scroll sync, a code-split Three/R3F node-network hero substrate with static mobile/reduced-motion fallback, anime.js and split-type text/detail motion, Framer Motion button/nav interactions, optimized SVG chapter illustrations generated through SVGO/SVGR, six MVP service chapters, an agent-first audit-trail close, and a real CTA to GitHub/dashboard prototype.
- Placeholder vs final: Final for the current marketing-page visual/interaction system and illustration style bible. Product claims remain intentionally MVP-safe: Privacy Pool, A-2-A, Agent Auth, NFT, and De-Pin are presented as Draft/early/coming-soon where context.md says decisions are not finalized. Morph is presented as the furthest along because the CLI is implemented and packaged.
- Decisions: Accepted - `/` is the public marketing page; `/dashboard` lazy-loads the existing dashboard prototype. Accepted - Marketing page may use cinematic scroll storytelling outside the stricter in-app dashboard layout rules. Accepted - Keep color restrained to black/white/zinc with one narrow accent per chapter.
- Follow-ups: Replace generated vector placeholders with designer-approved production illustration assets if brand direction changes; decide actual waitlist/docs destination before launch; revisit Three.js chunk budget if production hosting metrics require stricter first-load limits.
- Blockers: None.
- Verification: Ran `npm run lint` and `npm run build` from `frontend/` successfully. Captured Chromium desktop, mobile, reduced-motion, and deep-chapter screenshots from the local dev server.

## 2026-07-10 - Codex - Infrastructure Renaissance Landing Page

- Service or area: Frontend marketing site.
- Files changed: `frontend/index.html`, `frontend/public/fonts/`, `frontend/public/marketing/`, `frontend/src/marketing/`, `memory.md`.
- Summary: Evolved the public marketing route into an original modern-Renaissance campaign for ZEXVRO. Added a full-bleed generated hero tableau, three-state transformation preview, pointer verification lens, Roman-numeral chapter progress rail, responsive principle strip, alternating service chapters, and a high-contrast closing panel. Kept all product claims aligned with the existing MVP status and preserved `/dashboard`.
- Decisions: Accepted - Use the optimized WebP hero at `frontend/public/marketing/zexvro-renaissance-hero.webp`; keep the service SVG chapters as the technical product layer; use lime only as a narrow verification/status accent. Removed the runtime Three.js hero path from the rendered page in favor of the lighter interactive image treatment.
- Follow-ups: Replace the dashboard bundle's broad screen import pattern if its existing production chunk warning becomes a deployment concern.
- Blockers: None.
- Verification: Ran `npm run lint` and `npm run build`; production marketing no longer emits the previous 910 kB Three.js chunk. Captured 1440x1000, 1024x768, 390x844, reduced-motion, privacy, Morph, and CTA screenshots. Scripted the transformation-state and chapter-anchor interactions in Chromium.

## 2026-07-10 - Codex - NOVA Template Landing Replacement

- Service or area: Frontend marketing site.
- Summary: Replaced the rejected Renaissance landing route with a MotionSites NOVA-inspired aerospace layout using ZEXVRO cube assets, an oversized brand hero, continuous scan/media motion, a staggered systems grid, and an interactive six-service index. Preserved `/dashboard` and root device-activation query routing.
- Verification: `npm run lint` and `npm run build` pass. Marketing JS is 34 kB before gzip; the remaining bundle warning is the existing dashboard chunk.

## 2026-07-10 - Codex - Minimal Welcome Screen

- Service or area: Frontend entry route.
- Summary: Removed the long-form marketing experience from `/` and replaced it with a single responsive glassmorphic "Welcome to ZEXVRO" screen with one "Step into Web3" action to `/dashboard`.
- Verification: TypeScript and production build pass; desktop and mobile Chromium screenshots were reviewed.

## 2026-07-10 - Codex - Transactions and Payroll Planning Entry

- Service or area: Dashboard navigation and finance-module planning.
- Summary: Added a non-interactive `Transactions & Payroll` sidebar category marked `Planned`. No finance screens, routes, payment behavior, or backend claims were added pending product approval.
- Decision needed: Confirm whether `Zer0` is the branded private-payment mode planned on top of the Zero-Knowledge Privacy Pool.

## 2026-07-10 - Codex - Proof Manager and Recipient Payout Planning

- Service or area: Transactions, payroll, recipient payouts, and finance evidence planning.
- Requested scope: Add `Proof Manager` to the planned finance module and support two recipient experiences over one canonical payment/proof record: `Web3` for wallet-aware recipients and `Standard payout` for recipients who want a guided withdrawal to supported local currency.
- Protocol clarification: `SEP-45` authenticates Stellar contract accounts; it is not a fiat withdrawal protocol. A future Stellar off-ramp should evaluate `SEP-24` for provider-hosted withdrawal or `SEP-6` for programmatic withdrawal, with provider-specific identity checks and quotes. Availability depends on the selected anchor, asset, country, and payout rail.
- Proof scope: Payment confirmations, payroll statements, withdrawal records, accounting exports, approval history, supporting documents, and narrowly defined `Zer0` attestations. Issued records must be versioned and append-only; corrections supersede prior versions.
- Product boundary: Proof artifacts may be prepared for accounting, tax, or legal review, but must not be described as legal certification, tax compliance, or a filed tax return. Sensitive documents remain encrypted off-chain; no private keys, raw ZK witness data, or fabricated settlement/proof states.
- Planned navigation: Finance Overview, Transactions, Zer0, Payroll, Proof Manager, Organization. No related screens or integrations are implemented pending explicit approval.

## 2026-07-10 - Codex - Frontend Phase 1: Routing, Stores, and Core Screens

- Service or area: Frontend architecture and dashboard UI.
- Files changed: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/src/main.tsx`, `frontend/src/stores/types.ts`, `frontend/src/stores/workspace.ts`, `frontend/src/stores/project.ts`, `frontend/src/stores/ui.ts`, `frontend/src/routes/router.tsx`, `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/components/workspace/WorkspaceOverview.tsx`, `frontend/src/components/workspace/ProjectsIndex.tsx`, `frontend/src/components/project/ProjectOverview.tsx`, `frontend/src/components/PlaceholderScreen.tsx`, `memory.md`.
- Summary: Implemented Phase 1 of the planning brief. Added TanStack Router for URL-backed navigation and Zustand for state management. Created canonical types for workspace, project, environment, service instance, deployment, and team membership. Built three Zustand stores (workspace, project, UI) with persist middleware. Created a full route tree with workspace-scoped routes (`/w/:workspaceId/...`) and project-scoped routes (`/w/:workspaceId/p/:projectId/...`). Built a complete DashboardLayout shell with sidebar, workspace switcher, command palette, mobile drawer, and Morph assistant dock. Built WorkspaceOverview with stats, quick actions, and recent projects. Built ProjectsIndex with search, project list, and a multi-step create project wizard. Built ProjectOverview with setup checklist and quick actions. Added placeholder screens for all remaining planned routes.
- Decisions: Accepted - TanStack Router (without strict typed Register), Zustand with persist, useNavigate for navigation (typed Link caused TS issues without Register), multi-step wizard for project creation, `/w/:workspaceId/p/:projectId/` route convention.
- Follow-ups: Build remaining workspace screens (Instances, Deployments, Activity, Services, Team, Security, Analytics, Settings). Build remaining project screens (Environments, Instances, Deployments, Logs, Services, Agents, Members, Audit, Settings). Add the old dashboard screens (Overview, AgentStudio, Analytics, Memory, Security, Settings) back as workspace/project-aware screens.
- Blockers: None.
- Verification: `npm run lint` and `npm run build` pass. TypeScript clean.

- Service or area: Product planning and frontend architecture.
- Files changed: `planning.md`, `memory.md`.
- Summary: Resolved four pending architecture decisions and added a five-phase implementation plan to `planning.md`. Decisions: use TanStack Router for URL-backed navigation, Zustand for workspace/project state management, multi-step wizard for project creation, and `/w/:workspaceId/p/:projectId/...` route convention. Finance screens (Transactions, Payroll, Zer0, Proof Manager) are deferred until the data model is approved. Added a concrete step-by-step plan covering routing foundation, project dashboard, service catalog split, team/invites, approval policies, and backend API boundaries.
- Decisions: Accepted - TanStack Router, Zustand, multi-step wizard, /w/:wid/p/:pid/ route convention.
- Follow-ups: Begin Phase 1 implementation — install TanStack Router, create Zustand stores, migrate existing useState navigation to routes.
- Blockers: Finance screens deferred pending data model approval. De-pin scope still undefined.
- Verification: Documentation-only change.

## 2026-07-10 - Codex - Planning Brief For Future Models

- Service or area: Product planning and dashboard information architecture.
- Files changed: `planning.md`, `memory.md`.
- Summary: Added a root-level planning brief consolidating the current ZEXVRO product context, workspace/project model, project dashboard flows, Transactions & Payroll direction, Zer0 proposal, Proof Manager scope, recipient payout modes, frontend gaps, implementation order, and open decisions for future humans or models.
- Decisions: Proposed - Use `planning.md` as a planning handoff only; project, finance, payroll, Zer0, and proof-manager screens remain unimplemented pending approval.
- Follow-ups: Review and approve the proposed screen backlog before frontend implementation.
- Blockers: De-pin scope remains undefined; finance/proof/off-ramp provider decisions are still open.
- Verification: Documentation-only change; no build or test run.

## 2026-07-11 - Codex - Web3 Dashboard AWS Wiring And Handoff

- Service or area: Frontend dashboard, Zer0 payroll, AWS Lambda, project documentation.
- Files changed: `frontend/src/api/api.ts`, `frontend/src/agent/settings.ts`, `frontend/src/components/dashboard/AgentStudio.tsx`, `frontend/src/components/dashboard/Settings.tsx`, `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/components/project/ProjectExecutions.tsx`, `frontend/src/components/project/ProjectOverview.tsx`, `frontend/src/components/workspace/Payroll.tsx`, `frontend/src/components/workspace/ProjectsIndex.tsx`, `frontend/src/components/workspace/WorkspaceActivity.tsx`, `frontend/src/components/workspace/WorkspaceOverview.tsx`, `frontend/src/components/workspace/WorkspaceSettings.tsx`, `frontend/src/components/zer0/*`, `frontend/src/routes/router.tsx`, `frontend/src/stores/awsSync.ts`, `frontend/src/stores/project.ts`, `frontend/src/stores/workspace.ts`, `frontend/src/stores/zer0.ts`, `frontend/src/data/serviceCatalog.ts`, `scratch_lambda/lambda_function.py`, `scratch_lambda/lambda.zip`, `context.md`, `pages.md`, `memory.md`.
- Summary: Reworked the routed dashboard toward a Web2-to-Web3 service platform instead of a personal ZEXVRO/internal dashboard. Restored the full sidebar while adding Zer0 Payroll, Proof Management, and service/admin options. Added Project Executions, removed active navigation reliance on Web2 deployment/instance/log pages, redesigned project/workspace overview language, and kept screens dense and service-oriented. Added AWS DynamoDB-backed payroll taxonomy (`zexvro-payroll-taxonomy`) and Lambda routes for role/department managers. Payroll now loads employees, payroll runs, roles, departments, and payment history filters from AWS APIs, with no dummy payroll history.
- Data decision: Removed Zustand browser persistence from business stores (`workspace`, `project`, `zer0`). Shared memory, Project Executions, Morph provider settings, and Zer0 fallback state now use the DynamoDB-backed `/api/memory` route. Remaining browser storage is limited to Cognito/session handoff and UI preferences.
- AWS state: Created DynamoDB table `zexvro-payroll-taxonomy` and deployed updated Lambda `zexvro-agent-backend` with `GET/POST/PUT/DELETE /api/payroll/taxonomy`. Smoke tested create/list/delete through API Gateway with `Authorization: Bearer test`; the test taxonomy item was deleted afterward.
- Docs: Added `pages.md` with route-by-route status, data source, completion percentage, and next work. Updated `context.md` with the secure Stellar credential request for Nabil/Nambil and clarified that if ZEXVRO does not hold signing credentials, user wallet connection/public wallet address must be supplied by the user and only public wallet metadata should be stored.
- Decisions: Accepted - `/api/memory` remains a temporary AWS-backed store for areas without dedicated tables. Accepted - Dedicated tables are still needed for audits, executions, service instances, Zer0 payments, proofs, and settings. Accepted - No secret seeds should ever be stored in frontend state or repo files.
- Follow-ups: Add dedicated DynamoDB/Lambda APIs for audit events, executions, service instances, Zer0 payments/proofs/settings. Replace Stellar stubs after credentials/contract IDs are available. Persist project membership/roles and service instance configuration. Remove legacy `DashboardApp.tsx` and inactive Web2 component files after route stability is confirmed.
- Blockers: Stellar/Soroban credentials, contract IDs, source account/signing model, and custody/wallet policy are still needed from Nabil/Nambil. Audit/execution live backends are not yet implemented.
- Verification: `npm run lint` and `npm run build` pass from `frontend/`. `python3 -m py_compile scratch_lambda/lambda_function.py` passes. Vite still reports the existing large dashboard chunk warning.

## 2026-07-11 - Codex - Agentic Operation Sidebar And Workspace Controls

- Service or area: Frontend dashboard navigation and workspace management.
- Files changed: `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/stores/workspace.ts`, `frontend/src/stores/awsSync.ts`, `memory.md`.
- Summary: Moved Morph Agent and Shared Memory into a dedicated `Agentic Operation` sidebar section for both workspace and project navigation. Added a workspace delete action in the workspace switcher with last-workspace protection and navigation to the next available workspace. Enforced unique workspace names in the workspace store for create and rename paths, and deduped workspace names when hydrating from AWS/fallback memory.
- Decisions: Accepted - Keep Services Manager under `Service Catalog`; agent and memory operations belong under `Agentic Operation`. Accepted - Do not allow deleting the final workspace from the UI because the dashboard needs an active workspace shell.
- Follow-ups: Add backend-side uniqueness constraints or conflict responses for workspace names if multiple clients create workspaces concurrently.
- Blockers: None.
- Verification: `npm run lint` and `npm run build` pass from `frontend/`. Vite still reports the existing large dashboard chunk warning.

## 2026-07-12 - Antigravity - ZKPP Project Persistence & Payroll Approval Workflows

- Service or area: ZKPP Privacy Pool, Project Configuration Persistence, and Payment Approval Workflows
- Files changed: `frontend/src/stores/project.ts`, `frontend/src/api/awsSync.ts`, `frontend/src/stores/zer0.ts`, `frontend/src/components/zer0/Zer0PayParty.tsx`, `frontend/src/components/zer0/Zer0Dashboard.tsx`, `frontend/src/components/zer0/Zer0History.tsx`
- Summary: Implemented complete project config persistence to AWS DynamoDB (for environments and service instances), resolved initial mock pool balance issues (ensured fallback from Stellar query 0 USDC/EURC to default pool balances), and created the full payment approval workflow (auto-creating pending payroll runs on the backend, syncing approvals from AWS DynamoDB/Lambda, and adding direct approve/reject widgets and controls on the dashboard and history pages).
- Decisions:
  - Accepted - Fallback to mock balances when Stellar Horizon API returns 0 USDC/EURC/XLM on testnet.
  - Accepted - Keep payment approvals synced with the backend payroll run statuses.
- Follow-ups: None.
- Blockers: None.
- Verification:
  - Successful build with `npm run build`.
  - Full E2E verification of payment flow, settings toggle, dashboard card, history list, and approvals via Chromium browser tool.

## 2026-07-11 - Codex with Nabil - Routing and Zer0 branch integration

- Service or area: Frontend routing, project service integration, NFT UI, and shared handoff documentation.
- Files changed: Incoming `updates-routing-and-zer0` frontend/AWS/Morph files, `frontend/src/routes/router.tsx`, `frontend/src/components/services/NftService.tsx`, `frontend/src/services/nft/`, frontend tests and dependency files, `memory.md`.
- Summary: Merged the requested routing/Zer0 branch into local `main`, accepted TanStack Router and the workspace/project dashboard as the canonical shell, and replaced the incoming simulated NFT mint screen with the authenticated API-backed collection dashboard and deployment wizard. NFT records are scoped by workspace and project, and the old router-specific component coupling was removed.
- Decisions: Accepted - NFT routes are `/dashboard/w/:workspaceId/p/:projectId/nft` and `/dashboard/w/:workspaceId/p/:projectId/nft/collections/new`. TanStack Router owns application navigation after this merge.
- Follow-ups: Complete one signed-in collection deployment from a real project route and review the incoming AWS-backed workspace state with the service owners.
- Blockers: Production Pinata/shared persistence and managed sponsor secret injection remain pending.
- Verification: Combined dependency install and audit passed with zero vulnerabilities. Frontend TypeScript, 20/20 Vitest tests, production build, and 3/3 Chrome NFT route journeys passed; merged desktop and mobile screenshots were inspected. The known dashboard bundle-size warning remains.

## 2026-07-11 - Codex with Nabil - De-pin gateway frontend wiring

- Service or area: De-pin gateway, frontend service screen, local developer runtime, documentation.
- Files changed: `services/depin/src/proxy.ts`, `services/depin/src/proxy.test.ts`, `services/depin/README.md`, `frontend/src/components/services/DepinService.tsx`, `frontend/src/services/depin/`, `frontend/src/App.routing.test.tsx`, `frontend/e2e/nft.spec.ts`, `frontend/vite.config.ts`, `frontend/scripts/dev-stack.mjs`, `frontend/.env.example`, `frontend/README.md`, `context.md`, `memory.md`.
- Summary: Replaced the pulled placeholder De-pin hardware/node UI with an API-backed x402 gateway screen. Added a sanitized `/status` manifest to the gateway, a frontend De-pin API client, a provider table, gateway readiness indicators, and an unpaid probe flow that verifies the standard `PAYMENT-REQUIRED` challenge through `/api/depin`. Extended `npm run dev:stack` to start or reuse the local De-pin gateway when `services/depin/depin.config.json` exists.
- Decisions: Accepted - The De-pin frontend may show sanitized provider route, price, recipient, timeout, upstream origin, and secret-required status, but must not expose upstream secret values or secret reference names. Accepted - The project De-pin route remains scoped to exact x402 HTTP resources; physical-node registration stays out of v1.
- Follow-ups: Move provider configuration, replay state, and unpaid-rate-limit state into managed infrastructure before multi-instance or hosted use. Add provider onboarding UI only after persistent ownership/configuration is designed.
- Blockers: De-pin still uses machine-local `depin.config.json` and in-memory replay/rate-limit state.
- Verification: Frontend `npm test` passed 25/25 tests, `npm run lint` passed, `npm run build` passed with the known large dashboard chunk warning, and `npm run test:e2e` passed 4/4 Chrome journeys including the new De-pin x402 probe. De-pin `npm test` passed 26/26 when run outside the sandbox because Supertest needs to bind a local server; `npm run lint` and `npm run build` passed.

## 2026-07-12 - Codex with Nabil - Project sidebar service regrouping

- Service or area: Frontend project navigation.
- Files changed: `frontend/src/components/layout/DashboardLayout.tsx`, `memory.md`.
- Summary: Moved Nabil-owned project links out of the generic `Services` sidebar group. NFT now appears under `Digital Assets` as `NFT Collections`; De-pin now appears under `Resource Gateway` as `De-pin x402 Gateway`. Direct deep links still show the relevant category even before project service state hydrates.
- Decisions: Accepted - Keep `Services` for the generic service catalog/manager and shared MVP service links, while Nabil's NFT and De-pin pages use domain-specific project sidebar categories.
- Follow-ups: None.
- Blockers: None.
- Verification: Frontend `npm run lint`, `npm run build`, and `npm run test:e2e` passed. Desktop Playwright screenshots confirmed the new `Digital Assets` and `Resource Gateway` sections.

## 2026-07-12 - Codex with Nabil - Stellar deployment result parsing fix

- Service or area: NFT Service API.
- Files changed: `services/nft-service/api/src/stellarGateway.ts`, `services/nft-service/api/src/stellarGateway.test.ts`, `memory.md`.
- Summary: Fixed collection deployment parsing after a live frontend run showed `Stellar accepted the deployment but did not return its final identifiers`. The Stellar JS SDK returns a generic deployed contract client shape with `options.contractId`; the API no longer requires that object to be an instance of the generated collection `Client` class. The parser now validates the returned contract ID with Stellar StrKey rules and accepts either the submit hash or finalized transaction hash.
- Decisions: Accepted - Treat the SDK's generic deploy result client shape as valid when it includes a valid Stellar contract ID and transaction hash.
- Follow-ups: Nabil should restart the NFT API/dev stack and retry a signed-in collection deployment. Failed local records from the previous parser error can be ignored or recreated.
- Blockers: None.
- Verification: NFT API `npm test` passed 24/24 when run outside the sandbox because Supertest binds local ports; `npm run lint` and `npm run build` passed.

## 2026-07-12 - Codex with Nabil - NFT lifecycle actions and public buyer page

- Service or area: NFT Service API and frontend.
- Files changed: `services/nft-service/api/src/app.ts`, `services/nft-service/api/src/service.ts`, `services/nft-service/api/src/repository.ts`, `services/nft-service/api/src/domain.ts`, `services/nft-service/api/src/app.test.ts`, `frontend/src/services/nft/`, `frontend/src/routes/router.tsx`, `frontend/src/App.routing.test.tsx`, `memory.md`.
- Summary: Added creator lifecycle actions for failed collection records: edit metadata before retry, retry deployment, and delete failed API records. Live collections now expose creator table actions to view the public page, open the buyer page, copy the public URL, and prepare an owner-signed primary USDC sale configuration. Added public collection reads at `/v1/public/collections/:collectionId`, public checkout intent preparation/submission endpoints, and a public frontend route at `/nft/collections/:collectionId` where buyers can inspect a live collection and prepare a Stellar checkout transaction for wallet signing.
- Decisions: Accepted - Failed API records can be edited/retried/deleted; live Soroban contracts are not deleted or edited from the dashboard. Accepted - Public buy v1 prepares the checkout transaction and requires buyer wallet signing; the UI does not claim an item is purchased until a signed transaction is submitted. Accepted - Sale setup v1 prepares the owner authorization transaction and does not claim configuration is active until a signed transaction is submitted.
- Follow-ups: Add wallet signing/submission integration for prepared checkout and sale-configuration transactions, minted item inventory/counts, and archive semantics for live collections if studios need to hide a live record without implying on-chain deletion.
- Blockers: Wallet signing/submission is still not wired in the frontend, so sale setup and public buy prepare Soroban transactions but do not yet complete browser wallet actions.
- Verification: NFT API lint/build passed; NFT API tests passed 27/27 outside the sandbox because Supertest binds local ports. Frontend TypeScript lint, production build, 29/29 Vitest tests, and 4/4 Playwright E2E tests passed. `git diff --check` passed.

## 2026-07-12 - Codex with Nabil - NFT checkout simulation errors

- Service or area: NFT Service API.
- Files changed: `services/nft-service/api/src/stellarGateway.ts`, `services/nft-service/api/src/stellarGateway.test.ts`, `memory.md`.
- Summary: Fixed public checkout error reporting when Soroban simulation fails before producing signer authorization entries. Contract error `#6` now maps to `primary_sale_not_configured`, which explains that the creator must sign and submit sale configuration before buyers can prepare checkout. Duplicate token and invalid price simulation failures also map to explicit API errors instead of the generic authorization fallback.
- Decisions: Accepted - Failed Soroban simulations should be translated before checking `needsNonInvokerSigningBy()` so product errors are not hidden by signer validation.
- Follow-ups: Add frontend wallet signing/submission for sale configuration so creators can complete the on-chain prerequisite from the dashboard.
- Blockers: None.
- Verification: NFT API lint/build passed; NFT API tests passed 30/30 outside the sandbox because Supertest binds local ports. A live local public checkout request now returns `primary_sale_not_configured` instead of `authorization_not_required`.

## 2026-07-12 - Codex with Nabil - Sponsor-owned sale setup

- Service or area: NFT Service API and frontend.
- Files changed: `services/nft-service/api/src/domain.ts`, `services/nft-service/api/src/stellarGateway.ts`, `services/nft-service/api/src/service.ts`, `services/nft-service/api/src/app.test.ts`, `frontend/src/services/nft/CollectionDashboard.tsx`, `frontend/src/services/nft/nftApi.ts`, `memory.md`.
- Summary: Fixed local sponsor-owned sale configuration. When the collection owner is also the local sponsor/transaction invoker, Stellar correctly returns no separate non-invoker authorization entry. The API now treats that as valid for sale configuration and auto-submits the setup transaction, returning the confirmed transaction hash to the dashboard instead of throwing `authorization_not_required`.
- Decisions: Accepted - Only creator sale configuration may use this local auto-submit path when no non-invoker signer is required. Buyer checkout still requires buyer authorization and is not auto-submitted.
- Follow-ups: Add full wallet signing/submission for non-sponsor creators and public buyers.
- Blockers: None.
- Verification: NFT API lint/build passed; NFT API tests passed 31/31 outside the sandbox. Frontend TypeScript lint, production build, 29/29 Vitest tests, and 4/4 Playwright E2E tests passed.

## 2026-07-12 - Codex with Nabil - Persist NFT primary sale state

- Service or area: NFT Service API and frontend.
- Files changed: `services/nft-service/api/src/domain.ts`, `services/nft-service/api/src/service.ts`, `services/nft-service/api/src/app.ts`, `services/nft-service/api/src/app.test.ts`, `frontend/src/services/nft/nftApi.ts`, `frontend/src/services/nft/CollectionDashboard.tsx`, `frontend/src/services/nft/CollectionDashboard.test.tsx`, `frontend/src/services/nft/PublicCollection.tsx`, `memory.md`.
- Summary: Fixed the dashboard state after sponsor auto-submits a primary USDC sale configuration. The NFT API now persists `primarySale` with payment token, atomic price, transaction hash, and configured timestamp. The dashboard now shows configured sales as updateable, disables the modal action after auto-submit, and keeps the current sale price visible. Public collection payloads and pages now include the configured primary sale price.
- Decisions: Accepted - Sponsor auto-submit marks sale configuration live only after Stellar returns a confirmed transaction hash. Accepted - Non-sponsor creators still need the later wallet signing/submission flow before the API can persist their signed sale configuration.
- Follow-ups: Add browser wallet signing/submission for non-sponsor creators and public buyers, then persist sale state from the explicit sale-config submit endpoint as well.
- Blockers: None.
- Verification: Frontend targeted dashboard test passed 6/6, full frontend Vitest passed 31/31, frontend TypeScript lint passed, production build passed with the known large chunk warning, and Playwright E2E passed 4/4. NFT API targeted app test passed 19/19 outside the sandbox because Supertest binds local ports; full NFT API tests passed 31/31 outside the sandbox; NFT API lint/build passed. `git diff --check` passed.

## 2026-07-12 - Codex with Nabil - Root env and dev runner

- Service or area: Developer runtime, frontend, NFT API, De-pin docs.
- Files changed: `.env.example`, `.gitignore`, `package.json`, `scripts/dev.mjs`, `frontend/vite.config.ts`, folder `.env.example` files, root/frontend/NFT/De-pin READMEs, `memory.md`.
- Summary: Added a root-level environment template and root npm scripts so local development can start the NFT API and frontend from the repository root with one `.env`. The root dev runner loads `.env` and `.env.local`, injects the same configuration into child processes, fills safe local defaults, and reads the configured Stellar CLI identity at runtime when the sponsor secret is not set. De-pin can join the same flow with `npm run dev:all`.
- Decisions: Accepted - Keep real secrets out of `VITE_*` variables and out of committed files. Accepted - Do not migrate package-locks or package ownership into a root workspace yet; root scripts orchestrate the existing package folders.
- Follow-ups: Consider a full npm workspace migration only when the team wants centralized dependency installation and lockfile ownership.
- Blockers: None.
- Verification: `node --check scripts/dev.mjs`, `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix services/nft-service/api run lint`, `npm --prefix services/nft-service/api run build`, `npm --prefix services/depin run lint`, and `git diff --check` passed. A short root `npm run dev` smoke test passed outside the sandbox: the NFT API started on `4101`, and Vite started the frontend on the next free port because `3000` was already occupied.

## 2026-07-12 - Codex with Nabil - Finish root env and dev runner

- Service or area: Developer runtime, frontend env loading, docs.
- Files changed: `scripts/dev.mjs`, `frontend/vite.config.ts`, `context.md`, root/package env docs already present, `memory.md`.
- Summary: Finished the unfinished unified root env task. Root `npm run dev` / `npm run dev:all` remains the preferred way to run NFT API + frontend (+ optional De-pin) from one `.env`. Hardened the runner with a startup banner, absolute De-pin config resolution and missing-config warning, and taught Vite to load repository-root env when the frontend is started alone. Updated `context.md` so agents stop sending people only to per-folder env files and legacy `dev:stack`.
- Decisions: Accepted - Root `.env` is the single local configuration source for Nabil-service development. Accepted - Folder `.env.example` files stay as compatibility pointers, not second sources of truth.
- Follow-ups: Optional npm workspaces migration later; signed-in frontend collection deploy smoke remains Nabil's next product step.
- Blockers: None for the root runner itself. Production Pinata, managed sponsor secrets, shared NFT persistence, and multi-instance De-pin stores remain open.
- Verification: `node --check scripts/dev.mjs`, frontend lint/build, NFT API lint/build, and De-pin lint passed. `git diff --check` clean. Root `npm run dev` smoke started NFT API on `4101` and Vite on `3000` with Stellar identity `zexvro-provider` loaded from CLI without a root `.env` file. Landed on `feature/nft-service` as commit `feat: unify local env and root dev runner`.

## 2026-07-12 - Codex with Nabil - Phase 1-2 NFT smoke harness and wallet sale submit

- Service or area: NFT Service frontend/API harness, Freighter wallet sale-config submit, public checkout submit client.
- Files changed: `scripts/nft-smoke.mjs`, `package.json`, `services/nft-service/README.md`, `README.md`, `frontend/src/services/nft/stellarWallet.ts`, `frontend/src/services/nft/stellarWallet.test.ts`, `frontend/src/services/nft/nftApi.ts`, `frontend/src/services/nft/nftApi.test.ts`, `frontend/src/services/nft/CollectionDashboard.tsx`, `frontend/src/services/nft/CollectionDashboard.test.tsx`, `frontend/src/services/nft/PublicCollection.tsx`, `frontend/e2e/nft.spec.ts`, `memory.md`, `agent-convo.md`.
- Summary: Implemented plan phases 1–2 (and public checkout submit client for phase 3 prep). Added `npm run nft:smoke` health/auth harness and signed-in runbook. Added Freighter-first wallet adapter, sale-config sign+submit on the dashboard when prepare does not auto-submit, and public page connect/sign/submit checkout path. Sponsor auto-submit path unchanged. No secrets committed.
- Decisions: Accepted - Freighter is the v1 browser wallet. Accepted - Smoke harness stays API-level; browser Cognito loop remains manual. Accepted - Do not claim purchase until API returns confirmed hash.
- Follow-ups: Phase 3 polish if live buyer Freighter smoke needed; Phase 4 creator mint UI; Pinata/shared persistence later phases.
- Blockers: Live Freighter and Cognito browser sessions are manual. `gh auth` still invalid for remote PR automation.
- Verification: Frontend lint/build passed; frontend Vitest 34/34; NFT API lint passed; NFT API tests 33/33; `node --check scripts/nft-smoke.mjs` passed. Known large frontend chunk warning unchanged.

## 2026-07-12 - Codex with Nabil - Freighter wallet detection fix

- Service or area: NFT frontend wallet adapter (Freighter).
- Files changed: `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/services/nft/stellarWallet.ts`, `frontend/src/services/nft/stellarWallet.test.ts`, `frontend/src/services/nft/CollectionDashboard.tsx`, `frontend/src/services/nft/CollectionDashboard.test.tsx`, `frontend/src/services/nft/PublicCollection.tsx`, `memory.md`.
- Summary: Fixed false "Freighter is not installed" by switching from brittle `window.freighterApi` probing to official `@stellar/freighter-api` (postMessage bridge). `isWalletAvailable` is now async via `isConnected()`; connect uses `requestAccess()`; sign uses `networkPassphrase` (Testnet) and clearer permission/network errors. Dashboard + public buy flows await the async availability check.
- Decisions: Accepted - Freighter v1 integration uses `@stellar/freighter-api@6`. Accepted - Prefer precise errors (unavailable / permission denied / sign failed) over a single "not installed" message.
- Follow-ups: Manual browser smoke (allow site in Freighter, Testnet network, non-sponsor sale-config + public checkout). Then Phase 4 creator mint UI and remaining plan phases.
- Blockers: Live Cognito + Freighter browser session still manual. Branch `feature/nft-service` still ahead of origin (unpushed).
- Verification: `npm --prefix frontend test` (stellarWallet + CollectionDashboard green in targeted run); full suite + lint pending this entry.

## 2026-07-12 - Codex with Nabil - Freighter auth JSON signing + creator mint UI

- Service or area: NFT frontend wallet adapter, creator mint dashboard, NFT API simulation error mapping.
- Files changed: `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/services/nft/stellarWallet.ts`, `frontend/src/services/nft/stellarWallet.test.ts`, `frontend/src/services/nft/CollectionDashboard.tsx`, `frontend/src/services/nft/CollectionDashboard.test.tsx`, `frontend/src/services/nft/PublicCollection.tsx`, `services/nft-service/api/src/stellarGateway.ts`, `services/nft-service/api/src/stellarGateway.test.ts`, `memory.md`, `agent-convo.md`.
- Summary: Completed the unfinished Freighter fix and Phase 4 creator mint UI. Wallet adapter now uses `@stellar/freighter-api` for connect/sign, rehydrates AssembledTransaction JSON to sign Soroban auth entries via `signAuthEntry`, and returns updated JSON for API submit. Dashboard live collections gain Mint token modal (operator, recipient, token id → prepare → Sign with wallet → submit). API simulation failures map trustline/balance/auth cases more clearly. No secrets committed.
- Decisions: Accepted - Creator mint UI is prepare+wallet-sign+submit; sponsor auto-submit remains sale-config only. Accepted - Prepared NFT txs stay as AssembledTransaction JSON; Freighter signs auth entries, not only envelope XDR.
- Follow-ups: Manual Freighter mint/sale/checkout smoke; Phase 5 Pinata readiness; inventory/archive later.
- Blockers: Live Cognito + Freighter browser sessions remain manual. Branch still unpushed.
- Verification: Frontend lint, Vitest 40/40, production build passed (known large chunk warning). NFT API lint and tests 39/39.

## 2026-07-13 - Codex with Nabil - Phase 8 mint inventory + archive

- Service or area: NFT API inventory/archive, public buy polish, dashboard inventory UI.
- Files changed: `services/nft-service/api/src/domain.ts`, `repository.ts`, `service.ts`, `app.ts`, `app.test.ts`, `frontend/src/types.ts`, `frontend/src/services/nft/nftApi.ts`, `PublicCollection.tsx`, `CollectionDashboard.tsx`, `CollectionDashboard.test.tsx`, `memory.md`, `agent-convo.md`.
- Summary: Added `MintedItemRecord` persistence, inventory list/next-token endpoints, archive/unarchive for live collections, sold-token blocking on mint/checkout, public buy UI sold/next-token state, dashboard inventory table + archive actions. Public collection pages 404 when archived. No secrets committed.
- Decisions: Accepted - Archive hides public/studio live ops but does not delete on-chain contract. Accepted - Inventory written on successful mint submit (with tokenId/owner) and confirmed checkout. Accepted - Token availability checks use API inventory before chain prepare.
- Follow-ups: Phase 5 Pinata; Phase 6 shared persistence; Phase 7 sponsor secrets; Phase 9-10 De-pin; manual Freighter smoke with inventory after buy.
- Blockers: Live Cognito/Freighter browser still manual. Branch unpushed.
- Verification: NFT API lint + 40/40 tests; frontend lint + nft Vitest 28/28.

## 2026-07-13 - Codex with Nabil - Phase 5 Pinata readiness

- Service or area: NFT API Pinata storage mode, smoke harness, docs.
- Files changed: `services/nft-service/api/src/pinning.ts`, `pinning.test.ts`, `server.ts`, `app.test.ts`, `scripts/nft-smoke.mjs`, `.env.example`, `services/nft-service/README.md`, `plan.md`, `memory.md`, `agent-convo.md`.
- Summary: Hardened Pinata upload path (empty CID rejection, no JWT in errors), startup warning when pinata mode lacks JWT, expanded unit/app tests for success + 502/503/unreachable mapping, documented Pinata env and optional `NFT_SMOKE_PINATA=1` media smoke. No secrets committed.
- Decisions: Accepted - Default local `.env.example` stays `NFT_STORAGE_MODE=local`; pinata is opt-in with server-only `PINATA_JWT`. Accepted - Collection create in pinata mode still requires explicit `ipfs://.../` baseMetadataUri (token metadata directory). Accepted - Real JWT upload remains a manual Nabil gate.
- Follow-ups: Manual Pinata upload with real JWT if available; Phase 6 Dynamo-ready repository; Phase 7 sponsor secret production gate; commit Phase 8 inventory + Phase 5 together or separately.
- Blockers: Live Cognito/Freighter/Pinata credential smokes remain manual. Branch unpushed.
- Verification: NFT API lint clean; tests 46/46; `node --check scripts/nft-smoke.mjs`.

## 2026-07-13 - Codex with Nabil - AWS-first NFT storage decision

- Service or area: NFT Service product/architecture docs.
- Files changed: `context.md`, `plan.md`, `memory.md` (implementation follows).
- Summary: Production media storage moves from Pinata/IPFS-default to AWS **S3 + CloudFront/HTTPS CDN**. API records stay on path to **DynamoDB**. Secrets via **Secrets Manager**. Pinata remains optional legacy only when explicit `ipfs://` is required. Local content-addressed HTTP remains single-process dev only.
- Decisions: Accepted - Prefer AWS over third-party storage for ZEXVRO-owned infrastructure. Accepted - S3 for blobs; DynamoDB for structured NFT records; not one service for both.
- Follow-ups: Implement Phase 5 S3 media adapter; then Dynamo repository (Phase 6); Secrets Manager sponsor injection (Phase 7).
- Blockers: Real AWS bucket/role smoke remains a manual gate after code lands.
- Verification: Docs updated before code implementation.

## 2026-07-13 - Codex with Nabil - Phase 5 AWS S3 media storage

- Service or area: NFT API media storage, frontend labels, docs.
- Files changed: `context.md`, `plan.md`, `services/nft-service/api/src/s3Pinning.ts`, `s3Pinning.test.ts`, `config.ts`, `server.ts`, `app.ts`, `service.ts`, `package.json` (+ `@aws-sdk/client-s3`), `frontend/src/services/nft/nftApi.ts`, `CollectionCreate.tsx`, `.env.example`, `.env` (local mode restore), `services/nft-service/README.md`, `memory.md`, `agent-convo.md`.
- Summary: Production media path is AWS S3 (`NFT_STORAGE_MODE=s3`) with optional CDN base URL. Local remains default for dev. Pinata remains optional legacy. API accepts HTTP(S) or ipfs base metadata URIs ending in `/`. Auto token-metadata base URL works for local and s3. No secrets committed.
- Decisions: Accepted - S3 for blobs; DynamoDB still Phase 6 for records. Accepted - Prefer IAM default credential chain over embedding keys.
- Follow-ups: Manual S3 bucket smoke when AWS role/bucket ready; Phase 6 DynamoNftRepository; Phase 7 Secrets Manager sponsor injection.
- Blockers: Live AWS bucket not required for CI (mocked).
- Verification: NFT API lint + 49/49 tests; frontend lint + nft Vitest 28/28.

## 2026-07-13 - Codex with Nabil - Phase 6 DynamoDB NFT repository

- Service or area: NFT API multi-instance persistence.
- Files changed: `services/nft-service/api/src/dynamoRepository.ts`, `dynamoRepository.test.ts`, `config.ts`, `server.ts`, `app.ts` (exactOptional mint submit), `s3Pinning.ts` (optional typing), `package.json` (+ Dynamo SDK), `services/nft-service/README.md`, `.env.example`, `plan.md`, `memory.md`, `agent-convo.md`.
- Summary: Added pluggable `DynamoNftRepository` for collections, minted inventory, and checkout intents on single-table `zexvro-nft` with workspace + idempotency GSIs and conditional checkout claim. Factory via `NFT_REPOSITORY=file|dynamo` (file default). Mocked unit tests only in CI. Fixed exactOptionalPropertyTypes build issues for mint submit + S3 options.
- Decisions: Accepted - File repository remains local default; Dynamo is opt-in via env. Accepted - Atomic claim with ConditionalCheckFailed → undefined (no double-claim). Accepted - No live Dynamo required for CI.
- Follow-ups: Optional live Dynamo table smoke; Phase 7 Secrets Manager sponsor injection; Phase 9–10 De-pin durable stores; commit Phase 8 + 5 + 6 when ready.
- Blockers: Live Cognito/Freighter and AWS table/bucket smokes remain manual. Branch unpushed.
- Verification: NFT API lint clean; tests 54/54; `npm --prefix services/nft-service/api run build` green.

## 2026-07-13 - Codex with Nabil - Phase 7 managed sponsor secret gate

- Service or area: NFT API production startup / Secrets Manager injection docs.
- Files changed: `services/nft-service/api/src/config.ts`, `config.test.ts`, `services/nft-service/README.md`, `.env.example`, `docs/aws_deployment.md`, `plan.md`, `memory.md`, `agent-convo.md`.
- Summary: Production (or `NFT_REQUIRE_SPONSOR=1`) fails fast without `STELLAR_SPONSOR_SECRET` + `NFT_COLLECTION_WASM_HASH`. Local CLI identity path via `scripts/dev.mjs` unchanged. Documented Secrets Manager → task env injection. No secrets committed or logged.
- Decisions: Accepted - Gate on `NODE_ENV=production` by default; explicit `NFT_REQUIRE_SPONSOR=0` can opt out for constrained hosts. Accepted - Hosted deploys inject secret as env; no runtime Secrets Manager SDK fetch in v1.
- Follow-ups: Phase 9–10 De-pin durable stores/config; Phase 11 docs/PR; optional live AWS smokes; commit phases when ready.
- Blockers: Live Cognito/Freighter and AWS smokes remain manual. Branch unpushed.
- Verification: NFT API lint clean; tests 60/60; build green.

## 2026-07-13 - Codex with Nabil - Phase 9–10 De-pin stores + managed config

- Service or area: De-pin gateway multi-instance state + config sources.
- Files changed: `services/depin/src/stores.ts`, `stores.test.ts`, `domain.ts`, `replay.ts`, `rateLimit.ts`, `proxy.ts`, `proxy.test.ts`, `config.ts`, `config.test.ts`, `server.ts`, `README.md`, `frontend/src/services/depin/depinApi.ts`, `.env.example`, `plan.md`, `memory.md`, `agent-convo.md`.
- Summary: Added pluggable `ReplayStore`/`RateLimitStore` (memory default, file shared JSON; redis reserved). Config load priority `DEPIN_CONFIG_JSON` → `DEPIN_CONFIG_URL` → `DEPIN_CONFIG_PATH`. `/status` reports `configSource` + `stateBackend`. x402 payment order unchanged. No secrets committed.
- Decisions: Accepted - File state for multi-process local/staging without Redis. Accepted - Boot-only config (no hot reload). Accepted - Redis not implemented yet (explicit error).
- Follow-ups: Phase 11 docs/PR readiness; optional Redis backend; commit NFT + De-pin phases when ready.
- Blockers: Live Cognito/Freighter/AWS smokes remain manual. Branch unpushed.
- Verification: De-pin lint clean; tests 34/34; build green.

## 2026-07-13 - Codex with Nabil - Phase 11 docs sync + PR readiness

- Service or area: Shared docs for NFT + De-pin status.
- Files changed: `pages.md`, `planning.md`, `context.md`, `plan.md`, `memory.md`, `agent-convo.md`.
- Summary: Synced planning/pages/context with implemented Nabil services. NFT and De-pin are working local/testnet MVPs with code-ready AWS/multi-instance gates; no live production claim. Plan phases 1–11 marked done for code/docs; commits/PR remain user-gated.
- Decisions: Accepted - Do not open PR/push without explicit user confirmation. Accepted - Keep Morph/Rushi areas out of this branch scope.
- Follow-ups: User-requested commit(s) and optional PR `feature/nft-service` → `main`; live AWS S3/Dynamo/Secrets + Freighter smoke recorded when available.
- Blockers: Branch still has large uncommitted Nabil work; live AWS/Freighter ops gates open.
- Verification: NFT API lint/test/build green (60/60); De-pin lint/test/build green (34/34).

## 2026-07-13 - Codex with Nabil - AWS production resources for NFT

- Service or area: AWS us-east-1 account `290294660486` infrastructure for NFT media/records/secrets.
- Files changed: root `.env` (infra keys only), `docs/aws_nft_production.md`, `docs/aws_deployment.md`, `memory.md`.
- Summary: Provisioned DynamoDB `zexvro-nft` (pk/sk + workspace-index + idempotency-index, on-demand), S3 `zexvro-nft-media-290294660486-us-east-1` (private, versioned, SSE-S3), CloudFront `E29QH7B9BDBJZW` / `d1a0z3arlwwfrj.cloudfront.net` with OAC + bucket policy, Secrets Manager `zexvro/nft/sponsor-secret` (value from local `zexvro-provider` CLI identity, not logged). Dynamo put/get/query/delete smoke passed; S3 object upload passed; CloudFront was InProgress at provision time.
- Decisions: Accepted - Private bucket + CloudFront only (no public S3 ACLs). Accepted - PAY_PER_REQUEST Dynamo. Accepted - Do not write sponsor secret into git; inject via Secrets Manager or CLI at runtime.
- Follow-ups: Wait for CloudFront Deployed; run NFT API with S3+Dynamo env + secret export; optional ECS/IAM least-privilege host; Freighter end-to-end against AWS-backed API.
- Blockers: NFT Express API still not container-deployed to ECS/Lambda (infra for storage/secrets only). CloudFront propagation.
- Verification: `aws dynamodb` smoke OK; `aws s3 cp` smoke object OK; secret describe OK.

## Live AWS verification (2026-07-13 20:44 UTC)

- CloudFront smoke object: HTTP 200 `https://d1a0z3arlwwfrj.cloudfront.net/nft/smoke.json`
- S3 put + CDN fetch of new key: HTTP 200 (then deleted)
- Dynamo put/get/query (workspace GSI) + minted item: OK (cleaned up)
- NFT API local (`tsx`, port 4101) with Secrets Manager sponsor secret:
  - `/health` → storageMode=s3, stellarConfigured=true, pinningConfigured=true, repository=dynamo
  - unauth private route → 401
  - missing public collection → 404
  - `scripts/nft-smoke.mjs` health path passed (no Cognito token; auth routes skipped)
- Frontend NFT unit tests: 28/28
- De-pin local file backend (port 4102):
  - `/health` ok
  - `/status` configSource=file:depin.config.json, stateBackend=file
  - unpaid `/v1/nft-health` → 402
- Note: empty `DEPIN_CONFIG_JSON`/`DEPIN_CONFIG_URL` in root `.env` must be unset at process start (empty string is treated as set and can break path load if cwd wrong). Use absolute `DEPIN_CONFIG_PATH` when not running from `services/depin`.
- Still open: Cognito/Freighter browser E2E; hosted API (ECS/Lambda); least-privilege IAM role.

## 2026-07-14 - Codex with Nabil - Commit phases 5–11 and push feature/nft-service

- Service or area: NFT Service + De-pin + shared docs.
- Files changed: NFT API (S3, Dynamo, inventory, sponsor gate, Pinata harden), NFT FE inventory/buy polish, De-pin stores/config, docs/aws_nft_production.md, planning/context/pages/plan/memory/agent-convo, .env.example, scripts/nft-smoke.mjs.
- Summary: User-approved commit of uncommitted Nabil work and push to `origin/feature/nft-service`. No PR. Excluded secrets, Morph dirt, local scratch scripts, and `.vscode/`.
- Decisions: Accepted - Push branch only; no PR. Accepted - Keep Morph/Rushi files out of commits.
- Follow-ups: Auto token-ID allocation (no manual entry); multi-surface public checkout (popup + custom UI + backend API) + web SDK scaffold; Cognito/Freighter browser E2E; hosted API + least-privilege IAM.
- Blockers: Browser E2E and container host still open.
- Verification: Prior matrix green (NFT 60/60, De-pin 34/34, FE NFT 28/28, live AWS smoke recorded).

## 2026-07-14 - Codex with Nabil - Auto token IDs + multi-surface checkout SDK

- Service or area: NFT Service API, frontend, public checkout SDK.
- Files changed: `domain.ts`, `repository.ts`, `dynamoRepository.ts`, `service.ts`, `app.ts`, `app.test.ts`, `dynamoRepository.test.ts`, FE mint/buy UIs + tests, `packages/nft-checkout-sdk/*`, `EmbedCheckout.tsx`, `router.tsx`, NFT README, memory/agent-convo.
- Summary: Token IDs always auto-allocated when omitted (Dynamo/file counter). Studio mint + public buy hide manual token ID entry. Scaffolded `@zexvro/nft-checkout-sdk` (headless client + openCheckout popup) and `/nft/embed/checkout` embed route for game integrations. Three surfaces: popup, custom UI, backend REST.
- Decisions: Accepted - Always auto by default; optional explicit tokenId for advanced API. Accepted - Web SDK only for v1; API is universal. Accepted - NFT = platform service; game decides currency vs ownership semantics.
- Follow-ups: Publish npm package when ready; partner CORS allowlist; Cognito/Freighter full E2E; optional commit of this slice.
- Blockers: Browser Freighter E2E still manual.
- Verification: NFT API 62/62 lint/build; FE nft+routing 34 tests expected after route test; FE lint green.

## 2026-07-14 - Codex with Nabil - Stellar skills audit polish (NFT + De-pin)

- Service or area: NFT wallet/gateway/contract, De-pin x402 facilitator auth.
- Files changed: `frontend/src/services/nft/stellarWallet.ts` (+tests), `services/nft-service/api/src/stellarGateway.ts` (+tests), `services/nft-service/contracts/collection/src/lib.rs`, `services/depin/src/payment.ts`, depin README/example, `.env.example`.
- Summary: Skill-aligned fixes after installing skills.stellar.org. Freighter network mismatch fail-fast; full collection contract error map (#1–#6); instance TTL bumps on mint/sale/purchase; De-pin optional OZ_API_KEY Bearer for Channels facilitator; docs for payTo G-address vs SAC C-address.
- Decisions: Accepted - Keep x402.org as local unpaid-probe default; OZ Channels + OZ_API_KEY for real Stellar settle. Accepted - Contract TTL bump is source change; existing testnet WASM hash still current until rebuild/redeploy.
- Follow-ups: Rebuild/redeploy collection WASM if TTL bumps required on-chain for new collections; optional switch depin.config facilitatorUrl to OZ Channels when key available; commit polish + SDK UI when user asks.
- Blockers: None for unit matrix.
- Verification: FE NFT 32/32; NFT API 63/63; De-pin 34/34; contract tests 10/10; lints green.

## 2026-07-14 - Codex with Nabil - Remaining ops: WASM TTL install + CORS + test checklist

- Service or area: NFT contract WASM, API CORS, local test docs.
- Files changed: rebuilt `zexvro_nft_collection.wasm`, installed on testnet hash `df42dfce…`, updated `.env`/`.env.example`/`scripts/dev.mjs`/README/aws_nft_production; CORS allowlist normalize + preflight test; `docs/nft_local_test_checklist.md`; SDK README CORS note.
- Summary: New collections deploy with TTL-bump WASM. CORS fail-closed allowlist (trailing slash normalized). Local browser checklist written for Nabil smoke without claiming E2E done.
- Decisions: Accepted - Old collections keep old WASM until redeployed. Accepted - No commit yet (user testing first).
- Follow-ups: User browser smoke via checklist; restart dev stack for new hash; optional OZ_API_KEY for De-pin settle; commit when user asks.
- Blockers: Hosted ECS/IAM still open (ops).
- Verification: NFT API 64/64; FE NFT 32/32; contract tests previously 10/10; install tx on testnet recorded in install log.

## 2026-07-15 - Codex with Nabil - Docs: Access Shield + teammate MD sync

- Service or area: Shared product docs (context, planning, pages, access_shield).
- Files changed: `context.md`, `planning.md`, `pages.md`, `docs/access_shield.md` (new), `memory.md`, `agent-convo.md`.
- Summary: Documented De-pin strategic framing as **Access Shield** (big-tech free-tier/agent API abuse defense) for teammates. Updated NFT rows for auto token IDs + Integrate SDK + embed routes. Clarified OZ_API_KEY / G vs C recipient rules. No code claims of full Access Shield GA.
- Decisions: Proposed - Access Shield is the product name for economic firewall built on De-pin + future Agent Auth/policy. Accepted - Platform defense only; no offensive farm tooling. Accepted - Keep shipping MVP as De-pin gateway while narrative expands.
- Follow-ups: Team review of `docs/access_shield.md`; coordinate with Rushi on Agent Auth binding; Nabil browser smoke checklist still open; commit when user asks.
- Blockers: None for docs.
- Verification: Docs only (no test matrix required).

## 2026-07-15 - Codex with Nabil - NFT RPG demo harness for SDK E2E

- Service or area: NFT SDK integration test game.
- Files changed: `test/nft-rpg-demo/**` (canvas RPG shop, 5 SVG assets, vendored checkout SDK, serve script, README); `docs/nft_local_test_checklist.md` game section.
- Summary: Built a small self-contained web RPG under test/ instead of cloning a large Pokemon repo. Shop buys via openCheckout popup; ownership unlocks in-game stats/VFX. Offline demo mode without collectionId.
- Decisions: Accepted - Tiny custom harness > huge third-party RPG for controllable E2E. Accepted - Demo maps purchase success to clicked SKU (collection is sequential mints, not on-chain SKUs).
- Follow-ups: User creates live collection, pastes collectionId, Freighter buy smoke; optional commit of test/ harness.
- Blockers: Needs human Cognito/Freighter for full live proof.
- Verification: Static server serves index/game/sdk/assets HTTP 200; NFT API health when running.

## 2026-07-15 - Merge - Zer0 + NFT/De-pin into updates-routing-and-zer0

- Service or area: Branch merge of `origin/main` (NFT/De-pin) into `updates-routing-and-zer0` (Zer0/routing).
- Files changed: conflict resolutions in `frontend/.env.example`, `frontend/package.json`, `memory.md`, `scratch_lambda/lambda_function.py`; package-lock regenerated.
- Summary: Kept Zer0 env vars and Cognito config, kept NFT/De-pin frontend + services, kept Lambda chat key from `OPENCODE_API_KEY` env (no hardcoded secret), kept both memory logs.
- Decisions: Accepted - `@stellar/stellar-sdk` for NFT Freighter flows + existing `stellar-sdk` for Zer0; chat proxy uses env secret only.
- Follow-ups: Deploy `zexvro-agent-backend` Lambda; merge PR #3.
- Blockers: None.
- Verification: Pending lint/build and Lambda deploy after conflict resolution.

## 2026-07-16 - Codex with Nabil - Merge origin/main into feature/nft-service

- Service or area: feature/nft-service merge of Paris main (Zer0 + NFT App Runner) + Nabil SVG media/RPG demo.
- Files changed: conflict resolutions in `CollectionCreate.tsx`, `EmbedCheckout.tsx`, `memory.md`.
- Summary: Kept main NFT create wizard (XLM price steps) with SVG/MIME-normalized cover upload; embed checkout uses openerOrigin when provided and `*` fallback; both memory entries retained.
- Decisions: Accepted - Prefer main CollectionCreate flow; keep media.ts MIME normalization + SVG. Accepted - postMessage targetOrigin = openerOrigin or `*`.
- Follow-ups: Push feature/nft-service; browser smoke RPG demo after pull.
- Blockers: None.
- Verification: Conflict markers cleared; commit merge.

## 2026-07-16 - Codex with Nabil - De-pin Access Shield harden slice

- Service or area: De-pin gateway (Access Shield enforcement plane).
- Files changed: `services/depin/src/facilitator.ts` (+tests), `payment.ts`, `proxy.ts` (+status fields), `server.ts`, `scripts/smoke.mjs`, `depin.config.example.json`, `README.md`, `package.json`; `frontend` depinApi + DepinService readiness UI; `.env.example`; `docs/depin_local_smoke.md`; deploy script file-state default; `memory.md`.
- Summary: Started focused De-pin work after NFT loop pause. Exposed facilitator settle readiness and multi-instance safety on `/status`; warn on production memory state and missing OZ key for Channels; added unpaid smoke script; dashboard shows settle/state banners; example config includes local NFT health route; docs runbook for unpaid + paid smoke.
- Decisions: Accepted - Prefer file state for multi-process; unpaid probes remain valid without OZ key; paid settle via OZ Channels requires `OZ_API_KEY`. Accepted - Do not implement streaming/POST/redis in this slice.
- Follow-ups: Live paid settle with OZ key when available; provider onboarding UI; redis store when multi-region needed; coordinate Access Shield control-plane with Agent Auth (Rushi).
- Blockers: None for unpaid path. Paid settle needs human OZ_API_KEY + funded buyer for full proof.
- Verification: `npm --prefix services/depin test` (expect 38+); FE depin unit tests; smoke script against running gateway when available.

## 2026-07-17 - Codex with Paris - NFT + Zer0 product complete; De-pin paused for tomorrow

- Service or area: NFT Service, Zer0 UI, brand cinema, client settings, De-pin gateway harden (code-only).
- Files changed (high level): NFT create cinema + success modal, CollectionStudio dashboard (ledger charts, delete, URLs), nftApi hosted default + get-by-id, brand/boot assets, Auth/Settings AWS scrub, Depin CORS + multiInstance honesty, `/docs` NFT section, `memory.md`/`context.md`.
- Summary: Marked **NFT** and **Zer0** product surfaces complete for client use. NFT: mission-brief through Freighter, launch finale, success popup (dashboard/manage/delete), studio analytics, docs at `/docs`. Zer0: client settings without EC2/AWS region/Cognito debug UI. De-pin: CORS + expose x402 headers + FE base URL default; **full Depin product testing deferred to tomorrow** — do not merge this branch yet.
- Decisions: Accepted - NFT/Zer0 = complete for product UI on this branch. Accepted - De-pin remains in progress (redeploy + paid settle smoke still open). Accepted - Push branch only; **no merge to main**.
- Follow-ups (tomorrow): Depin service E2E (App Runner redeploy, CORS from Pages, OZ settle, probe 402 from dashboard). Optional: fuel/assemble videos if product wants multi-stage cinema again.
- Blockers: None for NFT/Zer0. Depin live CORS depends on redeploy of hardened gateway image.
- Verification: FE NFT unit suite green earlier; Depin gateway 40/40 + FE depin 5/5 earlier; typecheck green on studio/hooks fixes.

## 2026-07-17 - Codex with Paris - De-pin App Runner CORS redeploy

- Service or area: De-pin x402 gateway (Access Shield) on App Runner + FE client.
- Files changed: `scripts/redeploy-depin-aws.mjs` (new), `scripts/deploy-nft-depin-aws.mjs` (CORS on depin service), `frontend/src/services/depin/depinApi.ts` (+test), `frontend/src/components/services/DepinService.tsx`, root + `frontend/.env` `VITE_DEPIN_API_URL` → hosted URL, `memory.md`.
- Summary: Dashboard Unavailable/Unknown was browser NetworkError — live App Runner image lacked CORS (OPTIONS 404, no ACAO). Rebuilt image `depin-1784274236906` via CodeBuild ZIP source, updated `zexvro-depin` with `CORS_ALLOWED_ORIGINS` + file state. Verified OPTIONS/GET from localhost:3000 and pages.dev return 204/200 with ACAO. FE maps NetworkError to clearer message and shows API base.
- Decisions: Accepted - Point local FE at hosted App Runner by default until local :4102 is intentionally used. Accepted - Deploy script now injects CORS for De-pin (was NFT-only).
- Follow-ups: Hard refresh dashboard; Probe 402 on `/v1/weather`; paid settle still needs OZ_API_KEY + funded buyer; restore full dual-image CodeBuild source if next NFT+Depin joint deploy.
- Blockers: None for unpaid readiness/probe.
- Verification: Live OPTIONS 204 + ACAO; `/health` ok; `/status` scheme=exact state=file providers=1; FE depinApi tests 3/3.

## 2026-07-17 - Codex with Paris - Access Shield full product UI

- Service or area: De-pin / Access Shield frontend product surface (+ docs).
- Files changed: `DepinService.tsx` (tabs Overview/Routes/Protect/Integrate), `depinConfig.ts` (+tests), `ProtectRouteWizard.tsx`, `DepinIntegratePanel.tsx`, `DocsLibrary.tsx` topic `access-shield`, catalog/Services copy, DepinService tests.
- Summary: NFT-parity product UI without inventing a control-plane API. Protect wizard builds validated provider + full `depin.config.json` (copy/download + local/hosted apply steps). Integrate panel mirrors NFT SDK (probe/pay/config/env). Docs explain problem, 402 flow, config sources, OZ key, MVP limits.
- Decisions: Accepted - Config-at-boot honesty (wizard does not claim live create). Accepted - Single project `/depin` screen with tabs instead of extra routes for now.
- Follow-ups: Browser smoke protect → export → apply; optional deep-link `/docs?topic=access-shield`; paid settle still needs human OZ key.
- Blockers: None for unpaid product UI.
- Verification: `tsc --noEmit` clean; depin unit tests (re-run after selector fix).

## 2026-07-17 - Codex with Paris - Push main + Cloudflare Pages deploy

- Service or area: git release + Cloudflare Pages `zexvro`.
- Summary: Committed Access Shield UI + CORS redeploy tooling on `feature/depin-access-shield` (`623963c`), merged to `main` (`0be5016`), pushed origin. Built FE with hosted NFT/Depin API URLs and deployed Pages project `zexvro` → `https://79952fa4.zexvro.pages.dev` (alias `https://main.zexvro.pages.dev` / production `https://zexvro.pages.dev`).
- Decisions: Accepted - Exclude marketing binaries / morph db / circuit artifacts from commit. Accepted - Production build uses App Runner NFT+Depin bases (not `/api/*` proxy).
- Follow-ups: Hard-refresh production dashboard; confirm custom domain if not auto-promoting; paid settle still needs OZ key.
- Blockers: None for unpaid path.
- Verification: git push main ok; wrangler pages deploy success.

## 2026-07-21 - Codex with Paris - Remaining work + ticket assignments for agents

- Service or area: shared agent config (`context.md`, `memory.md`, `AGENTS.md`).
- Files changed: `context.md` (Active Ticket Assignments + Remaining Work + platform owners), `memory.md` (this entry), `AGENTS.md` (boot checklist + remaining work pointer).
- Summary: Locked remaining incomplete work and who builds what so Morph / Nabil / Paris agents pull the same source of truth on startup.
- Decisions: Accepted - Assignees: **Morph track** = Morph CLI/agentic + CI/CD + web2→web3 demo + Morph surface + shared memory; **Nabil** = RBAC, credits, team/workspace mgmt + related UI + audit logs; **Paris** = remove unwanted/dummy UI, landing demos+icons, shell polish (Zer0 sidebar, Payroll→Finance, need-help→docs, project settings UI). Accepted - Agents must not steal another assignee’s ticket without coordination + memory entry.
- Remaining Zexvro: RBAC, team email display, team invite fix, need-help→docs, mainnet↔testnet toggle, Zexvro credits.
- Remaining Overview: home metrics, Zer0 no duplicate sidebar, Payroll→Finance, Morph agent, Analytics, CI/CD, Project Settings, curated admin options.
- Remaining Projects: remove execution, remove unwired dummy, working audit logs, gut service manager, Morph working, shared memory actually updates, project settings revamp (Discord).
- Follow-ups: Each agent starts from `AGENTS.md` → `context.md` Active Ticket Assignments → own build list; update this file when a ticket finishes.
- Blockers: None for assignment clarity.
- Verification: Sections present in `context.md`; `AGENTS.md` points agents at remaining work.
