import json
import os
import time
import uuid
import boto3
from boto3.dynamodb.conditions import Key

# Configure DynamoDB
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "ZexvroDeviceCodes")
table = dynamodb.Table(TABLE_NAME)

# GSI Name for querying by user_code
USER_CODE_GSI = os.environ.get("USER_CODE_GSI", "user_code-index")

# Expiry duration in seconds
CODE_EXPIRY_SECONDS = 300

def get_username_from_auth(event):
    """
    Extract username/email from authorization header or API Gateway authorizer.
    In API Gateway Cognito Authorizer, the claims are inside event['requestContext']['authorizer']['claims'].
    """
    # 1. Check API Gateway Authorizer
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {})
        username = claims.get("cognito:username") or claims.get("email") or claims.get("username")
        if username:
            return username
    except Exception:
        pass

    # 2. Fallback: Parse Authorization Token manually if passed directly (optional/dev mode)
    auth_header = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # Decodes claims if standard JWT (Cognito JWT)
        try:
            import base64
            parts = token.split(".")
            if len(parts) == 3:
                payload_b64 = parts[1]
                # Fix padding
                payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                payload = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
                username = payload.get("cognito:username") or payload.get("email") or payload.get("username")
                if username:
                    return username
        except Exception:
            pass

    return "stellar_dev"  # Default fallback if auth is disabled for testing


def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    path = event.get("path", "")
    http_method = event.get("httpMethod", "")

    # CORS Preflight
    if http_method == "OPTIONS":
        return respond(200, {})

    # Route: POST /auth/device-code
    if path == "/auth/device-code" and http_method == "POST":
        device_code = str(uuid.uuid4())
        # Generate user-friendly 8 digit code: ABCD-1234
        raw_uid = str(uuid.uuid4()).upper().replace("-", "")
        user_code = f"{raw_uid[0:4]}-{raw_uid[4:8]}"
        expires_at = int(time.time()) + CODE_EXPIRY_SECONDS

        # Save to DynamoDB
        table.put_item(
            Item={
                "device_code": device_code,
                "user_code": user_code,
                "status": "pending",
                "expires_at": expires_at,
            }
        )

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        
        return respond(
            200,
            {
                "device_code": device_code,
                "user_code": user_code,
                "verification_uri": frontend_url,
                "verification_uri_complete": f"{frontend_url}/?code={user_code}",
                "interval": 2,
                "expires_in": CODE_EXPIRY_SECONDS,
            },
        )

    # Route: POST /auth/token (Polling)
    elif path == "/auth/token" and http_method == "POST":
        try:
            body = json.loads(event.get("body", "{}") or "{}")
        except Exception:
            body = {}

        device_code = body.get("device_code")
        if not device_code:
            return respond(400, {"error": "invalid_request", "error_description": "device_code is required"})

        # Get device status from DynamoDB
        res = table.get_item(Key={"device_code": device_code})
        item = res.get("Item")

        if not item:
            return respond(400, {"error": "invalid_grant", "error_description": "Device authorization code expired or invalid"})

        # Check TTL
        if int(time.time()) > item.get("expires_at", 0):
            table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "expired_token", "error_description": "Authorization code expired"})

        status = item.get("status")
        if status == "pending":
            return respond(400, {"error": "authorization_pending", "error_description": "User has not approved the device yet"})
        elif status == "rejected":
            table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "access_denied", "error_description": "User rejected the authorization request"})
        elif status == "authorized":
            # Generate CLI Auth Access Token (Mock JWT / User Auth Token)
            username = item.get("username", "stellar_dev")
            cli_token = "cli_token_" + str(uuid.uuid4()).replace("-", "")

            # Clear DynamoDB record
            table.delete_item(Key={"device_code": device_code})

            # Save the authorized session in a shared database or memory table if needed,
            # or issue a signed JWT. Here we return the session details.
            return respond(
                200,
                {
                    "access_token": cli_token,
                    "username": username,
                    "token_type": "Bearer",
                },
            )

    # Route: POST /auth/activate (User Action)
    elif path == "/auth/activate" and http_method == "POST":
        try:
            body = json.loads(event.get("body", "{}") or "{}")
        except Exception:
            body = {}

        user_code = body.get("user_code")
        action = body.get("action")  # 'approve' or 'reject'

        if not user_code or not action:
            return respond(400, {"error": "invalid_request", "error_description": "user_code and action are required"})

        user_code = user_code.strip().upper()
        if action not in ["approve", "reject"]:
            return respond(400, {"error": "invalid_request", "error_description": "action must be 'approve' or 'reject'"})

        # Query DynamoDB using the user_code index
        res = table.query(
            IndexName=USER_CODE_GSI,
            KeyConditionExpression=Key("user_code").eq(user_code)
        )
        items = res.get("Items", [])
        if not items:
            return respond(404, {"error": "not_found", "error_description": "Invalid or expired authorization code"})

        item = items[0]
        device_code = item["device_code"]

        # Check TTL
        if int(time.time()) > item.get("expires_at", 0):
            table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "expired_token", "error_description": "Authorization code expired"})

        if action == "approve":
            username = get_username_from_auth(event)
            # Update status to authorized
            table.update_item(
                Key={"device_code": device_code},
                UpdateExpression="set #s = :status, #u = :username",
                ExpressionAttributeNames={"#s": "status", "#u": "username"},
                ExpressionAttributeValues={":status": "authorized", ":username": username}
            )
            return respond(200, {"status": "success", "message": f"Successfully authorized device for {username}"})
        
        else:
            # Update status to rejected
            table.update_item(
                Key={"device_code": device_code},
                UpdateExpression="set #s = :status",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":status": "rejected"}
            )
            return respond(200, {"status": "success", "message": "Successfully rejected device authorization"})

    return respond(404, {"error": "not_found", "error_description": "Resource not found"})
