"""Memory Management screen — interactive persistent memory editor."""

import os
from textual.screen import Screen
from textual.widgets import Label, Static, Button, DataTable, Input
from textual.containers import Container, Vertical, Horizontal

try:
    from ..components.logo import get_banner
except ImportError:
    from components.logo import get_banner

LOGO = get_banner()


class MemoryScreen(Screen):
    """Interactive screen for persistent key-value memory management."""

    def compose(self):
        with Container(id="memory-screen-container"):
            with Container(id="memory-outer"):
                yield Static(LOGO, id="memory-logo")
                
                with Vertical(id="memory-header-box"):
                    yield Label("PERSISTENT MEMORY MANAGEMENT", id="memory-title")
                    yield Label("Manage keys, values, and contextual memory used by Morph.", id="memory-desc")
                
                with Horizontal(id="memory-workspace"):
                    # Left side: DataTable listing all keys/values
                    with Vertical(id="memory-table-container"):
                        yield Label("Stored Keys & Values", id="memory-table-label")
                        yield DataTable(id="memory-screen-table")
                    
                    # Right side: Add / Edit form and control actions
                    with Vertical(id="memory-form-container"):
                        yield Label("Add or Update Key", classes="form-label")
                        yield Input(placeholder="Enter memory key...", id="input-memory-key")
                        yield Label("Memory Value", classes="form-label")
                        yield Input(placeholder="Enter memory value...", id="input-memory-value")
                        
                        with Vertical(id="memory-actions-wrapper-inner"):
                            yield Button(" 💾 Save / Update Key", id="btn-memory-save", variant="primary")
                            yield Button(" ✖ Delete Selected Row", id="btn-memory-delete", variant="error")
                            yield Button(" 🗑 Clear All Memories", id="btn-memory-clear", variant="error")
                            yield Button(" ❮ Back to Main Menu", id="btn-memory-back")

    def on_mount(self) -> None:
        """Initialize table columns and populate rows."""
        table = self.query_one("#memory-screen-table", DataTable)
        table.add_columns("Key", "Value")
        table.cursor_type = "row"
        self.refresh_table()

    def refresh_table(self) -> None:
        """Load entries from the database and refresh the DataTable."""
        table = self.query_one("#memory-screen-table", DataTable)
        table.clear()
        
        user_id = getattr(self.app.agent, "user_id", "default")
        entries = self.app.store.list(user_id)
        
        if not entries:
            table.add_row("(empty)", "No persistent memories found.")
        else:
            for k, v in entries:
                table.add_row(k, v)

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """When user clicks/selects a row, populate the input fields for easy editing."""
        table = self.query_one("#memory-screen-table", DataTable)
        row_key = event.row_key
        row_data = table.get_row(row_key)
        
        if row_data and row_data[0] != "(empty)":
            self.query_one("#input-memory-key", Input).value = row_data[0]
            self.query_one("#input-memory-value", Input).value = row_data[1]

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        user_id = getattr(self.app.agent, "user_id", "default")
        
        if button_id == "btn-memory-save":
            key = self.query_one("#input-memory-key", Input).value.strip()
            val = self.query_one("#input-memory-value", Input).value.strip()
            
            if not key or not val:
                self.notify("Key and Value fields cannot be empty.", severity="error")
                return
            
            self.app.store.set(user_id, key, val)
            self.notify(f"Saved memory for: '{key}'")
            self.query_one("#input-memory-key", Input).value = ""
            self.query_one("#input-memory-value", Input).value = ""
            self.refresh_table()
            
        elif button_id == "btn-memory-delete":
            table = self.query_one("#memory-screen-table", DataTable)
            cursor_coordinate = table.cursor_coordinate
            if not cursor_coordinate:
                self.notify("Please select a row in the table first.", severity="error")
                return
                
            row_index = cursor_coordinate.row
            row_key = table.row_keys[row_index]
            row_data = table.get_row(row_key)
            
            if not row_data or row_data[0] == "(empty)":
                self.notify("No valid entry selected.", severity="error")
                return
                
            key_to_delete = row_data[0]
            self.app.store.delete(user_id, key_to_delete)
            self.notify(f"Deleted memory: '{key_to_delete}'")
            self.refresh_table()
            
        elif button_id == "btn-memory-clear":
            entries = self.app.store.list(user_id)
            if not entries:
                self.notify("Memory is already empty.")
                return
                
            for k, _ in entries:
                self.app.store.delete(user_id, k)
                
            self.notify("All memories cleared.")
            self.refresh_table()
            
        elif button_id == "btn-memory-back":
            self.app.switch_screen("menu")
