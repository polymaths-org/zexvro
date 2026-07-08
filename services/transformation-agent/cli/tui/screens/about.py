"""About screen — version, features, key bindings in a centered, clean layout."""

from textual.binding import Binding
from textual.containers import Container
from textual.screen import Screen
from textual.widgets import Label, RichLog

from ..styles.icons import ARROW_DOWN, ARROW_UP, BULLET


class AboutScreen(Screen):
    """About / help screen."""

    BINDINGS = [
        Binding("escape", "go_back", "Back"),
    ]

    def compose(self):
        with Container(id="main-container"):
            yield Label("About Morph Agent", id="title")
            yield Label("System version, configuration, and keyboard shortcuts", id="subtitle")
            
            with Container(id="log-container"):
                yield RichLog(id="about-log", highlight=True, markup=True)
                
            yield Label("[esc] Return to main panel", id="screen-footer")

    def on_mount(self):
        log = self.query_one("#about-log", RichLog)
        
        # Output clean system info lines
        log.write(" [bold]MORPH[/bold] — [dim]v0.1.0[/dim]")
        log.write(" ────────────────────────────────────────────────────────────")
        log.write(" [bold]AI Code Transformation & Web3 Migration Agent[/bold]")
        log.write(" Designed as part of the ZEXVRO PaaS developer ecosystem.\n")
        
        log.write(" [bold]SYSTEM STACK[/bold]")
        log.write("  ▪ Languages: Python 3.14")
        log.write("  ▪ Frameworks: Textual, Typer, Rich")
        log.write("  ▪ Core Engines: OpenAI GPT-4o, SQLite Local Storage\n")
        
        log.write(" [bold]CORE CAPABILITIES[/bold]")
        log.write(f"  {BULLET} Codebase structure mapping & file analysis")
        log.write(f"  {BULLET} Auto-guided translation of Web2 systems to Web3 patterns")
        log.write(f"  {BULLET} State and repository context persistence via memory layer")
        log.write(f"  {BULLET} Tool execution harness with sandboxed shell operations")
        log.write(f"  {BULLET} Interactive terminal interfaces (CLI and TUI modes)\n")
        
        log.write(" [bold]KEYBOARD SHORTCUTS[/bold]")
        log.write(f"  {ARROW_UP}{ARROW_DOWN}  Navigate menus / scroll tables")
        log.write("  Enter  Select menu item / Submit chat query")
        log.write("  Esc    Go back / Close screen")
        log.write("  q      Terminate session")
        log.write("  r      Refresh dynamic data panels")
        log.write("  Ctrl+C Force quit\n")
        
        log.write(" ────────────────────────────────────────────────────────────")
        log.write(" [dim]ZEXVRO Platform Project (polymaths-org/zexvro)[/dim]")

    def action_go_back(self):
        self.app.pop_screen()
