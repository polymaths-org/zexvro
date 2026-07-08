"""Main menu screen — logo, title, and navigation list."""

import os
import platform
import sys

from textual.binding import Binding
from textual.containers import Container
from textual.screen import Screen
from textual.widgets import Label, ListItem, ListView, Static

from ..components.logo import get_banner
from ..styles.icons import BRAIN, CHAT, CROSS, INFO, LIGHTNING, TOOLS

LOGO = get_banner()


class MainScreen(Screen):
    """Main menu — hub for all TUI navigation."""

    BINDINGS = [Binding("q", "quit", "Quit")]

    def compose(self):
        # Center container
        with Container(id="main-container"):
            yield Static(LOGO, id="logo")
            yield Label("MORPH — AI Transformation Agent", id="title")
            yield Label("Web3 Migration & Code Transformation", id="subtitle")
            
            yield Container(
                ListView(
                    ListItem(Label(f"  {CHAT}  Chat with Morph"), id="chat"),
                    ListItem(Label(f"  {LIGHTNING}  Execute Transformation"), id="exec"),
                    ListItem(Label(f"  {BRAIN}  Memory Viewer"), id="memory"),
                    ListItem(Label(f"  {TOOLS}  Available Tools"), id="tools"),
                    ListItem(Label(f"  {INFO}  About Morph"), id="about"),
                    ListItem(Label(f"  {CROSS}  Quit"), id="quit"),
                ),
                id="menu",
            )
            
            # System status/information box
            cwd = os.getcwd()
            if len(cwd) > 50:
                cwd = "..." + cwd[-47:]
            stats_text = (
                f" Directory: [bold]{cwd}[/bold]\n"
                f" System: {platform.system()} {platform.machine()} | Python {platform.python_version()} | ZEXVRO Mode"
            )
            yield Label(stats_text, id="info-box")

    def on_list_view_selected(self, event: ListView.Selected):
        target = event.item.id
        if target == "quit":
            self.app.exit()
        elif target == "exec":
            # Redirect transformation command to chat screen
            self.app.push_screen("chat")
        else:
            self.app.push_screen(target)

    def action_quit(self):
        self.app.exit()
