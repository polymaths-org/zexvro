# ZEXVRO — Technologies, Features & Services Map

> Generated from the monorepo as of **2026-07-18**.  
> Product: **Unified Web3 PaaS** for private, verifiable, agent-ready infrastructure.  
> Style references: Vercel / Cloudflare. Primary chain: **Stellar (Soroban)**. Cloud: **AWS**.

---

## 1. Platform overview

| Field | Value |
| --- | --- |
| Name | ZEXVRO |
| Category | Unified Web3 Platform-as-a-Service |
| One-liner | Helps teams move Web2 products onto private, verifiable, agent-ready Web3 infrastructure without raw blockchain complexity |
| Repo | `https://github.com/polymaths-org/zexvro.git` |
| Runtime baseline | Node.js ≥ 22 (most TS services); Morph CLI = Python |
| Primary chain | Stellar Network (testnet for MVP) + Soroban smart contracts |
| Primary cloud | AWS (`us-east-1`, account `290294660486`) |
| Auth | Amazon Cognito User Pools |
| Settlement asset (MVP) | SEP-41 USDC on Stellar |

### Six MVP services (ownership)

| # | Service | Owner | Product status |
| --- | --- | --- | --- |
| 1 | **Zer0** — Zero-Knowledge Privacy Pool | Paris (`paris-29`) | Product UI complete |
| 2 | **Morph** — Transformation Agent | Paris (`paris-29`) | CLI implemented & packaged |
| 3 | **A-2-A Trade Pipeline** | Rushi (`Wraient`) | Planned / UI scaffold |
| 4 | **Agent Auth** (captcha-like human/agent classification) | Rushi (`Wraient`) | Planned / UI scaffold |
| 5 | **NFT Service** | Nabil (`n4bi10p`) + Paris (UX) | Product UI complete |
| 6 | **De-pin** (x402 gateway / Access Shield economic plane) | Nabil (`n4bi10p`) | In progress (gateway MVP) |

---

## 2. Repository layout

```text
ZEXVRO/
├── frontend/                 # Vite + React dashboard + marketing
├── landing/                  # Static marketing landing (HTML/CSS/JS)
├── packages/
│   └── nft-checkout-sdk/     # Headless + popup NFT checkout client
├── services/
│   ├── nft-service/          # Soroban NFT contract + Express API
│   ├── depin/                # x402 reverse-proxy gateway
│   ├── zk-prover/            # HTTP ZK prove worker (snarkjs)
│   └── transformation-agent/ # Morph CLI (Python)
├── zer0-pool/                # Soroban privacy pool + Circom circuits
├── docs/                     # AWS, Access Shield, smoke checklists
├── scripts/                  # Root dev orchestration + AWS deploy helpers
├── test/nft-rpg-demo/        # Game-style NFT checkout demo
└── scratch_lambda/           # Scratch Lambda experiments
```

Root scripts (`package.json`):

| Script | What it starts |
| --- | --- |
| `npm run dev` | Frontend + NFT API (shared root `.env`) |
| `npm run dev:all` | Frontend + NFT API + De-pin |
| `npm run nft:smoke` | NFT API smoke checks |
| `lint:*` / `test:*` / `build:*` | Per-package targets |

---

## 3. Technology stack by layer

### 3.1 Frontend (`frontend/`)

| Concern | Technology | Why / where used |
| --- | --- | --- |
| Framework | **React 19** | Dashboard + marketing SPA |
| Language | **TypeScript ~5.8** | Type-safe app code |
| Bundler / dev | **Vite 6** | Dev server (port 3000), HMR, production build |
| Routing | **TanStack React Router** (+ residual `react-router-dom`) | Nested workspace/project/service routes |
| Styling | **Tailwind CSS 4** (`@tailwindcss/vite`) | Utility UI, light/dark themes |
| State | **Zustand** | Workspace, project, collection stores |
| Icons | **lucide-react** | Dashboard chrome |
| Charts | **Recharts** | NFT studio / analytics graphs |
| Motion | **Framer Motion / motion**, **GSAP**, **animejs**, **Lenis** | Marketing scroll, cinema loaders, settle animations |
| 3D / marketing | **Three.js**, **@react-three/fiber**, **@react-three/drei** | Marketing illustrations / scenes |
| Class utilities | **clsx**, **class-variance-authority**, **tailwind-merge** | Component variants |
| Stellar client | **@stellar/stellar-sdk**, **stellar-sdk**, **@stellar/freighter-api**, **@creit.tech/stellar-wallets-kit** | Wallet connect, auth entries, tx submit |
| ZK (browser) | **snarkjs**, **circomlibjs** | Client-side withdraw proofs when worker offline |
| Crypto helpers | **tweetnacl**, **buffer**, **vite-plugin-node-polyfills** | Browser crypto/polyfills for chain libs |
| AI (optional) | **@google/genai** | Gemini integration when `GEMINI_API_KEY` set |
| Auth (browser) | Cognito IDP REST (`cognito-idp.*.amazonaws.com`) | Sign-in / refresh without Amplify |
| Unit tests | **Vitest**, **Testing Library**, **jsdom** | Component & API client tests |
| E2E | **Playwright** | Browser flows |
| Lint typecheck | `tsc --noEmit` | CI-style gate |

**Vite proxies (local):**

| Browser path | Target |
| --- | --- |
| `/api/nft` | NFT API `http://127.0.0.1:4101` |
| `/api/depin` | De-pin gateway `http://127.0.0.1:4102` |

**Platform API base (hosted):**  
`https://qkuostruh3.execute-api.us-east-1.amazonaws.com` (API Gateway → Lambda).

### 3.2 Shared platform backend (AWS Lambda)

| Piece | Tech | Role |
| --- | --- | --- |
| Function | **AWS Lambda** (`zexvro-agent-backend`, Python 3.12) | Auth device codes, workspaces, projects, employees, payroll, memory, chat proxy, ZK worker proxy |
| HTTP front door | **API Gateway HTTP API** (`zexvro-api`) | Public HTTPS for Lambda |
| Identity | **Amazon Cognito** pool `us-east-1_vyONcitBD` | Dashboard + NFT login |
| Device auth store | **DynamoDB** `zexvro-device-codes` + GSI `user_code-index` | CLI device-code OAuth-style flow |
| Workspaces / projects | DynamoDB `zexvro-workspaces`, `zexvro-projects` | Multi-tenant shell data |
| Zer0 payroll data | DynamoDB `zexvro-employees`, `zexvro-payroll-runs`, `zexvro-payroll-taxonomy` | People & payroll runs |
| Shared memory | DynamoDB `zexvro-user-memory` | `/api/memory` for dashboard + Morph alignment |
| Logs | **CloudWatch Logs** | Lambda + App Runner |

Reference source samples: `docs/lambda_auth.py`, `docs/lambda_function.py`.

### 3.3 Blockchain / Web3

| Tech | Used for |
| --- | --- |
| **Stellar** (testnet passphrase: `Test SDF Network ; September 2015`) | Settlement network |
| **Soroban** RPC (`https://soroban-testnet.stellar.org`) | Smart contract invoke / simulate |
| **SEP-41 USDC** contract (testnet) | NFT primary sale + De-pin exact payments |
| **Soroban SDK (Rust)** | On-chain contracts |
| **OpenZeppelin Stellar tokens** (`stellar-tokens`) | NFT `NonFungibleToken` base |
| **Freighter** + Stellar Wallets Kit | User signing of auth entries (never secrets in browser) |
| **Platform sponsor account** | Pays envelope fees; secret via Secrets Manager / Stellar CLI identity |
| **x402 v2** (`@x402/core`, `@x402/express`, `@x402/stellar`, `@x402/fetch`) | HTTP 402 pay-per-request |
| **OpenZeppelin Channels** facilitator | Verify/settle Stellar x402 payments |
| **Circom 2** + **circomlib** (Poseidon) | Zer0 withdraw circuit |
| **Groth16** artifacts (`.zkey`, `.wasm`) | Proof generation (browser or worker) |
| **snarkjs** | Prove/verify in Node + browser |
| **soroban-poseidon** | On-chain Poseidon for Zer0 pool |

### 3.4 Zero-knowledge stack (`zer0-pool/`, `services/zk-prover/`)

| Layer | Path | Stack |
| --- | --- | --- |
| Circuit | `zer0-pool/circuit/withdraw.circom` | Circom, MerkleProof + Withdraw (Poseidon) |
| Powers of tau | `pot15_*.ptau` | Trusted setup material (local) |
| Contract | `zer0-pool/contracts/zer0-pool` | Rust, `soroban-sdk` 27, hazmat crypto, Poseidon |
| Artifacts backup | `zer0-pool/backups/zk-proofs-LATEST/` | Frozen wasm/zkey + contract/circuit snapshots |
| Prover worker | `services/zk-prover` | Node HTTP (`/prove`, `/health`), snarkjs; roadmap RapidSNARK |
| Hosted worker | **EC2 c6i.xlarge** `zexvro-zk-prover` + Elastic IP | Lambda can start/stop instance |
| Frontend fallback | Browser snarkjs | If worker offline |

### 3.5 Infrastructure & ops

| AWS / tool | Used for |
| --- | --- |
| **App Runner** | Hosted NFT API + De-pin containers |
| **ECR** | Container images `zexvro-nft-api`, `zexvro-depin` |
| **S3** | NFT media, deploy tarballs, agent assets |
| **CloudFront** | CDN for NFT media (`d1a0z3arlwwfrj.cloudfront.net`) |
| **Secrets Manager** | NFT sponsor seed; De-pin config JSON |
| **CodeBuild** | Image build project (idle when unused) |
| **IAM** | App Runner, CodeBuild, EC2, Lambda roles |
| **Docker** | NFT API + De-pin Dockerfiles |
| **Stellar CLI** | Local sponsor identity (`zexvro-provider`) for `npm run dev` |
| Deploy scripts | `scripts/deploy-nft-depin-aws.mjs`, `redeploy-depin-aws.mjs` |

---

## 4. Service-by-service deep dive

### 4.1 Zer0 — Zero-Knowledge Privacy Pool

**Problem:** Businesses want Web3 settlement without exposing sensitive payment details on a public ledger.

**What the product does**

| Feature | Description | Tech |
| --- | --- | --- |
| Private payroll UI | Multi-screen suite: dashboard, people, pay party, history, proofs, stealth, settings | React + TanStack Router under `/dashboard/.../zer0` |
| People directory | Employees / payees for private pays | DynamoDB employees + Lambda API |
| Pay party | Batch private pay session with brand settle cinema | Frontend + payroll APIs + pool contract |
| History / proofs | Proof and run history views | DynamoDB payroll-runs + UI |
| Stealth / redeem | Stealth redeem guidance flows | Frontend guides + pool model |
| Client ZK prove | Generate withdraw proof | snarkjs + Circom artifacts in `public/zk` |
| Hosted prove | Offload prove to worker | `POST /api/zk-worker/prove` → Lambda → EC2 prover |
| On-chain verify | Pool contract checks proof / nullifiers | Soroban `zer0-pool` |
| Wallet connect | Network, signing, privacy settings (no AWS knobs in UI) | Freighter / Wallets Kit |

**Key paths**

- UI: `frontend/src/components/zer0/*`
- Pool API helpers: `frontend/src/api/privacyPool.ts`, `api.ts` (payroll/employees)
- Contract + circuit: `zer0-pool/`
- Worker: `services/zk-prover/`

**AWS services used:** Cognito, Lambda, API Gateway, DynamoDB (employees/payroll/taxonomy), EC2 (prover), CloudWatch.

**External:** Stellar/Soroban, Freighter.

---

### 4.2 Morph — Transformation Agent

**Problem:** Teams need help migrating Web2 codebases and workflows into Web3-ready infrastructure.

**What the product does**

| Feature | Description | Tech |
| --- | --- | --- |
| CLI chat agent | Terminal agent for inspect / suggest / transform | **Python**, **Typer**, **Rich**, **Textual** |
| Tool registry | Read/write files, run commands, analyze codebase | `cli/tools.py` |
| Agent loop | Intent routing + tool use | `cli/agent.py` |
| Persistent memory | Per-user KV + sessions | **SQLite** (`cli/memory.py`) |
| LLM backend | Model calls | **OpenAI API** (swappable; web also has OpenCode/Gemini paths) |
| Device auth | CLI login via device codes | Cognito-backed Lambda + DynamoDB device codes |
| Web assistant shell | Dashboard Agent Studio + Morph polling | React `AgentStudio`, `/api/chat` proxy |
| Shared memory UI | Workspace/project memory notes | DynamoDB `zexvro-user-memory` via `/api/memory` |
| Stellar knowledge | Local KB for chain guidance | `stellar_kb.py` / `frontend/src/agent/stellarKb.ts` |

**Key paths**

- CLI: `services/transformation-agent/cli/`
- Plan: `services/transformation-agent/PLAN.md`
- Frontend: `frontend/src/components/dashboard/AgentStudio.tsx`, `frontend/src/agent/*`

**AWS services used:** Cognito, Lambda (chat + memory + device auth), DynamoDB memory/device-codes.

**External:** OpenAI (CLI), optional Gemini / OpenCode provider for web chat.

---

### 4.3 A-2-A Trade Pipeline

**Problem:** Agents need a trusted way to approach other agents, negotiate, and settle trades.

**Status:** Product intent + dashboard scaffold (`TradePipeline` route). Protocol, wallet model, identity standard, and settlement mechanism are **not finalized**.

| Feature (intent) | Planned role | Likely tech (direction) |
| --- | --- | --- |
| Offer / counteroffer protocol | Structured negotiation | TBD schema + API |
| Agent identity | Who is trading | Coordinate with Agent Auth + Stellar |
| Settlement | Move value after agreement | Stellar USDC / contracts (TBD) |
| UI scaffold | Project service screen | React route `/.../trade` |

**Owner rule:** No custody or auto-spend without explicit authorization design.

---

### 4.4 Agent Auth (Captcha-like) + HDM direction

**Problem:** Platforms must distinguish humans from agents and control access; optional HDM lets verified humans sell human-origin data.

**Status:** Planned service + UI scaffold (`AgentAuth` route). Classification signals, Stellar role, and SDK shape are open.

| Feature (intent) | Description | Tech direction |
| --- | --- | --- |
| Human vs agent scoring | Confidence-labeled classification | ML/signals TBD; never claim perfect detection |
| SDK / API | External platform integration | Future package + API |
| Web3 identity hooks | Where Stellar helps | TBD |
| HDM (related) | Consented human data marketplace | Privacy, consent, deletion required before build |
| Access Shield plane | Identity layer in front of De-pin | See `docs/access_shield.md` |

**UI path:** `/dashboard/w/:workspaceId/p/:projectId/agent-auth`

---

### 4.5 NFT Service

**Problem:** Indie games and studios need NFTs without learning full Web3 tooling.

**Status:** Product UI complete; production AWS path exists (App Runner + S3 + Dynamo + CloudFront).

#### On-chain (Soroban)

| Feature | Detail | Tech |
| --- | --- | --- |
| One contract per collection | No factory in v1 | Rust crate `zexvro-nft-collection` |
| NFT standard | Ownership, approvals, transfer, burn | OpenZeppelin Stellar `NonFungibleToken` (`stellar-tokens`) |
| Metadata | Immutable `base_uri + token_id` | Contract config |
| Royalties | Quote info only (not enforced on arbitrary transfers) | BPS capped at 10% |
| Primary sale | Fixed-price USDC transfer + mint **atomically** | SEP-41 USDC + sponsor envelope |
| Roles | Studio owner + optional delegated minter | Contract roles |

#### Off-chain API (`services/nft-service/api`)

| Feature | Routes / behavior | Tech |
| --- | --- | --- |
| Health | `GET /health` | Express 5 |
| Media upload | `POST /v1/media` | **multer** + local / **S3** / optional **Pinata** |
| Collections CRUD/status | `/v1/collections...` | Cognito JWT (`aws-jwt-verify`) |
| Mint intent/submit | Auth-entry pattern | Stellar SDK + sponsor gateway |
| Sale config intent/submit | Owner configures primary sale | Same gateway |
| Public inventory/metadata | Unauthenticated reads | Public REST |
| Public checkout | Intent + submit with **Idempotency-Key** | Auto token IDs |
| Persistence | file JSON (dev) or DynamoDB (prod) | `@aws-sdk/client-dynamodb`, `lib-dynamodb` |
| Media delivery | Local HTTP, S3, optional CloudFront CDN URL | `@aws-sdk/client-s3` |
| CORS | Partner game origins allowlist | `CORS_ALLOWED_ORIGINS` |

#### Studio / product UI

| Feature | Description | Tech |
| --- | --- | --- |
| Create wizard | Freighter mission cinema → launch finale | React NFT components |
| Collection studio | Overview, sale, mint, ledger analytics, SDK panel, archive | Recharts + nftApi |
| Public collection page | Shareable storefront | `/nft/collections/:id` |
| Embed checkout | Hosted popup for games | `/nft/embed/checkout` + postMessage |
| Integrate SDK panel | Copy-ready snippets | `packages/nft-checkout-sdk` |

#### Checkout SDK (`packages/nft-checkout-sdk`)

| Mode | Who builds UI | Entry |
| --- | --- | --- |
| Popup | ZEXVRO hosted embed | `openCheckout()` |
| Headless web | Game frontend | `createNftCheckoutClient` + Freighter |
| Backend-only | Game server | Public REST (wallet still signs in browser) |

#### Hosted endpoints

| Resource | URL / name |
| --- | --- |
| App Runner NFT API | `https://iyk6idmup6.us-east-1.awsapprunner.com` |
| DynamoDB | `zexvro-nft` (+ workspace + idempotency GSIs) |
| S3 media | `zexvro-nft-media-…` |
| CloudFront | `https://d1a0z3arlwwfrj.cloudfront.net` |
| Sponsor secret | Secrets Manager `zexvro/nft/sponsor-secret` |

**Out of v1:** secondary markets, auctions, multi-chain, fiat card checkout.

---

### 4.6 De-pin — x402 Agentic Resource Gateway (+ Access Shield)

**Problem (MVP):** Agents cannot easily buy API/compute capacity with card-based Web2 billing.

**Problem (strategic):** Big platforms lose COGS to free-tier farms and agent spam; economic pay-per-request makes abuse unprofitable.

**Product framing:** Enforcement plane of **ZEXVRO Access Shield** (`docs/access_shield.md`). Full control-plane UI is **proposed**, not fully shipped.

#### Shipping gateway features

| Feature | Behavior | Tech |
| --- | --- | --- |
| Fail-closed reverse proxy | Unpaid never sees upstream body | Express 5 + custom proxy |
| x402 v2 exact | `PAYMENT-REQUIRED` → `PAYMENT-SIGNATURE` → settle → `PAYMENT-RESPONSE` | `@x402/*`, `@x402/stellar` |
| Facilitator verify/settle | Optional OZ Channels Bearer auth | `OZ_API_KEY` / `X402_FACILITATOR_API_KEY` |
| USDC on Stellar testnet | Exact atomic amount per request | Stellar SDK + facilitator-sponsored fees |
| Replay protection | Auth fingerprint claim before second upstream call | memory / **file** state backends |
| Rate limits | Unpaid request throttling | In-process + durable state |
| Provider config | Route, price, recipient G-address, timeout, secret ref | JSON via path / URL / env |
| Health / status | Sanitized manifest for dashboard | `GET /health`, `GET /status` |
| Demo client | Paid settle smoke | `demoClient.ts` + buyer secret from CLI |

#### Dashboard features

| Feature | Description |
| --- | --- |
| Gateway status | Settle readiness, multi-instance flags, routes |
| Probe 402 | Unpaid challenge through Vite proxy |
| Protect route wizard | Setup UX for provider routes |
| Integrate panel | Integration guidance |

**Key paths:** `services/depin/src/*`, `frontend/src/services/depin/*`

**Hosted:** App Runner `https://sr9k3xpmbj.us-east-1.awsapprunner.com`, secret `zexvro/depin/config-json`.

**v1 limits:** concrete `GET`/`HEAD` only; no streaming, sessions, POST completions, redis state, marketplace, or physical-device adapters yet.

---

## 5. Shared platform features (shell)

These are not the six MVP “product services,” but they power the dashboard.

| Feature | Description | Tech / backend |
| --- | --- | --- |
| Marketing site | Scroll chapters, 3D, brand intro | React marketing + Three/R3F; also static `landing/` |
| Auth (email/password session) | Cognito USER_PASSWORD_AUTH style flow | Cognito IDP API from browser |
| Device code CLI login | Poll/activate device codes | Lambda + DynamoDB + Cognito authorizer |
| Workspaces | Multi-workspace console | Lambda + DynamoDB + Zustand |
| Projects | Per-workspace projects + enabled services | Lambda + DynamoDB |
| Services catalog | Enable/configure services per project | Frontend catalog + placeholders |
| Agent Studio | Platform assistant UI | React + `/api/chat` |
| Memory | Shared notes for agents/humans | DynamoDB memory API |
| Docs library | In-app docs (`/docs`) | React `DocsLibrary` |
| Team / security / analytics / audit | Shell screens (mixed maturity) | Mostly UI + partial APIs |
| Theme system | Light/dark, brand fonts/assets | Tailwind + `design.md` tokens |
| Public withdraw page | Standalone withdraw flow | `/withdraw` lazy route |
| Boot / brand cinema loaders | Platform polish | Custom React loaders |

---

## 6. Feature → technology → service matrix

| User-facing feature | Primary technologies | Owning service / system |
| --- | --- | --- |
| Sign in / session refresh | Cognito, localStorage session | Shared auth |
| CLI device login | Lambda, DynamoDB device-codes, Cognito | Shared auth + Morph CLI |
| Workspace & project CRUD | Lambda, DynamoDB, React, Zustand | Shared platform |
| Private payroll / Zer0 UI | React, Freighter, snarkjs, Soroban, DynamoDB, EC2 prover | **Zer0** |
| ZK proof generation | Circom, snarkjs, optional RapidSNARK roadmap | **Zer0** + **zk-prover** |
| Morph CLI transform assist | Python Typer, OpenAI, SQLite, tools | **Morph** |
| Web agent chat | Lambda `/api/chat`, OpenCode/Gemini env | **Morph** + shared API |
| Shared agent memory | DynamoDB user-memory, React Memory UI | Shared + Morph |
| NFT create / mint / sale | Express, Soroban NFT contract, S3, DynamoDB, Freighter | **NFT Service** |
| NFT public buy / game embed | Public REST, checkout SDK, CloudFront media | **NFT Service** |
| Pay-per-request API gate | x402, Stellar USDC, OZ facilitator, Express proxy | **De-pin** |
| Access Shield narrative | De-pin + future Agent Auth + policy | **De-pin** + **Agent Auth** (proposed) |
| Agent-to-agent trade | TBD protocol | **A-2-A** (planned) |
| Human/agent captcha | TBD classifier SDK | **Agent Auth** (planned) |
| Marketing homepage | React/Three or static landing | Frontend / `landing/` |

---

## 7. External services & third parties

| Service | Role | Secrets / config |
| --- | --- | --- |
| **Amazon Cognito** | User authentication | Pool ID + client ID (public to browser) |
| **AWS API Gateway + Lambda** | Core platform API | IAM roles; no browser secrets |
| **AWS DynamoDB** | Platform + NFT + auth data | IAM / App Runner role |
| **AWS S3 + CloudFront** | NFT media | Bucket private; CDN via OAC |
| **AWS App Runner + ECR** | NFT + De-pin hosting | Image push + env injection |
| **AWS Secrets Manager** | Sponsor seed, De-pin config | Injected into runtime only |
| **AWS EC2** | ZK prover worker | Instance start/stop from Lambda |
| **Stellar network / Soroban RPC** | Chain settlement | Public RPC; sponsor secret server-side |
| **Freighter / wallet extensions** | User signatures | User-held keys only |
| **OpenZeppelin Channels (x402)** | Payment verify/settle | `OZ_API_KEY` |
| **x402.org facilitator** | Local unpaid 402 probes | Public facilitator URL |
| **Pinata** (optional legacy) | IPFS pin for NFT media | `PINATA_JWT` server-side |
| **OpenAI** | Morph CLI LLM | CLI env key |
| **Google Gemini** | Optional frontend/genai | `GEMINI_API_KEY` |
| **OpenCode / Morph proxy** | Web agent completions | `OPENCODE_*` server-side only |

---

## 8. Data stores summary

| Store | Backend | Data |
| --- | --- | --- |
| Cognito | AWS managed | Users / tokens |
| `zexvro-device-codes` | DynamoDB | CLI device auth |
| `zexvro-workspaces` | DynamoDB | Workspaces |
| `zexvro-projects` | DynamoDB | Projects |
| `zexvro-employees` | DynamoDB | Zer0 people |
| `zexvro-payroll-runs` | DynamoDB | Payroll sessions/payments |
| `zexvro-payroll-taxonomy` | DynamoDB | Roles/departments |
| `zexvro-user-memory` | DynamoDB | Shared memory blobs |
| `zexvro-nft` | DynamoDB | Collections, inventory, checkout intents |
| NFT media | S3 (+ CloudFront) | Images/metadata objects |
| NFT local dev | JSON file + local assets | Single-process dev only |
| De-pin replay state | memory or file JSON | Auth fingerprints / rate state |
| Morph CLI memory | SQLite | Per-user agent memory |
| On-chain | Stellar/Soroban | NFT ownership, pool commitments/nullifiers, USDC transfers |

---

## 9. Local development map

```text
Browser :3000  (Vite React)
    │
    ├─ Cognito (AWS)
    ├─ Platform API  → API Gateway / Lambda  (or local mock if configured)
    ├─ /api/nft      → proxy → NFT Express :4101  → Stellar testnet
    └─ /api/depin    → proxy → De-pin Express :4102 → facilitator + upstream

Optional:
  ZK worker :8787 (Node snarkjs)
  Morph CLI (Python) with device-code login
```

```bash
cp .env.example .env
npm run dev        # frontend + NFT
npm run dev:all    # + De-pin
```

Sponsor secret for local NFT: read from Stellar CLI identity `zexvro-provider` when `STELLAR_SPONSOR_SECRET` is empty (never written into frontend env).

---

## 10. Testing stack

| Area | Tools |
| --- | --- |
| Frontend unit | Vitest, Testing Library, jsdom |
| Frontend e2e | Playwright |
| NFT API | Vitest, supertest, ESLint |
| NFT contract | `cargo test` / clippy / stellar contract build |
| De-pin | Vitest, supertest, ESLint, smoke script |
| Zer0 contract | Cargo tests (Soroban) |
| Root smoke | `npm run nft:smoke` |

---

## 11. Hosted runtime inventory (high level)

| Product area | Compute | Data | Secrets / CDN |
| --- | --- | --- | --- |
| Auth + dashboard API | Lambda + API GW | Cognito + multiple Dynamo tables | — |
| Zer0 prove path | Lambda + **EC2 c6i.xlarge** | Payroll Dynamo tables | Shared prover secret |
| NFT Studio | **App Runner** | Dynamo `zexvro-nft`, S3 media | Sponsor secret, CloudFront |
| De-pin | **App Runner** | File/memory state in container | Config secret, OZ API key |
| Frontend | (deploy target TBD in docs; app talks to hosted APIs) | — | Public Cognito + API URLs only |

Cost note (from `docs/aws_inventory_and_cost.md`): EC2 ZK worker dominates (~$124/mo if always on); App Runner pair ~$15–35/mo; serverless data plane usually free-tier small.

---

## 12. Explicit non-goals / out of scope (v1)

- Multi-chain NFT or De-pin
- Secondary NFT marketplace / auctions / fiat card rails
- De-pin streaming, POST completions, redis state, physical device adapters
- Perfect agent detection (Agent Auth)
- Autonomous Morph actions without approval/audit design
- Committing secrets to git
- Claiming Access Shield control plane is fully shipped

---

## 13. Quick “what uses what” cheatsheet

| If you care about… | Look here | Stack keywords |
| --- | --- | --- |
| Dashboard UI | `frontend/` | React, Vite, Tailwind, TanStack Router, Zustand |
| Login | `frontend/src/auth/` | Cognito |
| Workspaces/projects/memory/payroll APIs | Lambda via `frontend/src/api/api.ts` | API GW, DynamoDB |
| Private pay + ZK | `frontend/src/components/zer0/`, `zer0-pool/`, `services/zk-prover/` | Circom, snarkjs, Soroban, EC2 |
| Morph CLI | `services/transformation-agent/cli/` | Python, Typer, OpenAI, SQLite |
| NFT chain | `services/nft-service/contracts/` | Rust, Soroban, OZ tokens |
| NFT API | `services/nft-service/api/` | Express, DynamoDB, S3, Stellar |
| NFT games SDK | `packages/nft-checkout-sdk/` | Vanilla JS client |
| Pay-per-request APIs | `services/depin/` | x402, Stellar USDC, Express |
| Access Shield story | `docs/access_shield.md` | De-pin + Agent Auth (future) |
| AWS inventory | `docs/aws_inventory_and_cost.md` | Full resource list |

---

## 14. Related docs

| Doc | Contents |
| --- | --- |
| `README.md` | Public overview + local dev |
| `context.md` | Product source of truth, ownership, service map |
| `memory.md` | Chronological work state |
| `design.md` | Visual system / UI rules |
| `docs/access_shield.md` | De-pin strategic framing |
| `docs/aws_deployment.md` | Device-auth Lambda deploy |
| `docs/aws_nft_production.md` | NFT AWS resources |
| `docs/aws_nft_depin_runtime.md` | Hosted NFT/De-pin runtime notes |
| `docs/aws_inventory_and_cost.md` | Live AWS inventory + cost |
| `services/*/README.md` | Service-local setup and APIs |

---

*This document maps the monorepo as implemented and documented. Status of individual services can change; prefer `context.md` + `memory.md` for current work state.*
