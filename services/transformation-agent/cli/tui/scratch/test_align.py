from textual.app import App, ComposeResult
from textual.containers import Container
from textual.widgets import Static
import asyncio

class TestAlignApp(App):
    CSS = """
    #screen-container {
        layout: vertical;
        align: center middle;
        width: 100%;
        height: 100%;
        background: black;
    }
    #outer {
        layout: vertical;
        align: center middle;
        width: 78;
        height: auto;
        border: solid white;
        background: blue;
    }
    #logo {
        width: 100%;
        height: 4;
        content-align: center middle;
        background: red;
    }
    #subtitle {
        width: 100%;
        height: 2;
        background: magenta;
    }
    #actions-wrapper {
        width: 100%;
        height: auto;
        align: center middle;
        background: gray;
    }
    #actions {
        width: 50;
        height: 6;
        border: solid green;
        background: yellow;
    }
    """
    def compose(self) -> ComposeResult:
        with Container(id="screen-container"):
            with Container(id="outer"):
                yield Static("LOGO", id="logo")
                yield Container(id="subtitle")
                with Container(id="actions-wrapper"):
                    yield Container(id="actions")

async def run_test():
    app = TestAlignApp()
    async def capture():
        await asyncio.sleep(0.5)
        app.save_screenshot("/home/paris/.gemini/antigravity/brain/f6d34261-5eee-47ef-a57f-0f660b36907c/test_align_wrapper.svg")
        await app.action_quit()
    task = asyncio.create_task(app.run_async())
    await capture()
    await task

if __name__ == "__main__":
    asyncio.run(run_test())
