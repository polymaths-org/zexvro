---
name: nft
description: Wire ZEXVRO NFT (Stellar testnet) for ownership — skins, badges, collectibles.
compatibility: opencode
metadata:
  product: zexvro
  service: nft
---

# ZEXVRO NFT

**Base:** App Runner NFT API · override `ZEXVRO_NFT_URL`  
**Network:** `stellar:testnet` only for Morph migrations

## Health

`GET /health` → testnet + `stellarConfigured: true`

## Auth

Bearer Cognito (`ZEXVRO_ACCESS_TOKEN`) on `/v1/*`

## Wire pattern

1. Health first (`nft_health`)
2. Collection list/create when token present
3. Client: unlock on ownership / mint button
4. Cover images: HTTPS only
5. Owner = Stellar G-address

## Do not

Mainnet · sponsor secrets in git · claim mint without HTTP proof

## MCP

`nft_health`, `nft_list_collections`, `nft_create_collection`
