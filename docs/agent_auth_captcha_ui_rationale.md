# Captcha UI — what we keep, why, and how to improve

## Layout (current)

```
┌ Host / Protected by ZEXVRO     [N left] [×] ┐ 44px
│ [40px example]  Match this example          │ ~48px
│                 Select all squares…         │
│ ┌───┬───┬───┐                               │
│ │   │   │   │  fluid 1fr × 1fr grid         │ fills rest
│ ├───┼───┼───┤  ALL 3 rows visible           │
│ │   │   │   │                               │
│ ├───┼───┼───┤                               │
│ │   │   │   │                               │
│ └───┴───┴───┘                               │
│ [reload][info][report]     status  [Verify] │ 52px
└─────────────────────────────────────────────┘ 360×456
```

## Why each piece exists

| Element | Keep? | Why |
| --- | --- | --- |
| **Fixed modal 360×456** | Yes | Integrators need zero layout reflow; predictable embed like hCaptcha widget |
| **No soft-gate first page** | Yes (default) | Users complained; friction without value. Soft gate is **opt-in** (`softGate: true`) for low-risk only |
| **3×3 photo grid** | Yes | Industry-familiar mental model (reCAPTCHA/hCaptcha). Fluid `1fr` rows so **row 3 is never clipped** |
| **Compact reference (40px)** | Yes | Fixes “I don’t know what a hydrant looks like in *your* bank” without eating a whole card of height |
| **Photo-only tiles** | Yes | SVG icons looked fake and broke trust; bank photos only |
| **Unique photos per tile** | Yes | Prevents identical tiles / empty-feeling grids |
| **Lenient scoring** | Yes | Humans make near-misses; 8 tries / partial match keeps completion rate high |
| **Reload / Info / Report** | Yes | Competitor table stakes; stuck users need escape hatches |
| **SVG tool icons** | Yes | Unicode ↻ℹ⚑ looked “shit” / emoji-ish; stroke icons match premium zinc UI |
| **Attempts chip** | Yes | Failures felt blind; “N left” is calm feedback |
| **Shake + success check** | Yes | Instant affordance without neon toy skins |
| **Co-brand header** | Yes | Host owns the surface; ZEXVRO is quiet trust line |
| **Agent crypto path** | Yes | Product differentiator — never put agents through image puzzles |
| **Kitchen-sink types always on** | No (default) | Hero set only: image_select / odd_one_out / audio; rest via preferredType |
| **Large reference card** | No | Caused 3rd-row clip — replaced with inline 40px thumb |

## How to improve further (next)

1. **Photo QA** — human or embedding filter to drop mislabeled Kaggle crops (biggest remaining quality gap vs Google photos).  
2. **Reference always from a curated “canonical” set** — 3–5 best images per label reserved for examples only.  
3. **Dynamic modal height** — if viewport is short, shrink header copy before shrinking cells.  
4. **Selection count hint** — “Select 2–4” when multi-select (reduces guesswork).  
5. **Keyboard** — arrow keys move between tiles; Space toggles.  
6. **Dark/light host theme tokens** — inherit surface colors when host is light mode.  
7. **Lottie-free micro motion** — already CSS; keep under 300ms.  
8. **Telemetry** — which labels get the most reports → auto-demote from bank.

## What not to do

- Bring back a mandatory “confirm you’re here” page.  
- Giant reference card above the grid.  
- Emoji / toy icons in the footer.  
- Claim farm-proof security.  
- Force agents through the captcha UI.
