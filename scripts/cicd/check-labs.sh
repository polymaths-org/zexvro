#!/usr/bin/env bash
set -euo pipefail
# Build the deployed Pages API bundle locally, without any account mutation.
node services/platform-api/node_modules/wrangler/bin/wrangler.js pages functions build labs/functions \
 --project-directory labs --outdir /tmp/zexvro-labs-functions-ci \
 --compatibility-date 2026-10-19 --compatibility-flags nodejs_compat --profile zexvro
(cd labs/spacetimedb && npx tsc --noEmit --moduleResolution bundler --module ESNext --target ES2022 --skipLibCheck src/index.ts)
