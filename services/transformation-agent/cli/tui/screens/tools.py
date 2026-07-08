"""Tools screen — shows all registered tools in a structured DataTable."""

from textual.binding import Binding
from textual.containers import Container
from textual.screen import Screen
from textual.widgets import Label, DataTable

from tools import ToolRegistry


class ToolsScreen(Screen):
    """Tool registry browser using DataTable."""

    BINDINGS = [
        Binding("escape", "go_back", "Back"),
    ]

    def compose(self):
        with Container(id="main-container"):
            yield Label("Agent Tool Registry", id="title")
            yield Label("Registered system capabilities and sandbox tools", id="subtitle")
            
            # Table container
            with Container(id="table-container"):
                yield DataTable(zebra_stripes=True)
                
            yield Label("[esc] Return to main panel", id="screen-footer")

    def on_mount(self):
        table = self.query_one(DataTable)
        table.add_columns("Tool Name", "Capability Description")
        self._refresh()

    def _refresh(self):
        table = self.query_one(DataTable)
        table.clear()
        
        registry = ToolRegistry()
        tools = registry.list_tools()
        
        if not tools:
            table.add_row("(empty)", "No capabilities registered in system registry.")
        else:
            for t in tools:
                table.add_row(t["name"], t["description"])

    def action_go_back(self):
        self.app.pop_screen()
