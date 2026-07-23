# Morph

Self-contained **ZEXVRO** transformation agent. Own branding. Own config. Own TUI.

```bash
bash services/morph/install.sh
morph
```

## First session

```
morph
/connect
```

Pick OpenAI / Anthropic-compatible / custom endpoint → enter base URL, API key, model.

Then:

> Analyze demos/arcade (Neon Run). Plan a ZEXVRO Web2→Web3 migration (Gate + NFT). Implement it.

## Commands

| Command | What |
| --- | --- |
| `morph` | Morph TUI |
| `/connect` | Add provider |
| `/providers` | List |
| `/use <id>` | Switch |
| `/model <name>` | Set model |
| `morph run "…"` | Headless |
| `morph doctor` | Status |
| `morph install` | PATH install |

Config: `~/.config/morph/config.json`

## Demo game

https://bright-meadow-20f31c35f5.lakebed.app  

```bash
cd demos/arcade && morph
# after changes:
npx lakebed@0.0.29 deploy
```
