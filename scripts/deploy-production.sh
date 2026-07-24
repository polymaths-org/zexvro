#!/usr/bin/env bash
# Production deploy for console.zexvro.in + API Gateway Lambda.
# Usage (from repo root):
#   set -a && source .env && set +a
#   export CLOUDFLARE_API_TOKEN=...   # required for Pages
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

echo "==> 2) Merge Lambda env (Brevo + console URL)"
python3 - <<'PY'
import json, os, subprocess
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
})
if os.environ.get("BREVO_API_KEY"):
    cur["BREVO_API_KEY"] = os.environ["BREVO_API_KEY"]
open("/tmp/lambda-env.json", "w").write(json.dumps({"Variables": cur}))
print("FRONTEND_URL", cur.get("FRONTEND_URL"))
print("has_brevo", bool(cur.get("BREVO_API_KEY")))
PY
aws lambda update-function-configuration \
  --function-name "$LAMBDA" \
  --region "$REGION" \
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

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo ""
  echo "ERROR: CLOUDFLARE_API_TOKEN is not set."
  echo "Create a token at https://dash.cloudflare.com/profile/api-tokens"
  echo "Then: export CLOUDFLARE_API_TOKEN=... && ./scripts/deploy-production.sh"
  echo "Build is ready at frontend/dist — deploy manually with:"
  echo "  npx wrangler pages deploy frontend/dist --project-name=$PAGES_PROJECT --branch=main"
  exit 2
fi

echo "==> 4) Deploy Cloudflare Pages ($PAGES_PROJECT)"
npx wrangler pages deploy dist \
  --project-name="$PAGES_PROJECT" \
  --branch=main \
  --commit-dirty=true

echo "==> 5) Smoke"
curl -sS -o /dev/null -w "console %{http_code}\n" "$APP_URL/"
curl -sS -o /dev/null -w "api workspaces %{http_code}\n" "$API_URL/api/workspaces"
curl -sS -o /dev/null -w "nft health %{http_code}\n" "$NFT_URL/health"
echo "DONE — hard refresh https://console.zexvro.in"
