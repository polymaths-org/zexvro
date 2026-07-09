"""Menu screen — centered configuration dashboard and action menu."""

import os
from textual.screen import Screen
from textual.widgets import Label, Static, Button
from textual.containers import Container, Vertical

from textual.binding import Binding
from ..components.logo import get_banner

LOGO = get_banner()


class WelcomeMenuScreen(Screen):
    """Sleek dashboard landing menu screen for the Morph console matching original design."""

    BINDINGS = [
        Binding("down", "focus_next", "Focus Next", show=False),
        Binding("up", "focus_previous", "Focus Previous", show=False),
    ]

    def compose(self):
        with Container(id="menu-screen-container"):
            with Container(id="menu-outer"):
                yield Static(LOGO, id="menu-logo")
                
                with Vertical(id="menu-subtitle-box"):
                    yield Label("MORPH - AI Transformation Agent", id="menu-subtitle-title")
                    yield Label("Web3 Migration & Code Transformation", id="menu-subtitle-desc")
                    yield Label("", id="menu-auth-status")
                
                with Container(id="menu-actions-wrapper"):
                    # Inner actions container
                    with Vertical(id="menu-actions"):
                        yield Button(" ❯ Chat with Morph", id="btn-chat")
                        yield Button(" ▲ Execute Transformation", id="btn-exec")
                        yield Button(" ⭘ Memory Viewer", id="btn-memory")
                        yield Button(" ✦ Available Tools", id="btn-tools")
                        yield Button(" ℹ About Morph", id="btn-about")
                        yield Button(" ⮊ Logout", id="btn-logout")
                        yield Button(" ✖ Quit", id="btn-quit")
                    
                # Bottom directory box
                cwd = os.getcwd()
                if len(cwd) > 50:
                    cwd_display = "..." + cwd[-45:]
                else:
                    cwd_display = cwd
                with Container(id="menu-directory-wrapper"):
                    yield Label(f"Directory: {cwd_display}", id="menu-directory")

    def action_focus_next(self) -> None:
        self.focus_next()

    def action_focus_previous(self) -> None:
        self.focus_previous()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        
        if button_id == "btn-chat":
            self.app.switch_screen("main")
            
        elif button_id == "btn-exec":
            self.app.switch_screen("main")
            self.notify("Switching to Agent interface. Use '/' commands for operations.")
            
        elif button_id == "btn-memory":
            self.app.switch_screen("memory")
            
        elif button_id == "btn-tools":
            self.app.switch_screen("main")
            main_screen = self.app.get_screen("main")
            # Switch to tools tab
            main_screen.select_sidebar_tab("tools")
            
        elif button_id == "btn-about":
            self.app.switch_screen("main")
            main_screen = self.app.get_screen("main")
            # Switch to help tab
            main_screen.select_sidebar_tab("help")
            
        elif button_id == "btn-logout":
            try:
                from ...auth import clear_auth
            except ImportError:
                try:
                    from ..auth import clear_auth
                except ImportError:
                    from auth import clear_auth
            clear_auth()
            self.notify("Successfully logged out and cleared credentials.")
            self.app.switch_screen("login")
            
        elif button_id == "btn-quit":
            self.app.exit()

    def on_mount(self) -> None:
        """Focus the first menu action and display authenticated user details on load."""
        self.query_one("#btn-chat", Button).focus()

        try:
            from ...auth import load_auth, get_api_url
        except ImportError:
            try:
                from ..auth import load_auth, get_api_url
            except ImportError:
                from auth import load_auth, get_api_url
                
        auth_data = load_auth()
        if auth_data:
            username = auth_data.get("username") or "N/A"
            email = auth_data.get("email") or "N/A"
            api_url = get_api_url(auth_data)
            
            # Shorten api_url for display
            if len(api_url) > 40:
                api_display = api_url[:37] + "..."
            else:
                api_display = api_url
                
            status_text = f"User: [bold cyan]{username}[/bold cyan] ({email})  |  Host: [dim]{api_display}[/dim]"
            self.query_one("#menu-auth-status", Label).update(status_text)
        else:
            self.query_one("#menu-auth-status", Label).update("[red]Not Authenticated[/red]")
