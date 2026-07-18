"""Morph agent loop — ties LLM, tools, and memory together."""

import json
import os
from datetime import datetime
from typing import Any

try:
    from .memory import MemoryStore
    from .tools import ToolRegistry
    from .stellar_kb import SYSTEM_PROMPT
except ImportError:
    from memory import MemoryStore
    from tools import ToolRegistry
    from stellar_kb import SYSTEM_PROMPT


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
        """Generate a response using LLM (OpenCode AI API with big-pickle auth)."""
        import urllib.request
        import urllib.error
        import json

        api_url = os.environ.get("OPENCODE_API_URL", "https://opencode.ai/zen/v1/chat/completions")
        api_key = (os.environ.get("OPENCODE_API_KEY") or "").strip()
        if not api_key:
            return (
                "[dim](AI offline — set OPENCODE_API_KEY in the environment)[/dim]\n\n"
                "I can still help with local tools. Type `tools` or describe a task."
            )
        provider = os.environ.get("OPENCODE_PROVIDER", "opencode zen")
        model = os.environ.get("OPENCODE_MODEL", "big-pickle")

        # Prepare messages in chat completions format
        api_messages = []
        api_messages.append({
            "role": "system",
            "content": SYSTEM_PROMPT
        })
        # Add history messages
        for msg in self.history[-10:]:
            api_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        payload = {
            "provider": provider,
            "model": model,
            "messages": api_messages,
            "metadata": {
                "workspace": self.workspace
            }
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "MorphTUI/0.1.0"
        }

        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read().decode("utf-8")
                res_json = json.loads(body)
                choices = res_json.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if content:
                        return content
                content = (
                    res_json.get("output_text")
                    or res_json.get("message")
                    or res_json.get("text")
                )
                if content:
                    return str(content)
                return "Received empty response from the AI model."
        except Exception as e:
            lower = prompt.lower()
            err_msg = f"[dim](Fallback active — AI API Offline: {e})[/dim]\n\n"
            if "transform" in lower or "migrate" in lower or "web3" in lower:
                return err_msg + (
                    "I can help transform your codebase for Web3. "
                    "Try: `analyze` to scan the codebase, or tell me what you want to migrate."
                )
            if "hello" in lower or "hi" in lower:
                return err_msg + f"Hello! I'm Morph, your transformation agent. Working in {self.workspace}. How can I help?"
            return err_msg + (
                f"I understand your request. I have {len(self.tools.list_tools())} tools available. "
                f"Type `tools` to see them, or describe what you'd like to transform."
            )
