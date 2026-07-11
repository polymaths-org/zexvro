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
| NFT Service | Nabil / `n4bi10p` | Planned | Ask or record coordination before changing minting, metadata, checkout, or NFT model |
| De-pin | Nabil / `n4bi10p` | Needs Nabil context | Do not implement until scope is documented |

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
6. Do not invent De-pin scope.
7. Do not treat planned stack choices as fully designed architecture.
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
- Decision: Proposed - Use AWS for cloud infrastructure where needed.
- Decision: Blocked - De-pin scope needs Nabil's input before implementation.

## Active Blockers

| Blocker | Owner needed | Impact |
| --- | --- | --- |
| De-pin scope is undefined | Nabil / `n4bi10p` | De-pin should not be implemented yet |

## Active Handoffs

- Handoff:
  - Current state: Morph CLI/TUI fully implemented, integrated with remote completions API, and deployed.
  - Next step: Wait for Nabil's feedback on De-pin scope.
  - Files to inspect: `services/transformation-agent/cli/`, `context.md`, `memory.md`, `frontend/`.
  - Do not touch: De-pin, other developers' services.
  - Owner needed: Nabil for De-pin context.

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
