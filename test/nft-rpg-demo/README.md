# ZEXVRO NFT RPG Demo

Tiny browser RPG shop used to **prove the NFT Studio + checkout SDK** end-to-end—without pulling a huge third-party game repo.

| | |
|---|---|
| Goal | Buy gear with ZEXVRO `openCheckout` → Freighter → unlock in-game |
| Stack | Vanilla HTML/CSS/JS canvas (no Phaser build) |
| SDK | Vendored from `packages/nft-checkout-sdk` → `vendor/zexvro-nft-checkout-sdk.js` |
| Live collection | `c080bf4d-ebf7-42a3-ab46-5192929d8e72` (Iron Sword / SWORD, SVG cover, 0.02 USDC sale) |
| Assets | 5 SVG items under `assets/items/` |

This is a **test harness**, not production game content.

---

## Quick start

### A) ZEXVRO platform (terminal 1)

```bash
cd /path/to/zexvro
npm run dev
```

- App: http://127.0.0.1:3000  
- NFT API: http://127.0.0.1:4101 (proxied as `/api/nft` on the app)

Restart after changing `CORS_ALLOWED_ORIGINS` so game origin `:4173` is allowed.

### B) Collection already wired

`config.js` points at the live Iron Sword collection you deployed (SVG cover + primary sale).  
To use another collection, paste a new UUID into `collectionId` / `unlockItemId`.

### C) Serve the game (terminal 2)

```bash
cd test/nft-rpg-demo
node scripts/serve.mjs
# → http://127.0.0.1:4173
```

### D) Play / buy

1. Confirm log shows `API OK · Iron Sword · sale 0.02 USDC`  
2. Mode **Popup (openCheckout)** (default)  
3. Shop → **Buy with ZEXVRO** on Iron Sword → allow popup  
4. Freighter on **Testnet**: Connect → Prepare → Sign & submit  
5. On success the sword unlocks · press **J** for slash VFX  

**Headless** mode walks `createNftCheckoutClient` + intent create (Studio sample), then hands off to popup for AssembledTransaction auth signing.

**Offline** mode unlocks localStorage only (no chain).

---

## What this validates

| Surface | Exercise |
|---|---|
| NFT Studio create/deploy/sale | Collection live + primary sale + SVG cover |
| Public API | `getCollection` probe in game log |
| `openCheckout` popup | Embed route `/nft/embed/checkout?collectionId&openerOrigin` |
| Cross-origin postMessage | Game `:4173` ← success from app `:3000` |
| Freighter network check | Wrong network should fail clearly |
| Auto token IDs | No token id field in checkout |
| CORS | `CORS_ALLOWED_ORIGINS` includes `http://127.0.0.1:4173` |
| Ownership UX | Success → unlock Iron Sword |

### Honest limitation (demo mapping)

v1 collection is **generic sequential mints** (one sale price, auto token id)—not per-SKU on-chain catalog.  
This demo maps **successful purchase** → unlock `unlockItemId` (default `iron-sword`). Other shop rows can still mint additional tokens and unlock that card for UI testing.

---

## CORS for the game origin

Root `.env` should include:

```bash
CORS_ALLOWED_ORIGINS="http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:4173,http://localhost:4173"
```

Game `apiBase` defaults to `http://127.0.0.1:3000/api/nft` (Vite proxy) to reduce CORS friction.

---

## Clear unlocks

```js
localStorage.removeItem('zexvro-nft-rpg-owned-v1')
localStorage.removeItem('zexvro-nft-rpg-owned-v1:meta')
```

---

## File map

```text
test/nft-rpg-demo/
  index.html          UI shell + mode switcher
  styles.css
  game.js             canvas RPG + shop + popup/headless
  config.js           collectionId / apiBase / checkoutOrigin / mode
  assets/catalog.js   item definitions
  assets/items/*.svg  art
  vendor/*            copy of nft-checkout-sdk
  scripts/serve.mjs   static server
  README.md           this file
```

Use together with `docs/nft_local_test_checklist.md`.
