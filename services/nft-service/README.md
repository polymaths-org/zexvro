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
without AWS credentials. Its content-addressed HTTP metadata is only for
development. Production media uses AWS S3 (`NFT_STORAGE_MODE=s3`,
`NFT_S3_BUCKET`, optional `NFT_CDN_BASE_URL`). Pinata (`NFT_STORAGE_MODE=pinata`)
is optional legacy IPFS only.

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
development. `STELLAR_SPONSOR_SECRET`, AWS credentials (for S3), optional
`PINATA_JWT`, and `NFT_COLLECTION_WASM_HASH` stay server-side. The service starts
without chain credentials but returns an explicit `503` for chain operations.

The frontend uploads collection media, deploys through the authenticated API,
and lists live or failed workspace records. Older browser-local drafts remain
visible in a separate migration section and are never presented as deployed.

## Signed-in smoke runbook

Use this to prove the local NFT product loop. Do not treat a successful smoke as a production claim.

### Prerequisites

1. Root env: `cp .env.example .env` (set Cognito public IDs; leave secrets out of git).
2. Local Stellar CLI identity `zexvro-provider` funded on testnet (or set `STELLAR_SPONSOR_SECRET`).
3. `NFT_COLLECTION_WASM_HASH` set (defaults in root `.env.example`).
4. Browser access to the configured Cognito user pool.

### Start services

```bash
npm run dev
```

- NFT API: `http://127.0.0.1:4101/health`
- Frontend: `http://127.0.0.1:3000` (Vite may pick the next free port)

### API harness

```bash
npm run nft:smoke
```

Optional authenticated list check (Cognito **access** token, not ID token):

```bash
NFT_SMOKE_ACCESS_TOKEN='<cognito-access-token>' \
NFT_SMOKE_WORKSPACE_ID='default' \
npm run nft:smoke
```

The harness fails when `/health` is down. It reports `stellarConfigured` / `storageMode` and skips authenticated routes when no token is provided.

### Browser loop

1. Sign in at `/dashboard`.
2. Open a project NFT screen: `/dashboard/w/<workspaceId>/p/<projectId>/nft`.
3. **New collection** → complete the wizard → deploy.
4. On a live collection, open primary sale setup:
   - Local sponsor owner: prepare may auto-submit and mark the sale live.
   - Other owners: prepare returns a transaction; use **Sign with wallet** (Freighter) then submit.
5. Open the public page (`/nft/collections/<collectionId>`).
6. Enter buyer address (or connect wallet) → **Prepare checkout** → **Sign & submit** with the buyer wallet.
7. Confirm only after a Stellar transaction hash is returned as `confirmed`.

### Known manual gates

- Cognito browser sign-in cannot be automated without secrets in CI.
- Freighter must be installed for non-sponsor signing.
- Buyer needs testnet USDC for live checkout settlement.
- S3 mode requires `NFT_STORAGE_MODE=s3` and `NFT_S3_BUCKET` (IAM role or default AWS credential chain).
- Pinata mode is optional legacy and requires `NFT_STORAGE_MODE=pinata` and `PINATA_JWT`.

## AWS S3 media storage

Production media and pinned collection JSON objects use S3. Local mode remains
for single-process development. DynamoDB stores multi-instance API records
(collections/inventory/checkout), not image bytes.

## DynamoDB repository

Default local persistence is a JSON file (`NFT_REPOSITORY=file`). For multi-instance
hosts, set `NFT_REPOSITORY=dynamo` and provision a single-table design:

| Attribute | Purpose |
| --- | --- |
| `pk` / `sk` | Primary key |
| Collection | `pk=COLLECTION#<id>`, `sk=META` |
| Minted item | `pk=COLLECTION#<id>`, `sk=TOKEN#000000000007` |
| Checkout intent | `pk=CHECKOUT#<id>`, `sk=META` |
| GSI `workspace-index` | `gsi1pk=WORKSPACE#<id>`, `gsi1sk=COLLECTION#<createdAt>#<id>` |
| GSI `idempotency-index` | `gsi2pk=IDEMPOTENCY#<key>`, `gsi2sk=CHECKOUT` |

Checkout claim uses a conditional update (`status=pending_signature` and not expired)
so concurrent submitters cannot double-claim the same intent.

Env: `NFT_DYNAMO_TABLE` (default `zexvro-nft`), `NFT_DYNAMO_REGION`,
`NFT_DYNAMO_GSI_WORKSPACE`, `NFT_DYNAMO_GSI_IDEMPOTENCY`. CI uses mocked Dynamo
clients; live table creation is an ops gate.

## Managed sponsor secret (production)

Local `npm run dev` may inject `STELLAR_SPONSOR_SECRET` from Stellar CLI identity
`ZEXVRO_STELLAR_IDENTITY` when the env var is empty. Hosted/production must not
rely on CLI identity.

- When `NODE_ENV=production` **or** `NFT_REQUIRE_SPONSOR=1`, startup **fails fast**
  unless both `STELLAR_SPONSOR_SECRET` and `NFT_COLLECTION_WASM_HASH` are set.
- Inject the secret from **AWS Secrets Manager** (or SSM) into the task/container
  environment; never bake secrets into images or git.
- `/health` reports `stellarConfigured` only when both sponsor secret and WASM hash
  are present. Logs never print the secret.

Example Secrets Manager → ECS task definition (concept):

```json
"secrets": [
  {
    "name": "STELLAR_SPONSOR_SECRET",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:zexvro/nft/sponsor-secret"
  }
]
```

Also set plain env: `NODE_ENV=production`, `NFT_COLLECTION_WASM_HASH=...`,
`NFT_STORAGE_MODE=s3`, `NFT_REPOSITORY=dynamo` as appropriate.

### Env

| Variable | Role |
| --- | --- |
| `NFT_STORAGE_MODE` | `local` (default example), `s3` (production media), or `pinata` (legacy) |
| `NFT_S3_BUCKET` | Required for `s3` mode |
| `NFT_S3_REGION` | AWS region (default `us-east-1`) |
| `NFT_CDN_BASE_URL` | Optional CloudFront/custom HTTPS base for public object URLs |
| `NFT_REQUIRE_SPONSOR` | Force sponsor gate (`1`/`true`) or opt out of production gate (`0`/`false`) |
| `STELLAR_SPONSOR_SECRET` | Server-side only; required when sponsor gate is on |
| `NFT_COLLECTION_WASM_HASH` | Required with sponsor secret for chain ops / production gate |
| `PINATA_JWT` | Optional legacy only |
| Collection `baseMetadataUri` | Optional for local/s3 (API can auto-serve token metadata). Required for pinata: `ipfs://.../` |

Never commit AWS keys, JWTs, or sponsor secrets. Prefer IAM roles in hosted environments.
`/health` reports `storageMode`, `pinningConfigured`, and `stellarConfigured` without secrets.

### Unit / CI (mocked S3 + Pinata)

```bash
npm --prefix services/nft-service/api test
```

`s3Pinning.test.ts` covers CDN URI, regional S3 URI, and upload failure mapping.
Legacy `pinning.test.ts` still covers Pinata success/failure paths.

### Smoke

```bash
npm run dev:nft
npm run nft:smoke
```

For a real S3 upload, set `NFT_STORAGE_MODE=s3`, `NFT_S3_BUCKET`, AWS credentials
or role, restart the API, then upload cover media from the dashboard or
authenticated `POST /v1/media`. Record the resulting HTTPS URI/key in
`memory.md`; never record credentials.

