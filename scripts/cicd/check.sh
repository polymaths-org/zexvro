#!/usr/bin/env bash
set -euo pipefail
bash scripts/cicd/lint-workflows.sh
node --test test/cicd/*.test.mjs
npm run test:non-morph
for package in frontend services/platform-api labs; do
  if [[ "$package" == services/platform-api ]]; then npm --prefix "$package" run check; else npm --prefix "$package" run lint; fi
done
for package in services/nft-service/api services/agent-auth services/depin; do
  npm --prefix "$package" run lint
  npm --prefix "$package" run build
done
bash scripts/cicd/check-labs.sh
npm --prefix labs run build:web
npm --prefix landing/zexvro run lint
npm --prefix landing/zexvro run build
# Compile/test contracts locally; no wallet, RPC transaction or deployment.
CARGO_BUILD_JOBS=2 cargo test --manifest-path services/nft-service/Cargo.toml --locked
CARGO_BUILD_JOBS=2 cargo test --manifest-path zer0-pool/Cargo.toml --locked
