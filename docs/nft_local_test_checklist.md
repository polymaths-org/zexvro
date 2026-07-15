# NFT local browser test checklist (Nabil)

Use this after pulling latest `feature/nft-service` work (including uncommitted polish). Do **not** treat this as a production claim.

## Prerequisites

1. Root `.env` with AWS or local modes as you prefer. Current recommended AWS-backed local:
   - `NFT_STORAGE_MODE=s3`
   - `NFT_REPOSITORY=dynamo`
   - `NFT_COLLECTION_WASM_HASH=df42dfceaf2036be527561f313392cee4b756d34745d7cc5f7a1c96936543710`
2. Freighter unlocked on **Testnet**, site allowed for `http://127.0.0.1:3000`.
3. Buyer/creator wallet has testnet USDC trustline + balance for purchase.
4. Start stack: `npm run dev` (or restart if already running so new WASM hash loads).

```bash
curl -s http://127.0.0.1:4101/health | jq .
# expect storageMode matching .env; stellarConfigured true when sponsor + wasm set
```

## Studio loop

| # | Step | Pass? |
|---|---|---|
| 1 | Sign in Cognito → project → **NFT** | |
| 2 | **New collection** → upload cover → deploy | |
| 3 | Confirm Dynamo/S3 if AWS mode (optional CLI) | |
| 4 | **Configure primary sale** (USDC price) → auto-submit or Freighter | |
| 5 | **Mint token** — no manual token ID; assigned ID shown after prepare | |
| 6 | Freighter signs auth only; mint confirms | |
| 7 | Inventory shows minted count / items | |
| 8 | **Integrate SDK** modal opens; Copy code works; tabs switch | |
| 9 | Live row `</>` opens SDK with real collection UUID | |

## Public buy loop

| # | Step | Pass? |
|---|---|---|
| 1 | Open public page from dashboard Eye icon | |
| 2 | Connect Freighter (testnet) | |
| 3 | **Prepare checkout** — no token ID field; reserved token shown | |
| 4 | **Sign & submit** → confirmed hash + explorer link | |
| 5 | Wrong Freighter network → clear network mismatch error | |

## Game embed surfaces

| # | Step | Pass? |
|---|---|---|
| 1 | `/nft/embed/checkout?collectionId=<id>` loads | |
| 2 | Prepare + sign works in popup window | |
| 3 | Partner origin only works if listed in `CORS_ALLOWED_ORIGINS` | |

## De-pin (optional)

| # | Step | Pass? |
|---|---|---|
| 1 | Unpaid `curl -i http://127.0.0.1:4102/v1/nft-health` → **402** | |
| 2 | For real settle: set `OZ_API_KEY` + OZ Channels facilitator URL | |

## Notes

- Existing collections deployed with the **old** WASM hash still run old bytecode (no TTL bumps). **New** deploys after this checklist use the new hash.
- Do not commit secrets, Morph dirt, or local scratch scripts.
- When manual smoke is done, record pass/fail + any tx hashes in `memory.md` (no secrets).
