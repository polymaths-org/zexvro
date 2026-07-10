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
- `services/transformation-agent/` (Morph CLI skeleton) — first service scaffolded.
- `services/nft-service/`, containing the Soroban NFT collection contract and its TypeScript API.
- `services/depin/`, containing the TypeScript/Express x402 reverse proxy.

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
- NFT collection creation in the UI is still a browser-local prototype and is not wired to the NFT API.
- Cognito/session and Morph polling behavior predate Nabil's services and must be preserved when changing the shell.
- Do not claim live wallet, contract deployment, Pinata upload, payment, or De-pin provider integrations until credentials are configured and an end-to-end testnet run is recorded.

## Team Ownership

There are three developers. Each developer owns two MVP services.

| Developer | Alias | Owns |
| --- | --- | --- |
| Paris | `paris-29` | Zero-Knowledge Privacy Pool, Transformation Agent (Morph) |
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

### 2. Transformation Agent — Morph

Owner: Paris / `paris-29`
Product name: **Morph**
Status: CLI fully implemented & packaged

Problem:

- Teams need help migrating Web2 code, deployments, and workflows into Web3-ready infrastructure.

MVP intent:

- Provide a platform agent that can inspect repositories, explain migration work, and help deploy through the CLI and web UI.
- Share useful account memory between web agent and CLI agent.
- Make ZEXVRO itself agent-first so future agents know where to look, what changed, and what is safe to edit.

Inspiration:

- Workspace-level assistant placement like Gemini in Google Workspace.
- Platform intelligence direction similar to Snowflake Cortex-style assistants.
- OpenAI Codex CLI for agent UX patterns.

Agent boundaries:

- Do not add broad autonomous actions without permission and audit trail design.
- All agent memory behavior must separate durable user memory, temporary task context, secrets, and logs.
- Repository inspection must avoid leaking private code across accounts.

Current implementation:

- CLI built with Python + Typer.
- SQLite-backed persistent memory (per-user key-value + session store).
- Tool registry: read/write files, run commands, analyze codebase.
- Agent loop with intent routing.
- Ready to wire to OpenAI API.
- Path: `services/transformation-agent/cli/`

Unknowns:

- Auth model between web agent and CLI agent.
- Repository ingestion strategy.
- Web panel design.

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

Architecture decisions:

- Chain: Stellar Network with Soroban smart contracts. No multi-chain in v1.
- NFT contract: one Soroban contract per collection using OpenZeppelin Stellar's `NonFungibleToken` Base implementation. There is no on-chain factory in v1.
- Collection configuration: studio owner, name, symbol, immutable base metadata URI, royalty recipient, and royalty basis points capped at 10%.
- Minting: creator-controlled through the studio owner or an explicitly delegated minter role.
- Metadata: immutable collection identity and media use Pinata-backed public IPFS. A versioned ZEXVRO `external_url` may point to clearly mutable gameplay attributes.
- Royalties: expose marketplace-compatible royalty information, but never claim arbitrary transfers enforce payment.
- Primary checkout: fixed-price SEP-41 USDC transfer and NFT mint happen atomically in the collection contract. The buyer signs Soroban authorization entries while a ZEXVRO sponsor signs and pays the transaction envelope fee.
- Secondary sales, auctions, fiat checkout, and multi-chain support are outside v1.

Agent boundaries:

- Do not change the chain decision (Stellar + Soroban) without team coordination.
- Keep the user experience non-Web3 friendly.
- Any metadata schema, royalty logic, minting permission, or storage provider must be documented before implementation.
- Do not build multi-chain support in v1.

Remaining integration work:

- Connect the browser-local collection wizard to authenticated API calls.
- Choose production persistence and authorization for workspace-scoped API records.
- Configure Pinata and Stellar testnet sponsor credentials, install the verified WASM, and record a live testnet deployment.
- Define the studio wallet signing UX for creator mint and buyer checkout intents.
- Finalize game/studio onboarding details and operational status reconciliation.

### 6. De-pin (x402 Agentic Resource Gateway)

Owner: Nabil / `n4bi10p`

Problem:

- Physical hardware networks and API compute nodes cannot easily conduct commerce with autonomous AI agents because traditional Web2 billing platforms require human identity verification and credit cards.

MVP intent:

- Provide a lightweight proxy layer sitting in front of idempotent HTTP APIs and compute resources.
- Intercept agent requests and issue an HTTP 402 "Payment Required" challenge.
- Verify signed Soroban authorization entries and settle an exact USDC payment per successful request.

Architecture decisions:

- Protocol: official x402 v2 flow and payloads, using `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`; do not introduce a parallel 402 schema.
- Payment rail: `exact` scheme with SEP-41 USDC on `stellar:testnet` in v1, using the official `@x402/stellar` implementation and facilitator-sponsored fees.
- Proxy order: verify payment, fulfill and buffer a successful upstream result, settle, then release the result. Upstream or settlement failures withhold the resource.
- Provider model: validated local configuration for concrete `GET`/`HEAD` routes, upstream URL, description, price, recipient, network, timeout, and optional environment-secret reference.
- Abuse controls: request IDs, authorization replay protection, unpaid-request rate limits, bounded response buffering, structured redacted audit logs, and upstream timeouts.
- Streaming payments, time-based sessions, custom facilitators, provider marketplace UI, and physical-device adapters are deferred.

Agent boundaries:

- Do not implement payment flows without documenting the 402 challenge/response contract.
- Do not handle custody of user funds without explicit authorization design.
- Do not build the proxy without defining the resource provider registration model.
- Keep the gateway lightweight and composable.

Remaining integration work:

- Configure a real provider, recipient, and facilitator for an end-to-end Stellar testnet payment.
- Replace the in-memory replay/rate-limit stores before running multiple gateway instances.
- Define provider onboarding UI and persistent provider configuration ownership.
- Add an agent client SDK only after the standard x402 client path is exercised.

## Shared Platform Areas

These are not primary MVP services yet, but they will likely become shared modules.

| Area | Current status | Agent rule |
| --- | --- | --- |
| Auth | Cognito frontend flow exists; shared architecture is not finalized | Preserve the current flow and document cross-service changes |
| Accounts/workspaces | Browser-local prototype | Keep future multi-user and server authorization needs in mind |
| Billing | Service-specific prototypes | Keep NFT checkout and De-pin payments inside their documented trust boundaries |
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
  cli/                 # Future standalone CLI (Morph currently in services/)
services/
  privacy-pool/
  transformation-agent/   # Morph lives here
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

Current verification entry points:

- Frontend: `cd frontend && npm run lint && npm test && npm run build && npm run test:e2e`.
- NFT contract: commands in `services/nft-service/README.md`.
- NFT API: `cd services/nft-service/api && npm run lint && npm test && npm run build`.
- De-pin: `cd services/depin && npm run lint && npm test && npm run build`.
- Required environment variables are documented only in service `.env.example` files; never commit their values.
