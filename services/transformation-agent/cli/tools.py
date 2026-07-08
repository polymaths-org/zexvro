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
        self.register(
            "query_stellar_knowledge",
            self.tool_query_stellar_knowledge,
            "Query the Stellar/Soroban reference knowledge base. Args: query (str)",
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

    def tool_query_stellar_knowledge(self, query: str) -> str:
        """Query the Stellar/Soroban reference knowledge base for technical references."""
        import re
        kb_dir = Path(__file__).parent.parent / "data" / "stellar_kb"
        if not kb_dir.exists():
            return "Error: Stellar Knowledge Base directory not found."
            
        query_words = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 2]
        if not query_words:
            query_words = [query.lower()]
            
        results = []
        for file_path in kb_dir.glob("*.md"):
            try:
                content = file_path.read_text()
                # Split content into sections by ## headings
                sections = re.split(r'\n(##+ )', content)
                
                # Re-assemble the split sections
                reconstructed_sections = []
                # First chunk before any heading
                if sections and not sections[0].startswith("##"):
                    reconstructed_sections.append(("", sections[0]))
                
                for i in range(1, len(sections), 2):
                    heading_marker = sections[i]
                    section_body = sections[i+1] if i+1 < len(sections) else ""
                    # find the heading title line
                    heading_lines = section_body.split("\n", 1)
                    heading_title = heading_lines[0].strip() if heading_lines else ""
                    reconstructed_sections.append((heading_title, heading_marker + section_body))
                    
                for title, text in reconstructed_sections:
                    # Score section based on word occurrences
                    score = 0
                    text_lower = text.lower()
                    for word in query_words:
                        if word in text_lower:
                            score += 10
                            # Bonus for exact counts
                            score += text_lower.count(word)
                        if word in title.lower():
                            score += 20
                            
                    if score > 0:
                        results.append({
                            "file": file_path.name,
                            "heading": title,
                            "text": text.strip(),
                            "score": score
                        })
            except Exception as e:
                continue
                
        if not results:
            return "No matching Stellar or Soroban knowledge base articles found."
            
        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Take the top 3 results
        output = []
        for r in results[:3]:
            output.append(f"--- SOURCE: {r['file']} > {r['heading']} (Score: {r['score']}) ---\n{r['text']}\n")
            
        return "\n".join(output)
