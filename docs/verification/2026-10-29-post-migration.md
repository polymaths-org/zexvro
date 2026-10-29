# Post-migration verification — 2026-10-29

Status: **verification complete; external integration blockers remain**. User requested all ZEXVRO functionality tested with mocks,
including non-D1 services, explicitly excluding Morph. No real payments or chain
mutations are part of this acceptance run. No commits were requested.

## Critical finding: legacy Zer0 pools

The legacy circuit and checked-in Soroban pool were tested with a real Groth16 proof
and local fake token balances. The test reproduced both an unfunded commitment
withdrawing prefunded tokens and a proof usable with an arbitrary recipient.
See `zer0-pool/contracts/zer0-pool/src/test.rs` and the public test fixture (fixed fake
secret/nullifier inputs, not user credentials). The old test command discovered zero
tests because its obsolete hello-world module was disconnected.

New funding is paused in `frontend/src/lib/poolSafety.ts` and the standalone prover's
settlement endpoint. Notes and withdrawal functions are retained for recovery. Do not
remove this gate until atomic token funding and recipient-bound authorization/proofs
are implemented, audited, and upgraded contracts are verified. This local reproduction
does not establish the bytecode of every previously deployed contract; no contracts
were changed on-chain during testing.

## Current fixes under acceptance

- Shared console/API RBAC for project and financial record access; direct API denial
  tests for Finance, Developer, Admin, Viewer and Agent.
- Authoritative D1 workspace/roster refresh; no same-name tenant collapse, resurrected
  revoked members/invites or removed access retained from browser caches.
- Account-scoped notes, treasury, Zer0/stealth/payment state and NFT drafts. Legacy
  unscoped browser values are retained separately, never silently attached to a new
  login. Late API/note responses are discarded on account changes.
- Confirmed workspace settings/member/removal/leave/deletion; failed saves are visible
  and rejected deletes retain state. Project deletion is also confirmed remotely.
- DEDSEC Worker runtime and atomic D1 payment replay claims; native unpaid rate limits;
  no provider/payment destination invented when configuration is absent.
- Zer0 browser proof fallback/status replaces dead AWS controls. Remote compute is
  unconfigured; the standalone prover has bounded input/authentication/concurrency.
- NFT/Gate SDKs reject malformed JSON verification success; payment popup callbacks
  validate the exact source window as well as origin.
- Updated browser fixtures to D1 sessions, current Cloudflare URLs and current routes.

## Evidence so far

Baseline: frontend 106, platform 21, NFT 68, Gate 63, DEDSEC 44 tests passed.
Added: 32 non-Morph route renders passed before the later fixes; expanded native D1
suite 24 tests passed; local NFT contract 10 tests and legacy pool 5 tests passed
(the latter includes the safety reproduction); prover HTTP 6, NFT SDK 3 and Gate SDK
3 tests passed. Labs existing 8 tests and TypeScript passed after installing its
module dependency. Final acceptance totals and deployment versions are pending.

Logs are under `/tmp/zexvro-audit/`. Browser failures have retained traces in
`frontend/test-results/`; these contain disposable local/mock fixtures only.

## Acceptance checkpoint

- Reproducible `npm run test:non-morph` passed: frontend 138, native platform 24,
  NFT API 68, Gate 63, DEDSEC 49, stealth crypto 6, prover HTTP 6, SDKs 6, Labs
  backend/security/API 12. Separate Labs asset tests 3, local NFT contract 10,
  legacy pool contract 5, EDGERUN economy 6, Pixel Run 11 and legacy Python
  credits/audit helpers 12 passed. Browser acceptance: **40/40 passed**.
- Frontend, combined Worker, Labs and the three standalone service type/build
  checks passed. ESLint for NFT/Gate/DEDSEC passed. `git diff --check` passed.
- Browser tests render 32 routes and exercise current NFT wizard/studio flows,
  responsive layout, workspace rename/reload, platform-admin denial and promo
  redemption. External wallets/chains/providers are mocked; route rendering is
  not a claim that every external integration completed a real transaction.
- Labs uses its existing SpacetimeDB, not a newly reset database. Hardened cookie
  expiry, OAuth state, verified-identity admin checks, submission identity/status,
  student draft creation, and a shared Node/Pages API are covered locally. Public
  dev-login is retired. The module now requires the dedicated gateway identity or
  database owner for writes; publish only after both Pages deployments carry its
  gateway credential. Gateway credentials are outside the repo in private local
  state and Cloudflare encrypted secrets.
- Console release: `https://ab123cbc.zexvro-7oq.pages.dev` published successfully.
  D1 migration 0012 applied remotely. Worker and final Labs publication are still
  being retried after intermittent Cloudflare network failures; do not mistake
  this checkpoint for a verified completed release.
- One live smoke run confirmed signup/login, workspace/project creation, tenant
  isolation, R2 round-trip/ETag and Gate site/challenge creation, then hit network
  failure. Its exact disposable accounts/site/workspace were cleaned from D1;
  the R2 test object is being cleaned separately. A complete retry is pending.

## Remaining release limitations

New private pool funding is intentionally unavailable pending a reviewed contract
and circuit upgrade; no on-chain contracts were changed. NFT deploy/mint/checkout
needs the sponsor secret and WASM hash. Paid credits and DEDSEC settlement need a
real provider/recipient configuration. Remote proof compute and transactional
email are unconfigured. Labs' Firebase/Firestore identity-provider setup and real
OAuth callbacks require live identity acceptance beyond mock coverage. Public
SpacetimeDB table visibility is inherited; this patch restricts reducers without
resetting or silently privatizing existing tables. Morph is excluded.

### Labs remote acceptance

Main: `https://047d0fe2.labs-2w0.pages.dev`; beta:
`https://0e9f7dc3.labs-beta.pages.dev`. Both custom domains returned JSON health
200, the existing four-entry catalog 200, and retired dev-login 404. The
schema-preserving `labs-beta` module publication completed with an empty migration
plan and `--delete-data=never`. Anonymous reducer calls were rejected before data
access; the dedicated gateway reached the expected nonexistent-lab validation.
Neither check changed data. Full Labs tests now include assets: **15 passed**.

### Production platform acceptance

The full live service smoke passed using disposable accounts: signup/signin,
workspace/project creation, cross-tenant NFT denial, R2 upload/body/ETag, Gate
site isolation, real Ed25519 challenge completion, replay rejection, request-bound
proof verification, invite acceptance, Viewer write denial, starter credits and
logout. Cleanup removed its D1 records and R2 test image. See
`/tmp/zexvro-audit/live-services-curl.log`. Network retries used the same API and
ZEXVRO Wrangler profile with a temporary local HTTP transport; no authentication
was bypassed and no real chain transaction was submitted.

Three additional browser cases passed against **published console assets** with
mock API/wallet responses: NFT sale preparation, workspace rename/reload and promo
redemption. See `/tmp/zexvro-audit/published-console-browser.log`. These supplement
40 local production-build cases rather than real provider-payment verification.

### Final backend publication

Worker version `5854fdce-74d9-48ce-b5d5-275c26b3eb25` published successfully
with the hourly cleanup trigger. Production minification reduces Worker modules
from 9762 KiB to 6011 KiB (1711 KiB gzip); all 24 native tests passed again with
that configuration. Debug source maps make the multipart release upload larger
than runtime module size; earlier network failures were transfer failures. No
credentials/profile were changed to complete publication. Final deployed-runtime
acceptance is recorded in `/tmp/zexvro-audit/new-worker-final-check.log`.

The final deployed-runtime check passed: fresh account login, DEDSEC D1/shared
replay backend with truthful unconfigured-provider status, authenticated browser
proof fallback, and logout. Its disposable account was removed from remote D1.
No agent-owned dev server or browser test process remains running. The temporary
Wrangler network shim was removed; normal project release commands remain pinned
to Wrangler 4.151.0 and profile `zexvro`. No source commit/push was requested.
