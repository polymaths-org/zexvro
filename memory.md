# ZEXVRO Shared Memory

This file is the chronological operating memory for ZEXVRO developers and coding agents.

Use it to record what changed, why it changed, what decisions were made, what is blocked, and what another agent needs to know before continuing. Keep it precise. Do not paste long logs, unrelated brainstorms, or raw context dumps.

## Required Agent Startup

Before any coding or documentation task, every agent must:

1. Read `README.md`.
2. Read `context.md`.
3. Read this file from top to bottom.
4. Run `git status --short`.
5. Identify the service or shared area being touched.
6. Check the latest memory entries for ownership, blockers, and decisions.
7. Make scoped changes only.
8. Add a memory entry before committing.

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
| Zero-Knowledge Privacy Pool | Paris / `paris-29` | Planned | Ask or record coordination before changing core design |
| Transformation Agent (Morph) | Paris / `paris-29` | **In Progress — CLI built** | Owned by Paris. CLI skeleton done. Next: wire LLM, add web panel. |
| A-2-A Trade Pipeline | Rushi / `Wraient` | Planned | Ask or record coordination before changing protocol, wallet, or negotiation design |
| Captcha-like Agent Authentication Service | Rushi / `Wraient` | Planned | Ask or record coordination before changing identity, SDK, classifier, or HDM design |
| NFT Service | Nabil / `n4bi10p` | Authenticated API/frontend wired for local-storage testnet runs; production Pinata pending | Ask or record coordination before changing minting, metadata, checkout, or NFT model |
| De-pin | Nabil / `n4bi10p` | Live Stellar testnet x402 payment verified | Follow the accepted exact per-request x402 scope |

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
- Decision: Accepted - Frontend uses React Router for URL-based routing.
- Decision: Proposed - Use AWS for cloud infrastructure where needed.

## Active Blockers

| Blocker | Owner needed | Impact |
| --- | --- | --- |
| Production Pinata, persistent sponsor secret injection, and shared NFT persistence are not configured | Nabil / `n4bi10p` | Local frontend-to-testnet runs work, but the NFT service is not production deployable |
| Replay and unpaid-rate-limit state is in memory | Nabil / `n4bi10p` | Do not run multiple production gateway instances until shared persistence is added |

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
- Follow-ups: Nabil should complete one signed-in collection deployment from `http://127.0.0.1:3001/services/nft`; then configure Pinata, managed secret injection, and shared persistence before production use.
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
