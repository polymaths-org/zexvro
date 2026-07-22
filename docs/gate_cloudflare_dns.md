# Gate + zexvro.in — Cloudflare DNS (paste these)

Public Gate URL: **`https://api.zexvro.in/gate`**

> **Hosting note (2026-07-22):** AWS App Runner is capped at **2 services** on this account (NFT + De-pin already use them). Gate runs on **ECS Fargate + Application Load Balancer** instead. Same Docker image, same API.

**ALB host (paste as CNAME target):**

```text
zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com
```

---

## 1) `api.zexvro.in` → Gate (ALB)

In Cloudflare → **zexvro.in** → **DNS** → **Add record**:

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| **CNAME** | `api` | `zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com` | **Proxied** (orange) **or** DNS only | Auto |

**Recommended:** **Proxied** (orange).

### SSL / 521 fix (required for HTTPS)

Cloudflare zone SSL mode is almost certainly **Full**. With orange proxy, CF connects to the **origin on HTTPS :443**.  
Our ALB only had **HTTP :80** → Cloudflare returns **521** (or 502).  
`http://api.zexvro.in/gate/health` works; `https://` fails until one of these:

**Option A — ACM + HTTPS on ALB (preferred)**

1. Add DNS validation CNAME (DNS only / grey cloud is fine):

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `_0626c28ed2b67b1f925689722a300545.api` | `_71e2f3f753fe32e730fc6b9868e8c14f.jkddzztszm.acm-validations.aws.` |

2. After cert is ISSUED, we attach ALB HTTPS:443 listener (cert ARN  
   `arn:aws:acm:us-east-1:290294660486:certificate/0cb98f0c-9bcf-44ee-a176-6f713b293f9e`).

**Option B — quick (zone-wide):** SSL/TLS → Overview → **Flexible**  
(browser HTTPS → CF → origin HTTP). Works with port 80 only; slightly weaker origin hop.

**Option C — scoped Flexible:** Rules → Configuration Rules → hostname `api.zexvro.in` → SSL **Flexible**.

**Checks (before Cloudflare DNS):**

```bash
curl -sS http://zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com/health
curl -sS http://zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com/gate/health
```

**Checks (after Cloudflare DNS + SSL fix):**

```bash
curl -sS https://api.zexvro.in/gate/health
curl -sS https://api.zexvro.in/gate/status
```

Expected JSON includes `"status":"ok"` and `"product":"zexvro-gate"` (or service `agent-auth`).

---

## 2) `www.zexvro.in` → `https://zexvro.in` (redirect)

Landing is Pages project **`land`** at apex **`zexvro.in`**.  
A plain DNS CNAME for `www` alone causes **522** until `www` is a **Pages custom domain**.

### A. Add custom domain on Pages (required)

1. Cloudflare → **Workers & Pages** → project **`land`**
2. **Custom domains** → **Set up a custom domain**
3. Enter **`www.zexvro.in`** and finish (CF will manage DNS)

### B. Redirect Rule (after www is on Pages)

Cloudflare → **Rules** → **Redirect Rules**:

| Field | Value |
| --- | --- |
| Rule name | `www to apex` |
| If | Hostname equals `www.zexvro.in` |
| Then | Dynamic: `concat("https://zexvro.in", http.request.uri.path)` |
| Status | **301** |
| Preserve query string | **On** |

---

## 3) Do **not** change yet

| Domain | Project | Action |
| --- | --- | --- |
| `zexvro.in` | Pages `land` | Leave |
| `console.zexvro.in` | Pages `zexvro` | Leave until Gate live + `VITE_AGENT_AUTH_API_URL` set |

---

## 4) After DNS is live

Frontend (later):

```bash
VITE_AGENT_AUTH_API_URL=https://api.zexvro.in/gate
```

Integrators:

```js
apiBase: 'https://api.zexvro.in/gate'
```

---

## Rollback DNS

- Delete CNAME `api` → App Runner host stops receiving public traffic.
- Remove www redirect rule; leave or remove `www` CNAME.
- App Runner service can be paused/deleted separately in AWS.
