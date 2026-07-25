# ZEXVRO Marketing Kit

Shareable brand + motion + pitch pack. Rebuild `marketing.zip` from the recipe in `context.md` → **Marketing Surfaces**.

## Positioning

| Field | Value |
| --- | --- |
| Name | ZEXVRO |
| Category | Unified Web3 PaaS |
| One sentence | ZEXVRO helps teams move Web2 products onto private, verifiable, agent-ready Web3 infrastructure. |
| Product style | Clean, simple, professional — Vercel/Cloudflare clarity, Stellar rails where needed |
| Not | Crypto wallet UI, token casino, multi-chain hype |

## Five MVP services

| Service | One-liner | Status language (safe) |
| --- | --- | --- |
| **Zer0** | ZK privacy for business payments | Product UI complete; ops/protocol follow-ups |
| **Morph** | Web2 → Web3 transformation agent (CLI + web) | In progress — CLI exists; agentic/demo remaining |
| **REQWID** | Human vs agent classification SDK/API | Planned |
| **NFTo** | Deploy/sell NFTs without chain complexity | Product UI complete; ops smoke as needed |
| **DEDSEC** | x402 paid access gateway for APIs & compute | In progress — unpaid path live; expansion Proposed |

**Out of MVP:** A2A Trade (do not list as a core service).

## Surfaces in repo

| Path | What |
| --- | --- |
| `landing/zexvro/` | Standalone landing (hero, services, team, waitlist) |
| `frontend/src/marketing/` | In-app welcome + brand intro |
| `frontend/public/marketing/` | Product cinema, loaders, hero still |
| `presentation/` | `ppt/` decks · `video/` masters · `demo-video/` previews · `imp/` sources |
| `assets/brand/` | Logo lockups |
| `design.md` → Marketing Design | Visual rules for landing vs app |
| `context.md` → Marketing Surfaces | Product-aligned messaging + kit recipe |

## Kit folder layout (`marketing.zip`)

```text
zexvro-marketing-kit/
  README.md                 # this brief
  brand/                    # logo.png, logo2.png, typo-logo.png, brand-design.png
  motion/                   # cinema mp4/gif/webp for product + social
  presentation/             # video masters + demo-video previews + ppt + imp sources
  landing-dist/             # static build of landing (open index.html / host as static)
  docs/                     # design.md, marketing.md, README.md snapshots
```

## Motion inventory (product)

| File | Use |
| --- | --- |
| `watermark-removed-Brand_intro_animation_logo_assembly_*.mp4` | Brand intro |
| `Platform-bootup.mp4` | Platform boot cinema |
| `mission-brief_gwr_video_mvp.mp4` | NFTo create mission brief |
| `NFT-fuleing_gwr_video_mvp.mp4` / `NFT-Assemble_gwr_video_mvp.mp4` | Optional multi-stage NFTo cinema |
| `NFT_Launch.mp4` | NFTo launch finale |
| `zexvro-laoding-ani-nobg.gif` / `ZEXVRO-loding-ani.gif` | Loaders |
| `zexvro-renaissance-hero.webp` | Legacy hero still (optional) |

## Presentation exports

Prefer sharing:

- `IMG_1817_pro.mp4` + `IMG_1817_pro_preview.mp4`
- `IMG_1817_cinema_preview.mp4` (full cinema is large)
- `*_preview_sheet.jpg`
- `img1817_transcript.json`

Full multi-variant masters stay in `presentation/` locally.

## Copy do / don’t

**Do:** private, verifiable, agent-ready, Web2→Web3, developer platform, USDC/Stellar when chain-specific, status-honest. Use product names Zer0, Morph, REQWID, NFTo, DEDSEC.

**Don’t:** guaranteed bot detection, multi-chain v1, “DEDSEC fully shipped,” token speculation as the story, secrets in public packs, marketing A2A as MVP.

## Contacts / ownership

- Landing demos + marketing polish: Paris
- Morph transformation demo: Morph track
- Service accuracy: service owners in `context.md`

## Rebuild zip

See `context.md` → Marketing kit (`marketing.zip`). Output is gitignored (`*.zip`).
