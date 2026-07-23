import json
import os
import time
import uuid
import csv
import io
import re
from decimal import Decimal
from urllib.parse import quote
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
WAITLIST_TABLE_NAME = os.environ.get("WAITLIST_TABLE", "zexvro-waitlist")
AUDIT_TABLE_NAME = os.environ.get("AUDIT_TABLE", "zexvro-workspace-audit")
WAITLIST_ADMIN_SECRET = (os.environ.get("WAITLIST_ADMIN_SECRET") or "").strip()

devices_table = dynamodb.Table(DEVICES_TABLE_NAME)
memory_table = dynamodb.Table(MEMORY_TABLE_NAME)
workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)
projects_table = dynamodb.Table(PROJECTS_TABLE_NAME)
employees_table = dynamodb.Table(EMPLOYEES_TABLE_NAME)
payroll_runs_table = dynamodb.Table(PAYROLL_TABLE_NAME)
payroll_taxonomy_table = dynamodb.Table(PAYROLL_TAXONOMY_TABLE_NAME)
waitlist_table = dynamodb.Table(WAITLIST_TABLE_NAME)
audit_table = dynamodb.Table(AUDIT_TABLE_NAME)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ec2 = boto3.client("ec2", region_name=os.environ.get("AWS_REGION", "us-east-1"))

try:
    from brevo_mail import MailError, send_email as brevo_send_email
except ImportError:  # package layout / Lambda zip may flatten modules
    try:
        from scratch_lambda.brevo_mail import MailError, send_email as brevo_send_email  # type: ignore
    except ImportError:
        MailError = Exception  # type: ignore

        def brevo_send_email(**kwargs):  # type: ignore
            raise RuntimeError("brevo_mail module missing from deployment package")

# GSI Name for querying by user_code
USER_CODE_GSI = os.environ.get("USER_CODE_GSI", "user_code-index")

# Expiry duration in seconds
CODE_EXPIRY_SECONDS = 300

# On-demand RapidSNARK / prove worker (EC2). Optional — if unset, API reports unconfigured.
ZK_WORKER_INSTANCE_ID = (os.environ.get("ZK_WORKER_INSTANCE_ID") or "").strip()
# Prefer fixed URL (ALB / Elastic IP / Lightsail). Else use instance public IP + port.
ZK_PROVER_URL = (os.environ.get("ZK_PROVER_URL") or "").strip().rstrip("/")
ZK_PROVER_PORT = int(os.environ.get("ZK_PROVER_PORT") or "8787")
ZK_PROVER_SHARED_SECRET = (os.environ.get("ZK_PROVER_SHARED_SECRET") or "").strip()


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


def _zk_worker_configured():
    return bool(ZK_WORKER_INSTANCE_ID or ZK_PROVER_URL)


def get_zk_worker_status():
    """Return EC2 worker power state + resolved prove base URL."""
    if not ZK_WORKER_INSTANCE_ID and not ZK_PROVER_URL:
        return {
            "configured": False,
            "provider": None,
            "state": "unconfigured",
            "online": False,
            "instanceId": None,
            "publicIp": None,
            "proverUrl": None,
            "message": "Set ZK_WORKER_INSTANCE_ID and/or ZK_PROVER_URL on Lambda to enable remote proving.",
        }

    if ZK_WORKER_INSTANCE_ID:
        try:
            res = ec2.describe_instances(InstanceIds=[ZK_WORKER_INSTANCE_ID])
            reservations = res.get("Reservations") or []
            instances = (reservations[0].get("Instances") if reservations else None) or []
            if not instances:
                return {
                    "configured": True,
                    "provider": "ec2",
                    "state": "not_found",
                    "online": False,
                    "instanceId": ZK_WORKER_INSTANCE_ID,
                    "publicIp": None,
                    "proverUrl": ZK_PROVER_URL or None,
                    "message": f"Instance {ZK_WORKER_INSTANCE_ID} not found",
                }
            inst = instances[0]
            state = (inst.get("State") or {}).get("Name") or "unknown"
            public_ip = inst.get("PublicIpAddress")
            private_ip = inst.get("PrivateIpAddress")
            base = ZK_PROVER_URL
            if not base and public_ip:
                base = f"http://{public_ip}:{ZK_PROVER_PORT}"
            online = state == "running"
            return {
                "configured": True,
                "provider": "ec2",
                "state": state,
                "online": online,
                "instanceId": ZK_WORKER_INSTANCE_ID,
                "publicIp": public_ip,
                "privateIp": private_ip,
                "proverUrl": base,
                "message": "running" if online else f"instance is {state}",
            }
        except Exception as exc:
            return {
                "configured": True,
                "provider": "ec2",
                "state": "error",
                "online": False,
                "instanceId": ZK_WORKER_INSTANCE_ID,
                "publicIp": None,
                "proverUrl": ZK_PROVER_URL or None,
                "message": str(exc),
            }

    # Fixed URL only (e.g. Lightsail convenience box)
    return {
        "configured": True,
        "provider": "url",
        "state": "external",
        "online": True,
        "instanceId": None,
        "publicIp": None,
        "proverUrl": ZK_PROVER_URL,
        "message": "Using fixed ZK_PROVER_URL (manage power in AWS console if needed)",
    }


def start_zk_worker():
    if not ZK_WORKER_INSTANCE_ID:
        if ZK_PROVER_URL:
            return {
                "status": "ok",
                "state": "external",
                "online": True,
                "message": "Fixed prover URL configured — no EC2 start needed",
                **{k: get_zk_worker_status()[k] for k in ("configured", "provider", "proverUrl", "instanceId")},
            }
        return {
            "status": "error",
            "state": "unconfigured",
            "online": False,
            "message": "ZK_WORKER_INSTANCE_ID not set on Lambda",
        }
    try:
        ec2.start_instances(InstanceIds=[ZK_WORKER_INSTANCE_ID])
        st = get_zk_worker_status()
        st["status"] = "ok"
        st["message"] = "Start requested — wait until state is running (30s–2min cold start)"
        return st
    except Exception as exc:
        return {
            "status": "error",
            "state": "error",
            "online": False,
            "instanceId": ZK_WORKER_INSTANCE_ID,
            "message": str(exc),
        }


def stop_zk_worker():
    if not ZK_WORKER_INSTANCE_ID:
        if ZK_PROVER_URL:
            return {
                "status": "ok",
                "state": "external",
                "online": True,
                "message": "Fixed prover URL — stop the Lightsail/EC2 box in AWS console manually",
            }
        return {
            "status": "error",
            "state": "unconfigured",
            "online": False,
            "message": "ZK_WORKER_INSTANCE_ID not set on Lambda",
        }
    try:
        ec2.stop_instances(InstanceIds=[ZK_WORKER_INSTANCE_ID])
        st = get_zk_worker_status()
        st["status"] = "ok"
        st["message"] = "Stop requested — EBS volume may still incur a small charge while stopped"
        return st
    except Exception as exc:
        return {
            "status": "error",
            "state": "error",
            "online": False,
            "instanceId": ZK_WORKER_INSTANCE_ID,
            "message": str(exc),
        }


def _zk_worker_base(auto_start=False):
    """Resolve worker base URL or a structured browser_fallback/error payload.

    auto_start=True will request EC2 start when the instance is stopped/stopping.
    Caller still must wait for /health (cold start can take 30–90s).
    """
    st = get_zk_worker_status()
    if not st.get("configured"):
        return None, {
            "mode": "browser_fallback",
            "reason": "worker_unconfigured",
            "message": st.get("message"),
            "worker": st,
        }

    state = (st.get("state") or "").lower()
    if auto_start and st.get("provider") == "ec2" and state in (
        "stopped", "stopping", "pending", "shutting-down",
    ):
        try:
            if state in ("stopped", "stopping"):
                start_zk_worker()
            # re-read after start request
            st = get_zk_worker_status()
            state = (st.get("state") or "").lower()
        except Exception as exc:
            return None, {
                "mode": "browser_fallback",
                "reason": "worker_start_failed",
                "message": f"Failed to start prover EC2: {exc}",
                "worker": st,
            }

    if not st.get("online") and st.get("provider") == "ec2":
        return None, {
            "mode": "browser_fallback",
            "reason": "worker_offline",
            "message": (
                "Prover EC2 is starting — retry in ~30–90s, or wait for auto-wake."
                if state in ("pending", "running")
                else "Prover EC2 is not running. Auto-start requested; wait ~1 min and retry."
            ),
            "worker": st,
            "starting": True,
        }
    base = st.get("proverUrl")
    if not base:
        return None, {
            "mode": "browser_fallback",
            "reason": "no_prover_url",
            "message": "Worker has no public IP / ZK_PROVER_URL yet (still starting?)",
            "worker": st,
            "starting": True,
        }
    return base, st


def _wait_worker_ready(base, max_wait_s=75):
    """Poll worker /health until ok or timeout. Returns (ok, detail)."""
    import urllib.request
    import urllib.error

    deadline = time.time() + max_wait_s
    last_err = "not_tried"
    while time.time() < deadline:
        try:
            req = urllib.request.Request(
                f"{base.rstrip('/')}/health",
                headers={"User-Agent": "ZexvroZkProxy/1.0"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=4) as res:
                body = json.loads(res.read().decode("utf-8"))
                if body.get("ok"):
                    return True, body
                last_err = f"health_not_ok:{body}"
        except Exception as e:
            last_err = str(e)
        time.sleep(2)
    return False, last_err


def _proxy_zk_post(path, body_obj, timeout=180, auto_start=False, wait_ready_s=0):
    """POST JSON to worker path. Returns parsed JSON with mode tags."""
    import urllib.request
    import urllib.error

    base, st_or_err = _zk_worker_base(auto_start=auto_start)
    if base is None:
        # If we requested start, optionally wait for instance+health
        if auto_start and wait_ready_s > 0 and ZK_PROVER_URL:
            # Prefer fixed EIP URL while instance is coming up
            ready_base = ZK_PROVER_URL
            ok, detail = _wait_worker_ready(ready_base, max_wait_s=wait_ready_s)
            if ok:
                base = ready_base
                st = get_zk_worker_status()
            else:
                st_or_err = dict(st_or_err or {})
                st_or_err["healthWait"] = detail
                return st_or_err
        else:
            return st_or_err
    st = st_or_err if isinstance(st_or_err, dict) else get_zk_worker_status()

    if wait_ready_s > 0:
        ok, detail = _wait_worker_ready(base, max_wait_s=min(wait_ready_s, 75))
        if not ok:
            return {
                "mode": "browser_fallback",
                "reason": "worker_not_ready",
                "message": f"Worker health not ready: {detail}",
                "worker": st,
                "starting": True,
            }

    url = f"{base}{path}"
    payload = json.dumps(body_obj).encode("utf-8")
    headers_out = {"Content-Type": "application/json", "User-Agent": "ZexvroZkProxy/1.0"}
    if ZK_PROVER_SHARED_SECRET:
        headers_out["X-Zexvro-Prover-Secret"] = ZK_PROVER_SHARED_SECRET

    req = urllib.request.Request(url, data=payload, headers=headers_out, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
            data["mode"] = data.get("mode") or "remote"
            data["worker"] = {"state": st.get("state"), "proverUrl": base}
            return data
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_body = {"error": f"HTTP {e.code}"}
        return {
            "mode": "error",
            "error": err_body.get("error") or err_body.get("message") or f"HTTP {e.code}",
            "detail": err_body,
            "worker": st,
        }
    except Exception as e:
        return {
            "mode": "browser_fallback",
            "reason": "proxy_failed",
            "message": str(e),
            "worker": st,
        }


def proxy_zk_prove(circuit_input):
    """Forward Groth16 fullProve input to the worker HTTP service."""
    return _proxy_zk_post("/prove", {"input": circuit_input}, timeout=120, auto_start=True, wait_ready_s=60)


def proxy_zk_merkle(contract, commitments):
    """Forward merkle snapshot / path build to worker (server-side RPC + poseidon)."""
    return _proxy_zk_post(
        "/merkle",
        {"contract": contract, "commitments": commitments or []},
        timeout=180,
        auto_start=True,
        wait_ready_s=60,
    )


def proxy_zk_settle(body):
    """Start async settle job on worker (returns jobId immediately). Auto-wakes EC2."""
    return _proxy_zk_post(
        "/settle",
        body or {},
        timeout=30,
        auto_start=True,
        wait_ready_s=75,
    )


def proxy_zk_job(job_id):
    """Poll async worker job status."""
    import urllib.request
    import urllib.error

    base, st_or_err = _zk_worker_base(auto_start=False)
    if base is None:
        # During brief restarts still try fixed URL
        if ZK_PROVER_URL:
            base = ZK_PROVER_URL
            st = get_zk_worker_status()
        else:
            return st_or_err
    else:
        st = st_or_err
    url = f"{base}/jobs/{job_id}"
    headers_out = {"User-Agent": "ZexvroZkProxy/1.0"}
    if ZK_PROVER_SHARED_SECRET:
        headers_out["X-Zexvro-Prover-Secret"] = ZK_PROVER_SHARED_SECRET
    req = urllib.request.Request(url, headers=headers_out, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode("utf-8"))
            data["mode"] = data.get("mode") or "remote"
            data["worker"] = {"state": st.get("state"), "proverUrl": base}
            return data
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_body = {"error": f"HTTP {e.code}"}
        return {
            "mode": "error",
            "error": err_body.get("error") or f"HTTP {e.code}",
            "detail": err_body,
            "worker": st,
        }
    except Exception as e:
        return {
            "mode": "browser_fallback",
            "reason": "proxy_failed",
            "message": str(e),
            "worker": st,
        }


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


# Workspace roles allowed to invite members (Owner/Admin). Matches frontend rbac matrix.
_TEAM_INVITE_ROLES = {"Owner", "Admin"}
_SETTINGS_WRITE_ROLES = {"Owner", "Admin"}


def _norm_identity(value):
    return str(value or "").strip().lower()


def resolve_workspace_member_role(workspace, username, email=None):
    """Return workspace role for caller, or None if not a member."""
    if not workspace:
        return None
    owner_id = _norm_identity(workspace.get("ownerId"))
    uname = _norm_identity(username)
    em = _norm_identity(email)
    if owner_id and (owner_id == uname or (em and owner_id == em)):
        return "Owner"
    for member in workspace.get("members") or []:
        m_email = _norm_identity(member.get("email"))
        m_id = _norm_identity(member.get("id"))
        m_name = _norm_identity(member.get("name"))
        status = str(member.get("status") or "active").lower()
        if status in ("inactive", "revoked", "expired"):
            continue
        if (em and m_email == em) or (uname and (m_id == uname or m_name == uname or m_email.split("@")[0] == uname)):
            if status in ("invited", "pending"):
                return None
            return member.get("role") or "Viewer"
    return None


def require_workspace_role(workspace, username, allowed_roles, email=None):
    role = resolve_workspace_member_role(workspace, username, email=email)
    if not role:
        return None, respond(403, {
            "error": "forbidden",
            "error_description": "You are not an active member of this workspace",
        })
    if role not in allowed_roles:
        return role, respond(403, {
            "error": "forbidden",
            "error_description": f"Role {role} cannot perform this action",
            "role": role,
        })
    return role, None


def normalize_workspace_item(item):
    if not item:
        return item
    item.setdefault("id", item.get("workspaceId"))
    item.setdefault("workspaceId", item.get("id"))
    return item


def _caller_email(event, username):
    email = ""
    try:
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        claims = authorizer.get("claims", {}) or {}
        email = (claims.get("email") or "").strip().lower()
    except Exception:
        pass
    if not email and username and "@" in str(username):
        email = str(username).strip().lower()
    if not email:
        # Manual JWT decode fallback
        try:
            headers = event.get("headers") or {}
            auth = headers.get("Authorization") or headers.get("authorization") or ""
            if auth.startswith("Bearer "):
                import base64
                parts = auth.split(" ", 1)[1].split(".")
                if len(parts) == 3:
                    payload_b64 = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                    payload = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
                    email = (payload.get("email") or "").strip().lower()
        except Exception:
            pass
    return email


def list_shared_workspaces_for_user(username, email=None):
    """Scan workspaces where caller is an active non-owner member."""
    uname = _norm_identity(username)
    em = _norm_identity(email)
    shared = []
    try:
        res = workspaces_table.scan()
        items = res.get("Items", [])
        while res.get("LastEvaluatedKey"):
            res = workspaces_table.scan(ExclusiveStartKey=res["LastEvaluatedKey"])
            items.extend(res.get("Items", []))
        for item in items:
            owner = _norm_identity(item.get("ownerId"))
            if owner and (owner == uname or (em and owner == em)):
                continue
            role = resolve_workspace_member_role(item, username, email=email)
            if role:
                shared.append(normalize_workspace_item(item))
    except Exception as exc:
        print(f"[list_shared_workspaces] scan failed: {exc}")
    return shared


def find_workspace_by_id(workspace_id):
    """Locate a workspace row by workspaceId (any owner)."""
    if not workspace_id:
        return None
    try:
        found = find_by_sort_key(workspaces_table, "workspaceId", workspace_id)
        if found:
            return found
        found = find_by_sort_key(workspaces_table, "id", workspace_id)
        return found
    except Exception:
        return None


def append_audit_event(
    workspace_id,
    *,
    action,
    actor_id=None,
    actor_email=None,
    target=None,
    project_id=None,
    meta=None,
    severity="info",
):
    """
    Append-only workspace audit row. Fail-open: log and return None on error
    so primary mutations are not blocked by audit outages.
    """
    ws = (workspace_id or "").strip()
    if not ws or not action:
        return None
    now_ms = int(time.time() * 1000)
    event_id = str(uuid.uuid4())
    # Zero-padded ms + uuid so query KeyCondition RANGE is chronological.
    event_key = f"{now_ms:013d}#{event_id}"
    item = {
        "workspaceId": ws,
        "eventKey": event_key,
        "eventId": event_id,
        "action": str(action)[:128],
        "actorId": (actor_id or "")[:128] or None,
        "actorEmail": (actor_email or "").strip().lower()[:256] or None,
        "target": (target or "")[:512] or None,
        "projectId": (project_id or "").strip()[:128] or None,
        "meta": meta if isinstance(meta, dict) else {},
        "severity": severity if severity in ("info", "warning", "critical") else "info",
        "createdAt": now_ms,
    }
    try:
        audit_table.put_item(Item=to_dynamodb_value(item))
        return {
            "id": event_id,
            "eventKey": event_key,
            "workspaceId": ws,
            "action": item["action"],
            "actorId": item.get("actorId") or "",
            "actorEmail": item.get("actorEmail") or "",
            "target": item.get("target") or "",
            "projectId": item.get("projectId") or "",
            "meta": item.get("meta") or {},
            "severity": item["severity"],
            "createdAt": now_ms,
        }
    except Exception as exc:
        print(f"[append_audit_event] failed ws={ws} action={action}: {exc}")
        return None


def list_audit_events(workspace_id, *, limit=50, cursor=None, project_id=None):
    """List audit events newest-first for a workspace (optional project filter)."""
    ws = (workspace_id or "").strip()
    if not ws:
        return [], None
    limit = max(1, min(int(limit or 50), 100))
    kwargs = {
        "KeyConditionExpression": Key("workspaceId").eq(ws),
        "ScanIndexForward": False,
        "Limit": limit,
    }
    if cursor:
        try:
            kwargs["ExclusiveStartKey"] = {
                "workspaceId": ws,
                "eventKey": cursor,
            }
        except Exception:
            pass
    try:
        res = audit_table.query(**kwargs)
    except Exception as exc:
        print(f"[list_audit_events] query failed: {exc}")
        return [], None

    items = res.get("Items") or []
    events = []
    pid_filter = (project_id or "").strip()
    for raw in items:
        if pid_filter and (raw.get("projectId") or "") != pid_filter:
            continue
        events.append({
            "id": raw.get("eventId") or (raw.get("eventKey") or "").split("#")[-1],
            "eventKey": raw.get("eventKey"),
            "workspaceId": raw.get("workspaceId") or ws,
            "action": raw.get("action") or "",
            "actorId": raw.get("actorId") or "",
            "actorEmail": raw.get("actorEmail") or "",
            "target": raw.get("target") or "",
            "projectId": raw.get("projectId") or "",
            "meta": raw.get("meta") or {},
            "severity": raw.get("severity") or "info",
            "createdAt": int(raw.get("createdAt") or 0),
        })

    next_cursor = None
    lek = res.get("LastEvaluatedKey")
    if lek and lek.get("eventKey"):
        next_cursor = lek["eventKey"]
    return events, next_cursor


def require_workspace_access(workspace_id, username, email=None):
    """Owner or active member may access workspace resources (projects, etc.)."""
    workspace = find_workspace_by_id(workspace_id)
    if not workspace:
        # Allow project list if workspace row missing but projects exist (legacy data)
        return None, None
    role = resolve_workspace_member_role(workspace, username, email=email)
    if not role:
        return None, respond(403, {
            "error": "forbidden",
            "error_description": "You are not a member of this workspace",
        })
    return workspace, None


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


def build_invite_accept_url(token, frontend_url=None):
    """Always build a tokenized accept URL. Never fall back to bare /dashboard."""
    clean = (token or "").strip()
    if not clean:
        raise ValueError("invite token is required for accept URL")
    base = (frontend_url or os.environ.get("FRONTEND_URL") or "https://console.zexvro.in").rstrip("/")
    return f"{base}/invite/accept?token={quote(clean, safe='')}"


def send_invite_email(recipient_email, workspace_name, inviter_name, role, token=None, expires_at=None):
    """Send branded workspace invite via Brevo."""
    accept_url = build_invite_accept_url(token)
    expires_label = _format_invite_expiry(expires_at) if expires_at else ""

    try:
        from email_templates import render_workspace_invite
    except ImportError:
        try:
            from scratch_lambda.email_templates import render_workspace_invite  # type: ignore
        except ImportError:
            render_workspace_invite = None

    if render_workspace_invite:
        subject, html_body, text_body = render_workspace_invite(
            recipient_email=recipient_email,
            workspace_name=workspace_name or "a ZEXVRO workspace",
            inviter_name=inviter_name or "A teammate",
            role=role or "Developer",
            accept_url=accept_url,
            expires_label=expires_label,
        )
    else:
        safe_workspace = workspace_name or "a ZEXVRO workspace"
        safe_role = role or "Developer"
        subject = f"ZEXVRO · Join {safe_workspace} as {safe_role}"
        html_body = f"<p>Accept: <a href=\"{accept_url}\">{accept_url}</a></p>"
        text_body = f"Accept: {accept_url}"

    result = brevo_send_email(
        to=recipient_email,
        subject=subject,
        html=html_body,
        text=text_body,
        tags=["zexvro-invite", "workspace-iam"],
    )
    return {"MessageId": result.get("messageId"), **result}


def _format_invite_expiry(expires_at):
    try:
        ms = int(expires_at)
        return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ms / 1000.0))
    except Exception:
        return str(expires_at)


def find_workspace_invite(token):
    """Scan workspaces for an invitation with the given accept token."""
    if not token:
        return None, None
    try:
        res = workspaces_table.scan()
        for item in res.get("Items", []):
            for invite in item.get("invitations") or []:
                if invite.get("token") == token:
                    return item, invite
    except Exception:
        return None, None
    return None, None


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
            "Access-Control-Allow-Headers": "Content-Type,Authorization,x-waitlist-secret,X-Waitlist-Secret",
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

        frontend_url = os.environ.get("FRONTEND_URL", "https://console.zexvro.in")

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

        caller_email = _caller_email(event, username)
        res = workspaces_table.query(
            KeyConditionExpression=Key("ownerId").eq(username)
        )
        owned = [normalize_workspace_item(item) for item in res.get("Items", [])]
        # Also query by email if Cognito username != ownerId used at create time
        if caller_email and caller_email != _norm_identity(username):
            try:
                res_email = workspaces_table.query(
                    KeyConditionExpression=Key("ownerId").eq(caller_email)
                )
                for item in res_email.get("Items", []):
                    wid = item.get("workspaceId") or item.get("id")
                    if not any((w.get("workspaceId") or w.get("id")) == wid for w in owned):
                        owned.append(normalize_workspace_item(item))
            except Exception:
                pass
        shared = list_shared_workspaces_for_user(username, email=caller_email)
        by_id = {}
        for w in owned + shared:
            wid = w.get("workspaceId") or w.get("id")
            if wid:
                by_id[wid] = w
        return respond(200, {"workspaces": list(by_id.values())})

    elif path == "/api/workspaces" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        now = int(time.time() * 1000)
        name = (body.get("name") or "Untitled Workspace").strip()
        # Dedupe: if owner already has a workspace with the same name, return it
        try:
            existing_res = workspaces_table.query(
                KeyConditionExpression=Key("ownerId").eq(username)
            )
            for existing in existing_res.get("Items", []):
                if str(existing.get("name") or "").strip().lower() == name.lower():
                    return respond(200, {
                        "status": "success",
                        "workspace": normalize_workspace_item(existing),
                        "deduped": True,
                    })
        except Exception as exc:
            print(f"[create workspace] dedupe query failed: {exc}")

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
            "name": name,
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

        _, role_err = require_workspace_role(workspace, username, _TEAM_INVITE_ROLES)
        if role_err:
            return role_err

        invited_role = body.get("role", "Developer")
        if invited_role not in ("Admin", "Developer", "Finance", "Viewer", "Agent"):
            return respond(400, {
                "error": "invalid_request",
                "error_description": "Invalid invite role",
            })
        if invited_role == "Owner":
            return respond(400, {
                "error": "invalid_request",
                "error_description": "Cannot invite as Owner",
            })

        now = int(time.time() * 1000)
        member = {
            "id": body.get("id") or create_id("member"),
            "email": body.get("email", ""),
            "name": body.get("name") or body.get("email", ""),
            "role": invited_role,
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

    # Route: GET /api/workspaces/{id} — full workspace for members (roster sync)
    elif (
        path.startswith("/api/workspaces/")
        and http_method == "GET"
        and path.count("/") == 3
        and not path.endswith("/invite")
    ):
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        workspace_id = path.strip("/").split("/")[-1]
        caller_email = _caller_email(event, username)
        workspace, access_err = require_workspace_access(workspace_id, username, email=caller_email)
        if access_err and workspace is not None:
            return access_err
        if not workspace:
            # Soft fallback: scan by id even if access helper returned None
            workspace = find_workspace_by_id(workspace_id)
        if not workspace:
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})
        # If found, ensure caller is owner or member
        role = resolve_workspace_member_role(workspace, username, email=caller_email)
        if not role:
            return respond(403, {
                "error": "forbidden",
                "error_description": "You are not a member of this workspace",
            })
        return respond(200, {"workspace": normalize_workspace_item(workspace)})

    # Route: PUT/DELETE /api/workspaces/{id}
    elif path.startswith("/api/workspaces/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = path.split("/")[-1]
        res = workspaces_table.get_item(Key={"ownerId": username, "workspaceId": workspace_id})
        workspace = res.get("Item")
        if not workspace:
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})

        _, role_err = require_workspace_role(workspace, username, _SETTINGS_WRITE_ROLES)
        if role_err:
            return role_err

        # Allow Owner/Admin to update members + invitations (IAM invite flow).
        now_ms = int(time.time() * 1000)
        updated = update_item(
            workspaces_table,
            {"ownerId": username, "workspaceId": workspace_id},
            {**body, "updatedAt": now_ms},
            {"ownerId", "workspaceId", "id", "createdAt"},
        )
        caller_email = _caller_email(event, username)
        changed = [k for k in ("name", "plan", "settings", "members", "invitations") if k in body]
        if changed:
            append_audit_event(
                workspace_id,
                action="workspace.updated",
                actor_id=username,
                actor_email=caller_email,
                target=workspace_id,
                meta={"fields": changed},
            )
        return respond(200, {"status": "success", "workspace": normalize_workspace_item(updated)})

    # Route: GET /api/workspaces/{id}/audit — durable workspace audit ledger
    elif (
        path.startswith("/api/workspaces/")
        and path.endswith("/audit")
        and http_method == "GET"
    ):
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        parts = path.strip("/").split("/")
        # workspaces / {id} / audit
        if len(parts) < 3:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId required"})
        workspace_id = parts[1]
        caller_email = _caller_email(event, username)
        workspace, access_err = require_workspace_access(workspace_id, username, email=caller_email)
        if access_err:
            return access_err
        if not workspace:
            workspace = find_workspace_by_id(workspace_id)
        if not workspace:
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})
        role = resolve_workspace_member_role(workspace, username, email=caller_email)
        if not role:
            return respond(403, {
                "error": "forbidden",
                "error_description": "You are not a member of this workspace",
            })
        query = get_query_params(event)
        try:
            limit = int(query.get("limit") or 50)
        except (TypeError, ValueError):
            limit = 50
        events, next_cursor = list_audit_events(
            workspace_id,
            limit=limit,
            cursor=query.get("cursor"),
            project_id=query.get("projectId"),
        )
        return respond(200, {
            "events": events,
            "nextCursor": next_cursor,
            "workspaceId": workspace_id,
        })

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

        # Auth only for list — invitees may not be written to Dynamo members yet (local accept).
        # Membership is enforced on write below.
        res = projects_table.query(
            KeyConditionExpression=Key("workspaceId").eq(workspace_id)
        )
        projects = [normalize_project_item(item) for item in res.get("Items", [])]
        # Ensure workspaceId is set for FE filtering
        for p in projects:
            p.setdefault("workspaceId", workspace_id)
        return respond(200, {"projects": projects})

    elif path == "/api/projects" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        workspace_id = body.get("workspaceId")
        if not workspace_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId is required"})

        caller_email = _caller_email(event, username)
        workspace_row, access_err = require_workspace_access(workspace_id, username, email=caller_email)
        # Soft: if workspace row missing, allow create (legacy); if found without role, forbid
        if workspace_row is not None and access_err:
            return access_err

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
        append_audit_event(
            workspace_id,
            action="project.created",
            actor_id=username,
            actor_email=caller_email,
            target=body.get("name") or project_id,
            project_id=project_id,
            meta={"projectId": project_id},
        )
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
                "stealthMetaAddress": row.get("stealthMetaAddress", ""),
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

    # Route: GET/POST /api/proofs
    elif path == "/api/proofs" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        query = get_query_params(event)
        project_id = query.get("projectId") or query.get("workspaceId")

        res = memory_table.get_item(Key={"username": username})
        memory_data = res.get("Item", {}).get("memory", {})
        proofs = memory_data.get("proofs", [])
        
        if project_id:
            proofs = [p for p in proofs if p.get("projectId") == project_id]
            
        return respond(200, {"proofs": proofs})

    elif path == "/api/proofs" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        project_id = body.get("projectId")
        payment_id = body.get("paymentId")
        proof_system = body.get("proofSystem", "Groth16")

        if not project_id or not payment_id:
            return respond(400, {"error": "invalid_request", "error_description": "projectId and paymentId are required"})

        res = memory_table.get_item(Key={"username": username})
        item = res.get("Item") or {"username": username, "memory": {}}
        memory_data = item.get("memory", {})
        proofs = memory_data.get("proofs", [])

        # Prefer client-supplied id so frontend local + AWS stay in sync
        proof_id = body.get("id") or create_id("proof")
        new_proof = {
            "id": proof_id,
            "projectId": project_id,
            "paymentId": payment_id,
            "proofSystem": proof_system,
            "status": body.get("status", "queued"),
            "verificationKey": body.get("verificationKey"),
            "proofData": body.get("proofData"),
            "generationTimeMs": body.get("generationTimeMs"),
            "createdAt": int(time.time() * 1000),
            "verifiedAt": body.get("verifiedAt"),
        }

        proofs.append(new_proof)
        memory_data["proofs"] = proofs
        memory_table.put_item(Item={
            "username": username,
            "memory": to_dynamodb_value(memory_data)
        })

        return respond(200, {"status": "success", "proof": new_proof})

    # Route: PUT /api/proofs/{id}  (upsert — create if missing)
    elif path.startswith("/api/proofs/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        proof_id = path.split("/")[-1]

        res = memory_table.get_item(Key={"username": username})
        item = res.get("Item") or {"username": username, "memory": {}}
        memory_data = item.get("memory", {})
        proofs = memory_data.get("proofs", [])

        proof = None
        for p in proofs:
            if p.get("id") == proof_id:
                proof = p
                break

        if not proof:
            proof = {
                "id": proof_id,
                "projectId": body.get("projectId") or "",
                "paymentId": body.get("paymentId") or "",
                "proofSystem": body.get("proofSystem", "Groth16"),
                "status": body.get("status", "queued"),
                "verificationKey": body.get("verificationKey"),
                "proofData": body.get("proofData"),
                "generationTimeMs": body.get("generationTimeMs"),
                "createdAt": int(time.time() * 1000),
                "verifiedAt": body.get("verifiedAt"),
            }
            proofs.append(proof)
        else:
            for field in ["status", "verificationKey", "proofData", "generationTimeMs", "verifiedAt", "projectId", "paymentId", "proofSystem"]:
                if field in body:
                    proof[field] = body[field]

        memory_data["proofs"] = proofs
        memory_table.put_item(Item={
            "username": username,
            "memory": to_dynamodb_value(memory_data)
        })

        return respond(200, {"status": "success", "proof": proof})

    # Route: GET /api/zk-notes (list user's deposit notes)
    elif path == "/api/zk-notes" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        res = memory_table.get_item(Key={"username": username})
        memory_data = res.get("Item", {}).get("memory", {})
        notes = memory_data.get("zkNotes", [])
        return respond(200, {"notes": notes})

    # Route: POST /api/zk-notes (save a deposit note)
    elif path == "/api/zk-notes" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        commitment = body.get("commitment")
        if not commitment:
            return respond(400, {"error": "invalid_request", "error_description": "commitment is required"})

        res = memory_table.get_item(Key={"username": username})
        item = res.get("Item") or {"username": username, "memory": {}}
        memory_data = item.get("memory", {})
        notes = memory_data.get("zkNotes", [])

        # Deduplicate by commitment
        for existing in notes:
            if existing.get("commitment") == commitment:
                return respond(200, {"status": "success", "note": existing})

        note_id = create_id("zkn")
        new_note = {
            "id": note_id,
            "secret": body.get("secret", ""),
            "nullifier": body.get("nullifier", ""),
            "commitment": commitment,
            "nullifierHash": body.get("nullifierHash", ""),
            "index": body.get("index", 0),
            "spent": body.get("spent", False),
            "timestamp": body.get("timestamp", int(time.time() * 1000)),
            "createdAt": int(time.time() * 1000),
        }

        notes.append(new_note)
        memory_data["zkNotes"] = notes
        memory_table.put_item(Item={
            "username": username,
            "memory": to_dynamodb_value(memory_data)
        })

        return respond(200, {"status": "success", "note": new_note})

    # Route: PUT /api/zk-notes/{id} (mark note spent, etc.)
    elif path.startswith("/api/zk-notes/") and http_method == "PUT":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        note_id = path.split("/")[-1]

        res = memory_table.get_item(Key={"username": username})
        item = res.get("Item")
        if not item:
            return respond(404, {"error": "not_found", "error_description": "User memory not found"})

        memory_data = item.get("memory", {})
        notes = memory_data.get("zkNotes", [])

        target = None
        for n in notes:
            if n.get("id") == note_id:
                target = n
                break

        if not target:
            return respond(404, {"error": "not_found", "error_description": "Note not found"})

        for field in ["spent", "nullifierHash", "index"]:
            if field in body:
                target[field] = body[field]

        memory_data["zkNotes"] = notes
        memory_table.put_item(Item={
            "username": username,
            "memory": to_dynamodb_value(memory_data)
        })

        return respond(200, {"status": "success", "note": target})

    # Route: DELETE /api/zk-notes/{id}
    elif path.startswith("/api/zk-notes/") and http_method == "DELETE":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        note_id = path.split("/")[-1]

        res = memory_table.get_item(Key={"username": username})
        item = res.get("Item")
        if not item:
            return respond(404, {"error": "not_found", "error_description": "User memory not found"})

        memory_data = item.get("memory", {})
        notes = memory_data.get("zkNotes", [])
        notes = [n for n in notes if n.get("id") != note_id]
        memory_data["zkNotes"] = notes
        memory_table.put_item(Item={
            "username": username,
            "memory": to_dynamodb_value(memory_data)
        })

        return respond(200, {"status": "success"})

    # Route: POST /api/invite/send — IAM-style tokenized invite email
    elif path == "/api/invite/send" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        recipient_email = (body.get("email") or "").strip().lower()
        if not recipient_email or not EMAIL_RE.match(recipient_email):
            return respond(400, {"error": "invalid_request", "error_description": "valid email is required"})

        token = (body.get("token") or "").strip()
        if not token:
            return respond(400, {"error": "invalid_request", "error_description": "token is required"})

        role = body.get("role") or "Developer"
        workspace_name = body.get("workspaceName")
        try:
            accept_url = build_invite_accept_url(token)
        except ValueError as exc:
            return respond(400, {"error": "invalid_request", "error_description": str(exc)})

        try:
            send_res = send_invite_email(
                recipient_email,
                workspace_name,
                body.get("inviterName") or username,
                role,
                token=token,
                expires_at=body.get("expiresAt"),
            )
            caller_email = _caller_email(event, username)
            ws_id = (body.get("workspaceId") or "").strip()
            if ws_id:
                append_audit_event(
                    ws_id,
                    action="invite.sent",
                    actor_id=username,
                    actor_email=caller_email,
                    target=recipient_email,
                    meta={
                        "role": role,
                        "inviteId": body.get("inviteId") or "",
                        "workspaceName": workspace_name or "",
                    },
                )
            return respond(200, {
                "status": "success",
                "messageId": send_res.get("MessageId"),
                "acceptUrl": accept_url,
            })
        except ValueError as exc:
            return respond(400, {"error": "invalid_request", "error_description": str(exc)})
        except Exception as exc:
            return respond(502, {"error": "email_send_failed", "error_description": str(exc)})

    # Route: GET /api/invite/{token} — preview invite (auth optional for UX)
    elif path.startswith("/api/invite/") and http_method == "GET" and path.count("/") == 3:
        token = path.strip("/").split("/")[-1]
        workspace, invite = find_workspace_invite(token)
        if not invite:
            return respond(404, {"error": "not_found", "error_description": "Invitation not found"})
        status = invite.get("status", "pending")
        expires_at = int(invite.get("expiresAt") or 0)
        if status == "pending" and expires_at and expires_at < int(time.time() * 1000):
            status = "expired"
        return respond(200, {
            "invite": {
                "id": invite.get("id"),
                "workspaceId": invite.get("workspaceId") or workspace.get("workspaceId") or workspace.get("id"),
                "workspaceName": invite.get("workspaceName") or workspace.get("name"),
                "email": invite.get("email"),
                "role": invite.get("role"),
                "status": status,
                "expiresAt": expires_at,
                "invitedBy": invite.get("invitedBy") or invite.get("invitedByEmail") or "",
            }
        })

    # Route: POST /api/invite/accept — bind principal to workspace role
    elif path == "/api/invite/accept" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error

        token = (body.get("token") or "").strip()
        if not token:
            return respond(400, {"error": "invalid_request", "error_description": "token is required"})

        workspace, invite = find_workspace_invite(token)
        if not invite or not workspace:
            return respond(404, {"error": "not_found", "error_description": "Invitation not found"})

        status = invite.get("status", "pending")
        expires_at = int(invite.get("expiresAt") or 0)
        now_ms = int(time.time() * 1000)
        if status == "revoked":
            return respond(410, {"error": "revoked", "error_description": "Invitation was revoked"})
        if expires_at and expires_at < now_ms and status != "accepted":
            return respond(410, {"error": "expired", "error_description": "Invitation has expired"})

        invite_email = (invite.get("email") or "").strip().lower()
        caller_email = _caller_email(event, username)

        if invite_email and caller_email and invite_email != caller_email:
            return respond(403, {
                "error": "principal_mismatch",
                "error_description": f"Sign in as {invite_email} to accept this invitation",
            })

        role = invite.get("role") or "Viewer"
        owner_id = workspace.get("ownerId")
        workspace_id = workspace.get("workspaceId") or workspace.get("id")
        workspace_name = invite.get("workspaceName") or workspace.get("name") or "Workspace"
        members = list(workspace.get("members") or [])
        members = [
            m for m in members
            if (m.get("email") or "").strip().lower() != invite_email
            and m.get("inviteId") != invite.get("id")
        ]
        members.append({
            "id": username,
            "email": invite_email or caller_email,
            "name": (invite_email or caller_email or username).split("@")[0],
            "role": role,
            "status": "active",
            "joinedAt": now_ms,
            "principalType": "serviceAccount" if role == "Agent" else "user",
            "principalId": username,
            "roleBoundAt": now_ms,
            "roleBoundBy": invite.get("invitedByEmail") or invite.get("invitedBy"),
            "inviteId": invite.get("id"),
        })

        invitations = []
        for inv in workspace.get("invitations") or []:
            if inv.get("id") == invite.get("id") or inv.get("token") == token:
                invitations.append({
                    **inv,
                    "status": "accepted",
                    "acceptedAt": now_ms,
                    "acceptedBy": username,
                })
            else:
                invitations.append(inv)

        updated = update_item(
            workspaces_table,
            {"ownerId": owner_id, "workspaceId": workspace_id},
            {"members": members, "invitations": invitations, "updatedAt": now_ms},
            {"ownerId", "workspaceId", "id"},
        )
        if status != "accepted":
            append_audit_event(
                workspace_id,
                action="invite.accepted",
                actor_id=username,
                actor_email=invite_email or caller_email,
                target=invite_email or caller_email,
                meta={
                    "role": role,
                    "inviteId": invite.get("id") or "",
                    "workspaceName": workspace_name,
                },
            )
        return respond(200, {
            "status": "success",
            "workspaceId": workspace_id,
            "workspaceName": workspace_name,
            "role": role,
            "email": invite_email or caller_email,
            "alreadyAccepted": status == "accepted",
            "invite": {
                "id": invite.get("id"),
                "workspaceId": workspace_id,
                "workspaceName": workspace_name,
                "email": invite_email,
                "role": role,
                "status": "accepted",
                "expiresAt": expires_at,
                "invitedBy": invite.get("invitedBy") or invite.get("invitedByEmail") or "",
            },
            "workspace": normalize_workspace_item(updated),
        })

    # Route: POST /api/invite/revoke
    elif path == "/api/invite/revoke" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        workspace_id = body.get("workspaceId")
        invite_id = body.get("inviteId")
        if not workspace_id or not invite_id:
            return respond(400, {"error": "invalid_request", "error_description": "workspaceId and inviteId required"})
        res = workspaces_table.get_item(Key={"ownerId": username, "workspaceId": workspace_id})
        workspace = res.get("Item")
        if not workspace:
            # try scan by workspace id for non-owner admins later; owner-only for v1
            return respond(404, {"error": "not_found", "error_description": "Workspace not found"})
        _, role_err = require_workspace_role(workspace, username, _TEAM_INVITE_ROLES)
        if role_err:
            return role_err
        now_ms = int(time.time() * 1000)
        invitations = []
        for inv in workspace.get("invitations") or []:
            if inv.get("id") == invite_id:
                invitations.append({**inv, "status": "revoked", "revokedAt": now_ms})
            else:
                invitations.append(inv)
        members = [
            m for m in (workspace.get("members") or [])
            if not (m.get("inviteId") == invite_id and m.get("status") in ("invited", "pending"))
        ]
        updated = update_item(
            workspaces_table,
            {"ownerId": username, "workspaceId": workspace_id},
            {"invitations": invitations, "members": members, "updatedAt": now_ms},
            {"ownerId", "workspaceId", "id"},
        )
        caller_email = _caller_email(event, username)
        revoked_email = ""
        for inv in workspace.get("invitations") or []:
            if inv.get("id") == invite_id:
                revoked_email = (inv.get("email") or "").strip().lower()
                break
        append_audit_event(
            workspace_id,
            action="invite.revoked",
            actor_id=username,
            actor_email=caller_email,
            target=revoked_email or invite_id,
            meta={"inviteId": invite_id},
            severity="warning",
        )
        return respond(200, {"status": "success", "workspace": normalize_workspace_item(updated)})

    # Route: POST /api/waitlist (public join)
    elif path == "/api/waitlist" and http_method == "POST":
        raw_email = (body.get("email") or "").strip().lower()
        if not raw_email or not EMAIL_RE.match(raw_email):
            return respond(400, {"error": "invalid_email", "error_description": "A valid email is required"})

        source = (body.get("source") or "landing").strip()[:64] or "landing"
        now = int(time.time())
        try:
            existing = waitlist_table.get_item(Key={"email": raw_email}).get("Item")
            if existing:
                return respond(200, {"status": "already_joined", "email": raw_email})

            waitlist_table.put_item(
                Item={
                    "email": raw_email,
                    "created_at": now,
                    "source": source,
                    "user_agent": (headers.get("user-agent") or headers.get("User-Agent") or "")[:256],
                },
                ConditionExpression="attribute_not_exists(email)",
            )
            return respond(201, {"status": "joined", "email": raw_email})
        except Exception as exc:
            err_name = type(exc).__name__
            if "ConditionalCheckFailed" in err_name or "ConditionalCheckFailed" in str(exc):
                return respond(200, {"status": "already_joined", "email": raw_email})
            return respond(500, {"error": "waitlist_write_failed", "error_description": str(exc)})

    # Route: GET /api/waitlist (admin list — secret header or query)
    elif path == "/api/waitlist" and http_method == "GET":
        query = get_query_params(event)
        provided = (
            headers.get("x-waitlist-secret")
            or headers.get("X-Waitlist-Secret")
            or query.get("secret")
            or query.get("")
            or ""
        ).strip()
        # Also accept bare ?<secret> style (first query key is the secret)
        if not provided and query:
            first_key = next(iter(query.keys()), "")
            if first_key and not query.get(first_key):
                provided = first_key
            elif first_key and first_key not in ("secret", "key", "limit"):
                provided = first_key

        if not WAITLIST_ADMIN_SECRET or provided != WAITLIST_ADMIN_SECRET:
            return respond(401, {"error": "unauthorized", "error_description": "Invalid waitlist secret"})

        try:
            items = []
            scan_kwargs = {}
            while True:
                res = waitlist_table.scan(**scan_kwargs)
                items.extend(res.get("Items") or [])
                last = res.get("LastEvaluatedKey")
                if not last:
                    break
                scan_kwargs["ExclusiveStartKey"] = last

            items.sort(key=lambda row: int(row.get("created_at") or 0), reverse=True)
            return respond(
                200,
                {
                    "count": len(items),
                    "entries": [
                        {
                            "email": row.get("email"),
                            "created_at": int(row.get("created_at") or 0),
                            "source": row.get("source") or "landing",
                        }
                        for row in items
                    ],
                },
            )
        except Exception as exc:
            return respond(500, {"error": "waitlist_read_failed", "error_description": str(exc)})

    # ─── ZK prover worker (EC2 on-demand / fixed URL) ───
    # GET /api/zk-worker/status
    elif path == "/api/zk-worker/status" and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        return respond(200, get_zk_worker_status())

    # POST /api/zk-worker/start  — turn EC2 ON (for testing / before payroll)
    elif path == "/api/zk-worker/start" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        result = start_zk_worker()
        code = 200 if result.get("status") != "error" else 400
        return respond(code, result)

    # POST /api/zk-worker/stop  — turn EC2 OFF after testing (EBS may still bill a little)
    elif path == "/api/zk-worker/stop" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        result = stop_zk_worker()
        code = 200 if result.get("status") != "error" else 400
        return respond(code, result)

    # POST /api/zk-worker/prove  — proxy fullProve input to RapidSNARK/snarkjs worker
    elif path == "/api/zk-worker/prove" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        circuit_input = body.get("input")
        if not isinstance(circuit_input, dict):
            return respond(400, {
                "error": "invalid_request",
                "error_description": "body.input (circuit public/private signals object) is required",
            })
        result = proxy_zk_prove(circuit_input)
        if result.get("mode") == "error":
            return respond(502, result)
        # browser_fallback is 200 so client can fall back without treating as hard failure
        return respond(200, result)

    # POST /api/zk-worker/merkle — server-side leaf fetch + path build
    elif path == "/api/zk-worker/merkle" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        contract = body.get("contract") or body.get("poolContract")
        if not contract:
            return respond(400, {
                "error": "invalid_request",
                "error_description": "body.contract is required",
            })
        result = proxy_zk_merkle(contract, body.get("commitments") or body.get("wanted") or [])
        if result.get("mode") == "error":
            return respond(502, result)
        return respond(200, result)

    # POST /api/zk-worker/settle — start async fund+deposit+prove+withdraw on relayer
    elif path == "/api/zk-worker/settle" and http_method == "POST":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        if not body.get("toAddress") or not (body.get("poolContract") or body.get("contract")):
            return respond(400, {
                "error": "invalid_request",
                "error_description": "toAddress, poolContract, amountStroops, notes[] required",
            })
        settle_body = {
            "toAddress": body.get("toAddress"),
            "poolContract": body.get("poolContract") or body.get("contract"),
            "amountStroops": body.get("amountStroops") or body.get("amount"),
            "notes": body.get("notes") or [],
        }
        result = proxy_zk_settle(settle_body)
        if result.get("mode") == "error":
            return respond(502, result)
        # 202-style async accepted (still 200 for simple clients)
        return respond(200, result)

    # GET /api/zk-worker/jobs/{id} — poll async settle/prove job
    elif path.startswith("/api/zk-worker/jobs/") and http_method == "GET":
        username, auth_error = require_username(event, headers)
        if auth_error:
            return auth_error
        job_id = path.split("/")[-1]
        if not job_id:
            return respond(400, {"error": "invalid_request", "error_description": "job id required"})
        result = proxy_zk_job(job_id)
        if result.get("mode") == "error":
            return respond(502, result)
        return respond(200, result)

    # Route: POST /api/chat (Proxy for OpenCode completions to avoid CORS)
    elif path == "/api/chat" and http_method == "POST":
        import urllib.request
        import urllib.error

        api_url = "https://opencode.ai/zen/v1/chat/completions"
        api_key = os.environ.get("OPENCODE_API_KEY", "")

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
