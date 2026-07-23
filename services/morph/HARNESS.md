# Morph harness architecture

## Stack decision

| Layer | Choice |
| --- | --- |
| Agent runtime | **OpenCode** (tool loop, sessions, multi-provider, MCP) |
| Product surface | Morph agents + AGENTS.md + `bin/morph` launcher |
| Platform tools | **ZEXVRO MCP** (`mcp/`) |
| Demo host | **Lakebed** capsule (`demos/arcade`) — shareable URL, redeploy = live update |

We **do not** maintain a second agent loop in Python.

## Providers

- **Keep all OpenCode built-in providers** (OpenAI, Anthropic, Google, OpenCode Zen, etc.).
- **Add** optional `zexvro` OpenAI-compatible provider via env (`ZEXVRO_LLM_*`).
- **Add** any team gateways the same way OpenCode already supports (`provider` in `opencode.jsonc` with `@ai-sdk/openai-compatible`).
- UX rule: prefer `opencode providers login` + model picker; env for CI/demo automation only.

## Agents

| Agent | File | Use |
| --- | --- | --- |
| `morph` | `agent/morph.md` | Full Web2→Web3 migrate (demo day) |
| `morph-ops` | `agent/morph-ops.md` | Platform ops, no bulk rewrites |

## Tools Morph needs (OpenCode + MCP)

### Built into OpenCode (use as-is)

- `bash`, `edit`, `read`, `grep`, `glob`, `webfetch` (and websearch if enabled)

### ZEXVRO MCP (implement / extend)

| Tool | Service | Purpose |
| --- | --- | --- |
| `zexvro_health` | All | Health matrix for Gate/NFT/Depin/API |
| `gate_status` | Gate | Live Gate status |
| `gate_create_site` | Gate | Create siteKey + secret for embed |
| `gate_list_sites` | Gate | List admin sites |
| `nft_health` | NFT | Confirm testnet + capabilities |
| `nft_list_collections` | NFT | Auth list collections |
| `nft_create_collection` | NFT | Deploy collection (testnet) |
| `depin_status` | De-pin | settleReady + routes |
| `depin_probe` | De-pin | Unpaid 402 probe |
| `memory_get` / `memory_put` | Platform `/api/memory` | Persist migration decisions |
| `lakebed_deploy_hint` | Demo | Print redeploy commands for arcade |

### Platform work still needed (ZEXVRO)

| Gap | Why Morph needs it |
| --- | --- |
| **Morph service API** (`/api/morph/*`) | Server-side tool proxy so CLI never holds long-lived admin keys in demos |
| **Scoped service tokens** | Per-workspace tokens for Gate admin / NFT ops (not personal admin keys) |
| **Project service bindings** | `project.services.gate.siteKey`, `nft.collectionId` in memory/API |
| **Embed packages** | Official snippets: Gate SDK, NFT checkout, De-pin client for Lakebed/Preact |
| **Webhook / callback** | Optional: Morph run status → console |
| **Credits** | Meter Morph + platform tool calls later |

## Demo flow

1. Host Web2 arcade on Lakebed (`demos/arcade`).
2. Run Morph against monorepo / arcade dir.
3. Morph plans NFT + Gate (+ optional De-pin).
4. Morph patches arcade capsule.
5. `npx lakebed deploy` → same `lakebed.json` deployId updates shared URL.
6. Audience refreshes → Web3 version live.

## Non-goals (demo)

- Live Zer0 prove on stage
- Mainnet money
- Replacing OpenCode TUI entirely before migrate works
