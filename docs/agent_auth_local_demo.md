# ZEXVRO Gate — Local demo for another person

Show the **full dual-channel product** on a developer machine. No AWS.

| Channel | Who | What they do |
| --- | --- | --- |
| **Human** | Browser user | Solves self-hosted captcha → checkout works |
| **Agent** | Registered script | Ed25519 + PoP → search works; **never** captcha UI |
| **Human-channel bot QA** (optional) | Vision LLM + Playwright | Tries the captcha UI for product QA only — **not** the agent path |

## 0. One-time setup

```bash
cd /path/to/zexvro
npm --prefix services/agent-auth install
# optional dashboard
npm --prefix frontend install
```

Captcha photos live in `services/agent-auth/captcha-assets/verified/` (gitignored).
If the bank is empty, image challenges fall back where possible — prefer a machine that already has the verified bank.

## 1. Start Gate

```bash
npm run dev:agent-auth
# → http://localhost:4103
```

Optional dashboard (proxy to Gate):

```bash
npm run dev:frontend-gate
# → http://localhost:3000  → project → ZEXVRO Gate
```

Check:

```bash
curl -s http://localhost:4103/health
npm run gate:demo
```

## 2. Demo script (15 minutes)

### A. Merchant dual-channel site (core story)

Open: **http://localhost:4103/demo/site**

1. **Human checkout** — click checkout → captcha modal → succeed → API returns OK with human capability.
2. Without captcha / with an agent token → checkout must **fail** (human_only).
3. Leave agent search for the script in step B.

### B. Autonomous agent (crypto path)

```bash
npm run gate:agent-site-demo
```

Expect:

- Agent registers Ed25519 key
- Mints `class=agent` capability
- `GET /demo/site/api/search` with PoP **succeeds**
- Agent **cannot** use `captcha_pass`
- Agent **cannot** pass human checkout

This is the product “agent demo.” Do **not** call the LLM captcha bot an agent demo.

### C. Human captcha playground

Open: **http://localhost:4103/demo/captcha**

- Try types from the picker (image select, odd one out, etc.)
- Reload / report / info buttons
- Confirm tiles are fully visible (`object-fit: contain`)

### D. Smoke matrix

```bash
npm run agent-auth:smoke
npm run gate:protect-demo checkout.submit   # human_only policy path
npm run gate:protect-demo search.query
npm run test:agent-auth
```

### E. Optional — vision LLM vs human captcha (QA only)

Uses **env keys only** (never commit):

```bash
export CODEXIN_API_BASE="https://api.codexin.lol/v1"
export CODEXIN_API_KEY="…local only…"
export CODEXIN_MODEL="grok-4.5"
# or OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL

npm run gate:captcha-llm-demo
```

Report/screenshots default to `/tmp/zexvro-captcha-llm-demo`.
This exercises **human-channel** friction for bots; it is **not** how legitimate agents authenticate.

## 3. What to say while demoing

1. **Developers embed Gate** — protect any button/API with a site key + secret.
2. **Humans** get a premium captcha modal (self-hosted, mid confidence ~0.55 honesty).
3. **Agents** register a key once, then every request is challenge-signed + PoP.
4. **Class integrity** — human caps never satisfy agent_only; agent caps never satisfy human_only.
5. **Local-first** — this demo never needs AWS.

## 4. Demo keys (local)

```bash
curl -s http://localhost:4103/v1/admin/demo-keys | jq
```

| Field | Role |
| --- | --- |
| `siteKey` | Browser + agent clients (`zk_test_demo_public`) |
| `secretKey` | Origin server verify / middleware only |
| `allowedOrigins` | Must include your page origin |

## 5. Developer: add Gate to *their* site

See **[`docs/agent_auth_DEVELOPER_GUIDE.md`](./agent_auth_DEVELOPER_GUIDE.md)** and the short paste blocks below.

### Human — protect a button (browser)

```html
<script type="module">
  import { protectWithCaptcha, CAPABILITY_HEADER } from
    'http://localhost:4103/demo/site/sdk/captcha.js'
  // monorepo: packages/agent-auth-sdk/src/captcha.js

  document.querySelector('#buy').onclick = async () => {
    const { capability } = await protectWithCaptcha({
      siteKey: 'zk_test_demo_public',
      apiBase: 'http://localhost:4103',
      action: 'checkout.submit',
      origin: location.origin,
    })
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CAPABILITY_HEADER]: capability,
      },
      body: JSON.stringify({ sku: 'demo' }),
    })
    console.log(await res.json())
  }
</script>
```

### Origin server — verify capability

```js
import { gateMiddleware } from '../../packages/agent-auth-sdk/src/middleware.js'

app.post(
  '/api/checkout',
  gateMiddleware({
    apiBase: process.env.GATE_URL || 'http://localhost:4103',
    siteSecret: process.env.GATE_SECRET_KEY, // from demo-keys secretKey
    action: 'checkout.submit',
    minClass: 'human',
  }),
  (req, res) => res.json({ ok: true, class: req.gate.capability.class }),
)
```

### Agent — register once, call protected APIs

```js
import {
  GateAgent,
  generateAgentKeyPair,
  gateFetch,
} from '../../packages/agent-auth-sdk/src/index.js'

const keys = await generateAgentKeyPair()
await fetch('http://localhost:4103/v1/admin/agents', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    siteKey: 'zk_test_demo_public',
    publicKey: keys.publicKey,
    name: 'partner-bot',
  }),
})

const agent = new GateAgent({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103',
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
})

// PoP-bound request to merchant search (see /demo/site)
await gateFetch(agent, 'search.query', 'http://localhost:4103/demo/site/api/search')
```

## 6. URLs cheat sheet

| URL | Purpose |
| --- | --- |
| http://localhost:4103/health | Liveness |
| http://localhost:4103/demo/site | Merchant human + agent story |
| http://localhost:4103/demo/captcha | Human captcha playground |
| http://localhost:4103/v1/admin/demo-keys | Local siteKey / secretKey |
| http://localhost:3000 | Dashboard (with `dev:frontend-gate`) |

## 7. Out of scope for this demo

- AWS App Runner / ECR / secret rotation
- `/demo/curate` (internal image labeling only)
- Publishing `@zexvro/gate` to npm (monorepo path imports today)
