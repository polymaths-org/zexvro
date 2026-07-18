import json
import os
import time
import uuid
import boto3
from boto3.dynamodb.conditions import Key

# Configure DynamoDB resources
dynamodb = boto3.resource("dynamodb")

DEVICES_TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "zexvro-device-codes")
MEMORY_TABLE_NAME = os.environ.get("MEMORY_TABLE", "zexvro-user-memory")

devices_table = dynamodb.Table(DEVICES_TABLE_NAME)
memory_table = dynamodb.Table(MEMORY_TABLE_NAME)

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
    path = event.get("rawPath", event.get("path", ""))
    http_method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "")).upper()
    
    headers = event.get("headers", {})

    # Body parser
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            # Fallback to URL-encoded parsing if needed
            import urllib.parse
            body = dict(urllib.parse.parse_qsl(event["body"]))

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
        devices_table.put_item(
            Item={
                "device_code": device_code,
                "user_code": user_code,
                "status": "pending",
                "expires_at": expires_at,
            }
        )

        frontend_url = os.environ.get("FRONTEND_URL", "https://zexvro.pages.dev")
        
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
        device_code = body.get("device_code")
        if not device_code:
            return respond(400, {"error": "invalid_request", "error_description": "device_code is required"})

        # Get device status from DynamoDB
        res = devices_table.get_item(Key={"device_code": device_code})
        item = res.get("Item")

        if not item:
            return respond(400, {"error": "invalid_grant", "error_description": "Device authorization code expired or invalid"})

        # Check TTL
        if int(time.time()) > item.get("expires_at", 0):
            devices_table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "expired_token", "error_description": "Authorization code expired"})

        status = item.get("status")
        if status == "pending":
            return respond(400, {"error": "authorization_pending", "error_description": "User has not approved the device yet"})
        elif status == "rejected":
            devices_table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "access_denied", "error_description": "User rejected the authorization request"})
        elif status == "authorized":
            tokens = item.get("tokens", {})
            access_token = tokens.get("AccessToken")
            if not access_token:
                access_token = "cli_token_" + str(uuid.uuid4()).replace("-", "")
            username = item.get("username", "stellar_dev")

            # Clear DynamoDB record
            devices_table.delete_item(Key={"device_code": device_code})

            return respond(
                200,
                {
                    "access_token": access_token,
                    "username": username,
                    "token_type": "Bearer",
                },
            )

    # Route: POST /auth/activate (User Action)
    elif path == "/auth/activate" and http_method == "POST":
        user_code = body.get("user_code")
        action = body.get("action")  # 'approve' or 'reject'

        if not user_code or not action:
            return respond(400, {"error": "invalid_request", "error_description": "user_code and action are required"})

        user_code = user_code.strip().upper()
        if action not in ["approve", "reject"]:
            return respond(400, {"error": "invalid_request", "error_description": "action must be 'approve' or 'reject'"})

        # Query DynamoDB using the user_code index
        res = devices_table.query(
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
            devices_table.delete_item(Key={"device_code": device_code})
            return respond(400, {"error": "expired_token", "error_description": "Authorization code expired"})

        if action == "approve":
            username = get_username_from_auth(event)
            
            # Extract Bearer token to pass back to the CLI agent
            auth_header = headers.get("authorization", headers.get("Authorization", "")) or headers.get("Authorization") or headers.get("authorization")
            token_val = ""
            if auth_header and auth_header.startswith("Bearer "):
                token_val = auth_header.split(" ")[1]
            
            # Update status to authorized
            devices_table.update_item(
                Key={"device_code": device_code},
                UpdateExpression="set #s = :status, #u = :username, tokens = :tokens",
                ExpressionAttributeNames={"#s": "status", "#u": "username"},
                ExpressionAttributeValues={
                    ":status": "authorized", 
                    ":username": username,
                    ":tokens": {
                        "AccessToken": token_val or ("cli_token_" + str(uuid.uuid4()).replace("-", ""))
                    }
                }
            )
            return respond(200, {"status": "success", "message": f"Successfully authorized device for {username}"})
        
        else:
            # Update status to rejected
            devices_table.update_item(
                Key={"device_code": device_code},
                UpdateExpression="set #s = :status",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":status": "rejected"}
            )
            return respond(200, {"status": "success", "message": "Successfully rejected device authorization"})

    # Route: GET/POST /api/memory (Secure API calls)
    elif path == "/api/memory":
        auth_header = headers.get("authorization", headers.get("Authorization", "")) or headers.get("Authorization") or headers.get("authorization")
        if not auth_header:
            return respond(401, {"error": "unauthorized", "error_description": "Authorization header missing"})
            
        if not auth_header.startswith("Bearer "):
            return respond(401, {"error": "unauthorized", "error_description": "Invalid authorization scheme"})
            
        token = auth_header.split(" ")[1]
        
        # Identify user
        if token.startswith("cli_token_") or token.startswith("prod_jwt_token_"):
            username = "stellar_dev"
        else:
            username = get_username_from_auth(event)

        if http_method == "GET":
            res = memory_table.get_item(Key={"username": username})
            memory_data = res.get("Item", {}).get("memory", {})
            return respond(200, {"username": username, "memory": memory_data})
            
        elif http_method == "POST":
            memory_update = body.get("memory", {})
            
            # Fetch existing
            res = memory_table.get_item(Key={"username": username})
            current_memory = res.get("Item", {}).get("memory", {})
            
            # Merge and save
            current_memory.update(memory_update)
            memory_table.put_item(Item={
                "username": username,
                "memory": current_memory
            })
            return respond(200, {"status": "success", "memory": current_memory})

    # Route: POST /api/chat (Proxy for OpenCode completions to avoid CORS)
    elif path == "/api/chat" and http_method == "POST":
        import urllib.request
        import urllib.error
        
        api_url = "https://opencode.ai/zen/v1/chat/completions"
        api_key = (os.environ.get("OPENCODE_API_KEY") or "").strip()
        if not api_key:
            return respond(503, {
                "error": "configuration_error",
                "error_description": "OPENCODE_API_KEY is not configured on the Lambda",
            })
        
        messages = body.get("messages", [])
        model = body.get("model", "big-pickle")
        provider = body.get("provider", "opencode zen")
        metadata = body.get("metadata", {})
        
        payload = {
            "model": model,
            "provider": provider,
            "messages": messages,
            "metadata": metadata
        }
        
        headers_to_send = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ZexvroProxy/1.0"
        }
        
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers_to_send,
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                response_data = json.loads(res.read().decode("utf-8"))
                return respond(200, response_data)
        except urllib.error.HTTPError as e:
            try:
                error_data = json.loads(e.read().decode("utf-8"))
            except Exception:
                error_data = {"error": f"HTTP {e.code}"}
            return respond(e.code, error_data)
        except Exception as e:
            return respond(500, {"error": str(e)})

    return respond(404, {"error": "not_found", "error_description": "Resource not found"})
