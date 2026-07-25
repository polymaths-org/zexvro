# Morph harness

Morph is **not** “OpenCode with env vars.” It is a **Morph-branded fork** of OpenCode plus ZEXVRO seed config and MCP.

## Identity

| Surface | Value |
| --- | --- |
| Product | Morph (ZEXVRO) |
| Engine base | OpenCode MIT (`engine/VERSION`) |
| Splash | Morph brand mark (ascii-art, animated) |
| Config home | `~/.config/morph` |
| Config files | `morph.json` / `morph.jsonc` |
| Project config dir | `.morph/` |

## Layout

```
engine/apply-branding.sh   # logo + app name + morph.json names
engine/prepare-src.sh      # clone + brand + bun install
engine/build.sh            # optional standalone binary
seed/                      # agents, skills, themes, morph.jsonc → ~/.config/morph
mcp/                       # ZEXVRO tools
bin/morph                  # user entry
```

## Verify

```bash
bash services/morph/install.sh
morph doctor
morph   # splash must be MORPH, not OPENCODE
ls ~/.config/morph
```
