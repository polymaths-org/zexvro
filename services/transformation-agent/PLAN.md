# Morph — Transformation Agent Plan

## Identity
- **Name:** Morph
- **Service:** Transformation Agent (Jack's Bro / Zexvro)
- **Owner:** Paris
- **Inspiration:** Cortex Code, Snowflake Cortex, Gemini Workspace

## Concept
An AI agent platform (CLI + Web) that helps teams transform Web2 codebases, data, and workflows into Web3-ready infrastructure. It has persistent shared memory, vision, tool use, and workspace awareness.

## MVP Scope (21 Days)
1. **CLI Agent** (Week 1)
   - Terminal chat interface
   - Tool-use skeleton (read files, run commands)
   - Per-user persistent memory (SQLite)
   - Basic codebase analysis & transformation suggestions

2. **Web Panel** (Week 2)
   - React dashboard with agent chat
   - Same tools as CLI
   - Vision capability (screenshots)
   - Shared memory with CLI

3. **Agent Memory System** (Week 1-2)
   - Durable user memory
   - Session context
   - Project memory per repo
   - Secrets isolation

## Tech Stack (Proposed)
- **CLI:** Python + Typer
- **LLM:** OpenAI API (swappable)
- **Memory:** SQLite → PostgreSQL (later)
- **Web:** FastAPI + existing Zexvro frontend
- **Infra:** AWS (EC2/RDS)

## Architecture
```
User → CLI / Web Panel
         ↓
    [Morph Core]
     ↓       ↓
   [LLM]   [Tools]
     ↓       ↓
   [Memory] [Workspace]
```

## Files to Create
- `cli/morph.py` — Main CLI entry
- `cli/agent.py` — Agent loop
- `cli/tools.py` — Tool implementations
- `cli/memory.py` — Memory system
- `cli/requirements.txt` — Dependencies
- `web/` — Web panel (future)
- `README.md` — Service docs
