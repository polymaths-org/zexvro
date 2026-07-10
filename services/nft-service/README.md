# ZEXVRO NFT Service

Owner: Nabil / `n4bi10p`

The NFT service creates creator-controlled game-asset collections on Stellar. Each collection is a Soroban contract using OpenZeppelin's Stellar non-fungible token primitives.

## Current scope

- One contract per collection.
- Creator or delegated-minter minting.
- Standard ownership, approvals, transfers, and burning.
- Immutable `base_uri + token_id` metadata references.
- Royalty quote information, without claiming enforcement on arbitrary transfers.
- Optional fixed-price primary USDC purchase that transfers payment and mints atomically.

Secondary marketplaces, auctions, multi-chain deployment, and fiat card checkout are outside v1.

## Contract commands

```bash
cargo test --manifest-path services/nft-service/Cargo.toml
cargo fmt --manifest-path services/nft-service/Cargo.toml --check
cargo clippy --manifest-path services/nft-service/Cargo.toml --all-targets -- -D warnings
stellar contract build --manifest-path services/nft-service/Cargo.toml
```

## Layout

- `contracts/collection/`: Rust/Soroban collection contract.
- `api/src/index.ts`: generated typed client for the verified WASM interface.
- `api/src/app.ts`: media, collection, mint, and checkout HTTP routes.
- `api/src/stellarGateway.ts`: platform-sponsored envelope submission and signed auth-entry validation.
- `api/src/pinning.ts`: public-IPFS Pinata adapter.

## API

```text
POST /v1/media
POST /v1/collections
GET  /v1/collections?workspaceId=...
GET  /v1/collections/:collectionId
GET  /v1/collections/:collectionId/status
POST /v1/collections/:collectionId/sale-config/intent
POST /v1/collections/:collectionId/sale-config/submit
POST /v1/collections/:collectionId/mints/intent
POST /v1/collections/:collectionId/mints/submit
POST /v1/checkout/intents
GET  /v1/checkout/intents/:intentId
POST /v1/checkout/intents/:intentId/submit
```

Checkout intent creation requires `Idempotency-Key`. The returned value is the Stellar SDK's serialized simulated transaction. A buyer signs only the required Soroban authorization entry and returns that serialized transaction. Before submission, the API checks its source, sequence, fee, time bounds, contract, method, and arguments against the stored intent, then rebuilds the envelope with the sponsor's current sequence and signs it server-side. Sale configuration and creator minting use the same owner/minter auth-entry pattern.

The API uses a versioned local JSON repository by default. Production still needs shared persistence and authenticated workspace authorization.

## API commands

```bash
cd services/nft-service/api
npm install
npm run lint
npm test
npm run build
npm start
```

Copy values from `api/.env.example` into the runtime environment. `PINATA_JWT`, `STELLAR_SPONSOR_SECRET`, and `NFT_COLLECTION_WASM_HASH` stay server-side. The service starts without chain credentials but returns an explicit `503` for chain operations.

The frontend currently creates browser-local drafts and is not connected to these endpoints. No live testnet deployment is claimed yet.
