# Morph harness (self-contained)

Morph is **not** OpenCode. It is a standalone agent CLI with:

- Interactive + one-shot modes
- OpenAI-compatible multi-provider config (presets + custom base URL)
- Built-in tools (repo + ZEXVRO platform)
- Workspace = current directory (run inside `demos/arcade` or monorepo root)

OpenCode was evaluated as a host runtime; product requirement is **`morph` only**.

## Demo path

1. `cd demos/arcade && morph`
2. “Analyze this platformer and plan ZEXVRO migration (Gate + NFT + optional De-pin).”
3. “Implement the plan.”
4. `npx lakebed@0.0.29 deploy` → shared URL updates.

## Still to add (platform)

- Morph service API for scoped tokens (avoid raw admin keys on laptops)
- Project bindings store (siteKey / collectionId)
- Official embed snippets for Lakebed/Preact
