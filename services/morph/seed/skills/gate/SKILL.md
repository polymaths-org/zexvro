---
name: gate
description: Wire ZEXVRO Gate captcha on free abuse surfaces (scores, open writes, bots).
compatibility: opencode
metadata:
  product: zexvro
  service: gate
---

# ZEXVRO Gate

**Base:** `https://api.zexvro.in/gate` · override `ZEXVRO_GATE_URL`

Captcha + agent channel. Protect free abuse surfaces.

## Endpoints

- `GET /health` · `GET /status`
- SDK: `GET /v1/sdk/captcha.js`
- Admin (`ZEXVRO_GATE_ADMIN_KEY` → `x-gate-admin-key`):
  - `POST /v1/admin/sites` `{ name, allowedOrigins: string[] }`
  - Returns `siteKey` + `secretKey` (secret once — env only)

## Wire pattern

1. Create site; origin = app URL
2. Client: load SDK → captcha token before abuse-prone action
3. Server: verify secret before accepting write
4. Public config: `siteKey` + `gateApiUrl` only — never `secretKey`

## MCP

`gate_status`, `gate_list_sites`, `gate_create_site`, `zexvro_health`
