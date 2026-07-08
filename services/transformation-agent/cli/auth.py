import os
import json
import time
import urllib.request
import urllib.parse
import webbrowser
from rich.console import Console

console = Console()

CONFIG_DIR = os.path.expanduser("~/.config/morph")
CONFIG_PATH = os.path.join(CONFIG_DIR, "auth.json")
DEFAULT_API_URL = "http://localhost:8080"

def get_api_url():
    # Allow override via environment variable if needed
    return os.environ.get("MORPH_API_URL", DEFAULT_API_URL)

def save_auth(data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)

def load_auth():
    if not os.path.exists(CONFIG_PATH):
        return None
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return None

def clear_auth():
    if os.path.exists(CONFIG_PATH):
        try:
            os.remove(CONFIG_PATH)
            return True
        except Exception:
            return False
    return False

def request_json(url, data=None, headers=None, method="POST"):
    headers = headers or {}
    headers.setdefault("Content-Type", "application/json")
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8")), response.status
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode("utf-8"))
            return err_data, e.code
        except Exception:
            return {"error": "http_error", "error_description": str(e)}, e.code
    except Exception as e:
        return {"error": "connection_error", "error_description": str(e)}, 500

def perform_login():
    api_url = get_api_url()
    
    console.print("\n[bold]◆ Initiating Device Authorization Flow...[/]")
    
    # 1. Request device code
    resp, status = request_json(f"{api_url}/auth/device-code")
    if status != 200:
        console.print(f"[bold red]✖ Failed to initialize authentication: {resp.get('error_description', 'Unknown error')}[/]")
        return False
        
    device_code = resp.get("device_code")
    user_code = resp.get("user_code")
    verification_uri = resp.get("verification_uri")
    interval = resp.get("interval", 2)
    
    console.print("\n[bold white]To link this CLI agent to your ZEXVRO account:[/]")
    console.print(f"1. Open the following URL in your web browser:\n   [bold blue underline]{verification_uri}[/]")
    console.print(f"2. Enter the authorization user code:\n   [bold black bg white]  {user_code}  [/]\n")
    
    # Try to open the web browser automatically
    try:
        webbrowser.open(verification_uri)
    except Exception:
        pass
        
    console.print("[dim]Waiting for approval... (Press Ctrl+C to cancel)[/]")
    
    # 2. Polling loop
    start_time = time.time()
    timeout = 300 # 5 minutes
    
    while time.time() - start_time < timeout:
        time.sleep(interval)
        
        token_resp, token_status = request_json(f"{api_url}/auth/token", data={"device_code": device_code})
        
        if token_status == 200:
            save_auth(token_resp)
            console.print(f"\n[bold green]✔ Successfully authenticated as [cyan]{token_resp.get('username')}[/cyan]! ✦[/]")
            return True
            
        err = token_resp.get("error")
        if err == "authorization_pending":
            # Still waiting
            print(".", end="", flush=True)
            continue
        else:
            console.print(f"\n[bold red]✖ Authentication failed: {token_resp.get('error_description', 'Session expired')}[/]")
            return False
            
    console.print("\n[bold red]✖ Authentication timed out after 5 minutes.[/]")
    return False
