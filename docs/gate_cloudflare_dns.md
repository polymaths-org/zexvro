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

**Recommended:** **Proxied** (orange) so Cloudflare terminates HTTPS for `api.zexvro.in` and forwards to the ALB on HTTP. ALB currently listens on **port 80 only**.

**Checks (before Cloudflare DNS):**

```bash
curl -sS http://zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com/health
curl -sS http://zexvro-gate-alb-672701025.us-east-1.elb.amazonaws.com/gate/health
```

**Checks (after Cloudflare DNS + proxy):**

```bash
curl -sS https://api.zexvro.in/gate/health
curl -sS https://api.zexvro.in/gate/status
```

Expected JSON includes `"status":"ok"` and `"product":"zexvro-gate"` (or service `agent-auth`).
---

## 2) `www.zexvro.in` → `https://zexvro.in` (redirect)

Landing already lives on Pages project **`land`** at apex **`zexvro.in`**.  
`www` needs a record + a redirect rule.

### A. DNS record for www

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| **CNAME** | `www` | `zexvro.in` | **Proxied** (orange cloud) |

(If Cloudflare rejects CNAME to apex, use: CNAME `www` → `land-1sa.pages.dev` Proxied.)

### B. Redirect Rule (preferred)

Cloudflare → **Rules** → **Redirect Rules** → **Create rule**:

| Field | Value |
| --- | --- |
| Rule name | `www to apex` |
| If | Hostname equals `www.zexvro.in` |
| Then | Dynamic redirect |
| Expression | `concat("https://zexvro.in", http.request.uri.path)` |
| Status | **301** |
| Preserve query string | **On** |

Or static: URL `https://zexvro.in` with status 301 (path may be dropped — prefer dynamic).

### C. Alternative: Bulk Redirect

Source: `https://www.zexvro.in/*`  
Target: `https://zexvro.in/$1`  
Status: 301  

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
