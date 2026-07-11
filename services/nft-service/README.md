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
- `api/src/localPinning.ts`: content-addressed local media for development only.

## API

```text
GET  /health
GET  /v1/assets/:assetId
GET  /v1/public/collections/:collectionId/tokens/:tokenId
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

`/health`, local assets, and live token metadata are public. All workspace,
upload, mint, sale, and checkout routes require a Cognito access token. The API
derives storage scope from the verified token subject; a browser-provided
workspace ID cannot cross user boundaries.

Checkout intent creation requires `Idempotency-Key`. The returned value is the Stellar SDK's serialized simulated transaction. A buyer signs only the required Soroban authorization entry and returns that serialized transaction. Before submission, the API checks its source, sequence, fee, time bounds, contract, method, and arguments against the stored intent, then rebuilds the envelope with the sponsor's current sequence and signs it server-side. Sale configuration and creator minting use the same owner/minter auth-entry pattern.

The API uses a versioned local JSON repository by default. Production still needs shared persistence and authenticated workspace authorization.

## Local testnet runtime

Preferred root workflow:

```bash
cp .env.example .env
npm run dev
```

The root command starts the NFT API and frontend together. If
`STELLAR_SPONSOR_SECRET` is empty, it reads `ZEXVRO_STELLAR_IDENTITY`
(`zexvro-provider` by default) from Stellar CLI at runtime and passes the secret
only to the API process.

The testnet collection WASM is installed with hash
`a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad`.
The service-local command still works when you need to run only the API:

```bash
cd services/nft-service/api
STELLAR_SPONSOR_SECRET="$(stellar keys secret zexvro-provider)" \
NFT_COLLECTION_WASM_HASH=a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad \
NFT_STORAGE_MODE=local \
npm run dev
```

Local mode lets the frontend exercise real upload and testnet deployment
without a Pinata credential. Its content-addressed HTTP metadata is only for
development and must not be described as IPFS. Set `NFT_STORAGE_MODE=pinata`,
provide `PINATA_JWT`, and provide an `ipfs://.../` token metadata base URI for
production-style storage.

In another terminal, start the browser application:

```bash
cd frontend
npm run dev
```

Open `http://127.0.0.1:3000/dashboard`, sign in through the configured
Cognito pool, and use **New collection**. The Vite proxy forwards `/api/nft`
to port `4101`; sponsor credentials never enter the browser.

## API commands

```bash
cd services/nft-service/api
npm install
npm run lint
npm test
npm run build
npm start
```

Copy values from the repository-root `.env.example` into root `.env` for local
development. `PINATA_JWT`, `STELLAR_SPONSOR_SECRET`, and
`NFT_COLLECTION_WASM_HASH` stay server-side. The service starts without chain
credentials but returns an explicit `503` for chain operations.

The frontend uploads collection media, deploys through the authenticated API,
and lists live or failed workspace records. Older browser-local drafts remain
visible in a separate migration section and are never presented as deployed.
