"""Main terminal panel screen — single-pane developer workspace dashboard."""

import os
import platform
from datetime import datetime
from typing import Any

from textual import work
from textual.binding import Binding
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.screen import Screen
from textual.widgets import Input, Label, Static, TabbedContent, TabPane, DataTable

try:
    from ...tools import ToolRegistry
except ImportError:
    from tools import ToolRegistry

from ..components.logo import get_small_logo
from ..styles.icons import BULLET, CHAT, LIGHTNING, BRAIN, TOOLS, INFO

SMALL_LOGO = get_small_logo()


class MainScreen(Screen):
    """Unified single-pane developer terminal dashboard.

    Integrates chat panel, tool registry, memory manager, and system status
    into a keyboard-driven dark layout inspired by Claude Code.
    """

    BINDINGS = [
        Binding("escape", "go_to_menu", "Main Menu"),
        Binding("ctrl+g", "go_to_menu", "Main Menu", show=False),
        Binding("ctrl+b", "toggle_sidebar", "Toggle Sidebar"),
        Binding("ctrl+l", "clear_chat", "Clear Chat"),
        Binding("ctrl+r", "refresh_data", "Refresh Data"),
        Binding("ctrl+q", "quit", "Quit"),
    ]

    def compose(self):
        # 1. Header Bar
        cwd = os.getcwd()
        if len(cwd) > 50:
            cwd = "..." + cwd[-47:]

        with Container(id="header-bar"):
            yield Label("MORPH ❯ AI TRANSFORMATION PANEL", id="header-title")
            yield Label(f"Workspace: [dim]{cwd}[/dim]", id="header-workspace")
            yield Label("Status: [bold green]ONLINE[/bold green]", id="header-status")

        # 2. Main Horizontal Workspace
        with Horizontal(id="main-workspace"):
            # Left Sidebar
            with Container(id="sidebar"):
                # Mascot and status info
                with Container(id="sidebar-mascot-container"):
                    yield Static(SMALL_LOGO, id="sidebar-logo")
                    yield Label("MORPH COGNITIVE ENGINE", id="sidebar-engine-title")
                    yield Label("State: [bold green]IDLE[/bold green]", id="sidebar-status-val")

                # Tabbed contents
                with TabbedContent():
                    with TabPane("Capabilities", id="tab-tools"):
                        yield DataTable(id="tools-table", zebra_stripes=True)
                    with TabPane("Memory", id="tab-memory"):
                        yield DataTable(id="memory-table", zebra_stripes=True)
                    with TabPane("Help", id="tab-help"):
                        yield Static(id="help-text-widget", markup=True)

            # Right Chat Pane
            with Container(id="chat-pane"):
                yield ScrollableContainer(id="chat-area")

                # Chat Input Box
                with Container(id="chat-input-container"):
                    yield Label("❯", id="chat-prompt-symbol")
                    yield Input(
                        placeholder="Ask Morph, run a tool, or type '/' for commands...",
                        id="chat-input"
                    )

        # 3. Footer Bar
        yield Label(
            " [Esc] Main Menu  |  [Ctrl+B] Toggle Sidebar  |  [Ctrl+L] Clear Chat  |  [Ctrl+R] Refresh  |  [Ctrl+Q] Quit ",
            id="footer-bar"
        )

    def on_mount(self) -> None:
        self.spinner_index = 0
        self.current_state = "IDLE"
        self.set_interval(0.1, self.update_spinner_frame)

        # Initialize tables
        tools_table = self.query_one("#tools-table", DataTable)
        tools_table.add_columns("Capability", "Description")

        memory_table = self.query_one("#memory-table", DataTable)
        memory_table.add_columns("Key", "Value")

        # Set up help text
        help_widget = self.query_one("#help-text-widget", Static)
        help_widget.update(
            "\n[bold]COMMANDS & KEYBINDINGS[/bold]\n"
            "──────────────────────────────\n"
            "[bold]Keybindings:[/bold]\n"
            "• [cyan]Ctrl+B[/cyan] : Toggle left sidebar\n"
            "• [cyan]Ctrl+L[/cyan] : Clear chat console\n"
            "• [cyan]Ctrl+R[/cyan] : Refresh data panels\n"
            "• [cyan]Ctrl+Q[/cyan] : Terminate session\n\n"
            "[bold]Slash Commands:[/bold]\n"
            "• [cyan]/help[/cyan]      : Show this help info\n"
            "• [cyan]/clear[/cyan]     : Clear chat history\n"
            "• [cyan]/tools[/cyan]     : List all active tools\n"
            "• [cyan]/memory[/cyan]    : List stored memories\n"
            "• [cyan]/remember <k> <v>[/cyan] : Save key-value\n"
            "• [cyan]/recall <k>[/cyan]   : Retrieve memory key\n"
            "• [cyan]/exit[/cyan]      : Quit application\n"
        )

        # Initial data load
        self.refresh_tables()

        try:
            from ...auth import load_auth
        except ImportError:
            from auth import load_auth
            
        auth_data = load_auth()
        username = auth_data.get("username") or auth_data.get("email") or "Developer" if auth_data else "Developer"

        # Add welcome banner and start chat focus
        self.append_message(
            "Morph",
            f"Hello [bold cyan]{username}[/bold cyan]! I am Morph, your AI transformation agent. "
            "How can I assist with your Web3 migration or codebase transformation today?\n"
            "Type [cyan]/help[/cyan] or [cyan]/tools[/cyan] to get started."
        )
        self.query_one("#chat-input", Input).focus()

    def refresh_tables(self) -> None:
        """Query registry and DB to update Sidebar tables."""
        # 1. Update Tools Table
        try:
            tools_table = self.query_one("#tools-table", DataTable)
            tools_table.clear()
            registry = ToolRegistry()
            tools = registry.list_tools()
            for t in tools:
                tools_table.add_row(t["name"], t["description"])
        except Exception:
            pass

        # 2. Update Memory Table
        try:
            memory_table = self.query_one("#memory-table", DataTable)
            memory_table.clear()
            user_id = getattr(self.app.agent, "user_id", "default")
            entries = self.app.store.list(user_id)
            if not entries:
                memory_table.add_row("(empty)", "No memories stored yet.")
            else:
                for k, v in entries:
                    val_display = v[:40] + ("..." if len(v) > 40 else "")
                    memory_table.add_row(k, val_display)
        except Exception:
            pass

    def select_sidebar_tab(self, tab_id: str) -> None:
        """Select a tab in the sidebar by key."""
        try:
            tabbed_content = self.query_one(TabbedContent)
            if tab_id == "memory":
                tabbed_content.active = "tab-memory"
            elif tab_id == "tools":
                tabbed_content.active = "tab-tools"
            elif tab_id == "help":
                tabbed_content.active = "tab-help"
            
            # Ensure sidebar is visible
            sidebar = self.query_one("#sidebar")
            sidebar.styles.display = "block"
        except Exception:
            pass

    def append_message(self, sender: str, text: str) -> None:
        """Append a beautifully formatted message block to the chat area."""
        chat_area = self.query_one("#chat-area", ScrollableContainer)

        is_user = sender.lower() == "you"
        sender_color = "green" if is_user else "cyan"
        title = sender.upper()

        timestamp = datetime.now().strftime("%H:%M:%S")

        from rich.markup import escape, MarkupError
        from rich.text import Text
        from rich.markdown import Markdown
        from rich.console import Group

        header_text = Text.from_markup(
            f"[{sender_color}][bold]{title}[/bold] [dim]({timestamp})[/dim][/{sender_color}]\n"
        )

        if sender.lower() == "morph":
            body_renderable = Markdown(text)
        else:
            try:
                body_renderable = Text.from_markup(text)
            except MarkupError:
                body_renderable = Text(text)

        renderable = Group(header_text, body_renderable)

        message_classes = "chat-message-block user-message" if is_user else "chat-message-block morph-message"
        row_classes = "chat-message-row user-row" if is_user else "chat-message-row morph-row"
        
        message_widget = Static(
            renderable,
            classes=message_classes
        )
        row = Container(message_widget, classes=row_classes)
        chat_area.mount(row)
        chat_area.scroll_end(animate=False)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        if not text:
            return

        event.input.value = ""

        # Check for Slash Commands
        if text.startswith("/"):
            self.handle_slash_command(text)
            return

        # Regular agent prompts
        self.append_message("You", text)
        self.run_agent_loop(text)

    def handle_slash_command(self, cmd_text: str) -> None:
        """Intercept and execute CLI-level slash commands directly."""
        self.append_message("You", cmd_text)
        parts = cmd_text.split(" ", 2)
        cmd = parts[0].lower()

        if cmd in ("/exit", "/quit"):
            self.app.exit()
        elif cmd == "/clear":
            self.action_clear_chat()
        elif cmd == "/help":
            help_msg = (
                "**Available commands:**\n"
                "  - `/help` : Display help menu\n"
                "  - `/clear` : Clear console messages\n"
                "  - `/tools` : List active tools\n"
                "  - `/memory` : List all memory keys\n"
                "  - `/remember <k> <v>` : Write to memory\n"
                "  - `/recall <k>` : Read from memory\n"
                "  - `/logout` : Log out and clear local credentials\n"
                "  - `/exit` : Quit TUI"
            )
            self.append_message("System", help_msg)
        elif cmd == "/tools":
            registry = ToolRegistry()
            tools = registry.list_tools()
            lines = ["**Available tools in active registry:**"]
            for t in tools:
                lines.append(f"  - [cyan]{t['name']}[/cyan]: {t['description']}")
            self.append_message("System", "\n".join(lines))
        elif cmd in ("/memory", "/mem"):
            user_id = getattr(self.app.agent, "user_id", "default")
            entries = self.app.store.list(user_id)
            if not entries:
                self.append_message("System", "Memory is empty.")
            else:
                lines = ["**Stored memories:**"]
                for k, v in entries:
                    lines.append(f"  - [yellow]{k}[/yellow]: {v}")
                self.append_message("System", "\n".join(lines))
        elif cmd == "/remember":
            if len(parts) < 3:
                self.append_message("System", "Usage: `/remember <key> <value>`")
            else:
                k, v = parts[1], parts[2]
                user_id = getattr(self.app.agent, "user_id", "default")
                self.app.store.set(user_id, k, v)
                self.append_message("System", f"✅ Key '[yellow]{k}[/yellow]' saved to memory database.")
                self.refresh_tables()
        elif cmd == "/recall":
            if len(parts) < 2:
                self.append_message("System", "Usage: `/recall <key>`")
            else:
                k = parts[1]
                user_id = getattr(self.app.agent, "user_id", "default")
                v = self.app.store.get(user_id, k)
                if v:
                    self.append_message("System", f"[yellow]{k}[/yellow]: {v}")
                else:
                    self.append_message("System", f"No memory found for key '{k}'.")
        elif cmd == "/logout":
            try:
                from ...auth import clear_auth
            except ImportError:
                try:
                    from ..auth import clear_auth
                except ImportError:
                    from auth import clear_auth
            clear_auth()
            self.append_message("System", "✅ Successfully logged out and cleared credentials.")
            self.app.switch_screen("login")
        else:
            self.append_message("System", f"Unknown slash command: [red]{cmd}[/red]. Type `/help` for guidance.")

    @work(thread=True)
    def run_agent_loop(self, prompt: str) -> None:
        """Run the agent engine loop in a background thread."""
        self.app.call_from_thread(self.update_status, "THINKING")

        try:
            response = self.app.agent.run(prompt)
            self.app.call_from_thread(self.append_message, "Morph", response)
            self.app.call_from_thread(self.refresh_tables)
        except Exception as e:
            self.app.call_from_thread(self.append_message, "System Error", f"Agent failed: {e}")
        finally:
            self.app.call_from_thread(self.update_status, "IDLE")

    def update_status(self, state: str) -> None:
        """Update system status indicators."""
        self.current_state = state
        if state == "IDLE":
            self.query_one("#sidebar-status-val", Label).update("State: [bold green]IDLE[/bold green]")
            self.query_one("#header-status", Label).update("Status: [bold green]IDLE[/bold green]")
        elif state == "THINKING":
            self.update_spinner_frame()

    def update_spinner_frame(self) -> None:
        """Advance and render the spinner frame if the agent is thinking."""
        if self.current_state == "THINKING":
            frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
            frame = frames[self.spinner_index % len(frames)]
            self.spinner_index += 1
            self.query_one("#sidebar-status-val", Label).update(f"State: [bold yellow]THINKING {frame}[/bold yellow]")
            self.query_one("#header-status", Label).update(f"Status: [bold yellow]THINKING {frame}[/bold yellow]")

    def action_toggle_sidebar(self) -> None:
        """Toggle Left Sidebar visibility."""
        sidebar = self.query_one("#sidebar")
        sidebar.visible = not sidebar.visible

    def action_clear_chat(self) -> None:
        """Clear all messages from the chat area."""
        chat_area = self.query_one("#chat-area", ScrollableContainer)
        chat_area.query(".chat-message-row").remove()

    def action_refresh_data(self) -> None:
        """Manual refresh command for tables."""
        self.refresh_tables()
        self.append_message("System", "🔄 Dynamic tables and capabilities successfully re-synchronized.")

    def action_quit(self) -> None:
        self.app.exit()

    def action_go_to_menu(self) -> None:
        """Switch screen back to Welcome Menu."""
        self.app.switch_screen("menu")
