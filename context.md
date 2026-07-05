# ZEXVRO Context

## Platform Identity

- Platform name: ZEXVRO
- Repository: https://github.com/polymaths-org/zexvro.git
- Category: Unified Web3 PaaS
- Product direction: clean, simple, professional, understandable UI inspired by Vercel and Cloudflare.
- Brand assets:
  - `assets/brand/logo.png`
  - `assets/brand/typo-logo.png`
  - `assets/brand/brand-design.png`

## Purpose

ZEXVRO is a unified platform-as-a-service for Web3 products and infrastructure. The platform should provide common unified-platform capabilities such as databases, deployment, hosting, security, connectors, and related infrastructure, while also offering unique Web3 services that are not commonly available from other platforms.

The MVP priority is to build six unique services first. General platform features such as DB, deploy, hosting, security, and connectors are secondary and should be added if time allows.

The existing repository summary describes ZEXVRO as:

> Web2-to-Web3 PaaS middleware that abstracts complex public blockchain rails into secure, private, enterprise-grade endpoints using Zero-Knowledge Execution (ZEX) and Verifiable Routing Orchestration (VRO).

## Target Stack

- Frontend: Vite and React.
- Blockchain/Web3 backend preference: Stellar Network.
- Reason for Stellar preference: Stellar is sponsoring the project, so use Stellar technology where it fits the product.
- Cloud/infrastructure: AWS.
- Product design benchmark: Vercel/Cloudflare-like clarity, with a simple and professional developer experience.

## MVP Team Split

There are three developers. Each developer owns two services, for a total of six MVP services.

| Developer | Alias | Assigned services |
| --- | --- | --- |
| Paris | `paris-29` | Zero-knowledge Privacy Pool, Transformation Agent |
| Rushi | `Wraient` | A-2-A Trade Pipeline, Captcha-like Agent Authentication Service |
| Nabil | `n4bi10p` | NFT Service, De-pin |

## MVP Services

### 1. Zero-Knowledge Privacy Pool

Owner: `paris-29` / Paris

Web3 has strong public-verifiability properties, but companies often avoid moving sensitive workflows on-chain because they need transaction privacy. The Zero-Knowledge Privacy Pool service should let companies use Web3 while preserving privacy for their transactions.

Core idea:

- Provide privacy for business transactions.
- Use zero-knowledge techniques where possible.
- Make Web3 adoption more acceptable for companies that cannot expose transaction details publicly.

### 2. Transformation Agent

Owner: `paris-29` / Paris

This is a key agent service for the platform. It should feel like a workspace-level assistant similar in placement and importance to Gemini in Google Workspace, but focused on ZEXVRO platform operations and Web2-to-Web3 transformation.

The service needs a better product name later. Inspiration mentioned: Snowflake Cortex-style platform intelligence.

Core idea:

- Agent that helps users deploy from the CLI and from the platform UI.
- Agent that helps migrate old Web2 codebases and workflows into Web3-ready architecture.
- Users should be able to share or connect a Git repository so the agent can inspect the full codebase.
- CLI agent and web agent should share unified memory across the same account.
- If the web agent learns authenticated context, the CLI agent should know the relevant context too.
- The platform should be developed in an agent-first way.
- Code comments, conventions, and possibly a dedicated skill should tell agents where to look for important context and task-specific notes.
- The goal is to make agent work more accurate and reduce duplicated exploration.

### 3. A-2-A Trade Pipeline

Owner: `Wraient` / Rushi

This is a trading pipeline for agents. One user's agent should be able to approach another agent when it is trading or selling something, then negotiate through the pipeline.

Core idea:

- Agent-to-agent commerce or negotiation.
- Agents can have wallets.
- Agents may need a dedicated skill/capability for wallet operations and trade negotiation.
- The platform should provide the pipeline, identity context, and transaction rails needed for trusted agent trade.

### 4. Captcha-Like Agent Authentication Service

Owner: `Wraient` / Rushi

This is an authentication and identification service that distinguishes humans from agents. It should give platforms control over how they treat humans, agents, and automated activity.

Core idea:

- Auth service that identifies agents and humans.
- Use Web3 and Stellar technology where it fits.
- Identify behavioral patterns and other signals to classify human vs agent activity with high accuracy.
- Provide SDK and API service access for external platforms.
- Provide a ZEXVRO sub-platform for human and agent classification.
- The immediate work is to label internet users as human or agent with higher accuracy.

Related concept: HDM, the Human Data Marketplace.

HDM idea:

- When a user logs in to HDM, they are identified as human.
- Human users can sell their data to AI training companies.
- Users can earn from their data.
- AI companies can access actual human data instead of AI-content-polluted datasets.

### 5. NFT Service

Owner: `n4bi10p` / Nabil

This service should let non-Web3 users deploy and manage NFTs with only a few simple steps.

Target users:

- Indie game developers.
- Small studios.
- Creators or teams that need NFT functionality without needing deep Web3 knowledge.

Core idea:

- Easy NFT deployment.
- NFT management from the ZEXVRO platform.
- Checkout and related flows handled from the platform.
- Hide complex Web3 steps behind a simple product interface.

### 6. De-pin

Owner: `n4bi10p` / Nabil

This service needs more brainstorming and detailed context from Nabil.

Current instruction:

- Ask Nabil to brainstorm and provide context for De-pin.
- Do not invent the final service scope without Nabil's input.
- Add the finalized scope to this file and `memory.md` once it is decided.

## Product Principles

- Build a clean, simple, professional UI.
- Prioritize understandability over visual complexity.
- Use a Vercel/Cloudflare-like interface style: calm, clear, developer-friendly, and fast to scan.
- MVP scope should focus on the six unique services first.
- Add common PaaS capabilities only when they support the unique services or when there is enough time.
- Prefer Stellar-backed implementations where technically appropriate.
- Keep the agent experience central to the product architecture.

## Setup Instructions

Current repo state:

- This repo currently contains project context, brand assets, and planning documentation.
- The frontend/backend application has not been scaffolded yet.

Initial developer setup:

1. Clone the repo:

   ```bash
   git clone https://github.com/polymaths-org/zexvro.git
   cd zexvro
   ```

2. Read the context before coding:

   ```bash
   cat context.md
   cat memory.md
   ```

3. Use the shared memory workflow:

   - Before starting work, read the latest `memory.md`.
   - During work, avoid changing another developer's owned service without coordination.
   - After every meaningful update, append a new entry to `memory.md`.
   - Commit code and the memory update together.

4. Expected future app setup:

   - Frontend should be scaffolded with Vite and React.
   - Backend/service integrations should prefer Stellar Network where appropriate.
   - AWS should be used for cloud infrastructure where needed.
   - Add exact install, dev, build, and test commands here once the app is scaffolded.

