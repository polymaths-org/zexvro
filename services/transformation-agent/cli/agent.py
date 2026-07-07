"""Morph agent loop — ties LLM, tools, and memory together."""

import json
import os
from datetime import datetime
from typing import Any

from memory import MemoryStore
from tools import ToolRegistry


class Agent:
    """Core Morph agent that processes prompts using tools and memory."""

    def __init__(self, workspace: str = "."):
        self.workspace = os.path.abspath(workspace)
        self.memory = MemoryStore()
        self.tools = ToolRegistry(workspace)
        self.user_id = os.environ.get("MORPH_USER", "default")
        self.session = self.memory.load_session(self.user_id)
        self.history: list[dict] = self.session.get("history", [])

    def run(self, prompt: str) -> str:
        """Process a user prompt and return the response."""
        self.history.append({"role": "user", "content": prompt, "ts": datetime.utcnow().isoformat()})

        # Determine intent
        response = self._process(prompt)

        self.history.append({"role": "assistant", "content": response, "ts": datetime.utcnow().isoformat()})
        self.memory.save_session(self.user_id, {"history": self.history[-50:]})
        return response

    def _process(self, prompt: str) -> str:
        """Route the prompt to the right handler."""
        lower = prompt.lower().strip()

        # Tool listing
        if lower in ("tools", "help", "?"):
            tools = self.tools.list_tools()
            lines = ["**Available tools:**"]
            for t in tools:
                lines.append(f"  - {t['name']}: {t['description']}")
            return "\n".join(lines)

        # Memory operations
        if lower.startswith("remember ") or lower.startswith("save "):
            parts = prompt.split(" ", 2)
            if len(parts) >= 3:
                key = parts[1]
                value = parts[2]
                self.memory.set(self.user_id, key, value)
                return f"✅ Remembered: {key}"
            return "Usage: remember <key> <value>"

        if lower.startswith("recall ") or lower.startswith("get "):
            key = prompt.split(" ", 1)[1].strip()
            val = self.memory.get(self.user_id, key)
            return f"{key}: {val}" if val else f"Nothing stored under '{key}'"

        if lower == "memory" or lower == "mem":
            entries = self.memory.list(self.user_id)
            if not entries:
                return "No memories stored yet."
            return "\n".join(f"  {k}: {v[:100]}" for k, v in entries)

        # Tool execution (simple parsing)
        if lower.startswith("tool ") or lower.startswith("run "):
            rest = prompt.split(" ", 1)[1] if " " in prompt else ""
            if not rest:
                return "Usage: tool <name> [args as JSON]"
            parts = rest.split(" ", 1)
            tool_name = parts[0]
            args = {}
            if len(parts) > 1:
                try:
                    args = json.loads(parts[1])
                except json.JSONDecodeError:
                    return f"Invalid JSON args: {parts[1]}"
            result = self.tools.execute(tool_name, **args)
            return str(result)

        # Analyze codebase
        if lower in ("analyze", "analyze codebase", "codebase"):
            return self.tools.execute("analyze_codebase")

        # Default: LLM-powered response (simulated for MVP)
        return self._llm_response(prompt)

    def _llm_response(self, prompt: str) -> str:
        """Generate a response using LLM (simulated for MVP — will wire OpenAI API)."""
        # Check if it's about transformation
        lower = prompt.lower()
        if "transform" in lower or "migrate" in lower or "web3" in lower:
            return (
                "I can help transform your codebase for Web3. "
                "Try: `analyze` to scan the codebase, or tell me what you want to migrate."
            )
        if "hello" in lower or "hi" in lower:
            return f"Hello! I'm Morph, your transformation agent. Working in {self.workspace}. How can I help?"
        return (
            f"I understand your request. I have {len(self.tools.list_tools())} tools available. "
            f"Type `tools` to see them, or describe what you'd like to transform."
        )
