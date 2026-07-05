# ZEXVRO Shared Memory

This file is the shared working memory for all developers and their coding agents.

Every developer and every agent must read this file before starting work, then update it after meaningful changes. The goal is to let three developers and their agents work in the same repo without overwriting each other's work, duplicating decisions, or breaking service boundaries.

## Rules For Developers And Agents

1. Read `context.md` and `memory.md` before starting any task.
2. Check `git status` before editing.
3. Do not overwrite another developer's work.
4. Do not refactor another service unless that developer has agreed or the change is required for a shared interface.
5. Keep service ownership clear:
   - Paris / `paris-29`: Zero-Knowledge Privacy Pool, Transformation Agent.
   - Rushi / `Wraient`: A-2-A Trade Pipeline, Captcha-like Agent Authentication Service.
   - Nabil / `n4bi10p`: NFT Service, De-pin.
6. If a task touches shared contracts, APIs, schemas, auth, wallet logic, deployment, or platform navigation, document the change here.
7. After every meaningful update, add a dated memory entry before committing.
8. Commit the code change and the memory update together.
9. Keep entries factual. Write what changed, why it changed, what remains, and who owns the next step.
10. If work is blocked, record the blocker and the person or decision needed to unblock it.

## What Not To Do

- Do not delete or rewrite old memory entries.
- Do not remove another developer's notes unless they are moved into a more permanent doc and the move is recorded.
- Do not silently change service boundaries.
- Do not add large unrelated refactors to a service task.
- Do not commit generated secrets, API keys, private keys, wallet seed phrases, `.env` files, or credentials.
- Do not invent De-pin scope before Nabil provides context.
- Do not assume platform-wide standards are decided unless they are documented here or in `context.md`.

## Agent-First Development Notes

ZEXVRO should be built in an agent-first way.

Agents should be able to quickly discover:

- What service they are working on.
- Who owns it.
- Which files and directories are safe to edit.
- What shared interfaces exist.
- What recent changes other agents made.
- What context the web agent and CLI agent should share.

When code is scaffolded, add clear service-level READMEs or comments that point agents to the right context. If a dedicated agent skill is created later, it should teach agents where to look for `context.md`, `memory.md`, service READMEs, API contracts, and platform comments.

## Memory Entry Template

Use this format for every update:

```md
## YYYY-MM-DD - Developer or agent name - Short title

- Service or area:
- Files changed:
- Summary:
- Decisions made:
- Follow-ups:
- Blockers:
```

## Active Service Ownership

| Service | Owner | Current status |
| --- | --- | --- |
| Zero-Knowledge Privacy Pool | Paris / `paris-29` | Planned |
| Transformation Agent | Paris / `paris-29` | Planned |
| A-2-A Trade Pipeline | Rushi / `Wraient` | Planned |
| Captcha-like Agent Authentication Service | Rushi / `Wraient` | Planned |
| NFT Service | Nabil / `n4bi10p` | Planned |
| De-pin | Nabil / `n4bi10p` | Needs Nabil brainstorming/context |

## 2026-07-05 - Codex - Initial project memory

- Service or area: project documentation and repository setup.
- Files changed: `context.md`, `memory.md`, `README.md`, `assets/brand/logo.png`, `assets/brand/typo-logo.png`, `assets/brand/brand-design.png`.
- Summary: Captured the initial ZEXVRO platform context, MVP service list, developer ownership, planned stack, brand assets, and shared-memory workflow.
- Decisions made: Six unique services are the MVP priority. Common PaaS features such as DB, deploy, hosting, security, and connectors are secondary unless time allows.
- Follow-ups: Scaffold the Vite/React frontend, define service directories, add exact setup commands, and ask Nabil for De-pin context.
- Blockers: De-pin scope is not defined yet.

