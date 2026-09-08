# Labs SpacetimeDB Migration — Beta Outcome and Executive Overview

Beta URL: https://beta.labs.zexvro.in (DNS/certificate provisioning in progress;
live now at https://f0963b25.labs-beta.pages.dev)
Database: SpacetimeDB Maincloud `labs-beta`
(c200e46355ace8187a668335cb5200baa01ea345e11422c72c0c933a05d86c80)
Date: 2026-09-09

## Outcome

Catalog reads and core writes (enroll, task verify, progress checkpoint,
completion with submission plus certificate) are served by the live
SpacetimeDB database. Firestore is no longer on the beta path. Four sample
labs are seeded. No inline image bytes exist in any migrated row: banners
and credential art resolve to hosted URLs, with Firebase Storage rules and
an upload helper shipped for future uploads.

## Measured latency (real, this session)

From the operator location (India) to Maincloud plus the Pages edge:

| Operation | Latency | Payload |
|---|---|---|
| Reducer round trip, localhost baseline | 1 to 3 ms | Under 1 KB |
| Catalog SQL on Maincloud | 0.8 s | 664 B JSON |
| Catalog via beta Pages API | 1.3 to 1.8 s | 11 KB, 4 labs |
| Lab detail via beta Pages API | 0.7 to 2.5 s | 2.8 KB |
| Enroll reducer on Maincloud | 0.9 to 4.1 s first call, ~1.8 s warm | Empty body |
| Task verify, correct answer | 0.3 to 2.3 s | Empty body, message preserved |
| Task verify, wrong answer | 0.8 to 2.1 s | Reducer message preserved in body |
| Batched completion (submission plus certificate plus counters) | 1.0 s | Empty body |
| Browser full page load, desktop and mobile | 2.3 to 2.9 s | Zero page errors |

Server-side execution inside SpacetimeDB measured 182 to 747 microseconds
per query. The remainder is TLS plus geographic round trip time plus JSON
framing. Reads from the Spacetime client cache after subscription are local
and effectively free.

## Energy estimate for 500 students on one lab

About 70 TeV per month, under 3 percent of the 2,500 TeV free tier.
Egress dominates (1.2M eV per byte); the split-table design keeps the
subscribed catalog row at 621 bytes against a 102 KB content document, a
165 times ratio. One 3 MB inline banner pushed to 500 students would cost
about 1,800 TeV per round, which is why images stay out of rows.

## User-facing impact

Catalog browsing, lab detail, task verification, enrollment, submission,
and completion all work end to end for a test user on beta. Verification
feedback preserves the exact reducer message. Browser checks on desktop
and mobile viewports pass with zero page errors. Mobile layout uses the
existing desktop-oriented design unchanged; no regression was introduced.

## Operator-facing impact

Two deploy targets: frontend via `wrangler pages deploy` to the
`labs-beta` project, database via `spacetime publish -s maincloud
labs-beta`. Beta-only test login is gated by the `LABS_ALLOW_DEV_LOGIN`
project secret and issues the same session cookie as GitHub OAuth.
Production `wrangler.jsonc` now defaults to the spacetime backend, so do
not redeploy the production `labs` project until the production cutover is
explicitly approved. Failed reducers return HTTP 530 with the message in
the body; the API layer maps these to normal pass/fail responses.

## Known beta limitations

- The `labs-beta` module permits anonymous reducer calls; only test data
  is stored. Production needs OIDC-gated reducers before real user data.
- Admin badge and idea creation reducers are not implemented in beta;
  those endpoints return explicit errors.
- The legacy express `server.ts` dev path is untouched; beta and
  production serve through Pages Functions.
- `beta.labs.zexvro.in` certificate validation was pending at writing;
  the deployment URL above serves the identical build.
