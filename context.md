# ZEXVRO Context

This file is the source of truth for product context. It is written for humans and coding agents.

Use this file to understand what ZEXVRO is, what the MVP contains, who owns each area, and what assumptions are already known. Do not use this file as a dumping ground for logs, copied chats, temporary notes, or unclear ideas. Put work updates in `memory.md`.

## Agent Boot Sequence

Every agent must start here:

1. Read `README.md` for the public project summary.
2. Read this file for product context and service boundaries.
3. Read `memory.md` for current work state, handoffs, blockers, and decisions.
4. Read `design.md` before changing UI, theme, typography, layout, charts, motion, or brand usage.
5. Run `git status --short` before editing.
6. Identify the service or shared area being touched.
7. Make the smallest useful change.
8. Update `memory.md` with what changed and what remains.
9. Commit code and memory updates together.

## Platform Identity

| Field | Value |
| --- | --- |
| Platform name | ZEXVRO |
| Repository | `https://github.com/polymaths-org/zexvro.git` |
| Category | Unified Web3 PaaS |
| Product style | Clean, simple, professional, understandable |
| UI references | Vercel and Cloudflare |
| MVP priority | Six unique Web3 services first |
| Secondary priority | DB, deploy, hosting, security, connectors, and standard PaaS features if time allows |

Brand assets:

- `assets/brand/logo.png`
- `assets/brand/logo2.png`
- `assets/brand/typo-logo.png`
- `assets/brand/brand-design.png`

## One Sentence

ZEXVRO is a unified Web3 PaaS that helps teams move from Web2 to Web3 infrastructure through private, verifiable, agent-ready services.

## Product Purpose

ZEXVRO should make advanced Web3 infrastructure usable by teams that do not want to manage raw blockchain complexity.

The platform should:

- Provide a unified dashboard and developer workflow.
- Prefer clear product flows over blockchain jargon.
- Expose powerful Web3 capabilities through simple APIs, SDKs, UI flows, and agent actions.
- Support enterprise-grade privacy, identity, authentication, deployment, and commerce workflows.
- Make agents first-class users of the platform, not an afterthought.

The platform should not:

- Become a generic crypto dashboard.
- Prioritize speculative token features over real developer workflows.
- Add common PaaS features before the MVP services need them.
- Hide unclear ownership or decisions inside random notes.

## Current Repo State

The repository currently contains:

- Project documentation.
- Brand assets.
- Shared memory workflow.
- `frontend/`, the Vite + React frontend workspace.

The frontend application is scaffolded in `frontend/`. Run frontend commands from that folder.

Current and expected stack:

- Frontend: Vite and React.
- Web3/backend preference: Stellar Network where technically appropriate.
- Cloud infrastructure: AWS.
- Agent workflow: shared context between web agent, CLI agent, and developer agents.

Frontend workspace notes:

- Path: `frontend/`.
- Run locally: `cd frontend && npm run dev`.
- Validate before handoff: `cd frontend && npm run lint && npm run build`.
- The UI is still prototype/frontend-only. Do not claim live backend, auth, wallet, blockchain, deployment provider, or secrets-manager integrations until those are implemented.

## Team Ownership

There are three developers. Each developer owns two MVP services.

| Developer | Alias | Owns |
| --- | --- | --- |
| Paris | `paris-29` | Zero-Knowledge Privacy Pool, Transformation Agent |
| Rushi | `Wraient` | A-2-A Trade Pipeline, Captcha-like Agent Authentication Service |
| Nabil | `n4bi10p` | NFT Service, De-pin |

Ownership means:

- The owner decides service direction.
- Other developers can propose changes, but should not reshape the service without coordination.
- Shared contracts must be documented in `memory.md`.
- Cross-service changes require a memory entry explaining impact and follow-ups.

## Service Map

### 1. Zero-Knowledge Privacy Pool

Owner: Paris / `paris-29`

Problem:

- Companies may want Web3 benefits but cannot expose sensitive transaction details publicly.

MVP intent:

- Provide transaction privacy for business use cases.
- Use zero-knowledge techniques where they fit.
- Make on-chain or Web3-backed activity acceptable for privacy-sensitive teams.

Agent boundaries:

- Do not choose a final proving system, circuit design, smart contract model, or privacy architecture without a recorded decision.
- If researching implementation, record options and tradeoffs in `memory.md`.
- Any Stellar-specific privacy approach must explain why Stellar is suitable for that part.

Unknowns:

- Exact privacy model.
- Compliance requirements.
- Which data must be hidden versus verifiable.
- Whether this is a protocol, API, dashboard feature, or all three.

### 2. Transformation Agent

Owner: Paris / `paris-29`

Problem:

- Teams need help migrating Web2 code, deployments, and workflows into Web3-ready infrastructure.

MVP intent:

- Provide a platform agent that can inspect repositories, explain migration work, and help deploy through the CLI and web UI.
- Share useful account memory between web agent and CLI agent.
- Make ZEXVRO itself agent-first so future agents know where to look, what changed, and what is safe to edit.

Inspiration:

- Workspace-level assistant placement like Gemini in Google Workspace.
- Platform intelligence direction similar to Snowflake Cortex-style assistants.

Agent boundaries:

- Do not invent the final product name yet.
- Do not add broad autonomous actions without permission and audit trail design.
- All agent memory behavior must separate durable user memory, temporary task context, secrets, and logs.
- Repository inspection must avoid leaking private code across accounts.

Unknowns:

- Agent runtime.
- Memory storage model.
- CLI architecture.
- Auth model between web agent and CLI agent.
- Repository ingestion strategy.

### 3. A-2-A Trade Pipeline

Owner: Rushi / `Wraient`

Problem:

- Agents need a trusted way to approach other agents, negotiate, and complete trades.

MVP intent:

- Provide an agent-to-agent trade pipeline.
- Let agents represent offers, counteroffers, wallet intent, and settlement state.
- Support negotiation between agents with clear identity and transaction boundaries.

Agent boundaries:

- Do not implement wallet custody assumptions without an explicit decision.
- Do not let agents spend funds without user-controlled authorization rules.
- Record any message protocol, offer schema, settlement flow, or wallet interface in `memory.md`.

Unknowns:

- Negotiation protocol.
- Wallet model.
- Agent identity standard.
- Settlement mechanism.
- Dispute or cancellation flow.

### 4. Captcha-Like Agent Authentication Service

Owner: Rushi / `Wraient`

Problem:

- Platforms need to distinguish humans from agents and control how each can access product flows.

MVP intent:

- Build an auth service that classifies humans and agents.
- Provide SDK/API access for external platforms.
- Use Web3 and Stellar technology where useful.
- Support high-accuracy labeling of internet users as human or agent.

Related concept: HDM, Human Data Marketplace.

HDM intent:

- A verified human can choose to sell data to AI training companies.
- AI companies get human-origin data instead of AI-content-polluted data.
- Users can earn from their data.

Agent boundaries:

- Do not claim perfect detection.
- Do not store biometric, behavioral, or personal data without a privacy model.
- Do not design HDM data sale flows without consent, auditability, and deletion requirements.
- Any classification model must describe input signals, confidence score, appeal flow, and false-positive handling.

Unknowns:

- Classification signals.
- Web3 identity method.
- Stellar role.
- SDK shape.
- Data marketplace consent and payment model.

### 5. NFT Service

Owner: Nabil / `n4bi10p`

Problem:

- Non-Web3 users such as indie game developers and small studios need NFT functionality without learning complex Web3 tooling.

MVP intent:

- Let users deploy NFTs in a few guided steps.
- Provide simple NFT management.
- Support checkout or purchase flows from the platform.
- Hide wallet, metadata, and chain complexity behind clear UI and APIs.

Agent boundaries:

- Do not assume a final NFT standard, storage provider, marketplace model, or checkout provider without a recorded decision.
- Keep the user experience non-Web3 friendly.
- Any metadata, royalty, minting, or ownership assumptions must be documented.

Unknowns:

- Target chain or Stellar asset model.
- Metadata storage.
- Payment and checkout flow.
- Minting permissions.
- Game/studio workflow requirements.

### 6. De-pin

Owner: Nabil / `n4bi10p`

Status:

- Scope not defined yet.
- Needs brainstorming and written context from Nabil.

Rules:

- Do not invent final De-pin scope.
- Do not build De-pin code before scope is recorded.
- When Nabil provides the idea, update this section and add a memory entry.

## Shared Platform Areas

These are not primary MVP services yet, but they will likely become shared modules.

| Area | Current status | Agent rule |
| --- | --- | --- |
| Auth | Not designed | Do not create permanent auth architecture without documenting the flow |
| Accounts/workspaces | Not designed | Keep future multi-user needs in mind |
| Billing | Not designed | Do not add payment logic until product scope requires it |
| Deployment | Not designed | Prefer service-driven needs over generic deploy features |
| Database | Not designed | Choose storage after data models are clearer |
| Connectors | Not designed | Add only when a service needs one |
| Security | Required but not designed | Never commit secrets; document trust boundaries |
| Agent memory | Important but not designed | Separate user memory, project memory, task memory, logs, and secrets |

## Product Design Rules

- Use a calm, professional interface.
- Avoid crypto-native clutter.
- Use readable labels and predictable navigation.
- Design like a developer platform, not a marketing-only website.
- Keep first screens actionable.
- Make service status, setup state, errors, and next actions clear.
- Prefer precise product copy over hype.

## Agent Context Rules

Agents should collect only the context needed for the current task.

Allowed context:

- Relevant files.
- Current service ownership.
- Recent memory entries.
- Shared contracts touched by the task.
- Commands needed to verify the change.

Avoid:

- Dumping full command logs into docs.
- Copying long chat transcripts into repo files.
- Mixing brainstorm notes with decisions.
- Editing unrelated service areas.
- Turning `context.md` into a scratchpad.

Use the right file:

- `README.md`: public-facing project overview.
- `context.md`: stable product and architecture context.
- `memory.md`: chronological work state, decisions, blockers, handoffs.
- `design.md`: visual system, themes, typography, brand usage, UI behavior, and motion rules.
- Future service READMEs: service-local setup, API, architecture, and ownership.

## Decision Levels

Use these labels in `memory.md` when needed:

- `Draft`: idea is being explored.
- `Proposed`: a specific direction is suggested but not final.
- `Accepted`: team should follow this until changed.
- `Blocked`: work cannot proceed without a decision or input.
- `Deprecated`: old direction should not be used.

## Future Directory Direction

When code is scaffolded, prefer a structure that helps agents navigate quickly. This is a direction, not a final decision.

```text
apps/
  web/                 # Vite + React platform UI
  cli/                 # Future CLI agent or developer CLI
services/
  privacy-pool/
  transformation-agent/
  a2a-trade-pipeline/
  agent-auth/
  nft-service/
  depin/
packages/
  shared/
  ui/
  config/
docs/
  architecture/
  decisions/
```

Each service should eventually have a local README with:

- Owner.
- Purpose.
- Current status.
- Setup commands.
- API/contracts.
- Data model.
- Known blockers.
- Agent-safe edit notes.

## Setup Instructions

Initial setup:

```bash
git clone https://github.com/polymaths-org/zexvro.git
cd zexvro
cat context.md
cat memory.md
```

Current verification:

- There are no app tests yet because no application has been scaffolded.
- Documentation changes should be reviewed by reading the rendered Markdown.

Future setup instructions should be added when the app is scaffolded:

- Install command.
- Dev command.
- Build command.
- Test command.
- Required environment variables, without secrets.
- Local service dependencies.
