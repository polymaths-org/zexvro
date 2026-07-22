# ZEXVRO Gate (Agent Auth API)

**Owner:** Rushi / `Wraient`  
**Product:** Dual-channel human/agent capability gate (not a CAPTCHA)  
**Local status:** Ready for developer machine testing (`:4103`)

## Quick start (local)

```bash
# from repo root
npm run dev:agent-auth
npm run agent-auth:smoke
npm run test:agent-auth
```

- Health: `GET http://localhost:4103/health`
- Status: `GET http://localhost:4103/status`
- Demo keys: `GET http://localhost:4103/v1/admin/demo-keys` (local; Cognito-gated in production)
- List agents: `GET /v1/admin/agents?siteKey=…`
- Register agent: `POST /v1/admin/agents`

Full local guide: [`docs/agent_auth_quickstart.md`](../../docs/agent_auth_quickstart.md)

**Show someone the product:** [`docs/agent_auth_local_demo.md`](../../docs/agent_auth_local_demo.md) · `npm run gate:demo`

## Core ideas

- **Human** and **agent** channels are separate ceremonies.
- Capability JWT binds `class`, `action`, site/origin, short TTL, optional Stellar payer claims.
- Header: `X-Zexvro-Capability` · Agent PoP: `X-Zexvro-Pop`
- Humans cannot mint agent capabilities; agents cannot mint human capabilities.

## Env (local defaults)

| Variable | Default |
| --- | --- |
| `AGENT_AUTH_PORT` | `4103` |
| `AGENT_AUTH_ISSUER` | `http://localhost:4103` |
| `GATE_REQUIRE_POP` | `true` |
| `GATE_STATE_BACKEND` | `memory` |
| `GATE_ALLOW_DEV_HUMAN` | `true` (forced **false** if `NODE_ENV=production`) |

## Agent-safe edit notes

- Do not add image CAPTCHAs or claim perfect detection.
- Do not deploy or rotate production secrets without explicit user approval.
- Prefer `session_pop` / WebAuthn over `soft_confirm` for any security narrative.
