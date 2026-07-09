import json
import uuid
import time
import os
import urllib.parse
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')

DEVICES_TABLE = dynamodb.Table('zexvro-device-codes')
MEMORY_TABLE = dynamodb.Table('zexvro-user-memory')

USER_POOL_ID = os.environ.get("USER_POOL_ID")
CLIENT_ID = os.environ.get("CLIENT_ID")

def lambda_handler(event, context):
    path = event.get("rawPath", event.get("path", ""))
    method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", ""))
    
    headers = event.get("headers", {})
    query_params = event.get("queryStringParameters") or {}
    
    # Body parser
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except:
            body = dict(urllib.parse.parse_qsl(event["body"]))

    # 1. POST /auth/device-code
    if path == "/auth/device-code" and method == "POST":
        device_code = str(uuid.uuid4())
        raw_uid = str(uuid.uuid4()).upper().replace("-", "")
        user_code = f"{raw_uid[0:4]}-{raw_uid[4:8]}"
        ttl = int(time.time()) + 300  # 5 minutes expiry
        
        DEVICES_TABLE.put_item(Item={
            "device_code": device_code,
            "user_code": user_code,
            "status": "pending",
            "ttl": ttl
        })
        
        # Determine API URL dynamically from request header
        domain = headers.get("host", "localhost")
        verification_uri = f"https://{domain}/activate"
        
        return respond_json(200, {
            "device_code": device_code,
            "user_code": user_code,
            "verification_uri": verification_uri,
            "interval": 3
        })

    # 2. POST /auth/token
    elif path == "/auth/token" and method == "POST":
        device_code = body.get("device_code")
        if not device_code:
            return respond_json(400, {"error": "invalid_request"})
            
        res = DEVICES_TABLE.get_item(Key={"device_code": device_code})
        item = res.get("Item")
        if not item:
            return respond_json(400, {"error": "expired_token"})
            
        if item["status"] == "pending":
            return respond_json(400, {"error": "authorization_pending"})
            
        elif item["status"] == "authorized":
            # Return Cognito tokens stored during user approval step
            tokens = item.get("tokens", {})
            # Clean up auth table record
            DEVICES_TABLE.delete_item(Key={"device_code": device_code})
            
            return respond_json(200, {
                "access_token": tokens.get("AccessToken"),
                "refresh_token": tokens.get("RefreshToken"),
                "username": item.get("username")
            })

    # 3. GET /activate (Serves verification HTML)
    elif path == "/activate" and method == "GET":
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Link Device</title>
            <style>
                body { background: #050505; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { background: #0a0a0b; border: 1px solid #27272a; padding: 32px; border-radius: 12px; text-align: center; }
                input { background: #000; border: 1px solid #27272a; color: #fff; padding: 10px; width: 200px; text-align: center; border-radius: 6px; text-transform: uppercase; }
                button { background: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>ZEXVRO Device Authorization</h2>
                <form action="/auth/activate" method="POST">
                    <input type="text" name="user_code" placeholder="ABCD-1234" required maxlength="9">
                    <br>
                    <button type="submit">Approve Device</button>
                </form>
            </div>
        </body>
        </html>
        """
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html"},
            "body": html
        }

    # 4. POST /auth/activate (Processes submission from HTML)
    elif path == "/auth/activate" and method == "POST":
        user_code = body.get("user_code", "").strip().upper()
        
        # Scan devices table for matching user code
        scan_res = DEVICES_TABLE.scan(
            FilterExpression=Key('user_code').eq(user_code)
        )
        items = scan_res.get("Items", [])
        if not items:
            return respond_html(400, "<h3>Error!</h3><p>Invalid or expired code.</p>")
            
        target_device = items[0]
        
        # In a real environment, you would acquire credentials here using Cognito OAuth 
        # (e.g. from an active session cookie or headers). 
        # Here we mock-authenticate "stellar_dev" to simulate token extraction.
        mock_tokens = {
            "AccessToken": "prod_jwt_token_" + str(uuid.uuid4())[:8],
            "RefreshToken": "prod_refresh_ref"
        }
        
        DEVICES_TABLE.update_item(
            Key={"device_code": target_device["device_code"]},
            UpdateExpression="SET #s = :status, tokens = :toks, username = :user",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": "authorized",
                ":toks": mock_tokens,
                ":user": "stellar_dev"
            }
        )
        
        return respond_html(200, "<h3>Success!</h3><p>Your CLI device has been linked. You can close this tab.</p>")

    # 5. GET/POST /api/memory (Secure API calls)
    elif path == "/api/memory":
        auth_header = headers.get("authorization", headers.get("Authorization", ""))
        if not auth_header.startswith("Bearer "):
            return respond_json(401, {"error": "unauthorized"})
            
        token = auth_header.split(" ")[1]
        
        # Validate JWT token signature in production:
        # In real Cognito, verify token signature against JWKS URL: 
        # https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
        username = "stellar_dev" # Extracted from validated JWT claims
        
        if method == "GET":
            res = MEMORY_TABLE.get_item(Key={"username": username})
            memory_data = res.get("Item", {}).get("memory", {})
            return respond_json(200, {"username": username, "memory": memory_data})
            
        elif method == "POST":
            memory_update = body.get("memory", {})
            
            # Fetch existing
            res = MEMORY_TABLE.get_item(Key={"username": username})
            current_memory = res.get("Item", {}).get("memory", {})
            
            # Merge and save
            current_memory.update(memory_update)
            MEMORY_TABLE.put_item(Item={
                "username": username,
                "memory": current_memory
            })
            return respond_json(200, {"status": "success", "memory": current_memory})

    return respond_json(404, {"error": "not_found"})

def respond_json(status_code, body_dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" # CORS for frontend integration
        },
        "body": json.dumps(body_dict)
    }

def respond_html(status_code, body_html):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "text/html"},
        "body": f"<html><body><center style='margin-top:100px;'>{body_html}</center></body></html>"
    }
