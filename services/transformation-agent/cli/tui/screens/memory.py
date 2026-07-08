"""Memory browser screen — view persistent key/value store in a structured DataTable."""

from textual.binding import Binding
from textual.containers import Container
from textual.screen import Screen
from textual.widgets import Label, DataTable


class MemoryScreen(Screen):
    """Persistent memory browser using DataTable."""

    BINDINGS = [
        Binding("escape", "go_back", "Back"),
        Binding("r", "refresh", "Refresh"),
    ]

    def compose(self):
        with Container(id="main-container"):
            yield Label("Memory Store Viewer", id="title")
            yield Label("Recall and inspect persistent agent memories", id="subtitle")
            
            # Table container
            with Container(id="table-container"):
                yield DataTable(zebra_stripes=True)
                
            yield Label("[r] Refresh table  |  [esc] Return to main panel", id="screen-footer")

    def on_mount(self):
        table = self.query_one(DataTable)
        table.add_columns("Key", "Value")
        self._refresh()

    def _refresh(self):
        table = self.query_one(DataTable)
        table.clear()
        
        # Retrieve memories dynamically for active user session
        user_id = getattr(self.app.agent, "user_id", "default")
        entries = self.app.store.list(user_id)
        
        if not entries:
            table.add_row("(empty)", "No memories stored yet. Use 'remember <key> <value>' in Chat.")
        else:
            for k, v in entries:
                # Wrap long value display
                val_display = v[:100] + ("..." if len(v) > 100 else "")
                table.add_row(k, val_display)

    def action_refresh(self):
        self._refresh()

    def action_go_back(self):
        self.app.pop_screen()
