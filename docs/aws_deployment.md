# AWS Lambda & DynamoDB Deployment Guide

This guide details how to update and deploy the ZEXVRO CLI Device Authorization backend to your AWS environment.

---

## 1. DynamoDB Table Setup

Make sure your DynamoDB table is configured as follows to support both device code polling and user code activation:

1. **Create Table:**
   - **Table Name:** `ZexvroDeviceCodes` (or configured value in `DYNAMODB_TABLE` environment variable).
   - **Partition Key:** `device_code` (String).
   - **Sort Key:** None.

2. **Add Global Secondary Index (GSI):**
   - **Index Name:** `user_code-index` (or configured value in `USER_CODE_GSI` environment variable).
   - **Partition Key:** `user_code` (String).
   - **Sort Key:** None.
   - **Attribute Projection:** `All` (or project keys & attributes: `device_code`, `status`, `expires_at`, `username`).

3. **Enable Time-to-Live (TTL) (Recommended):**
   - **TTL Attribute:** `expires_at`.
   - *This automatically purges expired codes after 5 minutes.*

---

## 2. Option A: Update Using the AWS Console (Quickest)

1. Open the [AWS Lambda Console](https://console.aws.amazon.com/lambda/).
2. Select your auth Lambda function (e.g., `ZexvroAuthHandler` or similar name).
3. In the **Code** tab:
   - Double-click the file (usually `lambda_function.py`).
   - Copy the entire contents of [docs/lambda_auth.py](file:///home/paris/Documents/ZEXVRO/docs/lambda_auth.py) and paste it into the editor.
   - Click **Deploy** at the top.
4. In the **Configuration** tab under **Environment variables**:
   - Add/Verify these variables:
     - `DYNAMODB_TABLE` = `ZexvroDeviceCodes`
     - `USER_CODE_GSI` = `user_code-index`
     - `FRONTEND_URL` = `https://zexvrodashboard.xyz` (your production React app domain)

---

## 3. Option B: Update Using the AWS CLI (Command Line)

If you have the AWS CLI configured, you can bundle and deploy the code in one command:

1. **Zip the code:**
   ```bash
   # Navigate to the docs/ directory where the file is saved
   cd docs/
   
   # Rename file to lambda_function.py (Standard AWS entrypoint)
   cp lambda_auth.py lambda_function.py
   
   # Compress into a deployment package
   zip function.zip lambda_function.py
   ```

2. **Upload to AWS Lambda:**
   ```bash
   aws lambda update-function-code \
     --function-name YourLambdaFunctionName \
     --zip-file fileb://function.zip
   ```

3. **Set Environment Variables:**
   ```bash
   aws lambda update-function-configuration \
     --function-name YourLambdaFunctionName \
     --environment "Variables={DYNAMODB_TABLE=ZexvroDeviceCodes,USER_CODE_GSI=user_code-index,FRONTEND_URL=https://your-production-app.com}"
   ```

---

## 4. API Gateway Integration

If you need to define the endpoints in Amazon API Gateway (HTTP or REST API):

1. **Routes to map to the Lambda function:**
   - `POST /auth/device-code` (CORS enabled)
   - `POST /auth/token` (CORS enabled)
   - `POST /auth/activate` (Requires Cognito User Pool Authorizer, CORS enabled)

2. **CORS Configuration:**
   - **Allowed Origins:** `*` (or your dashboard domain)
   - **Allowed Headers:** `Content-Type,Authorization`
   - **Allowed Methods:** `POST,GET,OPTIONS`
