# Morph (self-contained harness)

Morph is a **standalone** ZEXVRO agent:

- Own TUI (branded MORPH — not a third-party agent product)
- Own config (`~/.config/morph/config.json`)
- Own tool loop + ZEXVRO platform tools
- `/connect` for providers (OpenAI, Anthropic-compatible, custom OpenAI-compatible, key, model)

No third-party agent branding in the UI.

## Install

`bash services/morph/install.sh` or curl the same script from main.

## Start

`morph` → Morph TUI → `/connect` → work in `demos/arcade` or any repo.
