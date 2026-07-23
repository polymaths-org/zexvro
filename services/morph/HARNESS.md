# Morph harness

Self-contained ZEXVRO agent:

- Own TUI (MORPH logo, slash commands)
- Own config (`~/.config/morph/config.json`)
- Tool loop: repo tools + ZEXVRO Gate/NFT/De-pin
- `/connect` for providers (endpoint + key + model)

## Install

```bash
bash services/morph/install.sh
morph
```

## Demo

```bash
cd demos/arcade && morph
# analyze → plan → implement
npx lakebed@0.0.29 deploy
```
