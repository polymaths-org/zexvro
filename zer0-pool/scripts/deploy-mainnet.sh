#!/usr/bin/env bash
# Deploy Zer0 privacy pool ×4 tiers on Stellar mainnet.
# Requires: stellar CLI 27+, funded identity, mainnet JSON-RPC.
#
# Usage:
#   export STELLAR_IDENTITY=zexvro-privacy
#   export MAINNET_RPC_URL=https://mainnet.sorobanrpc.com   # optional
#   ./scripts/deploy-mainnet.sh
#
# Funding: deployer needs ~40–80 XLM for upload + 4 deploy + 4 init + reserves.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IDENTITY="${STELLAR_IDENTITY:-zexvro-privacy}"
RPC_URL="${MAINNET_RPC_URL:-https://mainnet.sorobanrpc.com}"
PASSPHRASE="Public Global Stellar Network ; September 2015"
# Native XLM SAC on public network
MAINNET_SAC="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
HORIZON="https://horizon.stellar.org"

# Force mainnet — shell/env often default STELLAR_RPC_URL to testnet.
export STELLAR_RPC_URL="$RPC_URL"
export STELLAR_NETWORK_PASSPHRASE="$PASSPHRASE"
unset STELLAR_NETWORK || true

ADMIN="$(stellar keys address "$IDENTITY")"
echo "==> Deployer identity: $IDENTITY"
echo "    Address: $ADMIN"
echo "    RPC:     $RPC_URL"
echo "    Pass:    $PASSPHRASE"
echo "    SAC:     $MAINNET_SAC"

NET_FLAGS=(--rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE")

# Check funding
BAL_JSON="$(curl -sS "$HORIZON/accounts/$ADMIN" || true)"
if echo "$BAL_JSON" | grep -q 'not_found\|Resource Missing'; then
  cat <<EOF

❌ Deployer $ADMIN is NOT funded on mainnet.

Send XLM to this address, then re-run:
  $ADMIN

Recommended: **50–80 XLM** (upload WASM + 4 contract deploys + init + fees + reserve).
Minimum to attempt: ~25 XLM (tight).

EOF
  exit 2
fi

XLM_BAL="$(echo "$BAL_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((b['balance'] for b in d.get('balances',[]) if b.get('asset_type')=='native'), '0'))" 2>/dev/null || echo 0)"
echo "==> Mainnet XLM balance: $XLM_BAL"
python3 - <<PY
bal = float("$XLM_BAL")
if bal < 20:
    print(f"❌ Balance {bal} XLM is too low to deploy (need ~25+ XLM). Fund $ADMIN and retry.")
    raise SystemExit(2)
if bal < 40:
    print(f"⚠ Balance {bal} XLM is tight; prefer 50+ XLM.")
else:
    print(f"✅ Balance {bal} XLM looks sufficient.")
PY

echo "==> Building optimized WASM (opt-level=z, LTO)"
stellar contract build --package zer0-pool
WASM="$ROOT/target/wasm32v1-none/release/zer0_pool.wasm"
if [[ ! -f "$WASM" ]]; then
  # alternate path some toolchains use
  WASM="$ROOT/target/wasm32-unknown-unknown/release/zer0_pool.wasm"
fi
test -f "$WASM" || { echo "WASM not found after build"; exit 1; }
ls -la "$WASM"
sha256sum "$WASM" || shasum -a 256 "$WASM"

echo "==> Uploading WASM (mainnet)"
WASM_HASH="$(stellar contract upload \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  "${NET_FLAGS[@]}" \
  --inclusion-fee 100000)"
# upload prints only the hash on last line when quiet; capture full and take last token
WASM_HASH="$(echo "$WASM_HASH" | tail -n 1 | tr -d '[:space:]')"
echo "    wasm hash: $WASM_HASH"
# Sanity: hash must look like 64 hex
if [[ ! "$WASM_HASH" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "❌ Unexpected wasm hash output: $WASM_HASH"
  exit 1
fi

# Tiers: name, denomination stroops
TIERS=(
  "1:10000000"
  "10:100000000"
  "100:1000000000"
  "1000:10000000000"
)

OUT_ENV="$ROOT/mainnet-pools.env"
: > "$OUT_ENV"
echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by deploy-mainnet.sh" >> "$OUT_ENV"
echo "VITE_SOROBAN_RPC_MAINNET=$RPC_URL" >> "$OUT_ENV"

declare -A IDS

for entry in "${TIERS[@]}"; do
  XLM="${entry%%:*}"
  STROOPS="${entry##*:}"
  echo ""
  echo "==> Deploy ${XLM} XLM tier (denomination=${STROOPS} stroops)"
  CID="$(stellar contract deploy \
    --wasm-hash "$WASM_HASH" \
    --source-account "$IDENTITY" \
    "${NET_FLAGS[@]}" \
    --inclusion-fee 100000)"
  CID="$(echo "$CID" | tail -n 1 | tr -d '[:space:]')"
  echo "    contract: $CID"
  if [[ ! "$CID" =~ ^C[A-Z0-9]{55}$ ]]; then
    echo "❌ Unexpected contract id: $CID"
    exit 1
  fi
  echo "==> Initialize ${XLM} XLM pool"
  stellar contract invoke \
    --id "$CID" \
    --source-account "$IDENTITY" \
    "${NET_FLAGS[@]}" \
    --inclusion-fee 100000 \
    -- \
    initialize \
    --admin "$ADMIN" \
    --denomination "$STROOPS" \
    --token "$MAINNET_SAC"
  IDS["$XLM"]="$CID"
  case "$XLM" in
    1) echo "VITE_ZER0_CONTRACT_MAINNET=$CID" >> "$OUT_ENV"
       echo "VITE_ZER0_CONTRACT_1_MAINNET=$CID" >> "$OUT_ENV" ;;
    10) echo "VITE_ZER0_CONTRACT_10_MAINNET=$CID" >> "$OUT_ENV" ;;
    100) echo "VITE_ZER0_CONTRACT_100_MAINNET=$CID" >> "$OUT_ENV" ;;
    1000) echo "VITE_ZER0_CONTRACT_1000_MAINNET=$CID" >> "$OUT_ENV" ;;
  esac
done

echo ""
echo "========================================"
echo " MAINNET POOLS DEPLOYED"
echo "========================================"
cat "$OUT_ENV"
echo ""
echo "Next:"
echo "  1) Append these to frontend/.env (or Pages env) and rebuild console."
echo "  2) Optionally seed anonymity: SAC-transfer XLM into each pool + deposit commitments."
echo "  3) Smoke: public Horizon fund wallet → private pay 1 XLM on mainnet."
echo "  Env file: $OUT_ENV"
echo "  Deployer: $ADMIN"
echo "========================================"
