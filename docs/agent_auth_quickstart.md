# ZEXVRO Gate — Local Quickstart

Dual-channel **human / agent** capability gate. Not a puzzle CAPTCHA.  
**Local only** — no AWS required. Do not deploy until you finish testing.

## Prerequisites

- Node **≥ 22**
- From repo root: `/home/wraient/Projects/zexvro` (or your clone)

## 1. Install (once)

```bash
cd services/agent-auth && npm install
# optional frontend for dashboard:
# cd ../../frontend && npm install
```

## 2. Start Gate API

```bash
# from repo root
npm run dev:agent-auth
# → http://localhost:4103
```

Or full local stack (frontend + depin + Gate):

```bash
npm run dev:stack-gate
# frontend typically :5173, Gate :4103, depin :4102 (see script labels)
```

Vite proxies `/api/agent-auth` → `http://127.0.0.1:4103`.

## 3. Smoke (human + agent + PoP)

With Gate running:

```bash
npm run agent-auth:smoke
npm run gate:protect-demo checkout.submit   # human_only
npm run gate:protect-demo search.query      # either / agent path
npm run gate:protect-demo index.bulk        # agent_only
```

Expect JSON like:

```json
{ "health": "ok", "human": "human", "agent": "agent", "popEnforced": true }
```

## 4. Demo keys

```bash
curl -s http://localhost:4103/v1/admin/demo-keys | jq
```

| Field | Use |
| --- | --- |
| `siteKey` | Browser / agent clients |
| `secretKey` | Server `verify` / middleware only |
| `allowedOrigins` | Must match browser `origin` (includes `http://localhost:5173`) |

## 5. Protect any action (SDK)

### Human (browser — production soft path)

```js
import { BrowserGate, CAPABILITY_HEADER } from '../packages/agent-auth-sdk/src/browser.js'

const gate = new BrowserGate({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103', // or '/api/agent-auth' via Vite proxy
})
const { capability } = await gate.protect({
  action: 'checkout.submit',
  origin: location.origin,
})
await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'content-type': 'application/json', [CAPABILITY_HEADER]: capability },
  body: JSON.stringify({ /* payload */ }),
})
```

Hard human (passkey): `registerPasskey` then `protectWebAuthn` from `@zexvro/gate/browser`.

### Agent (Node)

```js
import {
  GateAgent,
  generateAgentKeyPair,
  gateFetch,
} from '../packages/agent-auth-sdk/src/index.js'

const keys = await generateAgentKeyPair()
// POST /v1/admin/agents { siteKey, publicKey: keys.publicKey, name }
const agent = new GateAgent({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
})
await gateFetch(agent, 'search.query', 'http://localhost:4103/health')
// gateFetch attaches X-Zexvro-Capability + PoP for the request URL
```

### Server (Express)

```js
import { gateMiddleware } from '../packages/agent-auth-sdk/src/middleware.js'

app.post(
  '/api/checkout',
  gateMiddleware({
    apiBase: 'http://localhost:4103',
    siteSecret: process.env.GATE_SECRET_KEY || 'sk_test_demo_secret_do_not_use_prod',
    action: 'checkout.submit',
    minClass: 'human',
    expectedOrigin: 'http://localhost:5173',
  }),
  (req, res) => res.json({ ok: true, class: req.gate.class }),
)
```

## 6. Policies (demo tenant)

| Action | Mode |
| --- | --- |
| `checkout.submit` | `human_only` |
| `search.query` | `either` |
| `index.bulk` | `agent_only` |
| `trade.execute` | `dual_path` (scopes/TTL differ by class) |

Class is set **only** by ceremony channel — humans cannot mint agent tokens and vice versa.

## 7. Dashboard

1. `npm run dev:stack-gate` (or frontend + Gate separately)
2. Open ZEXVRO Gate service in the app
3. **Overview** — status + GateProtect widget
4. **Keys** — live demo-keys, reveal secret, copy env
5. **Agents** — list/register agents against local API

## 8. Tests

```bash
npm run test:agent-auth   # Gate unit/integration
npm run test:depin        # includes capability gate composition
npm run lint:agent-auth
```

## 9. Security honesty (local)

| Path | Production-grade? |
| --- | --- |
| `soft_confirm` | **No** — dev only; off when `NODE_ENV=production` |
| `session_pop` | Ceremony key-bound; JWT bearer after mint (maxReuse=1) |
| WebAuthn | Harder human path |
| Agent Ed25519 + PoP | **Yes** when `GATE_REQUIRE_POP=true` (default) |

Optional request-bound Pop: pass `expectedHtm` / `expectedHtu` / `expectedBodyHash` into `/v1/verify`.

## 10. De-pin composition (optional local)

De-pin can require a Gate capability before payment. See `docs/agent_auth_depin_bind.md` and provider flag `requireCapability`.

## Commands cheat sheet

```bash
npm run dev:agent-auth      # Gate only
npm run dev:stack-gate      # frontend + depin + Gate
npm run agent-auth:smoke
npm run test:agent-auth
npm run test:depin
```

More detail: `docs/agent_auth_DEVELOPER_GUIDE.md`, `docs/agent_auth_PLAN_FINAL.md`, `docs/adr-002-gate-protocol-v0.2.md`.

**Deploy:** not part of local completion. Wait until you explicitly approve AWS deploy.

## Self-hosted captcha (human)

```bash
npm run dev:agent-auth
# open sample user site:
# http://localhost:4103/demo/captcha
```

Flow: challenge → `/captcha` → solve widget → `/captcha/answer` → complete `captcha_pass`.
Agents do not use captcha; use Ed25519 + PoP.

## Agent path local test

See [agent_auth_local_agent_test.md](./agent_auth_local_agent_test.md).
