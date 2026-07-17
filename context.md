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

## Stellar Integration Credential Request

Ask Nabil / Nambil for the Stellar integration details needed on ZEXVRO's side. Do not commit secrets into the repo; share secrets through AWS Secrets Manager or another agreed secure channel.

Required for backend integration:

- Target network for each environment: Testnet, Futurenet, or Public.
- Horizon endpoint and Soroban RPC endpoint, including any private RPC authentication.
- Contract IDs for the Zer0 privacy pool, payroll proof verifier, or related Soroban contracts once they exist.
- Asset configuration for supported settlement assets such as USDC, XLM, and EURC, including issuer public keys where applicable.
- Source account public keys, signer policy, multisig thresholds, and whether ZEXVRO is expected to submit transactions or only prepare unsigned payloads.
- Webhook/signature secrets for transaction callbacks, proof callbacks, or custody provider callbacks.
- Funded test accounts or sandbox credentials for integration testing.
- Final custody model: ZEXVRO-held signing via secure backend, user wallet signing, or a hybrid approval flow.

If ZEXVRO does not hold signing credentials, the frontend must connect the user's wallet and the user must provide the wallet address/public key. In that model, store only public wallet addresses and non-secret connection metadata in DynamoDB; never ask users to paste secret seeds into the app.

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
- Preferred local stack: from the repository root, `cp .env.example .env` then `npm run dev` (NFT API + frontend) or `npm run dev:all` (also De-pin).
- Run frontend only: `cd frontend && npm run dev` or root `npm run dev:frontend`.
- Legacy combined launcher from the frontend folder: `cd frontend && npm run dev:stack`.
- Validate before handoff: `cd frontend && npm run lint && npm run build`, or root `npm run lint:frontend` / `npm run build:frontend`.
- NFT collection creation is wired to the Cognito-protected NFT API for local Stellar testnet runs; browser-local drafts remain only for migration and fallback visibility.
- The project De-pin screen reads the local gateway health/status manifest and can probe an unpaid x402 `402` challenge through the Vite proxy.
- Cognito/session and Morph polling behavior predate Nabil's services and must be preserved when changing the shell.
- Code paths exist for S3 media, DynamoDB NFT records, managed sponsor secret gates, and multi-instance De-pin file state. Do not claim a live production deployment until AWS roles/buckets/tables/secrets are configured and a managed end-to-end run is recorded in `memory.md`.

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

### 1. Zero-Knowledge Privacy Pool (Zer0)

Owner: Paris / `paris-29`  
Status: **Complete (product UI)** — 2026-07-17

Problem:

- Companies may want Web3 benefits but cannot expose sensitive transaction details publicly.

MVP intent:

- Provide transaction privacy for business use cases.
- Use zero-knowledge techniques where they fit.
- Make on-chain or Web3-backed activity acceptable for privacy-sensitive teams.

Shipped product surface:

- Zer0 multi-screen suite: dashboard, people, pay party, history, proofs, stealth, settings.
- Client settings are Web3-facing (wallet, network, privacy, signing) — no AWS region/Cognito/EC2 controls in the UI.
- Payment processing modal uses brand loader + settle cinema.

Agent boundaries:

- Do not choose a final proving system, circuit design, smart contract model, or privacy architecture without a recorded decision.
- If researching implementation, record options and tradeoffs in `memory.md`.
- Any Stellar-specific privacy approach must explain why Stellar is suitable for that part.

Remaining (ops / protocol, not “incomplete product UI”):

- Hosted prover capacity and treasury ops keys remain platform-managed.
- Compliance view-keys and mainnet policy remain product follow-ups.

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

Owner: Nabil / `n4bi10p` (API/chain) + Paris (dashboard/product UX)  
Status: **Complete (product UI)** — 2026-07-17

Problem:

- Non-Web3 users such as indie game developers and small studios need NFT functionality without learning complex Web3 tooling.

MVP intent:

- Let users deploy NFTs in a few guided steps.
- Provide simple NFT management.
- Support checkout or purchase flows from the platform.
- Hide wallet, metadata, and chain complexity behind clear UI and APIs.

Shipped product surface:

- Create wizard with mission-brief cinema through Freighter, NFT Launch finale, success modal (dashboard / manage / delete).
- Collection studio: overview (graphs + full dashboard/public URLs), sale, mint, ledger analytics, integrate SDK, delete/archive.
- Public collection + embed checkout; nftApi defaults to hosted App Runner when env empty.
- Docs: `/docs` → Services → NFT Collections.

Architecture decisions:

- Chain: Stellar Network with Soroban smart contracts. No multi-chain in v1.
- NFT contract: one Soroban contract per collection using OpenZeppelin Stellar's `NonFungibleToken` Base implementation. There is no on-chain factory in v1.
- Collection configuration: studio owner, name, symbol, immutable base metadata URI, royalty recipient, and royalty basis points capped at 10%.
- Minting: creator-controlled through the studio owner or an explicitly delegated minter role.
- Metadata / media (production): AWS **S3** for object storage + **CloudFront** (or public HTTPS base URL) for delivery. Local content-addressed HTTP storage is development-only and is not IPFS.
- Metadata / media (optional legacy): Pinata public IPFS remains supported only when explicitly required (`NFT_STORAGE_MODE=pinata`); default production path is AWS.
- API records (production): AWS **DynamoDB** for collections, inventory, checkout intents (pluggable repository; local JSON file for single-process dev).
- Secrets: AWS **Secrets Manager** (or IAM role env injection) for `STELLAR_SPONSOR_SECRET` and similar; never commit secrets.
- A versioned ZEXVRO `external_url` may point to clearly mutable gameplay attributes.
- Royalties: expose marketplace-compatible royalty information, but never claim arbitrary transfers enforce payment.
- Primary checkout: fixed-price SEP-41 USDC transfer and NFT mint happen atomically in the collection contract. The buyer signs Soroban authorization entries while a ZEXVRO sponsor signs and pays the transaction envelope fee.
- Token IDs: always auto-allocated server-side when omitted (mint + checkout); UI does not require manual token ID entry.
- Game / indie integration: public REST checkout, hosted embed popup (`/nft/embed/checkout`), and copy-ready SDK snippets in the NFT Studio **Integrate SDK** panel (`packages/nft-checkout-sdk`).
- Secondary sales, auctions, fiat checkout, and multi-chain support are outside v1.

Agent boundaries:

- Do not change the chain decision (Stellar + Soroban) without team coordination.
- Prefer AWS for storage/persistence/secrets; do not add new third-party storage without documenting why AWS is insufficient.
- Keep the user experience non-Web3 friendly.
- Any metadata schema, royalty logic, minting permission, or storage provider must be documented before implementation.
- Do not build multi-chain support in v1.

Remaining integration work (ops, not product-UI incomplete):

- Periodic Cognito + Freighter mint/sale/buy smoke still useful after deploys.
- Least-privilege IAM / custom domain for hosted NFT API remain ops.
- Partner game origins must be listed in `CORS_ALLOWED_ORIGINS`.
- New collection deploys use WASM hash with instance TTL bumps; older collections keep prior WASM until redeployed.

### 6. De-pin (x402 Agentic Resource Gateway) + Access Shield direction

Owner: Nabil / `n4bi10p`  
Status: **In progress** — product testing planned next (do not treat as complete)

Problem (shipping MVP):

- Physical hardware networks and API compute nodes cannot easily conduct commerce with autonomous AI agents because traditional Web2 billing platforms require human identity verification and credit cards.

Problem (strategic / big-tech USP — **Proposed** product framing):

- Large AI and data platforms (Grok/xAI-class, OpenAI-class, internal LLM APIs) lose unbounded COGS when free tiers and weak Web2 gates (email, phone, CAPTCHA, flat API keys) are industrialized: account farms, residential proxies, multi-account rotation, and agent tool-loops resell or burn free capacity.
- ZEXVRO’s Web2→Web3 migration pitch for those buyers is **economic access control**: make free-capacity resale and agent spam unprofitable without rewriting their model stack.

MVP intent (implemented gateway):

- Provide a lightweight proxy layer sitting in front of idempotent HTTP APIs and compute resources.
- Intercept agent requests and issue an HTTP 402 "Payment Required" challenge.
- Verify signed Soroban authorization entries and settle an exact USDC payment per successful request.
- Fail closed: unpaid traffic never receives the upstream body; settlement failures withhold the resource.

Strategic intent (**Proposed** — document for teammates; not fully productized UI):

- Position De-pin as the enforcement plane of **ZEXVRO Access Shield**: an edge economic firewall big platforms put in front of expensive APIs.
- Combine with (future) Agent Auth classification (Rushi), policy/rate cards, and settlement receipts—not as a WAF clone and not as offensive anti-farm tooling.
- Full product one-pager: `docs/access_shield.md`.

Architecture decisions:

- Protocol: official x402 v2 flow and payloads, using `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE`; do not introduce a parallel 402 schema.
- Payment rail: `exact` scheme with SEP-41 USDC on `stellar:testnet` in v1, using the official `@x402/stellar` implementation and facilitator-sponsored fees.
- Proxy order: verify payment, fulfill and buffer a successful upstream result, settle, then release the result. Upstream or settlement failures withhold the resource.
- Provider model: validated local configuration for concrete `GET`/`HEAD` routes, upstream URL, description, price, recipient, network, timeout, and optional environment-secret reference.
- Recipient (`payTo`) is always a classic Stellar **G…** account (needs USDC trustline). Do not put the USDC SAC **C…** address in `recipient`.
- Facilitator: local unpaid 402 probes may use public facilitators (e.g. `https://x402.org/facilitator`). Real Stellar settle via OpenZeppelin Channels should use Channels facilitator URLs and process env `OZ_API_KEY` (or `X402_FACILITATOR_API_KEY`) as Bearer auth.
- Abuse controls: request IDs, authorization replay protection, unpaid-request rate limits, bounded response buffering, structured redacted audit logs, and upstream timeouts.
- Multi-instance: `DEPIN_STATE_BACKEND=memory|file` (redis reserved); managed config via `DEPIN_CONFIG_JSON` → `DEPIN_CONFIG_URL` → `DEPIN_CONFIG_PATH`.
- Streaming payments, time-based sessions, custom facilitators, provider marketplace UI, and physical-device adapters are deferred.
- POST/completions and streaming chat gateways are **roadmap** for Access Shield (v1 remains GET/HEAD exact).

Agent boundaries:

- Do not implement payment flows without documenting the 402 challenge/response contract.
- Do not handle custody of user funds without explicit authorization design.
- Do not build the proxy without defining the resource provider registration model.
- Keep the gateway lightweight and composable.
- Do not build offensive farm tooling (OTP bots, credential theft, ban evasion). Platform **defense** only.
- Do not claim Access Shield is fully shipped; keep product expansion marked Proposed until accepted by the team.
- Coordinate Agent Auth identity/challenge design with Rushi; do not fork a second classifier under De-pin.

Remaining integration work (active — test tomorrow):

- Redeploy App Runner image with CORS + expose `PAYMENT-REQUIRED` (branch harden).
- Dashboard probe 402 + settle readiness from Pages origin.
- Use `DEPIN_STATE_BACKEND=file` (or future redis) for multi-instance hosts; multi-ok only with shared state flag.
- Prefer managed config via `DEPIN_CONFIG_JSON` or `DEPIN_CONFIG_URL` in containers; local file remains the dev default.
- Provider onboarding UI and richer ownership model remain product follow-ups.
- Optional OZ Channels facilitator + `OZ_API_KEY` for production-like settle.
- Access Shield roadmap: rate cards, POST/stream patterns, platform control-plane UI, multi-region anti-replay.
- Add an agent client SDK only after the standard x402 client path is exercised in more environments.

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
- Required environment variables are documented in the repository-root `.env.example`. Folder-level `.env.example` files are pointers only. Never commit real `.env` values.
