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
| Transformation Agent | Paris / `paris-29` | Planned | Ask or record coordination before changing memory, CLI, or agent architecture |
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
- Decision: Proposed - Use AWS for cloud infrastructure where needed.
- Decision: Blocked - De-pin scope needs Nabil's input before implementation.

## Active Blockers

| Blocker | Owner needed | Impact |
| --- | --- | --- |
| De-pin scope is undefined | Nabil / `n4bi10p` | De-pin should not be implemented yet |
| App not scaffolded | Any owner can propose | No install/dev/build/test commands exist yet |
| Service architecture not defined | Each service owner | Agents should not create final architecture without recording decisions |

## Active Handoffs

- Handoff:
  - Current state: Repo has brand assets, README, context, and shared memory docs. No app scaffold exists.
  - Next step: Scaffold the Vite + React frontend or create service directories when the team decides to start implementation.
  - Files to inspect: `README.md`, `context.md`, `memory.md`, `assets/brand/`.
  - Do not touch: Do not implement De-pin before Nabil defines scope.
  - Owner needed: Any developer for app scaffold; Nabil for De-pin details.

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
