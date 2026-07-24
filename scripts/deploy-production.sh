#!/usr/bin/env bash
# Production deploy for console.zexvro.in + API Gateway Lambda.
# Usage (from repo root):
#   set -a && source .env && set +a   # optional (BREVO_API_KEY, CLOUDFLARE_API_TOKEN)
#   ./scripts/deploy-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
LAMBDA="zexvro-agent-backend"
API_URL="${VITE_API_URL:-https://qkuostruh3.execute-api.us-east-1.amazonaws.com}"
APP_URL="${VITE_APP_URL:-https://console.zexvro.in}"
NFT_URL="${VITE_NFT_API_URL:-https://iyk6idmup6.us-east-1.awsapprunner.com}"
DEPIN_URL="${VITE_DEPIN_API_URL:-https://sr9k3xpmbj.us-east-1.awsapprunner.com}"
PAGES_PROJECT="${CF_PAGES_PROJECT:-zexvro}"

ensure_table() {
  local name="$1"
  local hash="$2"
  local range="${3:-}"
  if aws dynamodb describe-table --table-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "  table ok: $name"
    return 0
  fi
  echo "  creating table: $name"
  if [[ -n "$range" ]]; then
    aws dynamodb create-table --table-name "$name" --region "$REGION" \
      --attribute-definitions AttributeName="$hash",AttributeType=S AttributeName="$range",AttributeType=S \
      --key-schema AttributeName="$hash",KeyType=HASH AttributeName="$range",KeyType=RANGE \
      --billing-mode PAY_PER_REQUEST >/dev/null
  else
    aws dynamodb create-table --table-name "$name" --region "$REGION" \
      --attribute-definitions AttributeName="$hash",AttributeType=S \
      --key-schema AttributeName="$hash",KeyType=HASH \
      --billing-mode PAY_PER_REQUEST >/dev/null
  fi
  aws dynamodb wait table-exists --table-name "$name" --region "$REGION"
}

echo "==> 0) Ensure production Dynamo tables"
ensure_table "zexvro-workspace-audit" "workspaceId" "eventKey"
ensure_table "zexvro-credits" "workspaceId" ""
ensure_table "zexvro-credit-ledger" "workspaceId" "sk"
ensure_table "zexvro-promo-codes" "code" ""
ensure_table "zexvro-promo-redemptions" "code" "workspaceId"

echo "==> 1) Package + deploy Lambda $LAMBDA"
WORKDIR="$(mktemp -d)"
cp "$ROOT/scratch_lambda/lambda_function.py" "$WORKDIR/"
cp "$ROOT/scratch_lambda/brevo_mail.py" "$WORKDIR/"
cp "$ROOT/scratch_lambda/email_templates.py" "$WORKDIR/"
cp "$ROOT/scratch_lambda/credits.py" "$WORKDIR/"
python3 -m py_compile "$WORKDIR"/lambda_function.py "$WORKDIR"/brevo_mail.py "$WORKDIR"/email_templates.py "$WORKDIR"/credits.py
python3 - <<PY
import zipfile, os
wd=${WORKDIR@Q}
out="/tmp/zexvro-agent-backend.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in ("lambda_function.py", "brevo_mail.py", "email_templates.py", "credits.py"):
        z.write(os.path.join(wd, f), f)
print("zip", os.path.getsize(out))
PY
aws lambda update-function-code \
  --function-name "$LAMBDA" \
  --zip-file "fileb:///tmp/zexvro-agent-backend.zip" \
  --region "$REGION" \
  --query 'LastModified' --output text
aws lambda wait function-updated --function-name "$LAMBDA" --region "$REGION"

echo "==> 2) Merge Lambda env (production defaults + credits/audit/platform)"
python3 - <<'PY'
import json, os, secrets, subprocess
region = os.environ.get("AWS_REGION", "us-east-1")
cur = json.loads(subprocess.check_output([
    "aws", "lambda", "get-function-configuration",
    "--function-name", "zexvro-agent-backend",
    "--region", region,
    "--query", "Environment.Variables",
    "--output", "json",
])) or {}
cur.update({
    "FRONTEND_URL": os.environ.get("FRONTEND_URL") or "https://console.zexvro.in",
    "MAIL_ASSET_BASE_URL": os.environ.get("MAIL_ASSET_BASE_URL") or "https://console.zexvro.in",
    "MAIL_PROVIDER": os.environ.get("MAIL_PROVIDER") or "brevo",
    "BREVO_SENDER_EMAIL": os.environ.get("BREVO_SENDER_EMAIL") or os.environ.get("INVITE_SOURCE_EMAIL") or "noreply@zexvro.in",
    "BREVO_SENDER_NAME": os.environ.get("BREVO_SENDER_NAME") or "ZEXVRO",
    "INVITE_SOURCE_EMAIL": os.environ.get("INVITE_SOURCE_EMAIL") or os.environ.get("BREVO_SENDER_EMAIL") or "noreply@zexvro.in",
    "PAYROLL_TAXONOMY_TABLE": os.environ.get("PAYROLL_TAXONOMY_TABLE") or "zexvro-payroll-taxonomy",
    "AUDIT_TABLE": os.environ.get("AUDIT_TABLE") or "zexvro-workspace-audit",
    "CREDITS_TABLE": os.environ.get("CREDITS_TABLE") or "zexvro-credits",
    "CREDIT_LEDGER_TABLE": os.environ.get("CREDIT_LEDGER_TABLE") or "zexvro-credit-ledger",
    "PROMO_CODES_TABLE": os.environ.get("PROMO_CODES_TABLE") or "zexvro-promo-codes",
    "PROMO_REDEMPTIONS_TABLE": os.environ.get("PROMO_REDEMPTIONS_TABLE") or "zexvro-promo-redemptions",
    "CREDITS_STARTER_GRANT": os.environ.get("CREDITS_STARTER_GRANT") or cur.get("CREDITS_STARTER_GRANT") or "100",
    "PLATFORM_ADMINS": os.environ.get("PLATFORM_ADMINS") or cur.get("PLATFORM_ADMINS") or "nabil,paris,rushi,talib,n4bi10p",
})
if os.environ.get("BREVO_API_KEY"):
    cur["BREVO_API_KEY"] = os.environ["BREVO_API_KEY"]
if not (cur.get("INTERNAL_CREDITS_SECRET") or "").strip():
    cur["INTERNAL_CREDITS_SECRET"] = os.environ.get("INTERNAL_CREDITS_SECRET") or secrets.token_urlsafe(32)
open("/tmp/lambda-env.json", "w").write(json.dumps({"Variables": cur}))
print("FRONTEND_URL", cur.get("FRONTEND_URL"))
print("has_brevo", bool(cur.get("BREVO_API_KEY")))
print("has_internal_secret", bool(cur.get("INTERNAL_CREDITS_SECRET")))
print("PLATFORM_ADMINS", cur.get("PLATFORM_ADMINS"))
print("CREDITS_STARTER_GRANT", cur.get("CREDITS_STARTER_GRANT"))
PY
aws lambda update-function-configuration \
  --function-name "$LAMBDA" \
  --region "$REGION" \
  --timeout 60 \
  --memory-size 256 \
  --environment "file:///tmp/lambda-env.json" \
  --query 'LastModified' --output text
aws lambda wait function-updated --function-name "$LAMBDA" --region "$REGION"

echo "==> 3) Build frontend for production"
cd "$ROOT/frontend"
export VITE_API_URL="$API_URL"
export VITE_APP_URL="$APP_URL"
export VITE_NFT_API_URL="$NFT_URL"
export VITE_DEPIN_API_URL="$DEPIN_URL"
npm run build

echo "==> 4) Deploy Cloudflare Pages ($PAGES_PROJECT)"
if command -v npx >/dev/null 2>&1; then
  npx wrangler pages deploy dist \
    --project-name="$PAGES_PROJECT" \
    --branch=main \
    --commit-dirty=true
else
  echo "ERROR: npx/wrangler not available"
  exit 2
fi

echo "==> 5) Production smoke"
curl -sS -o /dev/null -w "console %{http_code}\n" "$APP_URL/"
curl -sS -o /dev/null -w "api workspaces (no auth) %{http_code}\n" "$API_URL/api/workspaces"
curl -sS -o /dev/null -w "api platform/me (no auth) %{http_code}\n" "$API_URL/api/platform/me"
curl -sS -o /dev/null -w "api credits path (no auth) %{http_code}\n" -X POST "$API_URL/api/workspaces/ws_smoke/credits/validate-promo" -H 'Content-Type: application/json' -d '{"code":"X"}'
curl -sS -o /dev/null -w "invite accept route %{http_code}\n" "$APP_URL/invite/accept"
curl -sS -o /dev/null -w "nft health %{http_code}\n" "$NFT_URL/health" || echo "nft health skip"
echo "DONE — hard refresh https://console.zexvro.in"
echo "  Credits: /dashboard/w/<id>/credits"
echo "  Platform: /dashboard/platform"
echo "  Lambda: $LAMBDA ($REGION)"
