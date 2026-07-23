# Morph

**One install. One command.** Full agent TUI with ZEXVRO branding.

```bash
# Install everything (OpenCode engine + morph on PATH)
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/services/morph/install.sh | bash

# Start
morph
```

From a zexvro checkout:

```bash
bash services/morph/install.sh
morph
```

## In the TUI — providers (same as OpenCode)

Morph uses the OpenCode TUI, so provider setup is the **native** flow:

1. Start `morph`
2. Type **`/connect`** (or open the provider/connect command from the palette)
3. Pick **OpenAI**, **Anthropic**, **Google**, or **custom OpenAI-compatible**
4. Enter **base URL** (if custom), **API key**, **model**
5. Chat — Morph agent is already selected

You also get the usual slash commands: `/models`, `/theme`, `/session`, `/help`, …

Default theme: **morph** (ZEXVRO cyan/dark). Agent: **morph**.

## Workflow for demo day

```bash
cd demos/arcade   # or any repo
morph
# "Analyze this platformer, plan ZEXVRO migration (Gate + NFT), implement it"
```

Then redeploy the shared game:

```bash
npx lakebed@0.0.29 deploy
# https://bright-meadow-20f31c35f5.lakebed.app
```

## What gets installed

| Piece | Role |
| --- | --- |
| OpenCode | TUI engine (slash commands, sessions, providers) |
| `~/.local/bin/morph` | Only command you run |
| Morph agent + theme | Branding in `~/.config/opencode/` |
| ZEXVRO MCP | Gate / NFT / De-pin tools when env is set |

Optional platform env:

```bash
export ZEXVRO_GATE_URL=https://api.zexvro.in/gate
export ZEXVRO_NFT_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
export ZEXVRO_DEPIN_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
export ZEXVRO_ACCESS_TOKEN=…
export ZEXVRO_GATE_ADMIN_KEY=…
```

## Headless (CI / scripts)

```bash
export OPENAI_API_KEY=…   # or any OpenAI-compatible via MORPH_BASE_URL + MORPH_API_KEY
morph run "Analyze demos/arcade and propose a migration plan"
```
