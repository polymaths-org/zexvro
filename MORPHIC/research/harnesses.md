# Agent harness research → MORPHIC Core design

> 2026-10-14. What other harnesses do well, and what MORPHIC takes from each. Sources at the bottom;
> several are blogs/aggregators, so details marked "reported" weren't confirmed in official docs.

## What each harness gets right

| Harness | Best ideas | What we take |
| --- | --- | --- |
| **OpenClaw** | One long-running gateway process owns sessions, tools, memory, scheduling and channels. Memory in plain files (MEMORY.md + daily notes), hybrid keyword/vector search. Heartbeat (periodic agent turn) + cron. SKILL.md skills; persistent agents vs throwaway sub-agents. | A single **Core** process that owns everything; UIs are clients. Human-readable memory files. A **scheduler** for reminders. SKILL.md-style skills. |
| **Hermes Agent** (Nous) | A learning loop: nudges the agent to save knowledge, writes skills from experience, builds a model of the user across sessions. Session search with FTS + LLM summaries. | **Automatic memory** of durable facts about the person, **session summaries** that are searchable, a growing **profile** of the person. (Auto-written skills: roadmap.) |
| **Pi** (pi-mono) | A tiny core with everything else as extensions (`registerTool`, events/hooks). Provider-agnostic model layer. Run modes: interactive, JSON, **RPC**, SDK. Sessions as an id/parentId tree in JSONL; compaction keeps a summary + first kept entry. | A **small core with a tool registry and hooks** (the safety layer is a hook). A **provider-agnostic model client**. **RPC run modes** (embedded + stdio). **Compaction** with a stored summary. (Branching sessions: not needed for this audience yet.) |
| **T3 Code** | One server, many clients: desktop app (Win/macOS/Linux), web GUI, mobile companion, headless server. Brings your own models. | **Client/server split** so the same Core can later serve a phone app or web UI. Model provider is swappable. |
| **Letta (MemGPT)** | In-context memory blocks with labels and size limits (persona, human); out-of-context archival + recall memory; agent edits its own memory with tools. "Sleep-time" compute for memory work between turns. | A small **"About you" block** always in the prompt (size-limited, user-editable). Memory work happens **when idle**, not while the person waits. |
| **Mem0** | Extraction pipeline: look up related memories, extract new facts, then ADD / UPDATE / NOOP to avoid duplicates. | **Dedupe-aware extraction** (add new, update changed, skip known). |
| **Goose / OpenCode / Claude Code** | Server + multiple frontends; MCP tools; recipes; permission modes; hooks; compaction; skills with progressive disclosure. | **Permission tiers** (auto / ask first / never), **progressive skill loading**, **audit trail**. (MCP client: next step.) |

## Where MORPHIC aims to be better for its people

1. **Safety is code, not a prompt.** Every tool has a tier. "Ask first" tools never run until the person presses a button on a review card; the activity log records what happened, in plain words.
2. **Memory the person can see and control.** "What I remember" lists everything with where it came from (you told me / I learned / you added). Edit, forget one thing, forget everything, or switch memory off. Passwords, OTPs, card and account numbers are filtered out before anything is saved.
3. **Fast on a slow model.** VROAI takes ~9 s per call and handles one at a time, so a turn is **one call**: Morph answers and attaches actions (set a reminder, remember, show a plan, ask to open a website) in the same reply. Memory extraction and summaries run during idle time.
4. **Helpful structure instead of walls of text.** Step-by-step answers become a checklist the person ticks off; reminders become real OS notifications with "Done" and "Remind me in 10 minutes".
5. **Runs everywhere.** Core is plain Node/TypeScript with no native modules: inside the Electron app on Windows, macOS and Linux (as a separate utility process), or headless on any machine with Node ≥ 22 over stdio JSON-RPC (a WebSocket transport for phone/web clients is the next transport to add).

## MORPHIC Core at a glance

```
UI (Electron renderer) ──IPC──▶ Electron main ──MessagePort RPC──▶ Core (utility process)
                                     ▲  host requests (open website, notify)        │
                                     └──────────────────────────────────────────────┘
Core = sessions · agent turn · tools + sentinel · memory (profile, notes, episodes, BM25)
       · skills (SKILL.md) · reminders scheduler · activity log · model client (VROAI)
Headless: node out/main/core.js --stdio --data <dir>   (same RPC over stdin/stdout)
```

**Deliberately not yet:** browser automation (needs its own spike), MCP client, sub-agents, messaging
channels (WhatsApp etc.), vector embeddings (VROAI has no embedding endpoint yet), auto-written skills.

## Sources

- OpenClaw: [clawdocs.org architecture](https://clawdocs.org/architecture/overview), [core concepts](https://clawdocs.org/getting-started/core-concepts), [Ravi Chaganti intro](https://ravichaganti.com/blog/introduction-to-openclaw/), [Medium deep dive](https://medium.com/@eswar.kalakata/inside-openclaw-the-architecture-of-a-self-hosted-multi-agent-ai-gateway-5870aab11f22)
- Hermes Agent: [official docs](https://hermes-agent.nousresearch.com/docs), [Inside Hermes Agent](https://mranand.substack.com/p/inside-hermes-agent-how-a-self-improving), [Turing Post comparison](https://www.turingpost.com/p/hermes), [How Hermes memory works](https://unabyss.com/blog/how-hermes-memory-works)
- Pi: [pi.dev compaction docs](https://pi.dev/docs/latest/compaction), [agentic-ai reference](https://agentic-ai.readthedocs.io/en/latest/AgentHarness/pi-dev/), [urandom deep dive](https://urandom.io/blog/2026-03-07-pi-dev-deep-dive), [DEV review](https://dev.to/andrew-ooo/pi-coding-agent-review-the-minimal-terminal-harness-5b46)
- T3 Code: [Better Stack guide](https://betterstack.com/community/guides/ai/t3-code/), [Flavio Copes deep dive](https://flaviocopes.com/t3-code)
- Letta / Mem0: [Letta memory architecture](https://docs.letta.com/guides/agents/architectures/memgpt), [Letta memory management](https://docs.letta.com/concepts/memory-management), [Mem0 how it works](https://docs.mem0.ai/core-concepts/how-it-works), [Mem0 vs Letta](https://vectorize.io/articles/mem0-vs-letta)
