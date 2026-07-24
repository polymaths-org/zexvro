#!/usr/bin/env bash
# Optional: redeploy testnet pools with new initialize(token) signature.
# Existing testnet pools keep working; only needed for fresh testnet installs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
IDENTITY="${STELLAR_IDENTITY:-zexvro-privacy}"
NETWORK="${NETWORK:-testnet}"
TESTNET_SAC="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
ADMIN="$(stellar keys address "$IDENTITY")"

stellar contract build --package zer0-pool
WASM="$ROOT/target/wasm32v1-none/release/zer0_pool.wasm"
HASH="$(stellar contract upload --wasm "$WASM" --source-account "$IDENTITY" --network "$NETWORK")"
echo "wasm=$HASH"

for pair in 1:10000000 10:100000000 100:1000000000 1000:10000000000; do
  XLM="${pair%%:*}"; ST="${pair##*:}"
  CID="$(stellar contract deploy --wasm-hash "$HASH" --source-account "$IDENTITY" --network "$NETWORK")"
  stellar contract invoke --id "$CID" --source-account "$IDENTITY" --network "$NETWORK" -- \
    initialize --admin "$ADMIN" --denomination "$ST" --token "$TESTNET_SAC"
  echo "VITE_ZER0_CONTRACT_${XLM}=$CID"
done
