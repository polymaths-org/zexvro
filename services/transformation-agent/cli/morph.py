#!/usr/bin/env python3
"""Morph CLI — Transformation Agent for Zexvro."""

import typer
from rich.console import Console

app = typer.Typer(
    name="morph",
    help="Morph: AI transformation agent for Web3 migration.",
)
console = Console()


@app.command()
def chat(prompt: str = typer.Argument("", help="Initial prompt or question")):
    """Start an interactive chat with Morph."""
    from agent import Agent

    agent = Agent()
    if prompt:
        agent.run(prompt)
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
    from agent import Agent

    agent = Agent(workspace=repo)
    result = agent.run(prompt)
    console.print(result)


@app.command()
def tui():
    """Launch the interactive TUI (terminal UI)."""
    from tui import main as tui_main

    tui_main()


@app.command()
def memory(
    user: str = typer.Option("default", help="User ID to query memory for"),
    key: str = typer.Option(None, help="Specific memory key to retrieve"),
):
    """View or query Morph's persistent memory."""
    from memory import MemoryStore

    store = MemoryStore()
    if key:
        val = store.get(user, key)
        console.print(f"{key}: {val}")
    else:
        entries = store.list(user)
        for k, v in entries:
            console.print(f"  {k}: {v[:80]}..." if len(v) > 80 else f"  {k}: {v}")




@app.command()
def login():
    """Authenticate the CLI with your ZEXVRO account."""
    from auth import perform_login
    perform_login()


@app.command()
def logout():
    """Clear local authentication credentials."""
    from auth import clear_auth
    if clear_auth():
        console.print("[bold green]✔ Successfully logged out and cleared credentials.[/]")
    else:
        console.print("[yellow]No active session found or failed to delete auth file.[/]")


@app.command()
def status():
    """Check authentication status and connection to the backend."""
    from auth import load_auth, request_json, get_api_url
    auth_data = load_auth()
    if not auth_data:
        console.print("[yellow]Status: Unauthenticated. Run 'morph login' to connect.[/]")
        return
        
    console.print(f"Logged in as: [bold cyan]{auth_data.get('username')}[/]")
    console.print(f"Token signature: [dim]{auth_data.get('access_token')[:12]}...[/]")
    
    # Ping the api memory to check connection
    api_url = get_api_url()
    headers = {"Authorization": f"Bearer {auth_data.get('access_token')}"}
    resp, status_code = request_json(f"{api_url}/api/memory", headers=headers, method="GET")
    
    if status_code == 200:
        console.print("Sync connection health: [bold green]Active & Synchronized[/]")
    else:
        console.print(f"Sync connection health: [bold red]Offline or Invalid Token ({status_code})[/]")


def main():
    app()


if __name__ == "__main__":
    main()
