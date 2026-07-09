import json
import os
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

from rich.console import Console

console = Console()

CONFIG_DIR = Path(os.environ.get("MORPH_CONFIG_DIR", "~/.config/morph")).expanduser()
CONFIG_PATH = CONFIG_DIR / "auth.json"
DEFAULT_API_URL = "https://qkuostruh3.execute-api.us-east-1.amazonaws.com"
REQUEST_TIMEOUT_SECONDS = 15
AUTH_TIMEOUT_SECONDS = 300


def normalize_api_url(url: str | None) -> str:
    """Normalize API Gateway/base URLs while preserving configured stages."""
    raw_url = (url or DEFAULT_API_URL).strip()
    return raw_url.rstrip("/") or DEFAULT_API_URL


def get_api_url(auth_data: dict[str, Any] | None = None, explicit_url: str | None = None) -> str:
    """Resolve API URL from CLI option, env, saved session, or production default."""
    return normalize_api_url(
        explicit_url
        or os.environ.get("MORPH_API_URL")
        or (auth_data or {}).get("api_url")
        or DEFAULT_API_URL
    )


def save_auth(data: dict[str, Any], api_url: str | None = None):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    payload = dict(data)
    if api_url:
        payload["api_url"] = normalize_api_url(api_url)
    payload.setdefault("authenticated_at", int(time.time()))

    tmp_path = CONFIG_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.chmod(tmp_path, 0o600)
    os.replace(tmp_path, CONFIG_PATH)

def load_auth():
    if not CONFIG_PATH.exists():
        return None
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None

def clear_auth():
    if CONFIG_PATH.exists():
        try:
            CONFIG_PATH.unlink()
            return True
        except Exception:
            return False
    return False

def request_json(url, data=None, headers=None, method="POST"):
    headers = headers or {}
    headers.setdefault("Accept", "application/json")
    
    req_data = None
    if data is not None:
        headers.setdefault("Content-Type", "application/json")
        req_data = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8")
            if not body:
                return {}, response.status
            try:
                return json.loads(body), response.status
            except json.JSONDecodeError:
                return {
                    "error": "invalid_response",
                    "error_description": "Backend returned a non-JSON response",
                }, 502
    except urllib.error.HTTPError as e:
        request_id = e.headers.get("apigw-requestid") or e.headers.get("x-amzn-requestid")
        try:
            err_data = json.loads(e.read().decode("utf-8"))
            if isinstance(err_data, dict):
                err_data.setdefault("_request_id", request_id)
                err_data.setdefault("_status_code", e.code)
                return err_data, e.code
            return err_data, e.code
        except Exception:
            return {
                "error": "http_error",
                "error_description": str(e),
                "_request_id": request_id,
                "_status_code": e.code,
            }, e.code
    except urllib.error.URLError as e:
        return {"error": "connection_error", "error_description": str(e.reason)}, 503
    except TimeoutError:
        return {"error": "timeout", "error_description": "Request timed out"}, 504
    except Exception as e:
        return {"error": "connection_error", "error_description": str(e)}, 500


def get_access_token(auth_data: dict[str, Any] | None) -> str | None:
    if not auth_data:
        return None
    token = auth_data.get("access_token") or auth_data.get("id_token")
    return token if isinstance(token, str) and token.strip() else None


def auth_headers(auth_data: dict[str, Any] | None) -> dict[str, str] | None:
    token = get_access_token(auth_data)
    return {"Authorization": f"Bearer {token}"} if token else None


def _error_message(payload: dict[str, Any]) -> str:
    return str(payload.get("error_description") or payload.get("message") or payload.get("error") or "Unknown error")


def _request_id(payload: dict[str, Any]) -> str | None:
    request_id = payload.get("_request_id") or payload.get("request_id")
    return str(request_id) if request_id else None


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def perform_login(api_url: str | None = None, open_browser: bool = True, timeout_seconds: int = AUTH_TIMEOUT_SECONDS):
    api_url = get_api_url(explicit_url=api_url)
    
    console.print("\n[bold]◆ Initiating Device Authorization Flow...[/]")
    console.print(f"[dim]Backend: {api_url}[/]")
    
    # 1. Request device code
    resp, status = request_json(f"{api_url}/auth/device-code")
    if status != 200:
        console.print(f"[bold red]✖ Failed to initialize authentication: {_error_message(resp)}[/]")
        if status >= 500:
            console.print("[yellow]The auth backend returned a server error before issuing a device code.[/]")
            request_id = _request_id(resp)
            if request_id:
                console.print(f"[dim]AWS/API Gateway request id: {request_id}[/]")
            console.print("[dim]For local testing, run cli/mock_server.py and pass --api-url http://127.0.0.1:8080.[/]")
        return False
        
    device_code = resp.get("device_code")
    user_code = resp.get("user_code")
    verification_uri = resp.get("verification_uri")
    browser_uri = resp.get("verification_uri_complete") or verification_uri
    interval = max(1, _as_int(resp.get("interval"), 2))
    expires_in = _as_int(resp.get("expires_in"), timeout_seconds)
    timeout = min(timeout_seconds, expires_in) if expires_in > 0 else timeout_seconds

    if not device_code or not user_code or not verification_uri:
        console.print("[bold red]✖ Backend returned an incomplete device authorization response.[/]")
        return False
    
    console.print("\n[bold white]To link this CLI agent to your ZEXVRO account:[/]")
    console.print(f"1. A browser tab will open automatically (or visit: [bold blue underline]{browser_uri}[/])")
    console.print(f"2. Verify that the code matches: [bold black bg white]  {user_code}  [/] and click [bold green]Approve[/] in your dashboard.\n")
    
    # Try to open the web browser automatically
    if open_browser:
        try:
            webbrowser.open(browser_uri)
        except Exception:
            pass
        
    console.print("[dim]Waiting for dashboard authorization... (Press Ctrl+C to cancel)[/]")
    
    # 2. Polling loop
    start_time = time.monotonic()
    
    while time.monotonic() - start_time < timeout:
        time.sleep(interval)
        
        token_resp, token_status = request_json(f"{api_url}/auth/token", data={"device_code": device_code})
        
        if token_status == 200:
            if not get_access_token(token_resp):
                console.print("\n[bold red]✖ Authentication response did not include an access token.[/]")
                return False

            save_auth(token_resp, api_url=api_url)
            username = token_resp.get("username") or token_resp.get("email") or "authenticated user"
            console.print(f"\n[bold green]✔ Successfully authenticated as [cyan]{username}[/cyan]! ✦[/]")
            return True
            
        err = token_resp.get("error")
        if err == "authorization_pending":
            # Still waiting
            print(".", end="", flush=True)
            continue
        if err == "slow_down":
            interval += 5
            print(".", end="", flush=True)
            continue
        else:
            console.print(f"\n[bold red]✖ Authentication failed: {_error_message(token_resp)}[/]")
            return False
            
    console.print(f"\n[bold red]✖ Authentication timed out after {timeout // 60 or 1} minutes.[/]")
    return False


def send_heartbeat():
    """Send a CLI status heartbeat to the backend database to mark it online in the web dashboard."""
    auth_data = load_auth()
    if not auth_data:
        return
    token = get_access_token(auth_data)
    if not token:
        return
    api_url = get_api_url(auth_data)
    headers = auth_headers(auth_data)
    import time
    username = auth_data.get("username") or auth_data.get("email") or "Developer"
    update_data = {
        "memory": {
            "cli_connected": True,
            "cli_last_active": int(time.time()),
            "cli_username": username,
        }
    }
    try:
        request_json(f"{api_url}/api/memory", data=update_data, headers=headers, method="POST")
    except Exception:
        pass
