#!/usr/bin/env bash
# Deploy Cognito Custom Message Lambda → branded HTML emails via Cognito (still sent by Cognito/SES).
# The Lambda rewrites subject + HTML body for Signup / ResendCode / ForgotPassword / AdminCreateUser.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_vyONcitBD}"
FN_NAME="${COGNITO_CUSTOM_MESSAGE_FN:-zexvro-cognito-custom-message}"
ROLE_NAME="${COGNITO_CUSTOM_MESSAGE_ROLE:-zexvro-cognito-custom-message-role}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "${SCRIPT_DIR}/lambda_custom_message.py" "${WORKDIR}/lambda_function.py"
(
  cd "$WORKDIR"
  zip -q function.zip lambda_function.py
)

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)
if [[ -z "$ROLE_ARN" || "$ROLE_ARN" == "None" ]]; then
  echo "Creating IAM role ${ROLE_NAME}..."
  cat >"${WORKDIR}/trust.json" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
JSON
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${WORKDIR}/trust.json" \
    --query 'Role.Arn' --output text)
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "Waiting for role propagation..."
  sleep 10
fi

if aws lambda get-function --function-name "$FN_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "Updating Lambda ${FN_NAME}..."
  aws lambda update-function-code \
    --function-name "$FN_NAME" \
    --zip-file "fileb://${WORKDIR}/function.zip" \
    --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FN_NAME" --region "$REGION"
else
  echo "Creating Lambda ${FN_NAME}..."
  aws lambda create-function \
    --function-name "$FN_NAME" \
    --runtime python3.12 \
    --role "$ROLE_ARN" \
    --handler lambda_function.handler \
    --timeout 10 \
    --memory-size 128 \
    --zip-file "fileb://${WORKDIR}/function.zip" \
    --region "$REGION" >/dev/null
  aws lambda wait function-active --function-name "$FN_NAME" --region "$REGION"
fi

FN_ARN=$(aws lambda get-function --function-name "$FN_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)

# Allow Cognito to invoke
aws lambda add-permission \
  --function-name "$FN_NAME" \
  --region "$REGION" \
  --statement-id "CognitoCustomMessage-${POOL_ID//_/}" \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${POOL_ID}" \
  2>/dev/null || true

echo "Attaching CustomMessage trigger to pool ${POOL_ID}..."
aws cognito-idp update-user-pool \
  --region "$REGION" \
  --user-pool-id "$POOL_ID" \
  --lambda-config "CustomMessage=${FN_ARN}"

echo "Custom Message Lambda deployed: ${FN_ARN}"
echo "Signup / resend / forgot-password emails now use branded HTML."
