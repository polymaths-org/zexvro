# Morph

**Morph is the Morph application** — a fork of OpenCode with Morph branding, Morph config, ZEXVRO skills, and ZEXVRO MCP.

Not a thin wrapper that still says OPENCODE.

| | |
| --- | --- |
| Splash | **MORPH** |
| Config | `~/.config/morph` (`morph.jsonc`) |
| Project dir | `.morph/` |
| Entry | `morph` |

```bash
# one-liner (builds standalone engine by default — no re-brand every launch)
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
export PATH="$HOME/.local/bin:$PATH"
morph

# from monorepo checkout
bash services/morph/install.sh
# skip binary: MORPH_BUILD_BINARY=0 bash services/morph/install.sh
```

## Architecture

```
services/morph/
  engine/          # OpenCode source branding + build/prepare scripts
  seed/            # ships into ~/.config/morph (agents, skills, theme, MCP)
  mcp/             # ZEXVRO Gate / NFT / De-pin tools
  bin/morph        # Morph launcher (standalone engine or bun-run branded fork)
```

Engine = OpenCode MIT fork at pinned version (`engine/VERSION`) with:

- Morph brand mark (`engine/patches/logo.ts` + animated `logo.tsx` from `assets/ascii-art.txt`)
- XDG app name `morph` → `~/.config/morph`
- Config files `morph.json` / `morph.jsonc`
- Project folder `.morph`

## First session — ZEXVRO account (required)

```bash
morph login                 # browser: approve device on console.zexvro.in
morph                       # open TUI in your app folder
```

### Inside the Morph TUI

Each folder is linked via `.morph/project.json`.

| Command | What |
| --- | --- |
| **`/use`** (`/project`, `/p`) | Switch project (list for current workspace) |
| **`/workspace`** | Switch or create workspace |
| **`/zexvro`** | Linked project / workspace for this folder |

Prompt chip: **`[project-name]`** (click = `/use`). Sidebar shows project + workspace.

New folder: one workspace → projects; multiple → pick workspace first.

Project list: plain names · **New project** · **Folder only** · **Change workspace**

### Outside TUI (still works)

```bash
morph whoami
morph workspaces
morph use <workspaceId>     # interactive list also works
cd your-app && morph bind
```

### LLM brain (separate from ZEXVRO)

#### Built-in: CodexIn (Grok 4.5)

Morph ships **CodexIn** as a built-in OpenAI-compatible provider:

| | |
| --- | --- |
| Provider id | `codexin` |
| Display name | CodexIn |
| Base URL | `https://api.codexin.lol/v1` |
| Model | `codexin/grok-4.5` (Grok 4.5) |

```bash
morph providers add codexin    # paste API key only
# or in TUI:
morph
/connect                       # CodexIn under Popular
```

Default model is `codexin/grok-4.5` once the provider is seeded (`morph providers ensure` / any `morph` launch).

#### Other providers

```
morph
/connect
# or: morph providers add
# or: morph providers add --list
```

`/connect` lists stock providers + **CodexIn** (Popular). **Custom endpoint** is also under Popular.  
TUI custom only saves an API key — **base URL must be configured**.

```bash
morph providers add            # menu: CodexIn or custom
```

Custom prompts for: provider id · display name · base URL (`…/v1`) · model · API key.  
Writes `~/.local/share/morph/auth.json` + `~/.config/morph/morph.jsonc`.

Then restart Morph → `/models` → pick `your-id/your-model`.

**Manual config** (same shape as OpenCode custom providers):

```jsonc
// ~/.config/morph/morph.jsonc
{
  "provider": {
    "codexin": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "CodexIn",
      "options": { "baseURL": "https://api.codexin.lol/v1" },
      "models": {
        "grok-4.5": { "name": "Grok 4.5" }
      }
    }
  },
  "model": "codexin/grok-4.5"
}
```

Then `/connect` → **CodexIn** → paste API key.

Then migrate any app onto ZEXVRO (Gate / NFT / De-pin as they fit).

## Skills

`web2-web3` · `gate` · `nft` · `depin` (demo apps are migration targets only)

## Build standalone binary (optional)

```bash
MORPH_BUILD_BINARY=1 bash services/morph/install.sh
# or
bash services/morph/engine/build.sh
```

Needs bun + free disk. Without the binary, Morph runs the branded fork via `bun` (same Morph splash/config).

## Local only

Do not push until Morph splash + `~/.config/morph` are verified interactively.
