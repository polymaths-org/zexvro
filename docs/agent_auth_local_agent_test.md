# How to test ZEXVRO Gate agent path locally

Gate is dual-channel: **humans** solve captcha; **agents** use crypto keys + PoP.

## 0. Start Gate

```bash
cd ~/Projects/zexvro
npm run dev:agent-auth
# http://localhost:4103/health
```

Demo keys (local only):

| Field | Value |
| --- | --- |
| siteKey | `zk_test_demo_public` |
| siteSecret | `sk_test_demo_secret_do_not_use_prod` |
| siteId | `site_demo` |

```bash
curl -s http://localhost:4103/v1/admin/demo-keys | jq
```

## 1. Agent registration + capability (copy-paste)

```bash
# Generate Ed25519 keypair via Node (or use SDK)
node --input-type=module <<'JS'
import { generateAgentKeyPair, GateAgent, gateFetch } from './packages/agent-auth-sdk/src/index.js'

const keys = await generateAgentKeyPair()
console.log(JSON.stringify(keys, null, 2))

const siteKey = 'zk_test_demo_public'
const apiBase = 'http://localhost:4103'

// Register agent
const reg = await fetch(`${apiBase}/v1/admin/agents`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey,
    publicKey: keys.publicKey,
    name: 'local-test-agent',
    payMode: 'self',
  }),
})
console.log('register', reg.status, await reg.json())

const agent = new GateAgent({
  siteKey,
  apiBase,
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
})

const { capability } = await agent.obtainCapability({ action: 'search.query' })
console.log('capability class agent?', capability.slice(0, 20))

// Verify with PoP (Gate requires PoP for agents by default)
const pop = await agent.createPop({
  capability,
  htm: 'POST',
  htu: 'http://localhost:4103/v1/verify',
  body: '',
})

const verified = await fetch(`${apiBase}/v1/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability,
    action: 'search.query',
    minClass: 'agent',
    siteSecret: 'sk_test_demo_secret_do_not_use_prod',
    pop,
    expectedHtm: 'POST',
    expectedHtu: 'http://localhost:4103/v1/verify',
  }),
})
console.log('verify', verified.status, await verified.json())
JS
```

## 2. What you tell another agent (prompt)

> You are testing ZEXVRO Gate agent auth **locally**.  
> 1) Start `npm run dev:agent-auth` if not running.  
> 2) Use siteKey `zk_test_demo_public` and secret `sk_test_demo_secret_do_not_use_prod`.  
> 3) Generate Ed25519 keys with `@zexvro/gate` `generateAgentKeyPair`.  
> 4) `POST /v1/admin/agents` to register the public key.  
> 5) Obtain capability with `GateAgent.obtainCapability({ action: 'search.query' })` (channel=agent, nonce_sign).  
> 6) Call `POST /v1/verify` with capability + PoP (`X-Zexvro-Pop` fields) and `minClass: 'agent'`.  
> 7) Confirm class is `agent`. Confirm human captcha cannot mint agent class.  
> 8) Run `npm run test:agent-auth` and report pass count.

## 3. Human captcha check (contrast)

```bash
open http://localhost:4103/demo/captcha
# or curl-based automated solve is only for tests (server secrets not exposed)
npm run test:agent-auth
```

Human path: challenge → captcha → answer → `proofType=captcha_pass` → class **`human`**.  
Agent path: register key → sign challenge → PoP → class **`agent`**.

## 4. Smoke scripts

```bash
npm run agent-auth:smoke   # if present
npm run test:agent-auth
```
