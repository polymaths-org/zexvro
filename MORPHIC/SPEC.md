# MORPHIC — working spec

> `morphic.md` is the owner's read-only brief. This file is the working spec agents may edit.
> Last updated: 2026-10-14.

## What it is

**Morph** is a desktop helper: you tell it what you need, and it does it on the computer for you.
**MORPHIC** is Morph's own harness: the desktop app plus the engine underneath.

- Not Web3. Separate from `services/morph` (the OpenCode-based Web2→Web3 CLI).
- Example job: "upload this course to the LMS". Morph opens the site, fills everything in, attaches
  files, then stops. The person reviews a plain summary and presses Submit themselves.

## Who it's for (internal only, never in product copy)

Older people, people with no technical background, and anyone who finds it hard to click the right
button. The product never says "for seniors", "beginners" or "easy mode"; it just says
"Tell Morph what you need".

## Principles

1. **Morph does the work, the person approves.** Every consequential action ends in a review card
   with two large buttons, e.g. "Looks right, submit" / "Change something".
2. **Hard safety rules in code, not in the prompt** (Muse's "Sentinel" idea). Web pages can
   prompt-inject the model, and this audience is the most-scammed.

   | Morph does it | Always asks first |
   | --- | --- |
   | Open sites, read, scroll, search | Submit, send, pay, delete, post |
   | Type into fields, attach files | Enter a password, OTP, card or ID number |
   | Summarise, draft | Visit a new or suspicious site |

3. **No jargon.** No providers, models, tokens, tools, or raw errors in the UI. Errors say what
   happened and what to do next.
4. **Accessibility rules (non-negotiable):** body text ≥ 18px, adjustable to 21/24px; primary buttons
   ≥ 56px tall; every icon has a text label; nothing is hover-only; selection is never shown by colour
   alone; nothing times out; reduced motion and reduced transparency are respected.

## Architecture

```
Electron app (MORPHIC/desktop)          ← UI, Morph's browser (WebContentsView), settings, onboarding
   │  IPC (preload bridge, sandboxed renderer, allow-listed methods)
   ▼
MORPHIC Core (desktop/src/core)         ← our own harness: agent turn, Sentinel, browsing tasks, memory,
   │                                       soul, routines, skills, reminders, MCP connectors.
   │                                       Utility process in the app, or headless over stdio.
   ▼
VROAI                                   ← ZEXVRO's AI backend. Users never pick a provider.
```

Developer docs: `desktop/docs/CORE.md` (harness, data files, RPC, Sentinel, providers, testing) and
`desktop/docs/MEMORY.md` (memory, soul, learned routines).

- **Cross-platform:** Electron, so Windows, macOS and Linux all run the same Chromium.
  This matters for the agent driving its own browser.
- **VROAI contract (to agree before building either side):** OpenAI-compatible chat + tool calls +
  streaming, authenticated with the person's ZEXVRO account. Until VROAI exists, dev builds point at
  a stand-in with the same contract.
- **Licensing:** keep upstream LICENSE/NOTICE files for any white-labelled engine.

## Tools

| Tool | What it does | When |
| --- | --- | --- |
| Do it for me | Browser fills forms, uploads, portals, LMS; stops at review card | v1 |
| Explain this | Letter / bill / PDF / screenshot → what it says + what to do | v1 |
| Scam check | Message or link → safe or not, and why; warnings in Morph's browser | v1 |
| Mail | Read new mail aloud, summarise, draft replies, find attachments | v1 (one provider) |
| My Details | Encrypted local profile for form filling; passwords stay in OS keychain, never sent to VROAI | v1 |
| Show me how | Highlights where to click, step by step, instead of doing it | v2 |
| Routines | Scheduled jobs ("pay electricity bill monthly"), still ask before paying | v2 |
| Ask family | Send a review card to a trusted person's phone for approval | v2 |

## Design system (MORPHIC, not the ZEXVRO dashboard)

MORPHIC deliberately departs from `design.md`: bigger type, bigger targets, rounder shapes, glass.

- **Signature:** Morph is a glass M with glowing eyes, standing behind the glass panel the way it
  rises over the planet in the brand film. The panel's top edge sits just below the eyes. The eyes
  look at the button the person should press next. On first launch, Morph assembles from pixels,
  the logo's dissolve played in reverse.
- **Backdrop:** a static planet horizon with lavender rim light. No looping background animation.
- **Type:** Lexend (headings) and Atkinson Hyperlegible Next (body). Both were designed for reading
  ease. Lexend Tera is used only for the `MORPH` wordmark.
- **Colour:** ink `#07060A`, lavender `#D4D2FC` / `#9C97EC` / `#6F69CF` (sampled from the
  logo), action `#DCDAFD` on dark and `#4A43B8` on light. Light, dark and match-my-computer themes
  are all supported.
- **Clean mark:** `desktop/src/renderer/src/components/mark.ts` (traced from `assets/morph-idle.gif`,
  symmetric, 98% overlap with the source).

## Status

- [x] Electron + React + Tailwind scaffold, sandboxed renderer, settings persisted in main process
- [x] Onboarding: welcome (pixel intro) → name → text size (live) → read aloud → safety promise → ready
- [x] Home: greeting, ask bar, starter tiles (prefill only), Settings sheet (text size, voice, theme, redo setup)
- [x] Packaging config for Win (NSIS one-click), macOS (universal dmg), Linux (AppImage + deb)
- [x] E2E (Playwright + Electron): full onboarding, persistence across relaunch, dark theme — `npm run test:e2e`
- [x] Engine decision: own harness (MORPHIC Core) instead of wrapping Goose; see `research/harnesses.md`
- [x] Talks to live VROAI (`POST {prompt}` → `{success, response}`) from the main process; URL in `desktop/.env`
      (`MAIN_VITE_VROAI_URL`, overridable by `VROAI_URL`). Persona + last 12 messages are written into the prompt
      because VROAI ignores `system`/`messages` today
- [x] Conversations: saved per session in `userData/sessions/*.json`; sidebar grouped Today/Yesterday/Earlier;
      rename, delete (with confirm), Stop, Try again, read aloud per answer, online status
- [x] Themes: Lavender, Ocean, Sunrise, Forest, High contrast × light/dark (one hue per theme, oklch tokens)
- [x] Motion: circular theme reveal (View Transitions), Morph + ask box glide home → conversation (shared layout),
      thinking eyes scan + pixel loader, message enter springs
- [x] Living backdrop: WebGL shader (planet rim, drifting aurora, twinkling stars in dark), theme-coloured,
      brightens while Morph thinks; 30 fps cap, paused when hidden, single frame with reduced motion, off in High contrast
- [x] GSAP SplitText: step titles and the home greeting rise word by word; answers settle in word by word inside the
      bubble that grows out of the "Thinking…" bubble. Split is reverted after, so copy/selection/screen readers see plain text
- [x] Exit animations for Settings, confirm dialogs, sidebar collapse, and the onboarding → app hand-over
- [x] Onboarding "How would you like Morph to look?" step (theme + light/dark); Settings: name, delete all conversations,
      keyboard shortcuts; Copy on answers; crash screen; Ctrl/⌘+N and Ctrl/⌘+,
- [x] A scene per theme in the shader: Lavender = planet + aurora + stars; Ocean = moonlit sea, waves, reflection;
      Sunrise = sun peeking over hills, rays, clouds; Forest = pine ridges, mist, fireflies. Swatches show just Morph
      in each theme's colours (scene drawings were tried and dropped as too busy). Dark glass keeps a 28% dark base for text contrast over bright scenery
- [x] Settings → Advanced (folded away): chat bubble blur, panel blur, glass tint, background strength, background
      movement (still/slow/normal/lively), fewer animations, live preview, reset. Stored as `settings.advanced`
- [x] Collapsed sidebar: Morph at the top (thinking eyes while answering), New below
- [x] **MORPHIC Core harness** (`desktop/src/core`, design in `research/harnesses.md`): utility process in the app, or
      headless `node out/main/core.js --stdio --data <dir>` (JSON-RPC). One model call per turn with `<<action>>` lines;
      Sentinel tiers; memory (About you, notes with source, episodes, BM25 recall, dedupe, sensitive filter, idle
      reflection + compaction); SKILL.md skills; reminders scheduler + OS notifications; activity log
- [x] UI for Core: action lines, tick-off checklists, review cards ("Yes, go ahead" / "No, thanks"), reminder banner
      (Done / 10 minutes), Reminders page, "What I remember" page, Activity page; sidebar links + badge
- [x] Settings in sections: You · Reading & voice (voice, speed) · Morph's answers (14 languages, length) · Look ·
      Memory & privacy · Reminders (pop-ups) · Advanced (look tuning, start with computer, service address) · About & help
- [x] Themes: + Rose (petals), Snow (snowfall over mountains), Desert (dunes); 8 themes in total
- [x] Tests: `npm test` (44 Core unit tests), `npm run test:e2e` (13 Playwright/Electron flows)
- [x] **Built-in browser + agentic browsing** (Muse-style, Sentinel in charge): native web view beside the chat
      (`main/browser-host.ts`, own login storage, downloads/permissions blocked, page reading and actions in an isolated
      world); Core task runner (`core/browser-task.ts`): look → one model call → up to 4 actions → judged in code.
      New sites and real-world buttons (book/pay/send/submit…) ask first; passwords/OTP/card fields are handed to the
      person ("Your turn"); visible highlight + letter-by-letter typing; live task card; Take over / Stop
- [x] Connectors: MCP programs (stdio) and web addresses (Streamable HTTP) in Settings → Connectors; every tool use
      asks first, then Morph answers with the result
- [x] Settings as a centred pop-up window; calm rotating waiting lines; opening animation on each start (setting)
- [x] Model provider is configuration only (never shown in the app): OpenRouter when `MAIN_VITE_OPENROUTER_API_KEY` +
      `MAIN_VITE_OPENROUTER_MODEL` are set in `desktop/.env` (comma-separated = fallbacks), VROAI as the fallback;
      `MORPHIC_PROVIDER=vroai` forces VROAI. Instructions go as a system message (`splitPrompt`)
- [x] **Soul** (OpenClaw-style): fixed safety rules in code first → editable `soul.md` (Settings → Advanced →
      Morph's soul, reset to original) → personality from Settings → Morph's answers (tone, a little humour,
      what Morph calls you)
- [x] **Memory v2**: categories, importance, "Always remember" pins, dates (birthdays surface 14 days ahead),
      expiring facts, usage tracking; hybrid recall (BM25 + stemming + importance + recency + usefulness);
      reflection v2 (structured add/update/remove, safe remove); tidy without AI calls; `memory/MEMORY.md` mirror;
      memory page grouped by category with pins and category on add
- [x] **Learned routines**: finished browsing tasks are kept as private-free steps per site + goal, listed in the
      prompt and used as a guide for similar tasks (Sentinel still judges every action); shown on the memory page
- [x] Provider back-off: a provider out of daily quota is rested until 00:00 UTC, rate-limited 60 s, unreachable 20 s
- [ ] VROAI v2 (asked of the VROAI owner): OpenAI-compatible `/v1/chat/completions` with system/messages,
      streaming, parallel requests, `GET /health`, API key; then swap `src/main/vroai.ts`
- [ ] ZEXVRO sign-in step in onboarding
- [ ] Voice input (Electron has no built-in speech-to-text; needs a local or VROAI model)
- [ ] Code signing (Apple notarization, Windows cert) + auto-update
- [ ] Rive version of the mascot with states: listening, thinking, working, needs-you, done
