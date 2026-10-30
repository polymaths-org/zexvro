# Cloudflare D1 platform reset

This Worker replaces the platform data API, NFTo persistence/media storage, and Gate persistence previously hosted on AWS.
The Worker and console are deployed under profile **zexvro** / **zexvro@gmail.com**.
AWS was deleted. This is a fresh database and account reset, without historical AWS records.

- Console: https://console.zexvro.in/dashboard
- API: https://zexvro-platform-api.zexvro.workers.dev
- D1: `zexvro-platform` (`050a83ff-2404-4a75-8cf7-e2ca48644d24`, APAC), eleven additive migrations applied.
- R2: `zexvro-nft-assets` for NFT images and JSON metadata.
- Account: `ac51c31a2a40b154a68a40bd5283fae2`. Root `AGENTS.md` is authoritative.

## Fresh accounts

Register with a new username/email and a password of 12–128 characters. Previous AWS users
must register again. Passwords use salted native scrypt (`N=16384,r=8,p=5`, OWASP's 16 MiB
profile). Email is a login identifier, **not** a verified membership credential.

Signup displays a random recovery key once: save it in a password manager. Password recovery
uses that key and rotates it after use, revoking existing sessions. No email delivery is
configured and the UI does not promise emailed recovery codes. Sessions use random 256-bit
opaque tokens, stored only as SHA-256 hashes in D1. Access lasts one hour; refresh lasts
30 days and rotates both tokens atomically. Sign-out revokes all sessions for that account.
Up to ten sessions are retained per user. Authentication needs no AWS or external signing key.

Device login supports `/auth/device-code`, authenticated `/auth/activate`, and one-time
`/auth/token` consumption. Codes expire in five minutes; clients poll every ten seconds.
Only hashed device secrets are stored, and password resets invalidate pending approvals.

## Login and provisioning

Always use the **zexvro** named OAuth profile authenticated as **zexvro@gmail.com**, never the default or `tyrion-prod` profile. Verified account: `ac51c31a2a40b154a68a40bd5283fae2`. Root `AGENTS.md` is authoritative.

```sh
XDG_CONFIG_HOME=/home/wraient npx --yes wrangler@4.151.0 auth create zexvro
XDG_CONFIG_HOME=/home/wraient npx --yes wrangler@4.151.0 auth activate zexvro /home/wraient/Projects/zexvro/services/platform-api
cd /home/wraient/Projects/zexvro/services/platform-api
XDG_CONFIG_HOME=/home/wraient npx wrangler whoami
```

Verify the account is ZEXVRO's before creating resources. Then:

```sh
XDG_CONFIG_HOME=/home/wraient npx wrangler d1 list --profile zexvro
# Only create if zexvro-platform is absent; reuse the existing ID otherwise.
XDG_CONFIG_HOME=/home/wraient npx wrangler d1 create zexvro-platform --profile zexvro
```

Replace `database_id` in `wrangler.jsonc` with the returned ID; add `account_id` for the
verified account. The deployment script refuses to deploy the placeholder database.
Do not reset an existing populated D1 database. Migrations are additive.

```sh
npm ci
npm run types
npm run check
npm test
XDG_CONFIG_HOME=/home/wraient npm run db:remote
npm run deploy
```

Frontend defaults, the console CI default, and Morph’s `ZEXVRO_API_URL` fallback point to the Worker. `VITE_API_URL` can override it for local development.

## Implemented API

- Workspaces, projects, employees, payroll and taxonomy CRUD; environment switching;
  persistent team role/removal/leave; tenant-scoped audit and shared roster indexes.
- Shared memory: atomic JSON Merge Patch; user-isolated proofs/deposit notes;
  commitment deduplication and project filtering.
- Credits: atomic starter grants, server-priced consumption, idempotent ledger writes,
  nonnegative balances, bounded promo redemption and explicit platform-admin grants/promos.
  Testnet operations do not charge. Credit purchases return unavailable until a payment
  provider is configured; no payment or on-chain ownership is fabricated.
- Invitations: hashed, expiring, revocable links; recipient-bound authenticated acceptance;
  one-time consumption and token rotation on resend. Delivery is **copy/share link**;
  there is no configured email sender.
- Employee CSV/array import: at most 25 rows per atomic batch. Public waitlist registration
  is idempotent; listing it requires authenticated platform administration.
- NFTo under `/nft`: D1 collections, checkout intents, minted items and token counters;
  paginated inventory and collection lists; R2 content-addressed media/JSON uploads,
  streamed public assets and conditional ETag GETs.
- Gate under `/gate`: D1 sites, origins, policies, agents, challenges, one-time capability
  use and WebAuthn counters. Admin routes use the fresh platform sessions; site owners
  are isolated. Site secret hashes are stored and the plaintext is shown once. Signing
  uses the encrypted Worker `GATE_SIGNING_SECRET`, not a repository/default key.

Legacy platform record fields remain in JSON payloads. Ownership and workspace identity
are server-controlled. Validated client record IDs are retained for optimistic console
navigation; existing IDs cannot be overwritten across tenants. SQL triggers maintain
membership indexes transactionally. Viewer writes are rejected; only the owner can
remove a workspace or change ownership-sensitive membership.

## Sign-up gate (waitlist)

- `SIGNUPS_OPEN` (Worker var) controls public account creation. `wrangler.jsonc` ships `"false"`. `scripts/cicd/build.mjs` opens it only in the dev overlay, so the dev smoke test can still create accounts.
- While closed, `POST /auth/signup` returns 403 with a waitlist message, and `GET /api/health` reports `signupsOpen: false`. Sign-in, password recovery and existing accounts are unaffected.
- The console hides the sign-up toggle unless `/api/health` reports `signupsOpen: true`. The landing sends visitors to `#waitlist`, which posts to `POST /api/waitlist`.
- Reopening sign-ups is a release change: set the production value in `build.mjs` (or the base var) and ship it through the verified release path, not a direct deploy.

## Platform administration

The Wrangler login controls Cloudflare infrastructure. It does not create an application
account or grant platform-admin privileges. Register at the console first, then bind the
**confirmed application account ID** in `platform_admins`. Do not automatically promote an
unverified email address or a reserved username. The user's newly registered `wraient` account was explicitly assigned platform administration
on 2026-10-29; verified against its exact account ID in remote D1. This is a manual
owner assignment, not an automatic email/username promotion rule.
`/platform/me` reports the signed-in account's admin status; `/platform/credits/*`,
`/platform/promos*`, `/platform/analytics`, `/platform/workspaces` and `/platform/waitlist`
require that binding. The landing page's legacy secret-query waitlist admin is retired;
use authenticated platform administration instead.

## Remaining external setup

- **NFT chain operations:** configure the existing sponsor wallet's
  `STELLAR_SPONSOR_SECRET` and deployed `NFT_COLLECTION_WASM_HASH` as encrypted Worker
  secrets. They are currently absent. D1 records and R2 media work; contract deployment,
  minting and chain checkout are unavailable until these are supplied. Do not replace
  an existing wallet or spend funds during a database smoke test.
- **Payments:** credit purchases need a verified payment provider and settlement flow.
- **Compute:** DEDSEC is mounted at `/depin` with D1 replay protection; provider/payment
  configuration is still required. Proof generation defaults to the browser; no remote
  compute service is configured. Labs keeps its existing SpacetimeDB (no AWS dependency).
- **Legacy private pools:** new funding is paused after local contract/circuit tests
  exposed unsafe authorization. A reviewed contract/circuit upgrade and deployed-bytecode
  verification are required before reopening; existing note recovery remains available.
- **Photo CAPTCHA:** no production photo bank is bundled; Gate falls back to its text
  challenge. Agent signature/PoP verification is verified independently.
- **Email:** recovery uses the one-time saved key; invitations use copy/share links.
  Sending email requires separate provider/domain setup.
- **Historical data:** this is an authorized fresh reset. No deleted AWS records were
  recovered or imported; do not manufacture balances, private notes or ownership from
  frontend caches.

## Development and release

Root `npm run dev` uses the Cloudflare APIs by default. Explicit `--with-nft` or
`--with-agent-auth` opts into the standalone legacy development services. For the native
Worker simulation, run `npm --prefix services/platform-api run dev` and point the frontend
API variables at it. Install platform, NFT and Gate dependencies before typechecking the
combined Worker. Local secrets belong in ignored `.dev.vars`; never commit wallet/signing
keys. `wrangler types` must see the optional secret names (fake local values are sufficient).

Root `npm run deploy:cloudflare` and `npm run gate:deploy` dispatch the verified
GitHub Actions production workflow. They do not bypass tests, staging or artifact
verification. Main push heads update isolated dev; production promotion runs every
three hours or through **Production release (scheduled or deploy now)**. See
[CI/CD operations](../../docs/ci-cd.md) for setup, manual SHA selection, credentials,
release recovery and the independent Labs boundary. Archived AWS deployment scripts
are not the production path.

## Usage controls

- Native D1 binding: no Cloudflare REST call or API credential on each database operation.
- Workspace and record lookups are indexed. Record lists explicitly use the workspace index
  to prevent the planner choosing a broad primary-key scan for a small database.
- Keyset pagination: default 50, maximum 100, one extra row to detect the next page. Routine tenant lists avoid
  broad counts, full-table scans and offset pagination. Platform-admin analytics may
  aggregate explicitly; schema changes only run through migrations.
- Unchanged record/workspace writes skip audit and data updates. Memory uses a single
  atomic merge statement with a no-op predicate. Roster indexes update transactionally.
- At most 120 requests/minute per IP and authenticated user and 20 mutations/minute/user,
  using Workers rate-limit bindings before D1 access. These limits are approximate and
  per Cloudflare location; they are not a global hard spending cap or a daily quota.
- Authentication is limited to ten attempts/minute/IP and per login identity; device polling has a separate twelve/minute/secret limit.
- Core JSON bodies and cumulative per-user memory are limited to 64 KiB. NFT uploads
  are limited to one 5 MiB file, stored in R2. Notes/proofs use separate rows rather than rewriting the whole memory bag.
- NFT inventory reads use maintained counts/counters and bounded keyset pages; they do
  not poll Stellar or reconcile/write chain state on GET. Gate origin checks use an
  exact indexed lookup. Collection service queries never bootstrap full tables.
- The frontend coalesces identical reads for two seconds in a bounded, session-isolated
  memory cache, invalidated by mutations. HTTP private responses remain `no-store`.
- Hourly cleanup removes at most 1,000 expired rows per ephemeral table (sessions,
  device codes, Gate JTIs and old challenges); audit/financial history is retained.
- GET requests never initialize balances or write audit events. No shared cache contains
  user data. Private responses use `no-store` to avoid cross-user cache leaks.
- Logs sample at 5% and do not print request bodies, bearer tokens, keys, or deposit notes.

D1 Free currently includes 5 million rows read/day, 100,000 rows written/day and 5 GB
aggregate storage. Index maintenance also contributes to writes. Limits apply across the
account, and Workers has its own request/CPU limits; no design can promise unlimited use.
Inspect D1 analytics after launch, especially rows read versus returned and write volume.
Add a retention/archive policy for growing audit/ledger history once business requirements
are agreed; none is silently deleted here.

References: [pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/),
[Workers rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Verification (2026-10-29)

`npm test` applies migrations to local Wrangler D1 and runs 21 integration tests: fresh
accounts/reset/refresh/device replay, tenant permissions, member changes/cascades,
concurrent memory merges, query plans/pagination/no-op writes/body limits, concurrent
NFT allocation and checkout claiming, Gate owner/hash/replay/counter checks, R2 round
trips, credit spending and idempotency, global promo caps, recipient-bound invites,
CSV/waitlist idempotency and explicit admin grants and unauthenticated console CORS preflight. These tests use local disposable data.
NFT and Gate suites also pass (68 and 63 tests respectively). Frontend: 106 tests
across 17 files pass, with TypeScript and production builds verified.

`npm run smoke:services` tests the deployed native Worker with new disposable accounts:
tenant denial, R2 upload/stream/304, owner-isolated Gate sites, Ed25519 challenge completion
and proof-of-possession verification, replay denial, invitation acceptance/viewer denial,
credit reads/testnet exemption and logout. It deletes only its generated rows/objects.
Never use it to deploy contracts or make real payments. Core signup/login, project
creation and reload have also been exercised in the real console browser. After fixing
Gate CORS preflight, website creation, persistence after reload and logout passed there
with zero console errors.

## Non-Morph acceptance

Run `npm run test:non-morph` from the root after installing each package dependency.
Use `npm run test:non-morph:browser` to also run the production-build browser mocks.
Contract tests remain separate (`cargo test` in each contract workspace); a passing
legacy pool reproduction is evidence of the funding blocker, not certification of safety.
See `docs/verification/2026-10-29-post-migration.md` for coverage and release evidence.
