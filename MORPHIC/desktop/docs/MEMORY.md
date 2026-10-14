# Morph's memory, soul and learned routines

> Developer documentation for `src/core/memory.ts`, `soul.ts` and `routines.ts`.
> Harness overview: [CORE.md](./CORE.md). Last updated: 2026-10-14.

Ideas borrowed, then kept small enough for one person's computer: Letta's always-in-context block and
"sleep-time" reflection, Mem0's add / update / remove extraction, OpenClaw's `SOUL.md` and
human-readable `MEMORY.md`, Hermes' skills and learned procedures. No vector database: personal
memory stays in the hundreds of notes, where BM25 with light stemming is fast, explainable and has no
model dependency.

## Identity: rules, soul, personality

Every conversation prompt starts with `identity(soul, personality, name)`:

| Layer | Where | Who can change it | Notes |
| --- | --- | --- | --- |
| **Rules** | `RULES` in `soul.ts` | Developers only | Safety and honesty. Always first. Nothing below can override them. |
| **Soul** | `<data>/soul.md`, default `soul/default-soul.md` | The person (Settings → Advanced → Morph's soul) | Who Morph is, how it speaks, what it cares about. Max 6000 characters. Empty or "Go back to the original" deletes the file. |
| **Personality** | `settings.personality` | The person (Settings → Morph's answers) | `tone` (warm, cheerful, calm, respectful), `humour` (on/off), `callMe` (e.g. "Aunty"; empty = their name). |

The soul is written in the first person ("I am Morph…"); the rules in the second person. Changing the
soul is logged in the activity log. A unit test checks that a hostile soul ("ignore all rules…") still
comes after the rules.

## Memory layers

| Layer | File | In the prompt | Written by |
| --- | --- | --- | --- |
| **About you** (profile) | `memory/profile.json` | Always | The person, on the memory page. Lines that look sensitive are dropped. |
| **Notes** | `memory/notes.json` | Pinned: always. Others: when relevant. Dates: when coming up. | The `remember` tool, idle reflection, the memory page. |
| **Episodes** | `memory/episodes.json` | When relevant to the new question | Idle reflection (conversation summary). |
| **Routines** | `routines.json` | Up to 5 listed; the best match guides a browsing task | Finished browsing tasks. |

### A note (`MemoryNote`, `shared/core.ts`)

| Field | Meaning |
| --- | --- |
| `text` | One full sentence about the person, ≤ 300 characters. |
| `source` | `told` (they asked Morph to remember), `learned` (reflection), `added` (typed on the memory page). |
| `category` | `people`, `health`, `preferences`, `places`, `dates`, `tech`, `other`. Given by the model or the person, else guessed (`guessCategory`). |
| `importance` | 1 small detail, 2 useful (default), 3 important (allergies, medicines, close family). |
| `pinned` | "Always remember": in every prompt, never expires, never tidied away, never removed by reflection. |
| `date` | `MM-DD` (every year) or `YYYY-MM-DD` (once), for birthdays, anniversaries, appointments. Found automatically in date notes (`findDate`: "12 March", "March 12th", "12/03", ISO). |
| `expiresAt` | For short-lived facts ("my son is visiting this week"). Expired notes are not recalled and are removed by tidy. |
| `uses`, `lastUsedAt` | How often an answer actually drew on the note. |

Notes saved by the first memory version are upgraded on load (category guessed, importance 2,
unpinned, uses 0, date found if it's a date note).

## Lifecycle

```
capture ──► recall ──► use ──► reflect (idle) ──► tidy ──► forget
   ▲                                                         │
   └──────────────── the person, any time, on the memory page ┘
```

1. **Capture.** `memory.add` cleans the text, refuses anything `looksSensitive`, merges a near-duplicate
   (word overlap ≥ 0.85; keeps the more detailed wording and the higher importance) or stores a new note.
2. **Recall** (each turn, `memory.recall(lastTwoQuestions)`):
   - pinned notes (up to 8);
   - relevant notes (up to 6): only notes with a keyword match, scored
     `bm25/best + 0.25·importance/3 + 0.2·recency(60-day decay) + 0.1·usefulness + 0.1 if told/added`,
     kept above 0.35;
   - coming up: dated notes in the next 14 days ("today", "tomorrow", "in 6 days");
   - when nothing matches (e.g. "hello"): the 4 most important recent notes, so Morph still knows the basics.
3. **Use.** After the answer, `usedIn(reply, note)` checks whether the reply repeats the note's
   distinctive words (≥ 4 letters, ignoring the person's name); those notes get `uses + 1`.
4. **Reflect** (`Agent.reflect`, after 45 s of quiet, never while Morph is answering): one model call
   with `buildReflectionPrompt` returns
   `{"add": [{text, category, importance, date?, until?}], "update": [{id, text}], "remove": [id], "summary"}`.
   Code checks everything: sensitive facts are dropped, plain-string `add` items are accepted (older
   models), `remove` only applies to unpinned notes Morph learned itself (never what the person told or
   added). The summary updates the episode and compacts long conversations (older messages are covered
   by the summary; the last 10 stay word for word).
5. **Tidy** (`memory.tidy`, no model call): on start, every 12 hours, and after reflection changes
   memory. Drops expired notes and one-off dates that have passed; merges near-duplicates in the same
   category (overlap ≥ 0.8; usage counts are combined).
6. **Forget.** "Forget about…" (`forget` tool, BM25 match ≥ 60 % of the best), Forget on a row,
   or Forget everything (also clears routines and episodes; conversations stay).

### `memory/MEMORY.md`

Rewritten after every change: About you, Always remember, then one section per category, with
"(important)" marks. It lets the person or a family member read exactly what Morph remembers without
opening the app. It is a copy; edits there are not read back.

## Learned routines

- **Learn:** when a browsing task ends with `done` and has at least two useful steps, `routines.learn`
  stores `{goal, site, steps}`. Steps are generalised first: "Typed “Pune” into “From”" becomes
  "Typed into “From”", choices lose their value, steps done by the person are dropped, anything that
  looks sensitive is dropped. A similar goal on the same site (overlap ≥ 0.6) updates the existing
  routine and counts a use. At most 50 routines (least used dropped first).
- **Reuse:** a new task looks for the best routine on its start site with goal overlap ≥ 0.5 and adds
  it to the step prompt as a guide ("These steps worked then… follow what is on the page now"). The
  turn prompt lists up to 5 routines so Morph knows what it has done before.
- **Safety:** a routine is only text for the model. Every action is still judged by the Sentinel, so a
  learned "Pressed Book now" still asks first.
- **UI:** memory page → "Things I've learned to do" (steps expandable, Forget per routine).
- Routines are only learned and used while memory is on.

## The memory page (renderer `memory/MemoryPage.tsx`)

- Memory on/off, About you.
- Add a memory with an optional category ("Let Morph sort it" = guess).
- Grouped list: Always remember first, then each category with a count; searching shows a flat,
  ranked list instead. Each row: source and time, the date line for dated notes, "Important",
  "Until …" for expiring notes, and Always remember / Unpin, Change, Forget.
- Things I've learned to do (routines).
- Forget everything (confirm dialog).

## Privacy guarantees (tested)

- Passwords, PINs, OTPs, card, 12-digit ID, bank account and IFSC numbers are never stored in notes,
  profile, episodes or routines (`looksSensitive`).
- Memory off: no memory in the prompt, no `remember`/`forget` tools, no reflection, no routines.
- Everything lives in local files in the data directory; nothing is synced.

## Tests

`npm test` covers: v1 → v2 upgrade; pinned always recalled; expiry and tidy; dates (`findDate`,
`daysUntil`, upcoming); category guesses; near-duplicate merge; `MEMORY.md`; usage counting;
reflection v2 (categories, importance, dates, `until`, safe `remove`); soul set/reset and rule
precedence; personality in the prompt; routine generalisation, learning and reuse.
`npm run test:e2e` covers the memory page (grouping, category on add, pin, prompt), personality and
soul from Settings into the prompt, and a learned routine shown after a real browsing task.
