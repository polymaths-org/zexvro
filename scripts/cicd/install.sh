#!/usr/bin/env bash
set -euo pipefail
for package in frontend services/platform-api services/nft-service/api services/agent-auth services/depin services/zk-prover labs landing/zexvro; do
  npm ci --prefix "$package" --legacy-peer-deps --no-audit --no-fund
done
npm ci --prefix labs/spacetimedb --no-audit --no-fund
