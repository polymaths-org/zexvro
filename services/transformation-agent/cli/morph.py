#!/usr/bin/env python3
"""Morph CLI — Transformation Agent for Zexvro."""

from typing import Optional

import typer
from rich.console import Console

app = typer.Typer(
    name="morph",
    help="Morph: AI transformation agent for Web3 migration.",
)
auth_app = typer.Typer(help="Authenticate this CLI with your ZEXVRO account.")
console = Console()


def _import_agent():
    try:
        from .agent import Agent
    except ImportError:
        from agent import Agent
    return Agent


def _import_auth():
    try:
        from . import auth
    except ImportError:
        import auth
    return auth


def _import_memory_store():
    try:
        from .memory import MemoryStore
    except ImportError:
        from memory import MemoryStore
    return MemoryStore


def _import_tui_main():
    try:
        from .tui import main as tui_main
    except ImportError:
        from tui import main as tui_main
    return tui_main


@app.callback(invoke_without_command=True)
def default_callback(ctx: typer.Context):
    """Morph: AI transformation agent for Web3 migration."""
    if ctx.invoked_subcommand is None:
        tui_main = _import_tui_main()
        tui_main()



def _run_login(api_url: Optional[str] = None):
    auth = _import_auth()
    if not auth.perform_login(api_url=api_url):
        raise typer.Exit(1)


def _run_logout():
    auth = _import_auth()
    if auth.clear_auth():
        console.print("[bold green]✔ Successfully logged out and cleared credentials.[/]")
    else:
        console.print("[yellow]No active session found or failed to delete auth file.[/]")


def _run_status():
    auth = _import_auth()
    auth_data = auth.load_auth()
    if not auth_data:
        console.print("[yellow]Status: Unauthenticated. Run 'morph login' to connect.[/]")
        raise typer.Exit(1)

    username = auth_data.get("username") or auth_data.get("email") or "unknown"
    token = auth.get_access_token(auth_data)
    if not token:
        console.print("[bold red]Status: Stored session is missing an access token. Run 'morph login' again.[/]")
        raise typer.Exit(1)

    console.print(f"Logged in as: [bold cyan]{username}[/]")
    console.print(f"Token signature: [dim]{token[:12]}...[/]")

    api_url = auth.get_api_url(auth_data)
    headers = auth.auth_headers(auth_data)
    resp, status_code = auth.request_json(f"{api_url}/api/memory", headers=headers, method="GET")

    if status_code == 200:
        console.print("Sync connection health: [bold green]Active & Synchronized[/]")
        # Signal to the Web dashboard that this CLI session is reachable.
        import time

        update_data = {
            "memory": {
                "cli_connected": True,
                "cli_last_active": int(time.time()),
                "cli_username": username,
            }
        }
        update_resp, update_status = auth.request_json(
            f"{api_url}/api/memory", data=update_data, headers=headers, method="POST"
        )
        if update_status != 200:
            reason = update_resp.get("error_description") or update_resp.get("error") or update_status
            console.print(f"[yellow]Status updated locally, but backend sync write failed: {reason}[/]")
    else:
        reason = resp.get("error_description") or resp.get("error") or status_code
        console.print(f"Sync connection health: [bold red]Offline or Invalid Token ({reason})[/]")
        raise typer.Exit(1)


def _ensure_authenticated():
    auth = _import_auth()
    if not auth.load_auth():
        console.print("[bold red]✖ Authentication required.[/bold red]")
        console.print("Please run [bold cyan]morph login[/bold cyan] to link your ZEXVRO account first.")
        raise typer.Exit(1)


@app.command()
def chat(prompt: str = typer.Argument("", help="Initial prompt or question")):
    """Start an interactive chat with Morph."""
    _ensure_authenticated()
    Agent = _import_agent()

    agent = Agent()
    if prompt:
        console.print(agent.run(prompt))
    else:
        console.print("[bold cyan]Morph CLI[/] ready. Type your message.")
        while True:
            try:
                user_input = typer.prompt("You")
                if user_input.lower() in ("exit", "quit", "q"):
                    break
                agent.run(user_input)
            except (EOFError, KeyboardInterrupt):
                break


@app.command()
def exec(
    prompt: str = typer.Argument(..., help="What to execute"),
    repo: str = typer.Option(".", help="Repository path to analyze"),
):
    """Run a one-shot transformation task."""
    _ensure_authenticated()
    Agent = _import_agent()

    agent = Agent(workspace=repo)
    result = agent.run(prompt)
    console.print(result)


@app.command()
def tui():
    """Launch the interactive TUI (terminal UI)."""
    tui_main = _import_tui_main()

    tui_main()


@app.command()
def memory(
    user: str = typer.Option("default", help="User ID to query memory for"),
    key: str = typer.Option(None, help="Specific memory key to retrieve"),
):
    """View or query Morph's persistent memory."""
    _ensure_authenticated()
    MemoryStore = _import_memory_store()

    store = MemoryStore()
    if key:
        val = store.get(user, key)
        console.print(f"{key}: {val}")
    else:
        entries = store.list(user)
        for k, v in entries:
            console.print(f"  {k}: {v[:80]}..." if len(v) > 80 else f"  {k}: {v}")




@app.command()
def login(
    api_url: Optional[str] = typer.Option(
        None,
        "--api-url",
        help="Backend API URL. Defaults to MORPH_API_URL or the production AWS API Gateway URL.",
    ),
):
    """Authenticate the CLI with your ZEXVRO account."""
    _run_login(api_url)


@app.command()
def logout():
    """Clear local authentication credentials."""
    _run_logout()


@app.command()
def status():
    """Check authentication status and connection to the backend."""
    _run_status()


@auth_app.command("login")
def auth_login(
    api_url: Optional[str] = typer.Option(
        None,
        "--api-url",
        help="Backend API URL. Defaults to MORPH_API_URL or the production AWS API Gateway URL.",
    ),
):
    """Authenticate the CLI with your ZEXVRO account."""
    _run_login(api_url)


@auth_app.command("logout")
def auth_logout():
    """Clear local authentication credentials."""
    _run_logout()


@auth_app.command("status")
def auth_status():
    """Check authentication status and backend connectivity."""
    _run_status()


app.add_typer(auth_app, name="auth")


def main():
    app()


if __name__ == "__main__":
    main()
