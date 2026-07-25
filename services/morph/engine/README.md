# Morph engine

**Morph is a fork of [OpenCode](https://github.com/anomalyco/opencode)** (MIT), rebranded as the Morph application for ZEXVRO.

| Stock OpenCode | Morph |
| --- | --- |
| OPENCODE splash | MORPH splash |
| `~/.config/opencode` | `~/.config/morph` |
| `opencode.json(c)` | `morph.json(c)` |
| `.opencode/` | `.morph/` |
| binary `opencode` | binary / runner `morph` |

## Build (standalone binary)

```bash
# needs bun + disk space
bash services/morph/engine/build.sh
# → services/morph/bin/morph-engine
# → services/morph/dist/morph
```

## Dev / local (no full compile)

```bash
bash services/morph/engine/prepare-src.sh   # clone + brand + bun install
morph   # uses branded source via bun when morph-engine missing
```

## Branding patches

- `patches/logo.ts` — Morph brand mark (`logoArt*` from `assets/ascii-art.txt`) + CLI wordmark
- `patches/logo.tsx` — animated TUI splash (radial reveal + idle shimmer)
- `apply-branding.sh` — app name `morph`, config filenames, `.morph` dir

Pinned OpenCode version: see `VERSION`.
