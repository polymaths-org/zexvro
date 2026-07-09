"""Login screen — TUI-native device code authentication and polling."""

import os
import time
import webbrowser
from textual.screen import Screen
from textual.widgets import Label, Static, Button
from textual.containers import Container, Vertical
from textual import work

try:
    from ...auth import request_json, save_auth, get_api_url, get_access_token
except ImportError:
    from auth import request_json, save_auth, get_api_url, get_access_token

from ..components.logo import get_banner

LOGO = get_banner()

class LoginScreen(Screen):
    """Secure terminal-native oauth / cognito device link screen."""

    def compose(self):
        with Container(id="login-screen-container"):
            with Container(id="login-outer"):
                yield Static(LOGO, id="login-logo")
                yield Label("LINK YOUR CLI TO ZEXVRO", id="login-title")
                
                yield Label(
                    "Authenticate to access Morph agent capabilities, memory sync, and Web3 transformation tools.",
                    id="login-desc",
                    classes="login-text"
                )
                
                yield Label(
                    "1. A browser tab will open automatically (or link below).\n"
                    "2. Confirm the code matches and click Approve in the dashboard.",
                    id="login-steps",
                    classes="login-text"
                )

                with Container(id="login-code-box"):
                    yield Label("GENERATING CODE...", id="login-code-val")

                yield Label(
                    "Link: http://localhost:3000",
                    id="login-link-val",
                    classes="login-text"
                )

                yield Label("Waiting for approval...", id="login-status")
                
                with Container(id="login-actions-wrapper"):
                    yield Button("Cancel & Quit", id="btn-login-cancel")

    def on_mount(self) -> None:
        """Initiate authorization request and start background polling."""
        self.query_one("#btn-login-cancel", Button).focus()
        self.start_auth_flow()

    @work(thread=True)
    def start_auth_flow(self) -> None:
        """Run device code generation and backend polling."""
        api_url = get_api_url()
        
        # 1. Fetch code
        resp, status = request_json(f"{api_url}/auth/device-code")
        if status != 200:
            error_msg = resp.get("error_description") or resp.get("error") or "Server Connection Error"
            self.app.call_from_thread(self.update_status_err, f"Initialization Failed: {error_msg}")
            return

        device_code = resp.get("device_code")
        user_code = resp.get("user_code")
        verification_uri = resp.get("verification_uri")
        browser_uri = resp.get("verification_uri_complete") or verification_uri
        interval = max(2, resp.get("interval", 2))

        if not device_code or not user_code or not verification_uri:
            self.app.call_from_thread(self.update_status_err, "Incomplete parameters from server.")
            return

        # Update UI with code and link
        self.app.call_from_thread(self.update_code_ui, user_code, browser_uri)

        # 2. Open browser automatically
        try:
            webbrowser.open(browser_uri)
        except Exception:
            pass

        # 3. Poll for token
        start_time = time.monotonic()
        timeout = 300  # 5 minutes
        
        while time.monotonic() - start_time < timeout:
            time.sleep(interval)
            
            token_resp, token_status = request_json(f"{api_url}/auth/token", data={"device_code": device_code})
            
            if token_status == 200:
                if get_access_token(token_resp):
                    save_auth(token_resp, api_url=api_url)
                    username = token_resp.get("username") or token_resp.get("email") or "authenticated user"
                    self.app.call_from_thread(self.handle_auth_success, username)
                    return
                else:
                    self.app.call_from_thread(self.update_status_err, "Server reply did not contain access token.")
                    return
            
            err = token_resp.get("error")
            if err == "authorization_pending":
                # Polling state update
                dots = "." * (int(time.monotonic() - start_time) % 4 + 1)
                self.app.call_from_thread(self.update_polling_status, f"Waiting for approval{dots}")
                continue
            elif err == "slow_down":
                interval += 3
                continue
            else:
                error_msg = token_resp.get("error_description") or token_resp.get("error") or "Authorization Rejected"
                self.app.call_from_thread(self.update_status_err, f"Failed: {error_msg}")
                return

        self.app.call_from_thread(self.update_status_err, "Session expired. Please try again.")

    def update_code_ui(self, code: str, link: str) -> None:
        self.query_one("#login-code-val", Label).update(f"[bold white]{code}[/bold white]")
        self.query_one("#login-link-val", Label).update(f"Open: [bold blue underline]{link}[/bold blue underline]")

    def update_polling_status(self, msg: str) -> None:
        self.query_one("#login-status", Label).update(f"[yellow]{msg}[/yellow]")

    def update_status_err(self, msg: str) -> None:
        self.query_one("#login-status", Label).update(f"[red]✖ {msg}[/red]")

    def handle_auth_success(self, username: str) -> None:
        self.query_one("#login-status", Label).update(f"[bold green]✔ Linked successfully as {username}! Redirecting...[/bold green]")
        # Switch to menu screen after brief delay
        self.set_timer(1.5, lambda: self.app.switch_screen("menu"))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-login-cancel":
            self.app.exit()
