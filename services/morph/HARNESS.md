# Morph harness

## Product shape

| You type | What runs |
| --- | --- |
| `morph` | **OpenCode TUI** with Morph agent, theme, MCP, provider |
| `morph providers set/add` | Clean custom-endpoint UX (writes `~/.config/morph/config.json`) |
| `morph run "…"` | Headless self-contained loop (no TUI) |
| `morph chat` | Plain REPL fallback |

## Why OpenCode for TUI

Full `/` command surface, sessions, model switcher, permissions, streaming — already production-grade. Morph layers branding + ZEXVRO tools + easier providers. Rebuilding that TUI in-house is not demo-viable.

## Branding

- Theme: `themes/morph.json` → installed to `~/.config/opencode/themes/morph.json`
- Agents: `agent/morph.md`, `morph-ops.md` → `~/.config/opencode/agent/`
- Instructions: `AGENTS.md` / `MORPH.md`
- Default agent: `morph`

## Providers

- **All OpenCode stock providers** remain (TUI `/connect`)
- **Morph presets** (OpenAI, OpenRouter, Groq, xAI, custom URL, …) set default Morph model at TUI launch via runtime config inject

## Demo

1. `cd demos/arcade && morph`
2. Analyze → plan → implement ZEXVRO migration
3. `npx lakebed@0.0.29 deploy`
