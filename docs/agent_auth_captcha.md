# ZEXVRO Gate — Self-hosted multi-type CAPTCHA

## What it is

Human-channel ceremony that issues a rotating puzzle, verifies the answer **only on the server**,
then mints a short-lived **class=human** capability via `proofType: captcha_pass`.

Agents **never** use this path. Agents use registered Ed25519 + challenge sign + PoP.

## Honesty

- Stops casual automation (naive Playwright click scripts).
- Does **not** stop paid captcha farms or advanced CV forever.
- `ceremony_strength` / conf for captcha is mid-range (`~0.55`), not marketed as perfect detection.

## Photo bank

- **Verified only:** `services/agent-auth/captcha-assets/verified/`
- Engine loads `verified/manifest.json` exclusively (no unverified live label dirs).
- Image challenges never fall back to SVG tiles; shortfall falls back to `text_distorted`.

## Types (12)

| Type | Interaction | Notes |
| --- | --- | --- |
| image_select | multi-select 3×3 matching reference | verified photos + compact reference thumb |
| image_grid | denser multi-select (same builder) | alias of image_select style |
| text_distorted | type warped characters | SVG glyph, typo-tolerant |
| rotate | rotate SVG upright | lenient tolerance |
| slider_align | align piece to slot | SVG track |
| odd_one_out | pick the tile that does not belong | 3×3 verified |
| pair_match | select two matching squares | verified |
| label_pick | one photo → pick class from 4 labels | verified |
| count_objects | count tiles matching the reference | off-by-one allowed when count ≥ 3 |
| photo_rotate | rotate a real photo upright | verified photo |
| binary_pick | pick which of two photos matches example | verified |
| majority_select | select all tiles of the majority class | soft near-miss scoring |

## API

1. `POST /v1/challenges` `{ channel: "human", ... }`
2. `POST /v1/challenges/:id/captcha` `{ siteKey, preferredType? }`
3. `GET /v1/challenges/:id/captcha/assets/:path?siteKey=`
4. `POST /v1/challenges/:id/captcha/answer` `{ siteKey, value }`
5. `POST /v1/challenges/:id/complete` `{ proofType: "captcha_pass", proof: captchaId }`

## Sample page

Local demo (sample third-party site look):

```bash
npm run dev:agent-auth
# open http://localhost:4103/demo/captcha
```

Demo site key: `zk_test_demo_public` (see Gate demo-keys).

## SDK

```js
import { protectWithCaptcha } from '@zexvro/gate/captcha'

await protectWithCaptcha({
  apiBase: 'http://localhost:4103',
  siteKey: 'zk_test_demo_public',
  action: 'checkout',
  mode: 'modal', // fixed ~360×456 popup
})
```

## Operator curation

- UI: `http://localhost:4103/demo/curate`
- CLI: `python3 scripts/curate_batch.py prepare <label>` → `accept` → `publish`
- Publish refreshes `verified/manifest.json` only (no live root copies).


## Security (honest)

Captcha is **casual-bot friction**, not farm-proof and **not request-bound**.

Hardened against trivial script bypasses:

- Rotate/photo_rotate: server only trusts **relative** `degrees` (ignores client `displayDegrees`)
- Slider: track SVG does **not** paint the secret offset
- Text: bitmap glyphs (no scrapeable answer `<text>`)
- preferredType: production ignores client force of ultra-easy types; re-issue budget per challenge
- Assets require `siteKey`; `captcha_pass` proof must equal solved `captchaId`
- Exact tile-set / exact count scoring (no half-correct free pass)

Still not claimed: farm-proof, CV-proof, equivalent to WebAuthn, request-bound Pop.

Agents never use captcha (Ed25519 + PoP only).


## LLM browser demo (product QA — not Gate agent channel)

Shows a **website bot** (Playwright + optional vision LLM) opening `/demo/captcha`.
This is **not** the ZEXVRO Gate agent path (Ed25519 + PoP). Do not confuse the two in marketing.

```bash
export CODEXIN_API_BASE=https://api.codexin.lol/v1
export CODEXIN_API_KEY=...   # never commit
export CODEXIN_MODEL=grok-4.5
npm run dev:agent-auth   # terminal 1
npm run gate:captcha-llm-demo
```

Artifacts: `/tmp/zexvro-captcha-llm-demo/` (screenshot + plan + analysis + report).


**Naming:** “agent demo” / “agent channel” = registered keys + PoP only. `gate:captcha-llm-demo` is human-channel bot QA, never an agent demo.

## Dual-channel merchant demo (what “agent” means)

Sample developer website protected by Gate:

- UI: `http://localhost:4103/demo/site`
- Human checkout: captcha / human ceremony (`checkout.submit`, human_only)
- Agent search: registered key + PoP (`search.query`) — **no captcha UI**

Autonomous agent (Node):

```bash
npm run dev:agent-auth
npm run gate:agent-site-demo
```

This proves the product path for agents: crypto channel through a Gate-protected website, not browser captcha solving.

## Local demo

- Human playground: `http://localhost:4103/demo/captcha`
- Merchant site (human checkout + agent search): `http://localhost:4103/demo/site`
- Walkthrough: [`agent_auth_local_demo.md`](./agent_auth_local_demo.md)
- Checklist: `npm run gate:demo`
- Autonomous agent: `npm run gate:agent-site-demo`
- Optional vision-LLM human-channel QA (env keys only): `npm run gate:captcha-llm-demo`

