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
| **Morph track** | Morph on OpenCode (providers + agents) + ZEXVRO MCP tools, Lakebed arcade Web2→Web3 demo, Morph surface in dashboard, shared memory updates, CI/CD |
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
| `context.md` | Product context, ownership, **active remaining work**, marketing surfaces |
| `memory.md` | Chronological handoffs, decisions, blockers |
| `design.md` | Product UI + marketing design rules |
| `docs/marketing.md` | Marketing kit brief / copy inventory |
| `AGENTS.md` | This boot file |

## Database direction (2026-10-28)

- AWS has been deleted. User authorized a fresh reset onto Cloudflare D1, including new email/password accounts. Do not depend on or attempt to restore Cognito/AWS login. Use the project’s Cloudflare authentication; users register again.
- **Always use Wrangler named profile `zexvro`, authenticated as `zexvro@gmail.com`, for every Cloudflare operation in this project and its subprojects.** Set `XDG_CONFIG_HOME=/home/wraient`; use `--profile zexvro` on supported commands and bind the project directory with `wrangler auth activate zexvro /home/wraient/Projects/zexvro`. Verify the email/account with `wrangler whoami` from the bound directory (without `--profile`). Never use `default`, `tyrion-prod`, another account, or silently fall back. If the profile is missing, expired, or has the wrong email, stop Cloudflare mutations and reauthenticate `zexvro`. Do not replace another profile's login.
- Keep routine database usage economical: indexed tenant-scoped queries, bounded pagination, no-op write suppression, and request/write limits. Do not claim AWS data recovery or a completed cutover without remote verification.
- Migration implementation/status: `services/platform-api/README.md`; historical service boundaries remain relevant until each repository is migrated.

## Zer0 pool safety (2026-10-29)

- Local Soroban + real Groth16 proof tests reproduced unsafe legacy funding and unbound withdrawal recipients. New pool funding is paused in the console/prover; preserve existing notes and recovery access. Do not bypass `frontend/src/lib/poolSafety.ts` or deploy the legacy pool as safe. See the post-migration verification report and `memory.md` for the required contract/circuit upgrade.

## Non-Morph release verification

- Run `npm run test:non-morph` for the local non-Morph suites; add `:browser` for the production-build browser acceptance run. Keep external wallets, chain payments and paid providers mocked unless the user authorizes real transactions. Report unconfigured integrations separately from passing mock coverage.
- Labs keeps its existing SpacetimeDB; publish schema-preserving changes with `--delete-data=never`. Never reset Labs data as part of the deleted-AWS platform reset. Its dedicated gateway credential is a Cloudflare secret, never source code.

## CI/CD release policy

- Main push heads are verified and deployed to isolated `dev.zexvro.in`; production promotion runs every three hours. GitHub Actions “Production release (scheduled or deploy now)” is the manual fast path. Manual releases keep every test/staging/integrity gate and may skip only the observation delay. Never restore direct push-to-production or a force/skip-checks option.
- Record release identity and keep dev data, R2 assets and signing credentials separate from production. Preserve the legacy private-pool funding pause and report unavailable external integrations explicitly. Morph is excluded from this pipeline.
