# Morph

**You only run `morph`.**  

Morph is ZEXVRO’s transformation agent. The full interactive experience is an **OpenCode TUI engine** with Morph branding, Morph agents, ZEXVRO MCP tools, and a **simpler provider UX** than OpenCode’s custom-endpoint flow.

```bash
cd demos/arcade   # or monorepo root
morph             # full TUI — /theme /models /session /undo …
```

## Why OpenCode under the hood?

OpenCode already has the mature agent TUI (slash commands, sessions, tools, multi-provider). Rebuilding that from scratch would take months and look worse.  

Morph’s product layer:

| Morph owns | OpenCode engine provides |
| --- | --- |
| Branding (theme, agents, AGENTS.md) | Full TUI + `/` commands |
| `morph providers set/add` (easy custom endpoints) | Stock providers (Anthropic, OpenAI, Google, …) |
| ZEXVRO MCP tools (Gate/NFT/De-pin) | Tool loop, permissions, sessions |
| `morph` single entrypoint | Rendering / UX chrome |

You do **not** need to learn or run `opencode` day-to-day. Install the engine once; always launch **Morph**.

## Install

```bash
# 1) TUI engine (once)
curl -fsSL https://opencode.ai/install | bash
# or: npm i -g opencode-ai@latest

# 2) Morph on PATH
cd /path/to/zexvro
npm run morph -- install     # → ~/.local/bin/morph
```

## Providers (better than OpenCode’s custom URL UX)

```bash
# presets
morph providers set --preset openai --api-key sk-... --model gpt-4.1
morph providers set --preset openrouter --api-key sk-or-... --model openai/gpt-4.1-mini
morph providers set --preset xai --api-key ... --model grok-3

# custom OpenAI-compatible (interactive)
morph providers add

# or flags
morph providers set --preset custom \
  --base-url https://my-gateway.example/v1 \
  --api-key KEY \
  --model my-model

morph providers          # list
morph providers use openai
```

Config: `~/.config/morph/config.json` (keys never committed).  

On TUI start, Morph injects that as the **default Morph model** while **keeping all stock OpenCode providers** available via `/connect` / model picker.

## Modes

| Command | Mode |
| --- | --- |
| `morph` | **Default** — full Morph TUI |
| `morph chat` | Simple REPL (no OpenCode UI) |
| `morph run "…"` | Headless one-shot |
| `morph doctor` | Setup check |

## Demo game

```bash
cd demos/arcade && morph
# "Analyze Neon Run and plan a ZEXVRO Web2→Web3 migration, then implement"
```

Live: https://bright-meadow-20f31c35f5.lakebed.app  

After implement: `npx lakebed@0.0.29 deploy`

## Platform tools

Optional env for Gate/NFT/De-pin MCP inside the TUI:

```bash
export ZEXVRO_GATE_URL=https://api.zexvro.in/gate
export ZEXVRO_NFT_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
export ZEXVRO_DEPIN_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
export ZEXVRO_ACCESS_TOKEN=…
export ZEXVRO_GATE_ADMIN_KEY=…   # admin only
```
