import json
import os
import time
import uuid
import csv
import io
import re
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Attr, Key

# Configure DynamoDB resources
dynamodb = boto3.resource("dynamodb")

DEVICES_TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "zexvro-device-codes")
MEMORY_TABLE_NAME = os.environ.get("MEMORY_TABLE", "zexvro-user-memory")
WORKSPACES_TABLE_NAME = os.environ.get("WORKSPACES_TABLE", "zexvro-workspaces")
PROJECTS_TABLE_NAME = os.environ.get("PROJECTS_TABLE", "zexvro-projects")
EMPLOYEES_TABLE_NAME = os.environ.get("EMPLOYEES_TABLE", "zexvro-employees")
PAYROLL_TABLE_NAME = os.environ.get("PAYROLL_TABLE", "zexvro-payroll-runs")
PAYROLL_TAXONOMY_TABLE_NAME = os.environ.get("PAYROLL_TAXONOMY_TABLE", "zexvro-payroll-taxonomy")

devices_table = dynamodb.Table(DEVICES_TABLE_NAME)
memory_table = dynamodb.Table(MEMORY_TABLE_NAME)
workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)
projects_table = dynamodb.Table(PROJECTS_TABLE_NAME)
employees_table = dynamodb.Table(EMPLOYEES_TABLE_NAME)
payroll_runs_table = dynamodb.Table(PAYROLL_TABLE_NAME)
payroll_taxonomy_table = dynamodb.Table(PAYROLL_TAXONOMY_TABLE_NAME)
ses = boto3.client("ses", region_name=os.environ.get("AWS_REGION", "us-east-1"))

# GSI Name for querying by user_code
USER_CODE_GSI = os.environ.get("USER_CODE_GSI", "user_code-index")

# Expiry duration in seconds
CODE_EXPIRY_SECONDS = 300


def json_default(value):
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def to_dynamodb_value(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_dynamodb_value(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [to_dynamodb_value(v) for v in value]
    return value


def get_query_params(event):
    params = event.get("queryStringParameters") or {}
    if params:
        return params

    raw_query = event.get("rawQueryString", "")
    if not raw_query:
        return {}

    import urllib.parse
    parsed = urllib.parse.parse_qs(raw_query)
    return {key: values[-1] for key, values in parsed.items()}


def parse_csv_rows(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for row in reader:
        cleaned = {key.strip(): (value.strip() if isinstance(value, str) else value) for key, value in row.items() if key}
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def create_id(prefix):
    return f"{prefix}_{int(time.time() * 1000)}_{str(uuid.uuid4()).replace('-', '')[:8]}"


def slugify(value):
    cleaned = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return cleaned or "item"


def get_auth_header(headers):
    return headers.get("authorization") or headers.get("Authorization") or ""


def require_username(event, headers):
    auth_header = get_auth_header(headers)
    if not auth_header.startswith("Bearer "):
        return None, respond(401, {"error": "unauthorized", "error_description": "Authorization header missing or invalid"})
    return get_username_from_auth(event), None


def normalize_workspace_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("workspaceId"))
    item.setdefault("workspaceId", item.get("id"))
    return item


def normalize_project_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("projectId"))
    item.setdefault("projectId", item.get("id"))
    return item


def normalize_employee_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("employeeId"))
    item.setdefault("employeeId", item.get("id"))
    return item


def normalize_payroll_run_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("runId"))
    item.setdefault("runId", item.get("id"))
    return item


def normalize_taxonomy_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("taxonomyId"))
    item.setdefault("taxonomyId", item.get("id"))
    return item


def build_update_expression(updates, blocked_keys):
    safe_updates = {
        key: to_dynamodb_value(value)
        for key, value in updates.items()
        if key not in blocked_keys and value is not None
    }
    if not safe_updates:
        return None, None, None

    names = {}
    values = {}
    assignments = []
    for index, (key, value) in enumerate(safe_updates.items()):
        name_key = f"#f{index}"
        value_key = f":v{index}"
        names[name_key] = key
        values[value_key] = value
        assignments.append(f"{name_key} = {value_key}")
    return "SET " + ", ".join(assignments), names, values


def update_item(table, key, updates, blocked_keys):
    expression, names, values = build_update_expression(updates, blocked_keys)
    if not expression:
        res = table.get_item(Key=key)
        return res.get("Item")

    res = table.update_item(
        Key=key,
        UpdateExpression=expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )
    return res.get("Attributes")


def find_by_sort_key(table, sort_key_name, sort_key_value):
    res = table.scan(FilterExpression=Attr(sort_key_name).eq(sort_key_value))
    items = res.get("Items", [])
    return items[0] if items else None


def send_invite_email(recipient_email, workspace_name, inviter_name, role):
    frontend_url = os.environ.get("FRONTEND_URL", "https://zexvro.pages.dev")
    source_email = os.environ.get("INVITE_SOURCE_EMAIL", "noreply@zexvro.dev")
    safe_workspace = workspace_name or "a ZEXVRO workspace"
    safe_inviter = inviter_name or "A teammate"
    safe_role = role or "Developer"
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#18181b">
      <h2 style="margin:0 0 12px">You have been invited to {safe_workspace} on ZEXVRO</h2>
      <p>{safe_inviter} invited you to join as <strong>{safe_role}</strong>.</p>
      <p><a href="{frontend_url}/dashboard" style="display:inline-block;background:#09090b;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Open ZEXVRO</a></p>
    </div>
    """
    return ses.send_email(
        Source=source_email,
        Destination={"ToAddresses": [recipient_email]},
        Message={
            "Subject": {"Data": f"You have been invited to {safe_workspace} on ZEXVRO"},
            "Body": {"Html": {"Data": html_body}},
        },
    )


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
            "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=json_default),
    }


def lambda_handler(event, context):
    path = event.get("rawPath", event.get("path", ""))
    http_method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "")).upper()
    
    headers = event.get("headers", {})

    # Body parser
    body = {}
    raw_body = event.get("body") or ""
    if raw_body:
        try:
            body = json.loads(raw_body)
        except Exception:
            # Fallback to URL-encoded parsing if needed
            import urllib.parse
            parsed_body = dict(urllib.parse.parse_qsl(raw_body))
            body = parsed_body if parsed_body else {"csv": raw_body}

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

    # Route: GET/POST /api/workspaces
    elif path == "/api/workspaces" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        res = workspaces_table.query(
            KeyConditionExpression=Key("ownerId").eq(username)
        )
        workspaces = [normalize_workspace_item(item) for item in res.get("Items", [])]
        return respond(200, {"workspaces": workspaces})

    elif path == "/api/workspaces" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        now = int(time.time() * 1000)
        workspace_id = body.get("workspaceId") or body.get("id") or create_id("ws")
        members = body.get("members") or [{
            "id": username,
            "email": body.get("ownerEmail", ""),
            "name": username,
            "role": "Owner",
            "status": "active",
            "joinedAt": now,
        }]
        item = {
            **body,
            "ownerId": username,
            "workspaceId": workspace_id,
            "id": workspace_id,
            "name": body.get("name", "Untitled Workspace"),
            "slug": body.get("slug", workspace_id),
            "plan": body.get("plan", "Team workspace"),
            "createdAt": body.get("createdAt", now),
            "members": members,
        }
        workspaces_table.put_item(Item=to_dynamodb_value(item))
        return respond(200, {"status": "success", "workspace": normalize_workspace_item(item)})

    # Route: POST /api/workspaces/{id}/invite
    elif path.startswith("/api/workspaces/") and path.endswith("/invite") and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        parts = path.strip("/").split("/")
        workspace_id = parts[2] if len(parts) >= 4 else ""
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspace id is required"})

        res = workspaces_table.get_item(Key={"ownerId": username, "workspaceId": workspace_id})
        workspace = res.get("Item")
        if not workspace:
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})

        now = int(time.time() * 1000)
        member = {
            "id": body.get("id") or create_id("member"),
            "email": body.get("email", ""),
            "name": body.get("name") or body.get("email", ""),
            "role": body.get("role", "Developer"),
            "status": body.get("status", "invited"),
            "joinedAt": body.get("joinedAt", now),
        }
        members = workspace.get("members", [])
        members = [m for m in members if m.get("email") != member["email"]]
        members.append(member)
        updated = update_item(
            workspaces_table,
            {"ownerId": username, "workspaceId": workspace_id},
            {"members": members, "updatedAt": now},
            {"ownerId", "workspaceId", "id"},
        )
        return respond(200, {"status": "success", "member": member, "workspace": normalize_workspace_item(updated)})

    # Route: PUT/DELETE /api/workspaces/{id}
    elif path.startswith("/api/workspaces/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = path.split("/")[-1]
        res = workspaces_table.get_item(Key={"ownerId": username, "workspaceId": workspace_id})
        if not res.get("Item"):
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})

        updated = update_item(
            workspaces_table,
            {"ownerId": username, "workspaceId": workspace_id},
            {**body, "updatedAt": int(time.time() * 1000)},
            {"ownerId", "workspaceId", "id", "createdAt", "members"},
        )
        return respond(200, {"status": "success", "workspace": normalize_workspace_item(updated)})

    elif path.startswith("/api/workspaces/") and http_method == "DELETE":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = path.split("/")[-1]
        workspaces_table.delete_item(Key={"ownerId": username, "workspaceId": workspace_id})
        return respond(200, {"status": "success", "workspaceId": workspace_id})

    # Route: GET/POST /api/projects
    elif path == "/api/projects" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        workspace_id = query.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        res = projects_table.query(
            KeyConditionExpression=Key("workspaceId").eq(workspace_id)
        )
        projects = [normalize_project_item(item) for item in res.get("Items", [])]
        return respond(200, {"projects": projects})

    elif path == "/api/projects" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        now = int(time.time() * 1000)
        project_id = body.get("projectId") or body.get("id") or create_id("proj")
        item = {
            **body,
            "workspaceId": workspace_id,
            "projectId": project_id,
            "id": project_id,
            "createdAt": body.get("createdAt", now),
            "updatedAt": body.get("updatedAt", now),
            "owner": body.get("owner", username),
        }
        projects_table.put_item(Item=to_dynamodb_value(item))
        return respond(200, {"status": "success", "project": normalize_project_item(item)})

    # Route: PUT/DELETE /api/projects/{id}
    elif path.startswith("/api/projects/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        project_id = path.split("/")[-1]
        workspace_id = body.get("workspaceId") or query.get("workspaceId")
        project = None
        if workspace_id:
            project = projects_table.get_item(Key={"workspaceId": workspace_id, "projectId": project_id}).get("Item")
        if not project:
            project = find_by_sort_key(projects_table, "projectId", project_id) or find_by_sort_key(projects_table, "id", project_id)
        if not project:
            return respond(404, {"error": "not_found", "error_description": "Project not found"})

        key = {"workspaceId": project["workspaceId"], "projectId": project.get("projectId", project.get("id", project_id))}
        updated = update_item(
            projects_table,
            key,
            {**body, "updatedAt": int(time.time() * 1000)},
            {"workspaceId", "projectId", "id", "createdAt"},
        )
        return respond(200, {"status": "success", "project": normalize_project_item(updated)})

    elif path.startswith("/api/projects/") and http_method == "DELETE":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        project_id = path.split("/")[-1]
        workspace_id = query.get("workspaceId")
        project = None
        if workspace_id:
            project = projects_table.get_item(Key={"workspaceId": workspace_id, "projectId": project_id}).get("Item")
        if not project:
            project = find_by_sort_key(projects_table, "projectId", project_id) or find_by_sort_key(projects_table, "id", project_id)
        if project:
            projects_table.delete_item(Key={"workspaceId": project["workspaceId"], "projectId": project.get("projectId", project.get("id", project_id))})
        return respond(200, {"status": "success", "projectId": project_id})

    # Route: GET/POST /api/employees
    elif path == "/api/employees" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        workspace_id = query.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        res = employees_table.query(
            KeyConditionExpression=Key("workspaceId").eq(workspace_id)
        )
        employees = [normalize_employee_item(item) for item in res.get("Items", [])]
        return respond(200, {"employees": employees})

    elif path == "/api/employees" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        now = int(time.time() * 1000)
        employee_id = body.get("employeeId") or body.get("id") or create_id("emp")
        salary = body.get("salary", 0)
        if isinstance(salary, str):
            try:
                salary = float(salary)
            except Exception:
                salary = 0
        item = {
            **body,
            "workspaceId": workspace_id,
            "employeeId": employee_id,
            "id": employee_id,
            "projectId": body.get("projectId", workspace_id),
            "salary": salary,
            "currency": body.get("currency", "USDC"),
            "frequency": body.get("frequency", "monthly"),
            "status": body.get("status", "active"),
            "startDate": body.get("startDate", now),
            "createdAt": body.get("createdAt", now),
            "updatedAt": body.get("updatedAt", now),
        }
        employees_table.put_item(Item=to_dynamodb_value(item))
        return respond(200, {"status": "success", "employee": normalize_employee_item(item)})

    # Route: POST /api/employees/bulk
    elif path == "/api/employees/bulk" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        rows = body.get("employees")
        if not isinstance(rows, list):
            rows = parse_csv_rows(body.get("csv", ""))

        now = int(time.time() * 1000)
        employees = []
        for row in rows:
            salary = row.get("salary", 0)
            if isinstance(salary, str):
                try:
                    salary = float(salary)
                except Exception:
                    salary = 0
            employee_id = row.get("employeeId") or row.get("id") or create_id("emp")
            item = {
                **row,
                "workspaceId": workspace_id,
                "employeeId": employee_id,
                "id": employee_id,
                "projectId": row.get("projectId", workspace_id),
                "name": row.get("name", ""),
                "email": row.get("email", ""),
                "role": row.get("role", ""),
                "department": row.get("department", ""),
                "walletAddress": row.get("walletAddress", ""),
                "salary": salary,
                "currency": row.get("currency", "USDC"),
                "frequency": row.get("frequency", "monthly"),
                "status": row.get("status", "active"),
                "startDate": row.get("startDate", now),
                "createdAt": row.get("createdAt", now),
                "updatedAt": row.get("updatedAt", now),
            }
            employees_table.put_item(Item=to_dynamodb_value(item))
            employees.append(normalize_employee_item(item))

        return respond(200, {"status": "success", "count": len(employees), "employees": employees})

    # Route: PUT/DELETE /api/employees/{id}
    elif path.startswith("/api/employees/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        employee_id = path.split("/")[-1]
        workspace_id = body.get("workspaceId") or query.get("workspaceId")
        employee = None
        if workspace_id:
            employee = employees_table.get_item(Key={"workspaceId": workspace_id, "employeeId": employee_id}).get("Item")
        if not employee:
            employee = find_by_sort_key(employees_table, "employeeId", employee_id) or find_by_sort_key(employees_table, "id", employee_id)
        if not employee:
            return respond(404, {"error": "not_found", "error_description": "Employee not found"})

        salary = body.get("salary")
        updates = {**body, "updatedAt": int(time.time() * 1000)}
        if isinstance(salary, str):
            try:
                updates["salary"] = float(salary)
            except Exception:
                updates.pop("salary", None)

        key = {"workspaceId": employee["workspaceId"], "employeeId": employee.get("employeeId", employee.get("id", employee_id))}
        updated = update_item(
            employees_table,
            key,
            updates,
            {"workspaceId", "employeeId", "id", "createdAt"},
        )
        return respond(200, {"status": "success", "employee": normalize_employee_item(updated)})

    elif path.startswith("/api/employees/") and http_method == "DELETE":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        employee_id = path.split("/")[-1]
        workspace_id = query.get("workspaceId")
        employee = None
        if workspace_id:
            employee = employees_table.get_item(Key={"workspaceId": workspace_id, "employeeId": employee_id}).get("Item")
        if not employee:
            employee = find_by_sort_key(employees_table, "employeeId", employee_id) or find_by_sort_key(employees_table, "id", employee_id)
        if not employee:
            return respond(404, {"error": "not_found", "error_description": "Employee not found"})

        key = {"workspaceId": employee["workspaceId"], "employeeId": employee.get("employeeId", employee.get("id", employee_id))}
        updated = update_item(
            employees_table,
            key,
            {"status": "terminated", "updatedAt": int(time.time() * 1000)},
            {"workspaceId", "employeeId", "id", "createdAt"},
        )
        return respond(200, {"status": "success", "employee": normalize_employee_item(updated)})

    # Route: GET/POST /api/payroll/taxonomy
    elif path == "/api/payroll/taxonomy" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        workspace_id = query.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        res = payroll_taxonomy_table.query(
            KeyConditionExpression=Key("workspaceId").eq(workspace_id)
        )
        items = [normalize_taxonomy_item(item) for item in res.get("Items", [])]
        items.sort(key=lambda item: (item.get("type", ""), item.get("name", "").lower()))
        return respond(200, {
            "items": items,
            "roles": [item for item in items if item.get("type") == "role"],
            "departments": [item for item in items if item.get("type") == "department"],
        })

    elif path == "/api/payroll/taxonomy" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        taxonomy_type = body.get("type")
        name = str(body.get("name", "")).strip()
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})
        if taxonomy_type not in ["role", "department"]:
            return respond(400, {"error": "invalid_request", "error_description": "type must be 'role' or 'department'"})
        if not name:
            return respond(400, {"error": "invalid_request", "error_description": "name is required"})

        now = int(time.time() * 1000)
        taxonomy_id = body.get("taxonomyId") or body.get("id") or f"{taxonomy_type}#{slugify(name)}"
        item = {
            **body,
            "workspaceId": workspace_id,
            "taxonomyId": taxonomy_id,
            "id": taxonomy_id,
            "type": taxonomy_type,
            "name": name,
            "description": body.get("description", ""),
            "createdBy": body.get("createdBy", username),
            "createdAt": body.get("createdAt", now),
            "updatedAt": body.get("updatedAt", now),
        }
        payroll_taxonomy_table.put_item(Item=to_dynamodb_value(item))
        return respond(200, {"status": "success", "item": normalize_taxonomy_item(item)})

    # Route: PUT/DELETE /api/payroll/taxonomy/{id}
    elif path.startswith("/api/payroll/taxonomy/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        taxonomy_id = path.split("/")[-1]
        workspace_id = body.get("workspaceId") or query.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        item = payroll_taxonomy_table.get_item(Key={"workspaceId": workspace_id, "taxonomyId": taxonomy_id}).get("Item")
        if not item:
            return respond(404, {"error": "not_found", "error_description": "Payroll taxonomy item not found"})

        updates = {**body, "updatedAt": int(time.time() * 1000)}
        if "name" in updates:
            updates["name"] = str(updates.get("name", "")).strip()
            if not updates["name"]:
                return respond(400, {"error": "invalid_request", "error_description": "name is required"})
        if "type" in updates and updates["type"] not in ["role", "department"]:
            return respond(400, {"error": "invalid_request", "error_description": "type must be 'role' or 'department'"})

        updated = update_item(
            payroll_taxonomy_table,
            {"workspaceId": workspace_id, "taxonomyId": taxonomy_id},
            updates,
            {"workspaceId", "taxonomyId", "id", "createdAt", "createdBy"},
        )
        return respond(200, {"status": "success", "item": normalize_taxonomy_item(updated)})

    elif path.startswith("/api/payroll/taxonomy/") and http_method == "DELETE":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        taxonomy_id = path.split("/")[-1]
        workspace_id = query.get("workspaceId") or body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        payroll_taxonomy_table.delete_item(Key={"workspaceId": workspace_id, "taxonomyId": taxonomy_id})
        return respond(200, {"status": "success", "taxonomyId": taxonomy_id})

    # Route: GET/POST /api/payroll/runs
    elif path == "/api/payroll/runs" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        workspace_id = query.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        res = payroll_runs_table.query(
            KeyConditionExpression=Key("workspaceId").eq(workspace_id)
        )
        runs = [normalize_payroll_run_item(item) for item in res.get("Items", [])]
        runs.sort(key=lambda run: run.get("createdAt", 0), reverse=True)
        return respond(200, {"runs": runs})

    elif path == "/api/payroll/runs" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        now = int(time.time() * 1000)
        run_id = body.get("runId") or body.get("id") or create_id("run")
        line_items = body.get("lineItems", [])
        total_amount = body.get("totalAmount")
        if total_amount is None:
            total_amount = sum(float(item.get("amount", 0) or 0) for item in line_items)
        item = {
            **body,
            "workspaceId": workspace_id,
            "runId": run_id,
            "id": run_id,
            "lineItems": line_items,
            "totalAmount": total_amount,
            "employeeCount": body.get("employeeCount", len(line_items)),
            "status": body.get("status", "pending_approval"),
            "createdBy": username,
            "createdAt": body.get("createdAt", now),
            "updatedAt": body.get("updatedAt", now),
        }
        payroll_runs_table.put_item(Item=to_dynamodb_value(item))
        return respond(200, {"status": "success", "run": normalize_payroll_run_item(item)})

    # Route: PUT /api/payroll/runs/{id}
    elif path.startswith("/api/payroll/runs/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        run_id = path.split("/")[-1]
        workspace_id = body.get("workspaceId") or query.get("workspaceId")
        run = None
        if workspace_id:
            run = payroll_runs_table.get_item(Key={"workspaceId": workspace_id, "runId": run_id}).get("Item")
        if not run:
            run = find_by_sort_key(payroll_runs_table, "runId", run_id) or find_by_sort_key(payroll_runs_table, "id", run_id)
        if not run:
            return respond(404, {"error": "not_found", "error_description": "Payroll run not found"})

        key = {"workspaceId": run["workspaceId"], "runId": run.get("runId", run.get("id", run_id))}
        updated = update_item(
            payroll_runs_table,
            key,
            {**body, "updatedAt": int(time.time() * 1000)},
            {"workspaceId", "runId", "id", "createdAt", "createdBy"},
        )
        return respond(200, {"status": "success", "run": normalize_payroll_run_item(updated)})

    # Route: POST /api/invite/send
    elif path == "/api/invite/send" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        recipient_email = body.get("email")
        if not recipient_email:
            return respond(400, {"error": "invalid_request", "error_description": "email is required"})

        try:
            send_res = send_invite_email(
                recipient_email,
                body.get("workspaceName"),
                body.get("inviterName") or username,
                body.get("role"),
            )
            return respond(200, {"status": "success", "messageId": send_res.get("MessageId")})
        except Exception as exc:
            return respond(502, {"error": "email_send_failed", "error_description": str(exc)})

    # Route: POST /api/chat (Proxy for OpenCode completions to avoid CORS)
    elif path == "/api/chat" and http_method == "POST":
        import urllib.request
        import urllib.error
        
        api_url = "https://opencode.ai/zen/v1/chat/completions"
        api_key = "sk-qheeoxksGwgHDCcr0F6u9fisSj7L46o9xDuXYbqForNleRwb0ZMTkYeOofHmhRHK"
        
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
