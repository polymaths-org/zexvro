# MORPHIC Core — how Morph's harness works

> Developer documentation. Product copy never mentions any of this (no "model", "provider", "tool" in the UI).
> Memory, soul and routines have their own page: [MEMORY.md](./MEMORY.md).
> Last updated: 2026-10-14.

MORPHIC Core is Morph's own agent harness. It owns conversations, the agent turn, tools and the
Sentinel, browsing tasks, memory, the soul, skills, reminders, connectors and the activity log. It
uses only Node APIs (no Electron), so the same code runs in two places:

| Where | How it starts | Transport |
| --- | --- | --- |
| Inside the desktop app | `main/core-host.ts` forks `out/main/core.js --data <userData>` as an Electron utility process | `process.parentPort` messages |
| Headless (servers, scripts, a future phone companion) | `node out/main/core.js --stdio --data <dir>` (Node ≥ 22) | one JSON message per line on stdin/stdout; logs on stderr |

```
Renderer (React UI)
   │ window.morphic.core(method, ...args)      preload bridge, allow-listed by CORE_METHODS
   ▼
Main process (Electron)                        settings, window, Morph's browser (WebContentsView)
   │ JSON-RPC over parentPort                  host requests: browser.open/snapshot/act/driving
   ▼
MORPHIC Core (utility process)                 src/core/*
   │ HTTPS
   ▼
Model service                                  VROAI, or a configured chat-completions provider (see "Model providers")
```

## Modules (`src/core`)

| File | Responsibility |
| --- | --- |
| `index.ts` | Entry point. Builds every store, picks the model client, registers the RPC handlers, starts schedules (reminders tick, memory tidy). |
| `agent.ts` | The agent turn, the Sentinel applied to replies, review cards, browsing tasks (`runTask`), memory reflection while idle, memory-use tracking. |
| `prompt.ts` | Prompt assembly (`buildTurnPrompt`, `memorySections`, `buildReflectionPrompt`, `availableTools`, history + compaction window). |
| `soul.ts`, `soul/default-soul.md` | Fixed safety `RULES`, the editable soul (`soul.md`), personality → `identity()`. |
| `memory.ts` | Memory v2: profile, notes (category, importance, pin, date, expiry, usage), episodes; BM25 + light stemming; recall; tidy; `MEMORY.md` mirror; sensitive-data filter. |
| `routines.ts` | Learned browsing routines (steps that worked, without what was typed). |
| `tools.ts` | Tool definitions with a fixed tier (`auto` / `ask`), JSON schema, validation, preview and run. |
| `browser-task.ts` | Step reply parser, the browsing Sentinel (`judge`), step prompt (with optional routine guide). |
| `protocol.ts` | Forgiving reply parser: `<<action {...}>>`, `<tool_call>`, fenced JSON, bare `{name, arguments}`; `extractJson`. |
| `model.ts` | `VroaiClient`, `OpenRouterClient` (system/user split, native tool calls → `<<action>>` lines), `FallbackClient` with back-off. |
| `skills.ts`, `skills/*.md` | SKILL.md-style skills; only skills whose triggers match the message go into the prompt. |
| `reminders.ts` | Reminder store and scheduler (once / daily / weekly), local-time parsing. |
| `connectors.ts` | MCP connectors (stdio programs and Streamable HTTP addresses). |
| `sessions.ts`, `activity.ts`, `store.ts` | Conversations, the plain-English activity log, JSON helpers. |
| `core.test.ts` | Unit tests (vitest) for everything above, with a scripted fake model and fake browser. |

## Data files (all under the data directory; in the app this is Electron's `userData`)

| Path | Contents |
| --- | --- |
| `settings.json` | App settings (written by the main process, not Core). Core receives the subset in `CoreSettings` via `configure`. |
| `sessions/<id>.json` | One conversation: messages, actions, plans, approvals, task cards, summary + compaction markers. |
| `memory/profile.json` | "About you" (always in the prompt). |
| `memory/notes.json` | Memory notes (v2 fields; older notes are upgraded on load). |
| `memory/episodes.json` | One-line summaries of past conversations. |
| `memory/MEMORY.md` | Human-readable mirror of the above (rewritten on change; the JSON is the source of truth). |
| `soul.md` | Only present when the soul was changed; deleting it (or "Go back to the original") restores the default. |
| `routines.json` | Learned browsing routines. |
| `reminders.json` | Reminders. |
| `activity.jsonl` | Activity log, one JSON line per entry. |
| `skills/*.md` | Extra skills added by the person or a family member (built-in ones ship inside the app). |
| `connectors.json` | Configured connectors. |

## One turn

1. `chat.send` saves the question first (so it survives a crash or Stop), then `Agent.answer`.
2. `turnPrompt` builds the prompt, most important first:
   **rules → soul → personality → answer length + language → date/time → memory (about you, pinned,
   relevant, coming up, past conversations, learned routines) → reminders → matching skills → tools →
   connected apps → tool result (if any) → conversation.**
   Models with a system role get everything before `Conversation so far:` as the system message (`splitPrompt`).
3. One model call. Native tool calls come back as `<<action>>` lines, so every provider looks the same to Core.
4. `applyReply` parses actions (max 6), validates each against its tool, and applies the Sentinel:
   - `auto` tools run now (reminders, remember/forget, checklists, opening a site in Morph's browser);
   - `ask` tools produce one review card per answer and run only after "Yes, go ahead";
   - `start_browsing` starts straight away unless "Ask before Morph starts browsing" is on.
5. The answer is saved; memories the answer drew on are counted (`usedIn` → `memory.markUsed`).
6. After 45 s of quiet, reflection runs (see [MEMORY.md](./MEMORY.md)).

## The Sentinel (safety in code, not in the prompt)

- Tool tiers are fixed in `tools.ts`. The model cannot change them; every argument is validated.
- The fixed `RULES` in `soul.ts` always come first in the prompt; the editable soul cannot override them.
- `looksSensitive` (memory.ts) refuses to store or type passwords, PINs, OTPs, card, ID and bank numbers.
- Browsing (`judge` in `browser-task.ts`):
  - opening websites is allowed, except addresses that look like tricks (IP numbers, punycode, very long hosts) → ask;
  - "real-world" buttons (pay, buy, book, send, submit, delete, transfer, subscribe, checkout, …) → ask;
    everyday ones (search, next, sign in, accept, close) don't;
  - private fields (password, OTP, card) → handed to the person ("Your turn" → "Done, carry on");
  - an element that changed since the page was read → refused.
- A learned routine is only a hint for the model; every action it leads to is still judged by the Sentinel.

## Browsing tasks

`Agent.runTask`: look at the page (`browser.snapshot`, numbered elements + text) → one model call →
up to 6 actions → each judged → done in Morph's browser → look again only when the page changed.
Max 15 steps. The task card shows a live "say" line and each step. When a task finishes well, the
steps are saved as a routine (see [MEMORY.md](./MEMORY.md#learned-routines)); the next similar task on
the same site gets them as a guide in the step prompt.

## Model providers (configuration only)

| Setting (desktop/.env, main-process only) | Meaning |
| --- | --- |
| `MAIN_VITE_VROAI_URL` / `VROAI_URL` | VROAI address (`POST {prompt}` → `{success, response}`). |
| `MAIN_VITE_OPENROUTER_API_KEY` / `OPENROUTER_API_KEY` | When set together with a model, a chat-completions provider answers and VROAI is the fallback. |
| `MAIN_VITE_OPENROUTER_MODEL` / `OPENROUTER_MODEL` | Model id; comma-separated ids use client-side sequential fallbacks for custom gateways, or provider fallbacks on stock OpenRouter. |
| `OPENROUTER_BASE_URL` (runtime only) | Optional OpenAI-compatible gateway base URL, including `/v1`. Custom gateways are probed at `/models`; stock OpenRouter uses `/key`. |
| `MORPHIC_PROVIDER=vroai` | Forces VROAI (e2e tests use this). |

`FallbackClient` tries providers in order and rests one that just failed (`backoffFor`):

| Failure | Rested for |
| --- | --- |
| HTTP 429 mentioning a per-day / daily limit | until the quota resets at 00:00 UTC |
| other HTTP 429 / "rate limit" | 60 s |
| network error, time-out, host unreachable | 20 s |
| anything else | not rested |

If every provider is resting, all are tried anyway. Stop is never retried.

**Never ship a key inside a packaged build:** `MAIN_VITE_*` values are compiled into the app. Before
distributing, put the key behind VROAI (server side) and point Morph at VROAI only.

## RPC surface

The full, typed list is `CoreMethods` in `src/shared/core.ts`; the host only forwards methods in
`CORE_METHODS`. Groups: `configure`, `status`; `sessions.*`; `chat.send|retry|stop|approve|togglePlanStep`;
`memory.list|add|update|pin|delete|clear|profile|setProfile`; `soul.get|set|reset`;
`routines.list|delete`; `reminders.*`; `activity.list`; `connectors.*`.

Events (Core → UI): `session.updated`, `chat.progress`, `reminder.due`, `reminders.changed`,
`memory.changed` (also sent when routines change), `connectors.changed`.

Host requests (Core → main): `browser.open`, `browser.snapshot`, `browser.act`, `browser.driving`,
`host.openExternal` (unused by tools; Morph never opens the person's default browser).

## Extending Core

- **A tool:** add a `Tool` in `tools.ts` with a tier, `usage` line, JSON `schema`, `validate`, optional
  `preview` (for `ask`), and `run`; add it to `TOOLS`. Add a unit test that the Sentinel treats it right.
- **A skill:** a markdown file with `name`, `description`, `triggers` frontmatter in `src/core/skills/`
  (built in) or `<data>/skills/` (local).
- **A provider:** implement `ModelClient` (`complete`, `reachable`) in `model.ts`, return native tool
  calls as `<<action>>` lines, and add it to the `FallbackClient` list in `index.ts`.
- **An RPC method:** add it to `CoreMethods` and `CORE_METHODS` (`shared/core.ts`), then a handler in `index.ts`.

## Testing

| Command | What it covers |
| --- | --- |
| `npm test` | Core unit tests (vitest): protocol, memory v2, reflection v2, soul, routines, reminders, prompt, tools, browsing Sentinel, connectors (real MCP fixture), providers + back-off. |
| `npm run test:e2e` | Builds, then Playwright drives the real Electron app with a fake VROAI and a tiny test website. `MORPHIC_SHOTS=<dir>` saves screenshots. |
| `npm run typecheck` / `npm run build` | Both TypeScript projects (node + web), then the production bundle. |
