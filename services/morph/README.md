# Morph — ZEXVRO transformation agent

Morph is **OpenCode under ZEXVRO branding**, plus a **ZEXVRO MCP tool server** so the agent can migrate Web2 apps onto real platform services (Gate, NFT, De-pin, memory).

## What this is

| Piece | Path | Role |
| --- | --- | --- |
| OpenCode project config | `opencode.jsonc` | All built-in OpenCode providers **plus** optional ZEXVRO / custom OpenAI-compatible providers |
| Morph agent | `agent/morph.md` | Default migrate agent (scan → plan → patch → wire platform) |
| Morph ops agent | `agent/morph-ops.md` | Platform-only ops (no bulk rewrite) |
| Instructions | `AGENTS.md` | Always-on Morph product rules |
| ZEXVRO MCP | `mcp/` | Tools: Gate, NFT, De-pin, memory, health, deploy helpers |
| Launcher | `bin/morph` | `morph` → `opencode` in this directory with Morph agent |

The old Python/Textual Morph CLI was removed. Do not revive it.

## Prerequisites

```bash
# OpenCode CLI (keeps all stock providers: Anthropic, OpenAI, Google, …)
curl -fsSL https://opencode.ai/install | bash
# or: npm i -g opencode-ai@latest

opencode --version   # 1.18+ recommended
```

## Quick start

```bash
# From monorepo root
./services/morph/bin/morph

# Or explicitly
cd services/morph && opencode --agent morph

# Headless migrate demo (after providers configured)
cd services/morph
opencode run --agent morph "Scan demos/arcade and propose a ZEXVRO Web3 migration plan"
```

## Providers (keep OpenCode defaults + add yours)

OpenCode already ships many providers. Morph **does not disable them**.

Add custom / ZEXVRO endpoints via env (preferred — never commit keys):

```bash
export ZEXVRO_LLM_BASE_URL="https://your-openai-compatible.example/v1"
export ZEXVRO_LLM_API_KEY="…"
export ZEXVRO_LLM_MODEL="your-model-id"
```

Then in Morph config the `zexvro` provider is enabled when those vars are set.  
Or use OpenCode’s own UX:

```bash
opencode providers login
opencode providers list
opencode models
```

Demo day tip: pre-login one strong model, then use `/model` only if needed. Avoid teaching custom-endpoint JSON on stage.

## ZEXVRO platform env (MCP tools)

```bash
export ZEXVRO_API_URL="https://qkuostruh3.execute-api.us-east-1.amazonaws.com"
export ZEXVRO_GATE_URL="https://api.zexvro.in/gate"
export ZEXVRO_NFT_URL="https://iyk6idmup6.us-east-1.awsapprunner.com"
export ZEXVRO_DEPIN_URL="https://sr9k3xpmbj.us-east-1.awsapprunner.com"
export ZEXVRO_ACCESS_TOKEN="…"          # Cognito access token (short-lived)
export ZEXVRO_GATE_ADMIN_KEY="…"        # Gate admin for site create (server-side only)
```

Install MCP deps once:

```bash
npm --prefix services/morph/mcp install
```

## Demo game (Lakebed)

See [`../../demos/arcade/README.md`](../../demos/arcade/README.md).

Morph’s job is to migrate that **hosted Web2 arcade** into Web3 using ZEXVRO services, then redeploy so the shared Lakebed URL updates for everyone.

## Branding

- Product name: **Morph**
- Visual assets: `assets/`
- OpenCode remains the engine (TUI/web); Morph is the agent + tools + instructions layer
- Full TUI skin/fork of OpenCode is optional later — do not block demo on a full fork

## Docs

- [`HARNESS.md`](./HARNESS.md) — architecture and platform gaps
- [`../../demos/arcade/README.md`](../../demos/arcade/README.md) — Lakebed demo app
