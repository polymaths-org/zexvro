# ZEXVRO Gate — Developer Guide (one page)

## What it is

A **dual-channel access gate**: humans and agents prove themselves differently, then receive a short-lived **capability** bound to an **action** and **class**. You choose policy per action (`human_only` / `agent_only` / `either`).

Not a traffic-light CAPTCHA. Agents are first-class when you allow them.

## 5-minute setup

```bash
# 1) Run Gate
npm run dev:agent-auth   # http://localhost:4103

# 2) Demo keys
curl -s http://localhost:4103/v1/admin/demo-keys | jq
```

### Browser (human)

```js
import { BrowserGate } from '@zexvro/gate/browser' // session_pop (preferred)

const gate = new BrowserGate({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
})
const { capability } = await gate.protect({
  action: 'checkout.submit',
  origin: location.origin,
})
await fetch('/api/checkout', {
  headers: { 'X-Zexvro-Capability': capability, 'content-type': 'application/json' },
  method: 'POST',
  body: JSON.stringify(order),
})
```

Prefer browser `session_pop` via `@zexvro/gate/browser` (`BrowserGate`) in production soft path.

### Server

```js
import { verifyCapabilityRemote } from '@zexvro/gate'
// or: import { gateMiddleware } from '@zexvro/gate/middleware'

const v = await verifyCapabilityRemote({
  apiBase: process.env.GATE_API_BASE,
  siteSecret: process.env.GATE_SECRET_KEY,
  capability: req.headers['x-zexvro-capability'],
  action: 'checkout.submit',
  minClass: 'human',
  expectedOrigin: process.env.APP_URL,
})
if (!v.ok) return res.status(v.status).json(v.problem)
```

### Agent

```js
import { GateAgent, generateAgentKeyPair } from '@zexvro/gate'

const keys = await generateAgentKeyPair()
// Register keys.publicKey: POST /v1/admin/agents { siteKey, publicKey, name }

const agent = new GateAgent({
  siteKey, apiBase, publicKey: keys.publicKey, privateKey: keys.privateKey,
})
const { capability } = await agent.obtainCapability({ action: 'search.query' })
const pop = await agent.createPop({
  capability, htm: 'GET', htu: 'https://api.example/v1/search',
})
// Your origin calls /v1/verify with capability + pop

// Or one-liner:
// import { gateFetch } from '@zexvro/gate'
// await gateFetch(agent, 'search.query', 'https://api.example/v1/search')
```

## Policies

| Mode | Who passes |
| --- | --- |
| `either` | Human **or** agent (default) |
| `human_only` | Humans only |
| `agent_only` | Registered agents only |

## Security rules (read once)

1. Human UI never mints `class=agent` (and reverse).
2. Production disables string `soft_confirm`.
3. Agents need **PoP** on verify (`GATE_REQUIRE_POP=true`).
4. Capability is action-bound and short-lived.
5. `session_pop` proves key possession — **not** full liveness; WebAuthn is the hard human path.
6. Stellar claims bind **payment identity**, not humanness.

## Headers

- `X-Zexvro-Capability` — JWT  
- Pop via verify body `pop` (agents)

## Commands

```bash
npm run test:agent-auth
npm run agent-auth:smoke
npm run gate:dynamo-smoke
npm run gate:deploy-plan
```

## Full docs

- Protocol: `docs/adr-002-gate-protocol-v0.2.md`
- Ops: `docs/agent_auth_production_ops.md`
- De-pin bind: `docs/agent_auth_depin_bind.md`


## WebAuthn hard human (passkeys)

```bash
# 1) Registration options
curl -s http://localhost:4103/v1/webauthn/register/options \
  -H 'content-type: application/json' \
  -d '{"siteKey":"zk_test_demo_public","origin":"http://localhost:5173","userName":"you@app"}' | jq

# 2) Browser: navigator.credentials.create(options)
# 3) POST /v1/webauthn/register/verify with response + expectedChallenge + userId

# On protect:
# 4) POST /v1/challenges (human)
# 5) POST /v1/challenges/:id/webauthn-options
# 6) navigator.credentials.get(options)
# 7) POST complete proofType=webauthn proof=<assertion JSON>
```


## Local verification

```bash
npm run dev:agent-auth
npm run agent-auth:smoke   # human soft + session_pop + agent PoP + list agents
npm run test:agent-auth
npm run test:depin
npm run dev:stack-gate     # frontend + depin + Gate
```

Local guide: `docs/agent_auth_quickstart.md`.  
**No AWS deploy** until you approve after local testing.

## Embed captcha on a third-party page

```js
import { protectWithCaptcha, CAPABILITY_HEADER } from "../../packages/agent-auth-sdk/src/captcha.js"

const { capability } = await protectWithCaptcha({
  siteKey: "zk_test_demo_public",
  apiBase: "http://localhost:4103",
  action: "checkout.submit",
  origin: location.origin,
})

await fetch("/api/checkout", {
  method: "POST",
  headers: { "content-type": "application/json", [CAPABILITY_HEADER]: capability },
  body: JSON.stringify({ ok: true }),
})
```

Origin verifies with `gateMiddleware` (`minClass: "human"`). Agents use `GateAgent` + `gateFetch` (never captcha).

Full walkthrough: [`agent_auth_local_demo.md`](./agent_auth_local_demo.md).

