# Morph — self-contained ZEXVRO agent

**No OpenCode install required.** Morph is a standalone Node CLI with its own tool loop, multi-provider OpenAI-compatible support, and ZEXVRO platform tools.

```bash
# from anywhere after install
morph

# or from monorepo
cd /path/to/zexvro
npm run morph

# in the game repo
cd demos/arcade && morph
```

Then: *“Analyze this game, strategize a ZEXVRO Web2→Web3 migration, then implement it.”*

## Install onto PATH

```bash
cd services/morph
node bin/morph.mjs install
# ensures ~/.local/bin/morph  (put ~/.local/bin on PATH)
```

Or from monorepo root:

```bash
npm run morph -- install
```

## First-time provider setup

Morph keeps **presets** (OpenAI, OpenRouter, Groq, Together, DeepSeek, xAI, OpenCode Zen, custom). All use the standard OpenAI **tools** chat API.

```bash
morph providers set --preset openai --api-key sk-... --model gpt-4.1
# custom gateway
morph providers set --preset custom \
  --base-url https://my-gateway.example/v1 \
  --api-key ... \
  --model my-model

morph providers          # list
morph providers use openai
morph doctor
```

Env overrides (CI/demo):

```bash
export MORPH_BASE_URL=...
export MORPH_API_KEY=...
export MORPH_MODEL=...
# aliases: ZEXVRO_LLM_* / OPENAI_API_KEY
```

Config file: `~/.config/morph/config.json` (mode 600).

## Platform tools (optional)

```bash
export ZEXVRO_GATE_URL=https://api.zexvro.in/gate
export ZEXVRO_NFT_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
export ZEXVRO_DEPIN_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
export ZEXVRO_ACCESS_TOKEN=…        # Cognito
export ZEXVRO_GATE_ADMIN_KEY=…      # create Gate sites
```

## Commands

| Command | What |
| --- | --- |
| `morph` | Interactive session in **cwd** |
| `morph run "…"` | One-shot |
| `morph providers …` | Provider UX |
| `morph doctor` | Readiness |
| `morph install` | PATH wrapper |

## Demo game

- Local: `npm run arcade:dev`
- Hosted: https://bright-meadow-20f31c35f5.lakebed.app  
- After Morph implements: `cd demos/arcade && npx lakebed@0.0.29 deploy`

## Architecture

- **Agent loop:** OpenAI-compatible `tools` / `tool_calls` (self-contained)
- **Tools:** list/read/write/search/run/analyze + Gate/NFT/De-pin health + lakebed hint
- **Optional MCP:** `mcp/` still available for other harnesses; Morph CLI does **not** need it

See `HARNESS.md` for platform gaps and demo-day plan.
