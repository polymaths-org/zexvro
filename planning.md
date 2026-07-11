# ZEXVRO Planning Brief

Status: Proposed product planning context. This file is for humans and models planning future screens or architecture. Do not treat proposed flows as implemented backend behavior.

Last updated: 2026-07-10 (decisions added: TanStack Router, Zustand, multi-step wizard, /w/:wid/p/:pid/ routes)

## How To Use This File

- Read `README.md` first for the public project summary.
- Read `context.md` for stable product context, service ownership, stack assumptions, and edit boundaries.
- Read `memory.md` for chronological decisions, blockers, and current work state.
- Read `design.md` before planning UI, layout, animation, or frontend styling.
- Use this file as a concise planning map for the dashboard, projects, transactions, payroll, proof manager, and scoped workspace/project UX.

## Current Product Direction

ZEXVRO is a unified Web3 PaaS for teams building private, verifiable, agent-ready infrastructure.

The product should feel like a serious developer platform, closer to Vercel or Cloudflare than a crypto dashboard. It should hide unnecessary blockchain complexity while still supporting Web3-native privacy, verification, agents, payments, and infrastructure.

Core principles:

- Dashboard-first product, not marketing-first.
- Clean, dense, professional UI.
- Web3 power exposed through normal product flows.
- Agent actions are proposal-first and auditable.
- No fake live states, balances, integrations, deployments, tax claims, or compliance claims.
- Proposed product ideas stay marked as proposed until accepted.

## Current Repo State

- Frontend workspace: `frontend/`.
- Frontend stack: Vite + React.
- Public route `/` currently should stay minimal: glassmorphic "Welcome to ZEXVRO" with a `Step into Web3` button to `/dashboard`.
- Authenticated dashboard route: `/dashboard`.
- Dashboard state is still frontend-only and prototype-level.
- Do not claim real backend, auth, wallet, blockchain, deployment provider, secrets manager, finance, payroll, proof, or off-ramp integrations until implemented.
- Existing navigation is mostly local React tab state, not URL-backed routing.
- Current project rows do not open a real project dashboard.

Known dirty areas from recent work:

- Landing/marketing assets and dashboard files have recent uncommitted changes.
- `memory.md` has recent planning entries.
- Do not revert existing changes unless explicitly asked.

Branch note for `updates-routing-and-zer0`:

- This branch is for routing, workspace/project dashboard structure, and Zer0 prototype updates.
- Not everything in this branch is production-ready or polished.
- The frontend still contains dummy data, placeholder flows, unfinished screens, and unpolished UI details.
- Treat the branch as an implementation/prototype branch, not a claim that the full product experience is complete.

## MVP Services

| Service | Owner | Status | Planning notes |
| --- | --- | --- | --- |
| Zero-Knowledge Privacy Pool | Paris | Planned | Exact proving model, data privacy model, and contract architecture are undecided. |
| Transformation Agent, Morph | Paris | CLI built | CLI/TUI exists. Web panel and deeper frontend integration are future work. |
| A-2-A Trade Pipeline | Rushi | Planned | Agent negotiation, identity, offer schema, wallet authorization, and settlement are undecided. |
| Captcha-like Agent Authentication | Rushi | Planned | Must avoid claims of perfect detection. Needs confidence score, appeal, and privacy model. |
| NFT Service | Nabil | Planned | Minting, metadata, checkout, and NFT model still need detailed scope. |
| De-pin | Nabil | Blocked | Scope is undefined. Do not implement until Nabil provides direction. |

Secondary PaaS features like deploy, DB, hosting, security, connectors, and billing should support the MVP services, not overtake them.

## Recent User Direction

These items came from the latest product planning conversations and should be treated as proposed:

- Keep the public landing page minimal.
- Add a sidebar section named `Transactions & Payroll`.
- Plan organization/team invite flows.
- Plan a `Zer0` option connected to private payments/privacy features.
- Plan payroll, transaction, and proof-management screens.
- Plan two recipient experiences:
  - Web3 users who understand wallets/blockchain.
  - Standard users who need a guided withdrawal/off-ramp flow into normal currency.
- Plan a Proof Manager for sending, downloading, managing, and versioning proof artifacts for accounting, tax review, legal review, and audit support.
- Plan projects as scoped workspaces inside the broader account/workspace dashboard.

Important Stellar clarification:

- `SEP-45` is for authenticating Stellar contract accounts.
- It is not a fiat withdrawal protocol.
- For future off-ramp/withdrawal planning, evaluate `SEP-24` for provider-hosted withdrawals and `SEP-6` for programmatic withdrawals.
- Real availability depends on selected anchor, asset, country, payout rail, KYC requirements, and provider quotes.

## Product Hierarchy

Use this hierarchy for future planning:

```text
User Account -> Workspace -> Project -> Environment -> Service Instance
```

Definitions:

- User Account: personal identity, profile, MFA, sessions, personal preferences.
- Workspace: organization-level control plane for team, projects, policy, finance, audit, shared services, and billing.
- Project: scoped product/app/business initiative inside a workspace.
- Environment: dev, staging, production, testnet, mainnet, or other scoped runtime context.
- Service Instance: one configured occurrence of a ZEXVRO capability for a project and environment.

Do not collapse workspace and project into one concept. A workspace dashboard is the global control plane. A project dashboard is a narrowed operational view.

## Workspace Dashboard Scope

The workspace dashboard is for cross-project management and organization-wide control.

Workspace sections:

- Overview
- Projects
- All Instances
- All Deployments
- Activity
- Service Catalog
- Zer0 Privacy
- Agentic Ops
- Morph
- A-2-A
- Agent Auth
- NFT
- De-pin, blocked until scoped
- Transactions & Payroll
- Finance Overview
- Transactions
- Zer0
- Payroll
- Proof Manager
- Team & Access
- Approval Policies
- Security & Audit
- Usage & Billing
- Workspace Settings

Workspace views should show a `Project` column or filter when records are project-owned.

Workspace creates for project-owned resources must ask for target project and environment before continuing.

## Project Dashboard Scope

When a user opens a project, the UI should revolve around only that project.

Project sections:

- Project Overview
- Environments
- Instances
- Deployments
- Logs
- Enabled Services
- Add Service
- Agents
- Project Memory
- Transactions
- Zer0
- Proofs
- Optional Payroll Allocation
- Project Members
- API Keys & Secrets
- Project Audit
- Project Settings

Project pages should only show records for that project unless the user explicitly jumps back to workspace scope.

Project top shell:

```text
Back to Workspace | Workspace / Project | Project switcher | Environment selector | Section actions
```

Back behavior:

- From a normal navigation path, return to the previous workspace page with filters/search preserved.
- From a direct project link, fall back to the workspace overview or project index.
- Warn before leaving when there are unsaved changes.

Recommended future routes:

```text
/w/:workspaceId/overview
/w/:workspaceId/projects
/w/:workspaceId/instances
/w/:workspaceId/transactions
/w/:workspaceId/proofs
/w/:workspaceId/p/:projectId/overview
/w/:workspaceId/p/:projectId/environments
/w/:workspaceId/p/:projectId/instances
/w/:workspaceId/p/:projectId/services
/w/:workspaceId/p/:projectId/transactions
/w/:workspaceId/p/:projectId/proofs
/w/:workspaceId/p/:projectId/settings
```

The current dashboard does not have this route model yet. Add routing and scoped state before building many project screens.

## Workspace vs Project Ownership

Use one canonical record model. Workspace pages aggregate records. Project pages filter the same canonical records. Do not duplicate separate global and project data stores.

| Area | Workspace owns | Project owns |
| --- | --- | --- |
| Membership | Invites, identities, org roles | Project member bindings and scoped roles |
| Policy | Defaults, minimum security, approvals | Stricter project rules, never weaker than workspace |
| Service catalog | Which services are available | Which services are enabled and configured |
| Instances | Aggregate list and governance | Exact project/environment ownership |
| Deployments | Cross-project deployment history | Project deployment history and controls |
| Agents | Registry, templates, org policy | Installed agents, tools, runs, project memory |
| Zer0 | Global policy, integrations, aggregate activity | Project privacy config, intents, proofs |
| Transactions | Canonical ledger and reporting | Filtered project transaction view |
| Payroll | Organization payroll and payout runs | Project allocation, cost center, filtered lines |
| Proofs | Canonical append-only proof archive | Project-filtered proofs and issue/download flows |
| Secrets | Workspace rules and providers | Project/environment secret references |
| Audit | Canonical append-only audit log | Project-filtered audit stream |
| Billing | Workspace billing | Project attribution and usage split |

## Project Lifecycle

Use lifecycle and health as separate concepts:

- Lifecycle: Draft, Active, Paused, Archived.
- Health: Setup required, Healthy, Attention, Error.
- Deployment status belongs to deployments or instances, not the project itself.

Avoid statuses like `failed` or `deploying` on the project row unless they describe a specific operation.

## Core Project User Flows

### First Project

1. User lands on workspace Projects.
2. Empty state offers `Create Project`, `Import Repository`, and `Browse Services`.
3. Non-admin users see permission guidance or `Request Project`.
4. No fake usage, deployments, or readiness metrics.

### Create Project

1. Enter name, slug, description, and purpose.
2. Choose blank project, template, or repository import.
3. Pick initial environment/network defaults.
4. Select optional starter services without provisioning them yet.
5. Assign project owner and initial access.
6. Review inherited workspace policies.
7. Create the project.
8. Land on Project Overview with a setup checklist.

The final action should be `Create Project`, not `Deploy Project`. Creation must not silently deploy infrastructure.

### Import Project

1. Connect Git provider with least-privilege or enter repository URL.
2. Select repository, branch, and root directory.
3. Run a read-only scan for framework, manifests, ZEXVRO config, service candidates, and secret-file paths.
4. Show duplicate, unsupported, and missing-config warnings.
5. Review detected mapping.
6. Import creates project metadata and source link only.
7. Do not push code, deploy, ingest secrets, or mutate the repo during import.

### Enter Project

1. Click project row/card from workspace Projects or any resource link.
2. Open project overview with project-scoped header.
3. Show setup checklist, source, environments, service instances, pending approvals, team, and recent activity.
4. Quick actions are scoped by role: Add Service, Invite Member, Ask Morph, Create Environment.

### Add Service To Project

1. Open project-scoped service catalog.
2. Inspect requirements and risks.
3. Click `Add to Project` to create a draft installation.
4. Configure instance name, environment, network, inputs, secret references, limits, and ownership.
5. Validate and simulate.
6. Show review diff and required approvals.
7. Provision only after approval.

Service instance states:

- Draft
- Needs configuration
- Validating
- Ready
- Active
- Error
- Disabled

### Team And Invites

1. Workspace admin invites a person to the workspace.
2. Project admin assigns an existing workspace member to a project.
3. Inviting an external person from project context creates one workspace identity plus one project binding.
4. Project roles can narrow access but cannot elevate beyond workspace permission.
5. Support pending, accepted, expired, revoked, resend, role change, and remove.
6. Agent identities should use a separate service-account flow, not human email invites.

### Agent Actions

1. Agent proposes a plan with target workspace, project, environment, resources, risk, and diff.
2. User reviews and approves.
3. Agent executes with short-lived project-scoped capability.
4. Activity log stores proposal, approval, execution, logs, result, and rollback data.
5. If the approved plan changes, approval is invalidated and must be requested again.

Agent states:

- Proposed
- Awaiting approval
- Approved
- Executing
- Succeeded
- Failed
- Cancelled
- Rolled back

### Archive Or Delete Project

1. Archive requires elevated permission and impact preview.
2. Archived project becomes read-only.
3. Scheduled agents and new operations are disabled.
4. External infrastructure is not silently destroyed.
5. Restore validates dependencies before reactivation.
6. Delete requires archive first, owner permission, recent auth, typed project slug, impact preview, and recovery window.
7. Never imply Git history or on-chain records can be deleted.

## Transactions, Payroll, Zer0, And Proof Manager

Recommended finance navigation:

- Finance Overview
- Transactions
- Zer0
- Payroll
- Proof Manager
- Organization

### Recipient Types

Web3 recipient:

- Uses wallet or Web3 identity.
- Can receive private or normal Web3 payments.
- Can download proofs and transaction confirmations.
- Can understand transaction hashes, asset IDs, and network details.

Standard recipient:

- Uses email or normal account flow.
- Sees a guided withdraw button.
- Gets simple payout status and proof downloads.
- Should not need to understand wallets, gas, accounts, or private keys.
- Future off-ramp provider must handle KYC, quote, asset, country, payout rail, and compliance requirements.

### Zer0

Proposed meaning: branded private-payment/privacy mode built on top of the Zero-Knowledge Privacy Pool.

Workspace Zer0 should manage:

- Privacy policy.
- Allowed assets/networks.
- Provider/integration status.
- Aggregate private activity.
- Approval requirements.

Project Zer0 should manage:

- Project privacy configuration.
- Private payment intents.
- Project-specific attestations and proofs.
- Project-filtered activity.

Open decision: confirm that `Zer0` is the accepted brand name for the private payment/privacy mode.

### Payroll

Workspace payroll should own:

- Organization payroll setup.
- Payee/recipient directory.
- Payroll runs.
- Approval policies.
- Payout methods.
- Export settings.
- Finance roles.

Project payroll should show:

- Project allocation.
- Project cost center.
- Project-filtered payroll lines.
- Related proofs and approvals.

Do not make project payroll a separate payroll system. It should be a filtered/allocation view of workspace payroll.

### Proof Manager

Proof Manager should store and manage append-only evidence records.

Proof types:

- Payment confirmations.
- Payroll statements.
- Withdrawal records.
- Accounting exports.
- Approval history.
- Supporting documents.
- Zer0 attestations.
- Legal/tax review packets.

Rules:

- Proof records are versioned.
- Corrections supersede older versions instead of mutating them.
- Sensitive documents are encrypted off-chain.
- Do not store private keys, raw ZK witness data, or fabricated settlement/proof states.
- Proof artifacts may support accounting, tax, or legal review.
- Do not claim the platform provides legal certification, tax compliance, or filed tax returns.

Proof Manager actions:

- Issue proof.
- Send proof.
- Download proof.
- Request correction.
- Supersede proof.
- Attach supporting document.
- Export packet.
- View audit trail.

## Roles

Baseline roles:

- Owner: full control, ownership transfer, policies, archive, and delete. Final owner cannot be removed.
- Admin: project creation/import, team management below Owner, settings, services, and allowed approvals. No delete or ownership transfer.
- Developer: edit drafts, configure services, run checks, deploy where policy permits. No member or approval-policy management.
- Finance: transactions, payroll, proofs, payout approvals, and exports as configured.
- Viewer: read-only with secrets and sensitive identity data redacted.
- Agent: explicitly scoped, proposal-first, no invites, secrets, approvals, ownership, deletion, or self-approval.

Finance roles should be separate from project developer roles. A project developer should not automatically get payroll or payout permissions.

## Data Model Concepts

Future data contracts should support these concepts:

- `userId`
- `workspaceId`
- `projectId`
- `environmentId`
- `serviceId`
- `serviceInstallationId`
- `serviceInstanceId`
- `transactionId`
- `payrollRunId`
- `payoutId`
- `proofId`
- `agentRunId`
- `approvalId`
- `auditEventId`

Project-owned records should include `workspaceId` and `projectId`.

Environment-owned records should include `workspaceId`, `projectId`, and `environmentId`.

Server-side authorization must enforce scope. Client-side filtering is not enough.

## Current Frontend Gaps To Fix Before Screens

- Dashboard navigation is local state, not real routing.
- Project rows do not open project dashboards.
- Project data is local and not persisted.
- Workspace switching mostly changes labels, not scoped records.
- Services are catalog items, not project service instances.
- Deployments use project names, not stable project IDs.
- The project creation modal mixes project creation with deployment language.
- The overview can open New Project state while the modal may not be mounted.
- Team and invite flows are disconnected.
- Settings, Morph, Services, Team, and Memory are global, not project-aware.
- Finance, payroll, Zer0, and proof screens are planned but not implemented.

Recommended implementation order:

1. Add URL-backed workspace/project routing.
2. Add canonical project model and selected project context.
3. Build Projects index, create project flow, project switcher, and project overview.
4. Split service catalog from service installations and instances.
5. Add environment-scoped instances/deployments/logs.
6. Split workspace agents/memory from project agents/memory.
7. Add Transactions & Payroll as planned screens with honest empty states.
8. Add Zer0 and Proof Manager flows after data model approval.
9. Add team/invite unification, secrets, policy, audit, archive, and permissions.
10. Add real backend integration after UI contracts are stable.

## Screen Backlog

Workspace screens:

- Workspace Overview
- Projects Index
- Create Project
- Import Project
- All Instances
- All Deployments
- Activity
- Service Catalog
- Finance Overview
- Transactions
- Zer0
- Payroll
- Proof Manager
- Team & Access
- Approval Policies
- Security & Audit
- Usage & Billing
- Workspace Settings

Project screens:

- Project Overview
- Project Environments
- Project Instances
- Project Deployments
- Project Logs
- Project Services
- Add Service
- Service Instance Detail
- Project Agents
- Project Memory
- Project Transactions
- Project Zer0
- Project Proofs
- Project Members
- Project API Keys & Secrets
- Project Audit
- Project Settings
- Project Archive/Delete dialogs

## UI Notes

- Keep the dashboard utilitarian and information-dense.
- Use dark-first neutral surfaces from `design.md`.
- Avoid crypto-hype language.
- Avoid giant marketing hero treatment inside the logged-in app.
- Use compact tables, filters, tabs, segmented controls, badges, dialogs, and command menus.
- Use explicit empty states instead of fake metrics.
- Show `Planned`, `Integration required`, or `Setup required` when features are not connected.
- Always display workspace, project, environment, and network in risky confirmation dialogs.

## Resolved Decisions (2026-07-10)

- Decision: Accepted - Use TanStack Router for URL-backed navigation.
- Decision: Accepted - Project creation uses a multi-step wizard.
- Decision: Accepted - Use Zustand for workspace/project state management.
- Decision: Accepted - Route convention is `/w/:workspaceId/p/:projectId/...`.

## Open Decisions

- Confirm whether `Zer0` is the accepted brand name.
- Decide first supported payment rails and assets.
- Decide which Stellar SEP path is realistic after selecting off-ramp providers.
- Decide exact proof record schema and retention policy.
- Decide finance roles and approval thresholds.
- Decide first backend API boundaries for workspace, project, team, service instance, transaction, payroll, and proof records.

## Implementation Plan (Accepted 2026-07-10)

### Phase 1 — Routing & Model Foundation

This phase blocks all other dashboard work. No new screens should be built until this is complete.

Step 1: Add TanStack Router
- Install `@tanstack/react-router` and `@tanstack/router-devtools` in `frontend/`.
- Create a root route layout that wraps the dashboard shell.
- Replace the `useState('activeTab')` navigation in `DashboardApp.tsx` with router-based navigation.
- Preserve all existing screens as routes under the dashboard layout.
- Keep the `/` marketing page and `/dashboard` entry intact during migration.

Step 2: Add Zustand workspace/project stores
- Create `frontend/src/stores/workspace.ts` with:
  - `workspaces: Workspace[]`
  - `currentWorkspaceId: string | null`
  - `createWorkspace`, `selectWorkspace`, `deleteWorkspace` actions.
- Create `frontend/src/stores/project.ts` with:
  - `projects: Project[]`
  - `currentProjectId: string | null`
  - `createProject`, `selectProject`, `archiveProject`, `deleteProject` actions.
- Create `frontend/src/stores/types.ts` with canonical workspace, project, environment, and service instance types.
- Migrate existing `mockProjects` and local workspace state into the Zustand stores.

Step 3: Add workspace-scoped routes
```text
/w/:workspaceId/overview
/w/:workspaceId/projects
/w/:workspaceId/instances
/w/:workspaceId/deployments
/w/:workspaceId/activity
/w/:workspaceId/services
/w/:workspaceId/team
/w/:workspaceId/security
/w/:workspaceId/analytics
/w/:workspaceId/settings
```

Step 4: Add workspace switcher
- Top bar workspace selector dropdown.
- Switching workspace updates URL and store.
- Workspace-scoped routes use the `workspaceId` param to load the correct data.

Step 5: Add project-scoped routes
```text
/w/:workspaceId/p/:projectId/overview
/w/:workspaceId/p/:projectId/environments
/w/:workspaceId/p/:projectId/instances
/w/:workspaceId/p/:projectId/deployments
/w/:workspaceId/p/:projectId/logs
/w/:workspaceId/p/:projectId/services
/w/:workspaceId/p/:projectId/agents
/w/:workspaceId/p/:projectId/memory
/w/:workspaceId/p/:projectId/transactions
/w/:workspaceId/p/:projectId/proofs
/w/:workspaceId/p/:projectId/members
/w/:workspaceId/p/:projectId/secrets
/w/:workspaceId/p/:projectId/audit
/w/:workspaceId/p/:projectId/settings
```

Step 6: Build project top shell
- Breadcrumb: `Workspace / Project Name`.
- Back to Workspace button with filter preservation.
- Environment selector.
- Project switcher.
- Unsaved changes warning on navigation away.

### Phase 2 — Project Dashboard

Step 7: Build project overview
- Setup checklist (source connected, environment created, service added, team invited).
- Quick actions: Add Service, Invite Member, Ask Morph, Create Environment.
- Recent activity scoped to project.

Step 8: Build create project wizard
- Step 1: Name, slug, description, purpose.
- Step 2: Blank, template, or import.
- Step 3: Initial environment defaults.
- Step 4: Optional starter services (no provisioning).
- Step 5: Owner and initial access.
- Step 6: Review inherited workspace policies.
- Step 7: Create → land on project overview.

Step 9: Split service catalog from instances
- Workspace service catalog shows available services.
- Project "Add Service" shows catalog with "Add to Project" action.
- Service instances are project+environment scoped.
- Instance states: Draft, Needs config, Validating, Ready, Active, Error, Disabled.

Step 10: Add environment selector and scoped views
- Project environments list.
- Environment-scoped instances, deployments, and logs.
- Environment selector in project top shell.

### Phase 3 — Deferred: Finance, Zer0, Proof Manager

Finance screens are deferred until the data model is approved. When ready:
- Design canonical record schemas for transactions, payroll runs, payouts, and proofs.
- Build workspace finance overview with empty states.
- Build transactions list with project filter.
- Build Zer0 privacy mode (pending branding confirmation).
- Build payroll setup, payee directory, and run flows.
- Build proof manager: issue, send, download, version, export.

### Phase 4 — Team, Access & Policy

Step 11: Unify team/invite flows
- Workspace invites create workspace identity.
- Project member bindings assign existing workspace members.
- Inviting from project context creates workspace identity + project binding.
- Support pending, accepted, expired, revoked, resend, role change, remove.

Step 12: Add role model
- Owner, Admin, Developer, Finance, Viewer, Agent.
- Finance roles separate from developer roles.
- Project roles narrow but never elevate beyond workspace.

Step 13: Add approval policies and agent action review
- Agent proposes plan with diff and risk.
- User reviews and approves.
- Agent executes with short-lived capability.
- Activity log stores proposal, approval, execution, result, rollback.

### Phase 5 — Backend Readiness

Step 14: Define API boundaries
- Workspace CRUD.
- Project CRUD with workspace scoping.
- Team/invite API.
- Service instance API with environment scoping.
- Transaction, payroll, and proof APIs (after Phase 3 design).
- Agent action proposal and approval API.

Step 15: Replace mock state with API-backed state
- Add API client layer.
- Replace Zustand store initial state with API calls.
- Add loading, error, and retry states.

## Do Not Do Yet

- Do not build full finance/payroll/proof screens before approval.
- Do not implement De-pin until scope is documented.
- Do not claim live payroll, off-ramp, tax, legal, privacy, ZK, or blockchain settlement behavior.
- Do not let project views duplicate canonical workspace finance/proof records.
- Do not allow agents to approve their own actions.
- Do not expose secrets to UI, logs, import scans, or agent context.
- Do not describe proof packets as legal certification or filed tax records.
