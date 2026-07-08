"""Chat screen — interactive conversation with the agent."""

import os
from datetime import datetime

from textual import work
from textual.binding import Binding
from textual.containers import Container, ScrollableContainer
from textual.screen import Screen
from textual.widgets import Input, Label, Static

from tools import ToolRegistry
from ..components.logo import get_small_logo

SMALL_LOGO = get_small_logo()


class ChatScreen(Screen):
    """Interactive chat with the Morph agent."""

    BINDINGS = [
        Binding("escape", "go_back", "Back"),
        Binding("ctrl+d", "go_back", "Back"),
    ]

    def compose(self):
        # Left Sidebar for agent details and shortcuts
        with Container(id="chat-sidebar"):
            yield Static(SMALL_LOGO, id="sidebar-logo")
            yield Label("MORPH SYSTEM", id="sidebar-title")
            
            yield Label("AGENT STATUS", classes="sidebar-label")
            yield Label("IDLE", id="status-val", classes="sidebar-val")
            
            yield Label("WORKSPACE", classes="sidebar-label")
            cwd = os.getcwd()
            if len(cwd) > 22:
                cwd = "..." + cwd[-19:]
            yield Label(cwd, classes="sidebar-val")
            
            yield Label("ACTIVE TOOLS", classes="sidebar-label")
            registry = ToolRegistry()
            tools = registry.list_tools()
            for t in tools:
                yield Label(f" ▪ {t['name']}", classes="sidebar-tool")
                
            yield Label("\nCONTROLS", classes="sidebar-label")
            yield Label(" Esc : Back to Menu", classes="sidebar-val")
            yield Label(" Enter : Send Message", classes="sidebar-val")

        # Main Chat Area
        with Container(id="chat-main"):
            yield Label("  Chat Console with Morph", id="screen-title")
            
            # Message history container
            yield ScrollableContainer(id="chat-area")
            
            # Message input container
            with Container(id="chat-input-container"):
                yield Input(placeholder="Ask Morph anything or type 'tools'...", id="chat-input")

    def on_mount(self):
        # Add welcome message from Morph
        self.append_message(
            "Morph", 
            "Hello! I am Morph, your AI transformation agent. "
            "How can I assist with your Web3 migration or code transformation tasks today?"
        )
        self.query_one("#chat-input", Input).focus()

    def append_message(self, sender: str, text: str):
        """Append a beautifully formatted card message to the chat window."""
        chat_area = self.query_one("#chat-area", ScrollableContainer)
        
        # Determine styling classes
        if sender.lower() == "you":
            header_class = "message-header message-header-user"
            card_class = "message-card message-card-user"
            container_class = "message-container message-container-user"
        else:
            header_class = "message-header message-header-morph"
            card_class = "message-card message-card-morph"
            container_class = "message-container message-container-morph"

        # Create card widgets with children passed in constructor
        timestamp = datetime.now().strftime("%H:%M:%S")
        card = Container(
            Label(sender.upper(), classes=header_class),
            Label(text, classes="message-text"),
            Label(timestamp, classes="message-time"),
            classes=card_class
        )
        container = Container(card, classes=container_class)
        chat_area.mount(container)
        
        # Scroll to bottom
        chat_area.scroll_end(animate=False)

    def on_input_submitted(self, event: Input.Submitted):
        text = event.value.strip()
        if not text:
            return
            
        event.input.value = ""
        
        # Exit shortcuts
        if text.lower() in ("exit", "quit", "q"):
            self.action_go_back()
            return
            
        # Append User Message
        self.append_message("You", text)
        
        # Execute agent in background worker
        self.run_agent(text)

    @work(thread=True)
    def run_agent(self, text: str) -> None:
        """Run the agent logic on a background thread to prevent UI freezing."""
        # Update Status
        self.app.call_from_thread(self.query_one("#status-val", Label).update, "THINKING")
        
        try:
            # Process prompt through agent
            response = self.app.agent.run(text)
            self.app.call_from_thread(self.append_message, "Morph", response)
        except Exception as e:
            self.app.call_from_thread(self.append_message, "Error", f"Execution failed: {e}")
        finally:
            # Revert Status
            self.app.call_from_thread(self.query_one("#status-val", Label).update, "IDLE")

    def action_go_back(self):
        self.app.pop_screen()
