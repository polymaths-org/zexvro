# AGENTS.md — ZEXVRO agent boot + remaining work

Coding agents (Codex, Claude, Cursor, OpenCode, etc.) must read this before building.

## Boot (required)

1. Read `README.md`
2. Read `context.md` — especially **Active Ticket Assignments** and **Remaining Work**
3. Read `memory.md` (latest entries first, then full scan for blockers)
4. Read `design.md` before any UI work
5. Run `git status --short`
6. Build only your assignee’s tickets unless the human expands scope
7. After meaningful work: append a `memory.md` entry; commit code + memory together when asked

## Who builds what (2026-07-21)

| Assignee | Build |
| --- | --- |
| **Morph track** | Morph CLI + agentic system, CI/CD, Web2→Web3 transformation demo, Morph site/surface, shared memory that actually updates, Morph working in project dashboard |
| **Nabil** | RBAC, Zexvro credits, team management (invite fix, email display), workspace management + related UI, working audit logs, admin-curated options |
| **Paris** | Remove unwanted/dummy UI (executions, service manager bloat), landing demos + demo icons, shell polish (Zer0 sidebar, Payroll→Finance, home metrics, need-help→docs), project settings UI revamp (Discord) |

Full checklists live in `context.md` → **Remaining Work**. Do not invent a parallel backlog.

## Do not

- Steal another assignee’s ticket without coordination + `memory.md` entry
- Commit secrets / `.env`
- Treat incomplete platform work as done
- Paste long logs into `memory.md`

## Source of truth

| File | Use |
| --- | --- |
| `context.md` | Product context, ownership, **active remaining work** |
| `memory.md` | Chronological handoffs, decisions, blockers |
| `design.md` | UI / brand rules |
| `AGENTS.md` | This boot file |
