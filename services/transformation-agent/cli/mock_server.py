import http.server
import json
import urllib.parse
import uuid
import sys

PORT = 8080

# State stores (in-memory)
pending_devices = {}  # device_code -> { user_code, status, username }
authorized_sessions = {} # token -> username
shared_memory = {
    "stellar_dev": {
        "network": "testnet",
        "last_migration": "soroban-escrow-contract",
        "stellar_kb_version": "1.0.0"
    }
}

class MockServerHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean up output printing
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format%args))

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # 1. Activate Portal Page (Web Browser)
        if parsed_path.path == "/activate":
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            
            # Serve a premium dark-themed activation page
            html = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authorize CLI Device — ZEXVRO</title>
                <style>
                    body {
                        background-color: #050505;
                        color: #f4f4f5;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: #0a0a0b;
                        border: 1px solid #27272a;
                        padding: 32px;
                        border-radius: 12px;
                        width: 380px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                        text-align: center;
                    }
                    h2 {
                        margin-top: 0;
                        font-weight: 700;
                        color: #ffffff;
                        letter-spacing: -0.5px;
                    }
                    p {
                        color: #a1a1aa;
                        font-size: 13px;
                        line-height: 1.5;
                        margin-bottom: 24px;
                    }
                    .input-group {
                        margin-bottom: 20px;
                        text-align: left;
                    }
                    label {
                        display: block;
                        font-size: 10px;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: #71717a;
                        margin-bottom: 6px;
                    }
                    input[type="text"] {
                        width: 100%;
                        padding: 10px 12px;
                        background: #000000;
                        border: 1px solid #27272a;
                        border-radius: 6px;
                        color: #ffffff;
                        font-size: 14px;
                        font-family: monospace;
                        box-sizing: border-box;
                        text-transform: uppercase;
                    }
                    input[type="text"]:focus {
                        border-color: #3b82f6;
                        outline: none;
                    }
                    button {
                        width: 100%;
                        padding: 12px;
                        background: #ffffff;
                        border: none;
                        border-radius: 6px;
                        color: #050505;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    button:hover {
                        background: #e4e4e7;
                    }
                    .footer {
                        margin-top: 24px;
                        font-size: 10px;
                        color: #52525b;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>ZEXVRO MORPH</h2>
                    <p>Enter the 8-digit user authorization code printed on your CLI console terminal to link this device.</p>
                    <form action="/auth/activate" method="POST">
                        <div class="input-group">
                            <label for="user_code">Device User Code</label>
                            <input type="text" id="user_code" name="user_code" placeholder="ABCD-1234" maxlength="9" required autocomplete="off">
                        </div>
                        <button type="submit">Authorize Device</button>
                    </form>
                    <div class="footer">ZEXVRO Unified Web3 Platform</div>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
            return

        # 2. Memory Endpoint (Requires mock JWT auth header)
        if parsed_path.path == "/api/memory":
            auth_header = self.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                self.send_error_json(401, "unauthorized", "Missing or invalid Bearer token")
                return
            
            token = auth_header.split(" ")[1]
            username = authorized_sessions.get(token)
            if not username:
                self.send_error_json(401, "unauthorized", "Session token is invalid or expired")
                return

            self.send_json_response(200, {
                "username": username,
                "memory": shared_memory.get(username, {})
            })
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        # 1. Device authorization init request
        if parsed_path.path == "/auth/device-code":
            device_code = str(uuid.uuid4())
            # Generate a user friendly 8 character code: ABCD-1234
            raw_uid = str(uuid.uuid4()).upper().replace("-", "")
            user_code = f"{raw_uid[0:4]}-{raw_uid[4:8]}"
            
            pending_devices[device_code] = {
                "user_code": user_code,
                "status": "pending",
                "username": "stellar_dev" # Hardcoded mock user
            }
            
            self.send_json_response(200, {
                "device_code": device_code,
                "user_code": user_code,
                "verification_uri": f"http://localhost:{PORT}/activate",
                "interval": 2
            })
            return

        # 2. Token polling request
        if parsed_path.path == "/auth/token":
            try:
                params = json.loads(post_data.decode("utf-8"))
            except Exception:
                params = urllib.parse.parse_qs(post_data.decode("utf-8"))
                params = {k: v[0] for k, v in params.items()}

            device_code = params.get("device_code")
            if not device_code or device_code not in pending_devices:
                self.send_error_json(400, "invalid_request", "Device code is missing or invalid")
                return

            device_state = pending_devices[device_code]
            if device_state["status"] == "pending":
                self.send_error_json(400, "authorization_pending", "User has not approved the device yet")
                return
            elif device_state["status"] == "authorized":
                # Generate user token
                token = "mock_jwt_token_" + str(uuid.uuid4())[:8]
                username = device_state["username"]
                authorized_sessions[token] = username
                
                # Delete the device code record
                del pending_devices[device_code]
                
                self.send_json_response(200, {
                    "access_token": token,
                    "refresh_token": "mock_refresh_token_ref",
                    "username": username
                })
                return

        # 3. Web portal submission to authorize code
        if parsed_path.path == "/auth/activate":
            params = urllib.parse.parse_qs(post_data.decode("utf-8"))
            user_code = params.get("user_code", [""])[0].strip().upper()
            
            # Find the pending device code matching this user code
            target_device_code = None
            for d_code, state in pending_devices.items():
                if state["user_code"] == user_code:
                    target_device_code = d_code
                    break
            
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()

            if target_device_code:
                pending_devices[target_device_code]["status"] = "authorized"
                msg = f"<h3>Success!</h3><p>Device has been linked to <strong>{pending_devices[target_device_code]['username']}</strong>. You may close this tab.</p>"
            else:
                msg = "<h3>Error!</h3><p style='color:#ef4444;'>Invalid or expired user authorization code.</p>"

            html = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Device Activation Status</title>
                <style>
                    body {{ background-color: #050505; color: #f4f4f5; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
                    .card {{ background: #0a0a0b; border: 1px solid #27272a; padding: 32px; border-radius: 12px; text-align: center; width: 340px; }}
                    h3 {{ margin-top: 0; }}
                    a {{ color: #3b82f6; text-decoration: none; font-size: 13px; }}
                </style>
            </head>
            <body>
                <div class="card">
                    {msg}
                    <br>
                    <a href="/activate">Go Back</a>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode("utf-8"))
            return

        # 4. Write Memory Endpoint
        if parsed_path.path == "/api/memory":
            auth_header = self.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                self.send_error_json(401, "unauthorized", "Missing Bearer token")
                return
            
            token = auth_header.split(" ")[1]
            username = authorized_sessions.get(token)
            if not username:
                self.send_error_json(401, "unauthorized", "Invalid token")
                return

            try:
                data = json.loads(post_data.decode("utf-8"))
                # Merge memory
                if username not in shared_memory:
                    shared_memory[username] = {}
                shared_memory[username].update(data.get("memory", {}))
                
                self.send_json_response(200, {
                    "status": "success",
                    "memory": shared_memory[username]
                })
            except Exception as e:
                self.send_error_json(400, "invalid_json", str(e))
            return

        self.send_response(404)
        self.end_headers()

    def send_json_response(self, status, payload):
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def send_error_json(self, status, error_code, description):
        self.send_json_response(status, {
            "error": error_code,
            "error_description": description
        })

def run(server_class=http.server.HTTPServer, handler_class=MockServerHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"ZEXVRO Mock Auth/Memory Backend Server running on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping mock server.")
        httpd.server_close()

if __name__ == "__main__":
    run()
