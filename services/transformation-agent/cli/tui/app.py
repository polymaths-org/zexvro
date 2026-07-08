"""Main TUI application — central App class, screen registry, lifecycle."""

from textual.app import App

from agent import Agent
from memory import MemoryStore

from .screens.welcome import WelcomeScreen
from .screens.main import MainScreen
from .screens.chat import ChatScreen
from .screens.memory import MemoryScreen
from .screens.tools import ToolsScreen
from .screens.about import AboutScreen
from .styles.theme import APP_CSS


class MorphTUI(App):
    """Root TUI application.

    Manages screen navigation, agent lifecycle, and global state
    accessible to all screens via ``self.app``.
    """

    CSS = APP_CSS
    TITLE = "Morph TUI"

    SCREENS = {
        "welcome": WelcomeScreen,
        "main": MainScreen,
        "chat": ChatScreen,
        "memory": MemoryScreen,
        "tools": ToolsScreen,
        "about": AboutScreen,
    }

    def __init__(self):
        super().__init__()
        self.agent = Agent()
        self.store = MemoryStore()

    def on_mount(self):
        self.push_screen("welcome")
