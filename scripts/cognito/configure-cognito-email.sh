#!/usr/bin/env bash
# Configure Cognito User Pool email: branded verification template + SES from no-reply@zexvro.in
#
# Usage:
#   ./scripts/cognito/configure-cognito-email.sh            # templates + SES if verified
#   ./scripts/cognito/configure-cognito-email.sh --templates-only
#   ./scripts/cognito/configure-cognito-email.sh --dns-help
#
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_vyONcitBD}"
FROM_EMAIL="${COGNITO_FROM_EMAIL:-no-reply@zexvro.in}"
FROM_NAME="${COGNITO_FROM_NAME:-ZEXVRO}"
REPLY_TO="${COGNITO_REPLY_TO:-}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="${SCRIPT_DIR}/email-templates"

TEMPLATES_ONLY=0
DNS_HELP=0
for arg in "$@"; do
  case "$arg" in
    --templates-only) TEMPLATES_ONLY=1 ;;
    --dns-help) DNS_HELP=1 ;;
  esac
done

if [[ "$DNS_HELP" -eq 1 ]]; then
  echo "=== SES DKIM DNS for zexvro.in (add as CNAME) ==="
  TOKENS=$(aws sesv2 get-email-identity --email-identity zexvro.in --region "$REGION" --query 'DkimAttributes.Tokens' --output text 2>/dev/null || true)
  if [[ -z "$TOKENS" ]]; then
    echo "Domain identity not found. Creating..."
    aws sesv2 create-email-identity --email-identity zexvro.in --region "$REGION" >/dev/null
    TOKENS=$(aws sesv2 get-email-identity --email-identity zexvro.in --region "$REGION" --query 'DkimAttributes.Tokens' --output text)
  fi
  for t in $TOKENS; do
    echo "${t}._domainkey.zexvro.in  CNAME  ${t}.dkim.amazonses.com"
  done
  echo ""
  echo "After DNS propagates, re-run: $0"
  exit 0
fi

HTML_FILE="${TEMPLATES_DIR}/verification.html"
TXT_FILE="${TEMPLATES_DIR}/verification.txt"
if [[ ! -f "$HTML_FILE" || ! -f "$TXT_FILE" ]]; then
  echo "Missing templates under ${TEMPLATES_DIR}"
  exit 1
fi

# Cognito HTML email: {####} is the verification code placeholder
EMAIL_HTML=$(cat "$HTML_FILE")
EMAIL_TXT=$(cat "$TXT_FILE")
SUBJECT='ZEXVRO · Your verification code'

echo "Updating verification message template on pool ${POOL_ID}..."
# Use file:// to avoid shell escaping issues with HTML
TMP_JSON=$(mktemp)
python3 - <<PY >"$TMP_JSON"
import json
from pathlib import Path
html = Path("${HTML_FILE}").read_text()
text = Path("${TXT_FILE}").read_text()
print(json.dumps({
  "UserPoolId": "${POOL_ID}",
  "AutoVerifiedAttributes": ["email"],
  "EmailVerificationMessage": text.strip(),
  "EmailVerificationSubject": "${SUBJECT}",
  "VerificationMessageTemplate": {
    "DefaultEmailOption": "CONFIRM_WITH_CODE",
    "EmailMessage": text.strip(),
    "EmailSubject": "${SUBJECT}",
    "EmailMessageByLink": "Click the link to verify your ZEXVRO account: {##Click Here##}",
    "EmailSubjectByLink": "ZEXVRO · Verify your email",
  },
}))
PY

aws cognito-idp update-user-pool --region "$REGION" --cli-input-json "file://${TMP_JSON}"
rm -f "$TMP_JSON"
echo "Templates applied (plain text code message)."

# Cognito default only supports plain text for built-in EmailVerificationMessage.
# HTML requires Custom Message Lambda OR SES + custom templates via Lambda.
# Apply SES DEVELOPER config when identity is verified.

SES_STATUS=$(aws sesv2 get-email-identity --email-identity zexvro.in --region "$REGION" --query 'VerifiedForSendingStatus' --output text 2>/dev/null || echo "false")
EMAIL_STATUS=$(aws sesv2 get-email-identity --email-identity "$FROM_EMAIL" --region "$REGION" --query 'VerifiedForSendingStatus' --output text 2>/dev/null || echo "false")

echo "SES domain zexvro.in verified=${SES_STATUS}"
echo "SES ${FROM_EMAIL} verified=${EMAIL_STATUS}"

if [[ "$TEMPLATES_ONLY" -eq 1 ]]; then
  echo "Skipping SES From-address switch (--templates-only)."
  exit 0
fi

if [[ "$SES_STATUS" != "True" && "$EMAIL_STATUS" != "True" ]]; then
  cat <<EOF

SES is not verified yet for zexvro.in / ${FROM_EMAIL}.
Cognito still uses COGNITO_DEFAULT (no-reply@verificationemail.com) until SES is ready.

Next:
  1) Add DKIM CNAMEs:  $0 --dns-help
  2) Wait for SES VerificationStatus=SUCCESS
  3) Re-run: $0

Also ensure Cognito has permission to use SES (script will attach when verified).
EOF
  exit 0
fi

SOURCE_ARN="arn:aws:ses:${REGION}:${ACCOUNT_ID}:identity/zexvro.in"
if [[ "$EMAIL_STATUS" == "True" && "$SES_STATUS" != "True" ]]; then
  SOURCE_ARN="arn:aws:ses:${REGION}:${ACCOUNT_ID}:identity/${FROM_EMAIL}"
fi

echo "Switching Cognito EmailConfiguration to DEVELOPER / ${FROM_EMAIL}..."
aws cognito-idp update-user-pool \
  --region "$REGION" \
  --user-pool-id "$POOL_ID" \
  --email-configuration "{
    \"EmailSendingAccount\": \"DEVELOPER\",
    \"SourceArn\": \"${SOURCE_ARN}\",
    \"From\": \"${FROM_NAME} <${FROM_EMAIL}>\",
    \"ReplyToEmailAddress\": \"${REPLY_TO:-${FROM_EMAIL}}\"
  }"

# IAM: Cognito needs ses:SendEmail on the identity (service-linked role usually handles this
# when configured via console; ensure account is out of SES sandbox for arbitrary recipients).
echo "Cognito From address set to: ${FROM_NAME} <${FROM_EMAIL}>"
echo "Done."
