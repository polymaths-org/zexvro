"""Tool implementations for Morph agent."""

import os
import subprocess
from pathlib import Path
from typing import Any


class ToolRegistry:
    """Registry of tools Morph can use."""

    def __init__(self, workspace: str = "."):
        self.workspace = Path(workspace).resolve()
        self._tools: dict[str, dict] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(
            "read_file",
            self.tool_read_file,
            "Read a file from the workspace. Args: path (str)",
        )
        self.register(
            "write_file",
            self.tool_write_file,
            "Write content to a file. Args: path (str), content (str)",
        )
        self.register(
            "list_dir",
            self.tool_list_dir,
            "List directory contents. Args: path (str)",
        )
        self.register(
            "run_command",
            self.tool_run_command,
            "Run a shell command. Args: command (str), timeout (int)",
        )
        self.register(
            "analyze_codebase",
            self.tool_analyze_codebase,
            "Get an overview of the codebase structure.",
        )

    def register(self, name: str, fn: callable, description: str):
        self._tools[name] = {"fn": fn, "description": description}

    def list_tools(self) -> list[dict[str, str]]:
        return [{"name": n, "description": d["description"]} for n, d in self._tools.items()]

    def execute(self, name: str, **kwargs) -> Any:
        if name not in self._tools:
            return f"Error: unknown tool '{name}'"
        try:
            return self._tools[name]["fn"](**kwargs)
        except Exception as e:
            return f"Error executing {name}: {e}"

    def _safe_path(self, path: str) -> Path:
        p = (self.workspace / path).resolve()
        if not str(p).startswith(str(self.workspace)):
            raise PermissionError(f"Path outside workspace: {path}")
        return p

    def tool_read_file(self, path: str) -> str:
        p = self._safe_path(path)
        if not p.exists():
            return f"File not found: {path}"
        return p.read_text()

    def tool_write_file(self, path: str, content: str) -> str:
        p = self._safe_path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        return f"Written: {path}"

    def tool_list_dir(self, path: str = ".") -> str:
        p = self._safe_path(path)
        if not p.is_dir():
            return f"Not a directory: {path}"
        items = []
        for entry in p.iterdir():
            items.append(f"{'📁' if entry.is_dir() else '📄'} {entry.name}")
        return "\n".join(items)

    def tool_run_command(self, command: str, timeout: int = 30) -> str:
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=timeout
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[stderr]\n{result.stderr}"
            return output.strip() or "(no output)"
        except subprocess.TimeoutExpired:
            return f"Command timed out after {timeout}s"
        except Exception as e:
            return f"Command error: {e}"

    def tool_analyze_codebase(self) -> str:
        langs = set()
        file_count = 0
        for root, dirs, files in os.walk(self.workspace):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules" and d != "__pycache__"]
            for f in files:
                file_count += 1
                ext = Path(f).suffix
                if ext:
                    langs.add(ext)
        return f"Files: {file_count} | Types: {', '.join(sorted(langs)) if langs else 'unknown'}"
