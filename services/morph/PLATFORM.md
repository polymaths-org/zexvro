# Morph × ZEXVRO platform (what makes migration real)

## User flow (shipped)

```bash
morph login                 # device-code → browser approve on console
morph whoami
morph workspaces            # if API available
morph use <workspaceId>     # optional project id
cd your-app && morph bind   # .morph/project.json
morph                       # agent; MCP uses your session
```

Separate: LLM brain

```bash
morph providers add   # or /connect in TUI
```

## Shipped in this package

| Piece | Path |
| --- | --- |
| Device login | `lib/zexvro-login.mjs` → `POST /auth/device-code` + poll `/auth/token` |
| Session store | `~/.local/share/morph/zexvro-auth.json` |
| Workspace session | `morph use` |
| Project bind | `.morph/project.json` via `morph bind` |
| MCP auth | reads session store + bind; tools `zexvro_whoami`, memory, nft… |
| Project cwd | always launch folder, not engine-src |
| **`morph migrate`** | `bin/migrate-web3.mjs` — EDGERUN-style Web2→Web3 (NFT checkout + Gate captcha on token packs) |
| Gate site auto-create | When `GATE_ADMIN_API_KEY` / `ZEXVRO_GATE_ADMIN_KEY` set and `--site-key` omitted, migrate creates a site and injects public `siteKey` |
| Gate MCP | `gate_list_sites` / `gate_create_site` use morph Bearer **or** admin key |

## Demo polish shipped (P1 / P3-ish)

- Shared Memory dashboard: developer-facing (decisions / blockers / handoffs / Morph bindings)
- Morph Agent Studio: CLI setup strip in Context
- `morph memory add` — append structured notes to project/workspace memory
- Install script prints login → use → bind → morph
- Memory entry schema: `lib/memory-schema.mjs` + agent skill notes

## Still implement (P0 later + remainder)

### Platform / backend (P0)

1. **Scoped Morph agent tokens** — short-lived, workspace-scoped  
2. **User-scoped Gate API** — create/list sites as workspace member  
3. **Token refresh** — Cognito refresh_token if device flow returns it  
4. **Credits + RBAC** on mutating Morph tools  
5. **Audit log** — Morph actions visible in dashboard  

### Dashboard / Morph product

1. Live CLI connection heartbeat (morph → memory `cli_connected`)  
2. **`/migrate` slash** that requires whoami  
3. Migration checklist generator  
4. Secret guard on write tools  
5. Standalone morph-engine binary (`MORPH_BUILD_BINARY=1`) when disk allows  

### Migration DX

1. App scanner (abuse surface / ownership / paid API)  
2. Snippet patches for Gate / NFT / De-pin  
3. `.env.example` public-only updates  
4. Verify checklist after migrate  

## Security rules

- Never commit `zexvro-auth.json` or site `secretKey`  
- Never put admin Gate key in user docs as the normal path  
- Memory: public ids only (siteKey ok if public; secretKey never)  
- LLM keys ≠ ZEXVRO keys (separate stores)

## Demo day minimum

1. Human `morph login` + `use` + `bind` on sample app  
2. LLM provider connected  
3. Morph plans + patches Gate/NFT against live APIs with user token  
4. Memory shows collection/site ids on dashboard  
5. Redeploy demo URL  

If (1) or (3) fail, Morph is still just a coding shell.
