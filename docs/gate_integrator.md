# Integrate ZEXVRO Gate on your website

Public API: **`https://api.zexvro.in/gate`**

Gate issues short-lived **capabilities** after a human captcha (or agent crypto).  
Your backend checks the capability before sensitive actions.

---

## 1) Get keys (ZEXVRO console or admin API)

From the dashboard **Agent Auth / Gate → Sites**, create a site:

| Field | Who uses it |
| --- | --- |
| **siteKey** (`zk_live_…`) | Browser / frontend (public) |
| **secretKey** (`sk_live_…`) | **Your server only** — never ship to browsers |
| **allowedOrigins** | Exact origins of your site, e.g. `https://shop.example.com` |

You can add/remove origins anytime (must match browser `location.origin`).

---

## 2) Human captcha in the browser

### Option A — ES module (recommended)

```html
<script type="module">
  import { protectWithCaptcha, CAPABILITY_HEADER } from 'https://api.zexvro.in/gate/v1/sdk/captcha.js'

  const { capability } = await protectWithCaptcha({
    apiBase: 'https://api.zexvro.in/gate',
    siteKey: 'zk_live_YOUR_SITE_KEY',
    action: 'checkout.submit',
    origin: location.origin,
    mode: 'modal',
  })

  await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [CAPABILITY_HEADER]: capability,
    },
    body: JSON.stringify({ /* your payload */ }),
  })
</script>
```

### Option B — monorepo package

```js
import { protectWithCaptcha, CAPABILITY_HEADER } from '@zexvro/gate/captcha'
```

---

## 3) Verify on your server

```js
// Node / Express
const res = await fetch('https://api.zexvro.in/gate/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: req.headers['x-zexvro-capability'],
    siteSecret: process.env.GATE_SECRET_KEY,
    action: 'checkout.submit',
    minClass: 'human',
    expectedOrigin: 'https://shop.example.com',
  }),
})
const body = await res.json()
if (!res.ok || !body.ok) {
  return res.status(401).json(body)
}
// body.class === 'human'
```

Express middleware (from package):

```js
import { gateMiddleware } from '@zexvro/gate/middleware'

app.post(
  '/api/checkout',
  gateMiddleware({
    apiBase: 'https://api.zexvro.in/gate',
    siteSecret: process.env.GATE_SECRET_KEY,
    action: 'checkout.submit',
    minClass: 'human',
    expectedOrigin: process.env.APP_ORIGIN,
  }),
  (req, res) => res.json({ ok: true }),
)
```

---

## 4) Agents (optional)

Agents **do not** solve captchas. Register an Ed25519 public key:

```http
POST /v1/admin/agents
Authorization: Bearer <cognito or admin key>
{ "siteKey": "zk_live_…", "publicKey": "…", "name": "indexer" }
```

Then complete challenges with `nonce_sign` + PoP on verify. See `docs/agent_auth_DEVELOPER_GUIDE.md`.

---

## 5) Rules of the road

1. **Origin allowlist** — human challenges require `origin` ∈ site.allowedOrigins.  
2. **Class integrity** — captcha never mints `class=agent`; agents never mint human.  
3. **Captcha honesty** — stops casual bots; not farm-proof.  
4. **Secrets** — only `secretKey` calls `/v1/verify`.  
5. **CORS** — registered origins are allowed automatically for browser calls.

---

## Health

```bash
curl -sS https://api.zexvro.in/gate/health
curl -sS https://api.zexvro.in/gate/status
```
