# ZEXVRO verified releases

This replaces direct push-to-production. Morph is excluded. Deployment eligibility
means required checks passed; it is not a claim that every external provider is
configured or that software can have no bugs.

## Operator controls

| Action | Where | Behavior |
| --- | --- | --- |
| Verify a change | Open a PR to `main` | Builds/tests all declared non-Morph services and both frozen console configurations; no deployment credentials exposed |
| Update dev | Push/merge a commit to `main` | Checks, then serialized isolated dev deployment, deployed browser/API checks and cleanup |
| Scheduled production | Every three hours, cron `17 */3 * * *` UTC | Newest eligible main ancestor, at least 30 minutes after completed staging acceptance |
| Deploy now | GitHub → Actions → **Production release (scheduled or deploy now)** → **Run workflow** → branch **main** | Blank SHA selects newest eligible release; optional full 40-character SHA selects that eligible release; skips observation delay only |
| Verify without deploying | GitHub → Actions → **Verify non-Morph (no deployment or real payments)** | Same local test/build gate; cannot publish or spend chain funds |

“Deploy now” requires the commit to have completed the dev workflow successfully.
It cannot publish an untested commit. If no eligible release exists, manual runs
fail clearly; scheduled runs leave production unchanged. There is no force or
skip-checks input. `./scripts/deploy-production.sh [full-sha]` dispatches the same
action rather than running a separate local production deployment path.

GitHub schedules can be delayed. Push events normally verify the pushed branch
head, not each individual commit included in a multi-commit push. Queues are
bounded by GitHub; an older run arriving after a newer dev release is rejected
rather than downgrading dev. Protected main and reviewing PRs remain recommended.

## Boundaries and isolation

| Surface | Dev | Production | Release handling |
| --- | --- | --- | --- |
| Console | `dev.zexvro.in` / Pages `zexvro-dev` | `console.zexvro.in` / `zexvro` | Same built JS/CSS, separately hashed public runtime configuration |
| Platform, NFTo, Gate, DEDSEC, browser-prover API | Worker `zexvro-platform-api-dev` | `zexvro-platform-api` | Packaged Worker modules; no rebuild during promotion |
| Database | `zexvro-platform-dev` | `zexvro-platform` | Separate D1 IDs; packaged migrations only |
| NFT media | `zexvro-nft-assets-dev` | `zexvro-nft-assets` | Separate R2 buckets; no production images in tests |
| Landing | `landing.dev.zexvro.in` / `zexvro-land-dev` | `zexvro.in`, `www.zexvro.in` / `land` | Same built code, target API overlay |
| Labs | Existing independent release boundary | Existing Pages/SpacetimeDB | Tests, TypeScript, Pages Functions build and frontend build are required; autonomous Labs publication is not part of this three-target promotion lane |
| On-chain contracts | Local Soroban tests only | Existing deployments | No automated contract publication or spending; legacy private-pool funding remains paused |

Labs' existing SpacetimeDB must not be reset or silently reused as a staging
write target. Giving Labs its own automatically promoted hosted stack requires a
separate isolated database/identity-provider setup and database-module release
plan. The core pipeline does not pretend to have done that.

## What blocks a release

- Test/type/lint/build failure, unexpected page exception or unsupported API call.
- Missing Cloudflare credential, wrong profile/email/account or insufficient permissions.
- Incomplete staging browser/integration tests or failed cleanup.
- Incorrect deployed revision, HTML, runtime config, entry JS/CSS, health schema or CORS.
- Missing/expired artifact, wrong workflow/run/attempt/repository/main ancestry,
  dirty source build, hash mismatch, symlink, unexpected artifact file or target binding.
- Edited/removed applied migration, unrecorded remote migration or unreconciled history.
- Downgrade/divergent commit, quarantined release, unresolved interrupted transaction,
  or failed rollback.

Known external unavailability is explicit: no chain sponsor/WASM or paid-provider
configuration is fabricated. Tests use mocked wallets/providers and disposable
native accounts/records. Production post-release smoke reads release identity,
entry assets, service health and supported-origin CORS. Staging additionally runs
all console browser cases and actual D1/R2/Gate/invite/credit integration checks.

## Artifact and recovery model

The required verification job builds once. Both public runtime configurations are
checked against the frozen console directory with an exclusive local server—no
rebuild or server reuse. The artifact manifest hashes every packaged file and binds
repository, commit, producer workflow, run ID and attempt. Successful staging adds
its deployment IDs and completion timestamp only after verifying the payload has
not changed since tests. Production selects successful main push runs and verifies
that provenance itself; it never executes deployment scripts from the artifact.

A private R2 release journal stores last-good deployment IDs, release identity,
quarantine and a separate monotonic migration ledger. The shared deployment lock
covers dev mutations and production promotion. The journal is written before
mutation. Interrupted recovery runs before production candidate selection, even
when no candidate archive remains. Failed code restores the saved Worker and
Pages production deployments; D1 is never rolled back. Applied migrations from
failed releases remain in the ledger. Uncertain migration state must be positively
reconciled with D1 before another release.

Migrations must follow expand/migrate/contract discipline and remain compatible
with the previous release. The previous application is smoke-tested after schema
changes before code replacement. A passing smoke is limited compatibility evidence,
not proof that arbitrary new triggers/constraints are safe. Destructive schema or
contract changes require a separately reviewed rollout.

Rollback failure stops promotions. Resolve the underlying outage/configuration,
verify the saved previous Worker/Pages targets and migration history, then use the
verified Cloudflare account to repair the journal; do not clear a failure flag
merely to force publication. There is intentionally no public force button.

## Authentication and one-time setup

All local Cloudflare operations remain pinned to Wrangler `4.151.0`, profile
`zexvro`, email `zexvro@gmail.com`, account
`ac51c31a2a40b154a68a40bd5283fae2`. Mutating tools verify identity first.
GitHub Actions is the one approved exception (2026-10-31). Deploy jobs use the
account-owned token `zexvro-ci-github-actions` (ID `2e37f4240ba31ad20e32facd5ca5c042`,
expires 2027-10-30) from the environment secret `ZEXVRO_CI_CLOUDFLARE_API_TOKEN` in
`development` and `production`. Its scopes: Workers Scripts, D1, Pages and R2 write,
Account Settings read, and DNS write plus Zone read on `zexvro.in`. `cloudflare.mjs`
verifies the token is active and scoped to the ZEXVRO account before any mutation.
Actions never falls back to the profile; a missing secret fails closed, and the verify
job stays credential-free with its offline placeholder profile.
Never copy a personal refresh token or the CI token into logs or source. Deploy jobs
write no profile files; only the verify job creates the offline placeholder profile.
Offline PR checks use an empty named-profile metadata file, with no credentials.

Provisioning commands, each explicitly verifying the ZEXVRO identity:

```sh
node scripts/cicd/provision.mjs
node scripts/cicd/baseline.mjs
node scripts/cicd/dev-secret.mjs
node scripts/cicd/domains.mjs
node scripts/cicd/dns.mjs
```

Provisioning is explicit, not run on each commit. It creates only isolated dev
resources and release-journal storage. Baseline adoption compares the remote
production migration filenames with the checked-in SQL before recording hashes;
it changes no schema. The dev signing secret is fresh, not copied from production.
DNS commands refuse to overwrite conflicting records. Current Wrangler OAuth
scopes cannot edit DNS (403); the CNAMEs need dashboard setup or a separately
approved scoped credential. Read the Pages project's actual subdomain before
creating either record; do not guess suffixes.

Configure `development` and `production` GitHub environments to deploy from `main`.
Keep Actions builds enabled and grant only the permissions declared by the workflows.
Do not add required human approval to `production` if unattended scheduled promotion
is desired. Disable any competing Pages/Workers Git auto-deployment; these existing
projects use direct upload. The old direct production push workflow is removed.

The previous migration/API source is still local in this checkout. Publish that
source together with the pipeline; publishing only workflow YAML would reference
files that do not exist on remote `main`. Review unrelated local changes separately.

## Usage and validation

```sh
bash scripts/cicd/install.sh
bash scripts/cicd/check.sh
bash scripts/cicd/check-labs.sh
node scripts/cicd/build.mjs
node scripts/cicd/browser.mjs
```

Artifacts have a 100 MiB raw release budget. Main verification is serialized; retain
at most three candidate archives and one checked archive, with one-/three-day expiry.
A failed check retains at most 25 MiB of recent browser evidence for one day. CI
minutes and the account's other storage usage still count; these are bounds for
this pipeline, not a promise of unlimited free use. A pruned old SHA must be built
and verified again through the normal main workflow, not force-deployed.

Workflow lint uses pinned actionlint 1.7.12, with only its outdated `concurrency.queue`
schema warning suppressed. GitHub documents `queue: max`; tests separately assert
its value and the shared non-canceling deployment lock.
