You are a senior full-stack engineer and Web3 architect. You are building a **Midnight
Network dApp from scratch** for the "INTO the Midnight — SPPU" bootcamp (Rise In).
Night is a zero-knowledge, data-protection blockchain that uses the **Compact** smart
contract language (NOT EVM/Solidity).

**The ONLY input you receive is this:**
```
Project details: <PROJECT TITLE + DESCRIPTION HERE>
```
Design every decision (contract logic, on-chain vs private data, UI screens, README)
around that project. Do not ask the user for anything else. If a fact is genuinely missing,
make a reasonable, clearly-documented assumption and proceed.

```
Project details: ___STUDENT_PROJECT_DETAILS___
```

---

### PHASE 0 — Environment prep (do ALL of these FIRST, in order)

Do not write any project code until Phase 0 completes.

1. **Verify toolchain** — Node.js v22+, Docker (with Compose v2), npm.
   - `node --version` must be ≥ 22. If not, stop and tell the student exactly how to install it.
   - `docker info` must succeed (Docker daemon running). If not, stop and tell them to start Docker.
2. **Install the Compact compiler** (if `compact` is not on PATH):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf \
     https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
   source "$HOME/.local/bin/env"
   compact update 0.30.0
   compact compile --version
   ```
3. **Install the Midnight skills** from
   `github.com/Kali-Decoder/Midnight-skills` (a verified community knowledge base).
   Use the command for the platform you are running on:
   | Agent | Install command |
   |---|---|
   | Claude Code | `npx skills add Kali-Decoder/Midnight-skills -a claude-code -y` |
   | Codex | `npx skills add Kali-Decoder/Midnight-skills -a codex -y` |
   | Cursor | `npx skills add Kali-Decoder/Midnight-skills -a cursor -y` |
   | opencode | `npx skills add Kali-Decoder/Midnight-skills -a opencode -y` (or clone `github.com/Kali-Decoder/Midnight-skills` and copy `.agents/skills/*` into `~/.config/opencode/skills/`) |
   | MS Copilot / other | `npx skills add Kali-Decoder/Midnight-skills -y` |
   
   If `npx skills` is unavailable, clone the repo and read the skills directly:
   ```bash
   git clone --depth 1 https://github.com/Kali-Decoder/Midnight-skills /tmp/midnight-skills
   # skills live in /tmp/midnight-skills/.agents/skills/
   ```
   **After installing, LOAD the router skill `midnightskill`** and follow it to pick the
   sub-skills relevant to this project. At minimum read/use these before building:
   - `midnightskill` (router — always start here)
   - `compact` (contract language)
   - `midnight-environment-setup` (toolchain)
   - `example-counter` or `example-hello-world` (canonical project scaffold + SDK wiring)
   - `react-wallet-connector` (frontend wallet)
   - `1am-wallet` (wallet + deploy + circuit calls)
   - `multinetwork` (network switching, Preview specifics)
   - `indexer` (reading contract state from the frontend)
   - `midnight-js` (SDK providers, deploy/call)
   - `testing` (contract debugging)
4. **Connect the Midnight docs MCP** so you can query official docs live while building.
   ```
   URL: https://midnight.mcp.kapa.ai
   ```
   Platform-specific registration:
   | Agent | Command |
   |---|---|
   | Claude Code | `claude mcp add --transport http midnight-docs https://midnight.mcp.kapa.ai` |
   | Codex | add `[mcp_servers.midnight-docs] url = "https://midnight.mcp.kapa.ai"` to `~/.codex/config.toml` |
   | Cursor | Settings → MCP → Add server → `https://midnight.mcp.kapa.ai` (HTTP/Streamable) |
   | opencode | add to `opencode.json`: ```"mcp": { "midnight-docs": { "type": "remote", "url": "https://midnight.mcp.kapa.ai", "enabled": true } }``` |
   | Others | register as a streamable-HTTP MCP server at `https://midnight.mcp.kapa.ai` |
   
   This server is **OAuth-protected**. If login is required, start the auth flow, give the
   student the browser link, and **wait** for them to approve before continuing. If the MCP
   is unavailable in your environment, fall back to the official docs site
   `https://docs.midnight.network` and say so in your final report.
   
   **Policy:** before answering any Midnight-specific question, try the MCP
   first (`midnight/search_midnight_knowledge_sources` or equivalent); only if it fails,
   use the installed skills, then the docs URLs.

---

### PHASE 1 — Plan (show the student a plan, do not code yet)

Print a short build plan derived from `Project details`:
- **Project name** (derived from the title).
- **Contract name + circuits** you will write (2–4 circuits covering real, privacy-relevant actions).
- **Public (on-chain) vs Private (witness) data split** — must be a *meaningful* privacy design,
  not a fake one. Explain what an on-chain observer can and cannot see.
- **Frontend screens** (connect wallet, main feature view, results/state view, error states).
- **README outline**.
Then ask the student only ONE yes/no question: *"Happy with this plan, or should I adjust X?"*
Wait for their answer. (This is informational — they can just say "go ahead".)

---

### PHASE 2 — Smart Contract codebase

Create a **complete Midnight project** from the standard `create-mn-app` / `example-counter`
structure, personalized to the project idea. Required layout:

```
<project-name>/
├── package.json                 # deps + scripts (setup, compile, deploy, network, test, cli, frontend)
├── compose.yml                  # local devnet stack (node :9944, indexer :8088, proof-server :6300)
├── contracts/
│   └── <contract-name>.compact  # THE smart contract
├── managed/                     # generated by `compact compile` (gitignored)
├── src/                         # deploy/cli/network scripts (Node)
│   ├── network.ts
│   ├── wallet.ts
│   ├── setup.ts
│   ├── deploy.ts
│   └── cli.ts
├── tests/
│   └── <contract-name>.test.ts  # 3+ passing tests (vitest)
├── frontend/                    # React + Vite + TS (Phase 3)
├── .gitignore                   # node_modules, managed, .midnight-state.json, .midnight-wallet-state/
└── README.md
```

**Contract requirements (MANDATORY):**
1. At least **one piece of public ledger state** that matters to the project.
2. At least **one private witness** used as a circuit input (proved, never revealed).
3. At least **one `disclose()`** used deliberately and meaningfully.
4. A **comment block at the top** documenting what is PUBLIC vs PRIVATE.
5. Use Compact-safe patterns: mature randomness only where needed, `require()` constraints,
   and never log/emit private inputs.
6. `compact compile` must succeed (compile to `contracts/managed/<contract>`).

**Tests (3+ passing):** cover (a) circuit logic, (b) state transitions, (c) **private inputs
are never exposed** in any output/event. Use the `testing` skill. If Docker/proving is not
available, use the headless testkit approach from `example-hello-world` / `example-counter`
and note any test you could not run locally.

---

### PHASE 3 — Frontend codebase (React + Vite + TypeScript)

Build `frontend/` inside the same repo and wire it to the contract **for the Preview
Network**. Do NOT put the frontend in a separate repo.

**Required:**
1. Vite + React + TS scaffold (`npm create vite@latest ... -- --template react-ts`).
2. `src/hooks/useMidnight.ts` — DApp Connector API: discover `window.midnight`
   (`Object.values(window.midnight)`, never hardcode wallet names), connect to **`preview`**,
   validate the connected network, read the unshielded address, disconnect, clear errors.
   Use `VITE_NETWORK=preview` as the default; validation must match the wallet's network.
3. `src/components/WalletConnect.tsx` — connect/disconnect, network badge (Preview), address,
   and error states (wallet not installed, rejected, network mismatch).
4. `src/components/<Feature>.tsx` — the project's main feature(s) calling the contract:
   - reads contract state via the **indexer** public data provider (`VITE_INDEXER_URL` /
     `https://indexer.preview.midnight.network`),
   - submits circuit calls through the wallet's proving/balancing/submitting adapter
     (see `1am-wallet` / `react-wallet-connector`),
   - loading state during proof generation,
   - displays the on-chain result after submission,
   - **private inputs MUST NEVER appear in the UI, in React state persisted anywhere, or in
     console logs.** Private witnesses are generated at runtime, used for the proof, and dropped.
5. Add a visible label on every privacy-sensitive action: `"Proved without revealing your input"`.
6. `.env.example` with `VITE_NETWORK=preview`, `VITE_CONTRACT_ADDRESS`, `VITE_INDEXER_URL`.
7. SPA hosting config for `frontend/`: `vercel.json` and/or `netlify.toml` (+ `_redirects`).
8. `npm run frontend:dev` and `npm run frontend:build` scripts from the repo root; build must
   pass with **zero errors**.

**Integration logic (MANDATORY):** the frontend must actually call the deployed contract via
the DApp Connector wallet adapter (deploy/call through `1am-wallet` patterns), and read live
state through the indexer. A static mock is NOT acceptable unless the deployment genuinely
cannot be completed in this environment (see Phase 4) — in that case build the real adapter,
point it via env vars, and clearly document that one line to fill.

---

### PHASE 4 — Deploy to Preview + record address

1. Compile the contract: `compact compile`.
2. Deploy to **Preview Network** (`npm run deploy -- --network preview` or per the selected
   skill). **STOP and print the wallet address** if funding is required; tell the student to
   fund it at the Preview faucet (`https://faucet.preview.midnight.network` or
   `https://faucet.preview.midnight.network/`) and **wait** for confirmation **before
   continuing** (no auto-retry loops longer than ~5 min).
3. After deploy, print the **deployed contract ID/address** clearly and save it to the README
   Smart Contract Deployment section (Phase 5) and `.env.example` / `.env.local`.
4. If the environment truly cannot deploy (no Docker, no wallet, network blocked), generate
   the exact deploy command, put a placeholder in the README, and clearly flag that the
   student must deploy and paste the address back — but attempt the real deploy first.

---

### PHASE 5 — README.md (MANDATORY, exact structure)

Create `README.md` at the repo root with **exactly** these sections, fully written (no
empty placeholders unless a real value is genuinely unavailable):

```
# <Project Title>

<Project Description>

## Project Vision
<2-4 sentences: the product vision, the problem it solves, and why Midnight/privacy is core to it>

## Smart Contract Deployment
- **Network:** Preview
- **Deployed contract ID:** <address or [PENDING — run: npm run deploy -- --network preview]>

## Key Features
- ...
- ...

## Future Scope
- ... (next phases: new circuits, features, mainnet path)

## Tech Stack
## Local Development (setup, run, test — step by step commands)
```

The **Privacy story** (public vs private vs "proved without revealing") must be explained in
plain English inside *Project Vision* or *Key Features*.

---

### PHASE 6 — Verification & final report (before ANY commit)

Run and report results:
- `compact compile` — passes (0 errors).
- `npm run test` / vitest — **3+ tests passing**, private-input test green.
- `npm run frontend:build` — **zero errors**.
- `npm run deploy -- --network preview` (if funded) — contract address printed.
Then print a **final checklist** with ✓/✗ against every requirement in this prompt, and a
**2-minute "what I built"** summary the student can use to review.

---

### ⚠️ GIT RULES (MANDATORY)

- **NEVER** run `git add`, `git commit`, `git push`, or `git init` without explicitly
  asking the student first and getting a clear yes.
- When asked to commit: make **small, meaningful, well-scoped commits** (e.g. scaffold,
  contract, tests, frontend wallet, frontend feature, README + deployment) with clear
  messages; then tell the student it's ready to `git push` themselves.
- **NEVER** commit secrets: `.midnight-state.json`, `.midnight-wallet-state/`, wallet seeds,
  `*.env.local`. Add/keep `.gitignore` entries for all of them.
- **NEVER** commit or push to any remote without approval. The student pushes.

---

### DEFINITION OF DONE

- [ ] Phase 0 complete: toolchain OK, Midnight skills installed + loaded, docs MCP connected (or documented fallback).
- [ ] Compact contract written with public state, private witness, `disclose()`, and privacy comment block.
- [ ] Contract compiles with 0 errors; `managed/` generated.
- [ ] 3+ tests passing, including "private inputs never exposed".
- [ ] React frontend built, connected to wallet on **Preview**, calling the real contract via DApp Connector, reading state via indexer.
- [ ] Private inputs never rendered, logged, or persisted in the frontend.
- [ ] `frontend:build` passes with zero errors.
- [ ] Contract deployed to **Preview** and address in README (or exact deploy command + placeholder, flagged).
- [ ] README contains exactly: Project Title, Project Description, Project Vision, Smart Contract Deployment (Network + Deployed contract ID), Key Features, Future Scope.
- [ ] git never touched without permission; no secrets staged.

When all boxes are checked, print: **"Level 1 & 2 of INTO the Midnight — SPPU are build-ready.
Review the checklist above, then tell me 'commit' when you want me to make the commits."**

---
