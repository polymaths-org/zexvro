# Morph

**ZEXVRO’s transformation agent** — self-contained. Own branding, own config, own TUI.

```bash
# Install once
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash

# Or from this repo
bash services/morph/install.sh

# Start
morph
```

## First run

1. `morph`
2. Type **`/connect`**
3. Pick OpenAI / Anthropic-compatible / custom endpoint
4. Enter **base URL** (if custom), **API key**, **model**
5. Chat: analyze → strategize → implement

## Slash commands (Morph TUI)

| Command | Action |
| --- | --- |
| `/connect` | Add provider (endpoint + key + model) |
| `/providers` | List saved providers |
| `/use <id>` | Switch provider |
| `/model <name>` | Set model on active provider |
| `/clear` | New conversation |
| `/doctor` | Status |
| `/help` | Help |
| `/exit` | Quit |

Config lives at **`~/.config/morph/config.json`** (Morph only).

## Demo

```bash
cd demos/arcade
morph
# "Analyze Neon Run, plan ZEXVRO migration (Gate + NFT), implement it"
npx lakebed@0.0.29 deploy
```

Live game: https://bright-meadow-20f31c35f5.lakebed.app

## Headless

```bash
export MORPH_API_KEY=…   # or OPENAI_API_KEY
# optional: MORPH_BASE_URL, MORPH_MODEL
morph run "Analyze demos/arcade and propose a migration plan"
```

## Optional platform env

```bash
export ZEXVRO_GATE_URL=https://api.zexvro.in/gate
export ZEXVRO_NFT_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
export ZEXVRO_DEPIN_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
export ZEXVRO_ACCESS_TOKEN=…
export ZEXVRO_GATE_ADMIN_KEY=…
```
