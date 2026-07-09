"""Welcome/Boot screen — simulated system initialization with animations."""

import os
from textual.screen import Screen
from textual.widgets import Label, RichLog, Static
from textual.containers import Container

from ..components.logo import get_banner

LOGO = get_banner()


class WelcomeScreen(Screen):
    """Sleek system bootloader screen with typing animations."""

    def compose(self):
        with Container(id="welcome-screen-container"):
            with Container(id="welcome-outer"):
                yield Static(LOGO, id="logo")
                yield Label("MORPH SYSTEM INITIALIZATION", id="boot-title")
                yield RichLog(id="boot-log", highlight=True, markup=True)
                yield Label("", id="boot-progress-bar")
                yield Label("Press ANY KEY to skip boot sequence", id="boot-skip")

    def on_mount(self) -> None:
        self.progress = 0
        self.boot_steps = [
            (5, "MORPH SYSTEM BOOT v0.1.0 IN PROGRESS..."),
            (15, "Verifying ZEXVRO core platform dependencies..."),
            (25, "Status: Python 3.14 environment loaded."),
            (35, "Checking local database store..."),
            (45, "SQLite persistent engine: [bold green]ONLINE[/bold green]"),
            (55, f"Workspace detected: [dim]{os.getcwd()}[/dim]"),
            (65, "Registering AI agent capability registry..."),
            (75, "  - read_file [bold cyan]OK[/bold cyan]"),
            (80, "  - write_file [bold cyan]OK[/bold cyan]"),
            (85, "  - list_dir [bold cyan]OK[/bold cyan]"),
            (90, "  - run_command [bold cyan]OK[/bold cyan]"),
            (95, "  - analyze_codebase [bold cyan]OK[/bold cyan]"),
            (98, "ZEXVRO AI Transformation Agent Morph: [bold green]READY[/bold green]"),
            (100, "Redirecting to main terminal panel..."),
        ]
        self.current_step = 0
        self.log_widget = self.query_one("#boot-log", RichLog)
        self.progress_bar = self.query_one("#boot-progress-bar", Label)
        
        # Start typing animation interval
        self.timer = self.set_interval(0.04, self.tick_boot)

    def tick_boot(self) -> None:
        if self.progress < 100:
            self.progress += 2
            # Update ASCII loading progress bar
            width = 50
            filled = int(width * self.progress / 100)
            bar_str = "█" * filled + "░" * (width - filled)
            self.progress_bar.update(f"  [{bar_str}] {self.progress}%")
            
            # Print log items when progress passes the step trigger
            while (self.current_step < len(self.boot_steps) and 
                   self.progress >= self.boot_steps[self.current_step][0]):
                _, message = self.boot_steps[self.current_step]
                self.log_widget.write(f" [dim]»[/dim] {message}")
                self.current_step += 1
        else:
            self.timer.stop()
            self.go_to_main()

    def go_to_main(self) -> None:
        if hasattr(self, "timer"):
            self.timer.stop()
            
        try:
            from ...auth import load_auth
        except ImportError:
            try:
                from ..auth import load_auth
            except ImportError:
                from auth import load_auth
                
        auth_data = load_auth()
        if auth_data:
            self.app.switch_screen("menu")
        else:
            self.app.switch_screen("login")

    def on_key(self, event) -> None:
        """Skip boot sequence on any key press."""
        self.go_to_main()
