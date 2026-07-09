"""Main TUI application — central App class, screen registry, lifecycle."""

from textual.app import App

try:
    from ..agent import Agent
    from ..memory import MemoryStore
except ImportError:
    from agent import Agent
    from memory import MemoryStore

from .screens.main import MainScreen
from .screens.welcome import WelcomeScreen
from .screens.menu import WelcomeMenuScreen
from .screens.login import LoginScreen
from .screens.memory import MemoryScreen
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
        "menu": WelcomeMenuScreen,
        "main": MainScreen,
        "login": LoginScreen,
        "memory": MemoryScreen,
    }

    def __init__(self):
        super().__init__()
        self.agent = Agent()
        self.store = MemoryStore()

    def on_mount(self):
        self.push_screen("welcome")

        # Start periodic heartbeat to dashboard
        try:
            from ..auth import send_heartbeat
        except ImportError:
            from auth import send_heartbeat
            
        self.run_worker(send_heartbeat, thread=True)
        self.set_interval(15, lambda: self.run_worker(send_heartbeat, thread=True))
