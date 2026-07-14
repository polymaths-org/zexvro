# @zexvro/nft-checkout-sdk

Web checkout helpers for the ZEXVRO NFT public purchase API.

Indie game / web integrations get **three surfaces** from one API:

| Mode | Who builds UI | Package entry |
| --- | --- | --- |
| **Popup** | ZEXVRO hosted embed | `openCheckout({ collectionId })` |
| **Custom web UI** | Game frontend | `createNftCheckoutClient` + Freighter sign |
| **Backend only** | Game server | Same public REST routes (no browser package required) |

Token IDs are **always auto-allocated** when you omit `tokenId`.

## Install (local monorepo)

```bash
# From repo root — package is private / path-based for now
# import from packages/nft-checkout-sdk/src/index.js
```

## 1) Popup (Razorpay-style)

```js
import { openCheckout } from '@zexvro/nft-checkout-sdk'

openCheckout({
  collectionId: 'YOUR_COLLECTION_UUID',
  checkoutOrigin: 'https://app.zexvro.example', // host that serves /nft/embed/checkout
  onSuccess: ({ tokenId, transactionHash }) => {
    console.log('player owns token', tokenId, transactionHash)
    // unlock in-game asset / call your game backend
  },
  onError: ({ message }) => console.error(message),
  onClose: () => console.log('popup closed'),
})
```

## 2) Headless client (custom checkout UI)

```js
import { createNftCheckoutClient } from '@zexvro/nft-checkout-sdk'

const client = createNftCheckoutClient({
  apiBase: 'https://api.example.com/api/nft',
})

const { collection, inventory } = await client.getCollection(collectionId)

// buyerAddress from Freighter getPublicKey()
const intent = await client.createCheckoutIntent({
  collectionId,
  buyerAddress,
  // tokenId omitted → API assigns next free ID
})

// Sign intent.serializedTransaction with Freighter signAuthEntry (see ZEXVRO FE stellarWallet)
const confirmed = await client.submitCheckoutIntent({
  intentId: intent.id,
  signedTransaction, // AssembledTransaction JSON after auth-entry signing
})
```

## 3) Backend-only (curl / any language)

```bash
# Health
curl -s "$NFT_API/health"

# Collection + inventory
curl -s "$NFT_API/v1/public/collections/$COLLECTION_ID"

# Create checkout (auto token id)
curl -s -X POST "$NFT_API/v1/public/checkout/intents" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"collectionId\":\"$COLLECTION_ID\",\"buyerAddress\":\"G...\"}"

# Submit after wallet signed auth entries
curl -s -X POST "$NFT_API/v1/public/checkout/intents/$INTENT_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"signedTransaction":"..."}'
```

## Notes

- Buyer pays **USDC** on Stellar testnet; ZEXVRO **sponsor** pays network fees.
- Buyer must have USDC trustline + balance ≥ sale price.
- Wallet signing is **auth entries only** (not full fee-paying envelope).
- CORS: partner origins must be allowlisted on the NFT API host.
