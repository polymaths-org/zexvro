# @zexvro/gate

Developer SDK for **ZEXVRO Gate** — dual-channel human/agent capability tokens.

Agents are first-class. Humans and agents use **different ceremonies**. Class is set only by which channel succeeds (no human→agent mint).

## Install (monorepo)

```js
import {
  GateAgent,
  verifyCapabilityRemote,
  generateAgentKeyPair,
  gateFetch,
  withCapabilityHeaders,
  CAPABILITY_HEADER,
  POP_HEADER,
} from '../../packages/agent-auth-sdk/src/index.js'
import { BrowserGate, protectWebAuthn, registerPasskey } from '../../packages/agent-auth-sdk/src/browser.js'
import { gateMiddleware } from '../../packages/agent-auth-sdk/src/middleware.js'
```

Package exports: `@zexvro/gate`, `@zexvro/gate/browser`, `@zexvro/gate/middleware`.

## Security honesty

| Path | Production security? |
| --- | --- |
| Human `Gate.protect` soft_confirm | **No** — requires `allowInsecureDev: true`; disabled on Gate when `NODE_ENV=production` |
| Human `BrowserGate` session_pop | **Ceremony key-bound**; JWT is **bearer after mint** unless origin sets `requireHumanPop` + Pop. Default maxReuse=1 |
| Human WebAuthn | **Harder human path** (passkey); still bearer after mint unless presentation binding |
| Agent Ed25519 + PoP | **Yes** for holder-of-key when `GATE_REQUIRE_POP=true`. Pass `expectedHtm/Htu/bodyHash` for **request-bound** Pop |

## Browser human (production soft path)

```js
import { BrowserGate, CAPABILITY_HEADER } from '@zexvro/gate/browser'

const gate = new BrowserGate({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  mode: 'session_pop', // default
})
const { capability } = await gate.protect({
  action: 'checkout.submit',
  origin: location.origin,
})
await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'content-type': 'application/json', [CAPABILITY_HEADER]: capability },
  body: JSON.stringify(order),
})
```

Hard human (passkey):

```js
import { registerPasskey, protectWebAuthn } from '@zexvro/gate/browser'
await registerPasskey({ siteKey, apiBase, origin: location.origin })
const { capability } = await protectWebAuthn({ siteKey, apiBase, action: 'checkout.submit' })
```

## Agent (Ed25519 + PoP)

```js
const keys = await generateAgentKeyPair()
// Register keys.publicKey via POST /v1/admin/agents

const agent = new GateAgent({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
})

// One-liner for protected origin routes
const res = await gateFetch(agent, 'search.query', 'https://api.example/v1/search', {
  method: 'POST',
  body: JSON.stringify({ q: 'hello' }),
})
```

Manual path:

```js
const { capability } = await agent.obtainCapability({ action: 'search.query' })
const pop = await agent.createPop({
  capability,
  htm: 'POST',
  htu: 'https://api.example/v1/search',
  body: JSON.stringify({ q: 'hello' }),
})
```

## Server verify / Express middleware

```js
import { gateMiddleware } from '@zexvro/gate/middleware'

app.post(
  '/api/checkout',
  gateMiddleware({
    apiBase: process.env.GATE_API_BASE,
    siteSecret: process.env.GATE_SECRET_KEY,
    action: 'checkout.submit',
    minClass: 'human',
    expectedOrigin: process.env.APP_URL,
    // For agents / request-bound Pop:
    // requirePop: true,
    // expectedHtm: true,
    // expectedHtu: true,
  }),
  (req, res) => res.json({ ok: true, class: req.gate.class }),
)
```

## Headers

- `X-Zexvro-Capability` — capability JWT  
- `X-Zexvro-Pop` — proof-of-possession (agent; optional human session)

See `docs/adr-002-gate-protocol-v0.2.md` and `docs/agent_auth_PLAN_FINAL.md`.

## Human captcha (self-hosted multi-type)

Default UX is a **fixed 360×480 modal popup** — host page layout does not change.
Image tiles use the local photo bank under `services/agent-auth/captcha-assets/` (Openverse/CC + generated).

```js
import { BrowserGate, protectAction } from '@zexvro/gate/browser'

const gate = new BrowserGate({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  mode: 'captcha',
})

// Mount widget into a DOM node
const { capability } = await gate.protect({
  action: 'checkout.submit',
  mount: document.getElementById('captcha'),
})

// Or one-liner
await protectAction({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  action: 'reward.claim',
  mount: document.getElementById('captcha'),
})
```

Types rotate among: `image_select`, `image_grid`, `text_distorted`, `rotate`,
`slider_align`, `sequence`. Assets are generated server-side (SVG).
Agents never solve captchas — use Ed25519 + PoP.

**Local demo page:** with Gate running, open http://localhost:4103/demo/captcha
