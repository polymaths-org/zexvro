# Handshake — Frontend Build Prompt
### For: AI Frontend Builder (v0 / Lovable / Cursor / Codex) — Vite + React + Tailwind + shadcn/ui
### Primary Font: Inter (all UI), JetBrains Mono (code only) — Reference UI: Hugging Face + GitHub

> Copy-paste this entire prompt into your frontend generator. It is the spec for the Handshake in-development track on ZEXVRO.

---

### 0) ROLE & GOAL

You are building **Handshake** — ZEXVRO's GitHub-like hub for smart contracts.

**One-liner:** Discover any contract by `chain + network + contract ID`, read it chain → contract → function, fork it, and publish your own (mainnet or testnet) — all code-first, like GitHub + Hugging Face for contracts.

**Viewer:** Web3 developers who learn by reading real contract source function-by-function and want a lightweight **Contract Studio** (editor + reader + tester) without a heavy IDE.

Build a **production-quality** frontend. Vercel/Cloudflare clarity, dark-first, dense, professional. No crypto-hype, no neon, no template slop. Follow ZEXVRO `design.md`.

---

### 1) STACK & CONSTRAINTS

- **Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui primitives, `lucide-react` icons, `motion` (framer-motion) for micro-interactions, `recharts` for any charts, `monaco-editor` (or code-mirror) for Studio.
- **Fonts:** `Inter` is the ONLY primary UI font. Load `Inter` 400/500/600/700. Code/data = `JetBrains Mono`. Do NOT use Satoshi/Geist/Sora for this product. Set:
  ```css
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  ```
- **Theme:** Dark default (`#050505` bg), light polished. System/Light/Dark switch. Persist in localStorage.
- **Tokens (from ZEXVRO design.md — use exactly):**
  - Dark: `background #050505, surface #0A0A0B, surface-raised #111113, surface-hover #18181B, border #27272A, border-strong #3F3F46, text-primary #FAFAFA, text-secondary #A1A1AA, text-muted #71717A, accent #FFFFFF, brand-purple #7C3AED, brand-blue #3B82F6, success #22C55E, warning #F59E0B, danger #EF4444`
  - Light: `background #FAFAFA, surface #FFFFFF, border #E4E4E7, text-primary #09090B, text-secondary #52525B`
  - Radius: cards `8px` max, pills `9999px`. Borders > shadows. No gradient blobs.
- **Data:** Mock from `frontend/src/data/serviceCatalog.ts` (`srv-handshake`) + local mock contracts array. No real API yet. Make all pages work with mock and be 100% navigable.

---

### 2) GLOBAL LAYOUT (Hugging Face + GitHub fusion)

**TopNav (sticky, GitHub-style):**
- Left: `ZEXVRO` wordmark + `Handshake` pill (small, `In development` amber badge) + Search bar (center, `⌘K` hint, placeholder "Search contracts, functions, users, contract IDs…")
- Center nav: `Explore` | `Contracts` | `Spaces (optional)` | `Docs`
- Right: `+ Publish` primary button (white on dark) + notification bell + avatar dropdown (Profile, Settings, Sign out)

**Left Sidebar (when inside a contract/repo — like GitHub repo nav, collapsible):**
- Contract header mini (avatar, `owner/name`, `chain:network` badge, `C…`/`0x…` ID truncated with copy)
- Sections: `Code` (default), `Functions`, `History / Versions`, `Tests`, `Invokes (Dry-Run)`, `Forks / Remixes`, `Discussions`, `Settings`

**Main area:** max-w `1280` centered, `px-6`, grid. Consistent `pt-6 pb-16` padding.

**Inspired by:** Hugging Face model card header (HF) + GitHub file explorer + right-rail metadata (HF sidebar).

---

### 3) PAGE INVENTORY — BUILD ALL OF THESE

#### A) Marketing / Entry
1.  **`/` Explore (Landing for Handshake)** — Hero: "The GitHub for smart contracts" + search + chain filter pills (All, Stellar, EVM). Stats row (contracts indexed, chains, forks). Featured contracts grid (HF card style). Trending functions strip. CTA `Publish your contract`.
2.  **`/explore` Browse** — Full filterable grid/list of contracts. Left filters: Chain (Stellar/EVM...), Network (mainnet/testnet), Language (Rust/Solidity), Tags, License, Verified. Sort: Recent / Popular / Forks / Gas-optimized (mock). Card = HF Model Card vibe: title, owner, chain badge, contract ID (mono, copy), tags, `♥ likes  stars  forks` row, 2-line desc.

#### B) Contract Repo (the "Repo" entity — like GitHub repo == HF Model)
3.  **`/c/[chain]/[contractId]` Contract Overview (README view)** — This is the contract's homepage.
    - Header: `owner / contractName` + Visibility badge, Chain:Network badge (`stellar:pubnet`), Contract ID `C...` full mono + Copy + Stellar Expert / Etherscan external link.
    - Tab bar (GitHub-style): `Code | Functions (n) | Tests | Invokes | Forks (n) | Discussions | Settings` — keep tabs sticky below header.
    - Left 2/3: README card (description, "WTF is this?" prose, usage snippet), File explorer (tree: `lib.rs / src/*.rs` etc), Functions quick table (name, signature, gas hint, lines).
    - Right 1/3: HF-style metadata rail: `Contract Card` (license, language, chain, network, publisher, updated, tags, likes/favorites, fork button), `Dependencies / Imports` call graph mini, `Deploy Info` (WASM hash, size), `Related contracts`.

4.  **`/c/[chain]/[contractId]/tree/[branch]` File Browser (Branch = version/network variant)** — GitHub file explorer.
    - Branches selector = `Networks` concept: `mainnet` / `testnet` / `v1` / `v1.1` — maps to contract versions. Reuse Branch UI for `network + version`.
    - Table: file icon, name, last commit message, age. Above: breadcrumb, branch switcher, `Code` clone dropdown (HTTPS, Contract ID), `Open in Studio` button.
    - Right rail: `About` + `Releases (versions)` + `Contributors`.

5.  **`/c/[chain]/[contractId]/blob/[branch]/[path]` File Reader (Code Reader)** — GitHub blob + HF code preview.
    - Top: breadcrumb + `Raw | Blame | History` + Copy path.
    - Center: Syntax-highlighted source with line numbers, function anchors, hover shows "Jump to function" floating button. Selected function highlights with subtle left border.
    - Right mini-map: functions in file (sticky TOC).
    - Bottom: `Open in Studio` + `Copy permalink` (line-anchored).

6.  **`/c/[chain]/[contractId]/functions` Functions Index** — **Core Handshake novelty.**
    - List each function as a card: `fn transfer(to: Address, amount: i128)` — signature (mono), docs excerpt, source slice preview (2 lines), gas estimate badge, storage writes indicator, events emitted.
    - Filters: Pure / State-changing / Auth-required / Events. Search functions.
    - Click → `/c/[chain]/[contractId]/functions/[fnName]` function deep page (see next).

7.  **`/c/[chain]/[contractId]/functions/[fnName]` Function Deep Read** — Novel: chain-to-chain + function-to-function learning.
    - Hero: `fn name` + signature + NatSpec docs + `Copy signature` + `Try in Studio`.
    - Two columns: Left = Annotated source (docs inline, auth checks highlighted, storage access annotated). Right = `Function Meta` (args, returns, errors, events, cross-refs to other functions).
    - Footer: `See same function on other chains` strip (mock: this `transfer` vs EVM `transfer(address,uint256)` — diff view side-by-side).

8.  **`/c/[chain]/[contractId]/history` History / Commits (Versions)** — Git log style. Each row = commit (hash short, message, author, date) + `C…` diff. `Compare` selector (like GitHub compare). `Time-travel` — move slider to view contract at older commit.

9.  **`/c/[chain]/[contractId]/forks` Forks / Remixes Graph** — Network graph (small, HF Spaces-style) + list of forks. Show provenance `forked from C…`.

10. **`/c/[chain]/[contractId]/discussions` Discussions** — HF Discussions + GitHub Issues light: Q&A, audit notes, usage threads.

#### C) Studio (Lightweight Web3 Contract Editor + Tester)
11. **`/studio` Studio Launcher** — `New Contract` (from scratch / from template / Fork a contract) + Recent studios.

12. **`/studio/[id]` Contract Studio (THE EDITOR)** — **VS Code-lite, browser-only.**
    - **Three-pane IDE:** Left = File tree (add/rename/delete files) + Functions outline. Center = Monaco editor (Rust/Solidity, line numbers, diagnostics mock). Right = `Inspector` (current function's gas, errors, docs).
    - **Top bar:** Run `Build` (mock), `Test` (mock pass/fail), `Dry-Run Invoke` (pick function, fill args, run against mock/testnet RPC — show events/traces), `Publish` (push to Handshake).
    - **Bottom panel tabs:** `Problems | Tests | Invokes | Logs` (like VS Code panel, resizable).
    - **Test Writer Helper:** `Generate tests for this function` button → scaffolds a test file stub, inline. `Coverage` gutter in editor (green/red).
    - **Lightweight:** No heavy extensions. Fast open (<250ms motion, ≤8px radius, zinc borders).

13. **`/studio/[id]/tests` Test Bench** — Dedicated test view: list test files, Run All, per-test pass/fail with trace. `Write test` AI-helper mock (prompt input → generates test code preview).

14. **`/publish` Publish Flow** — Stepper: `1 Chain & Network (stellar:pubnet|testnet, eip155:1...) → 2 Contract ID + Name → 3 Source (upload .rs/.sol / paste / repo URL) → 4 Metadata (description, tags, license) → 5 Review → Publish` → success with contract link + copy ID. Works for mainnet OR testnet — user chooses.

#### D) User / Social
15. **`/u/[username]` Profile** — GitHub + HF hybrid. Avatar, bio, chain prefs, stats (contracts published, forks, likes). Tabs: `Contracts | Forks | Liked | Activity` (commits, publishes, forks graph mini).
16. **`/u/[username]/contracts` User Contracts** — Filterable.
17. **`/settings`** — Editor prefs (theme, keybinding Vim/Emacs, tab size), connected wallets (mock), API keys (mock).
18. **`/notifications`** — Forks of your contracts, likes, discussion mentions.

#### E) System
19. **`404` Not Found** — ZEXVRO brand: large `404`, mono contract-ID gibberish as easter egg (`C… not found on stellar:pubnet`), search input + `Explore contracts` CTA, subtle grid background (no neon). Similar vibe to GitHub 404 with HF's clean empty states.
20. **`/empty` & Loading states** — Skeleton for cards, table, editor. Empty: `No contracts yet — publish one` with icon + publish CTA.

---

### 4) COMPONENT THEME (shadcn/ui + Tailwind)

- **Primitives to implement/theme:** Button (primary white/black, secondary bordered zinc, ghost, destructive red), Card (`border #27272A, bg #111113, radius 8px, no shadow`), Badge (chain, network, verified amber, active emerald), Tabs (underline with `brand-blue` indicator, like GitHub), Dialog (scale 98→100, 200ms), Sheet (slide), DropdownMenu, Command (⌘K palette), Table (dense, hover `#18181B`, mono for IDs), Tooltip, Progress, ScrollArea, Separator, Avatar, Select, Input/Textarea (mono for IDs), Switch, Checkbox, Skeleton.
- **Contract Card (HF-inspired):** White on dark glass? Use `surface-raised` card, top thin chain-color strip (Stellar `#7C3AED` tint, EVM `#3B82F6` tint) — restrain to 2px high. Title 15px /600, mono ID 12px `text-muted`, tags small rounded `border` + `text-secondary`, stats row `heart / git-fork / star` icons + counts.
- **Code blocks:** `JetBrains Mono` 12.5px, `surface-hover` bg, border. Reader line highlight `bg-brand-blue/[0.06]` + left border `brand-blue`.
- **Motion:** ≤250ms, ease-out entry. Sidebar active slides. Dialogs scale. Editor panel resizes with motion. Pulse only for `Building…` / `Invoking…`.

---

### 5) DEEP-THINK NEW FEATURES — WEB3 DEV VALUE (Not in vanilla GitHub/HF)

Invent these and show them in the mock UI — they justify Handshake existing:

1.  **Function Diff Across Chains:** On a function page, show "Same intent, different chain" side-by-side (e.g. Stellar `transfer` vs EVM `transfer(address,uint256)`) with semantic diff + gas trade-off note.
2.  **Gas & Storage Lens (Inline Badges):** Every function card shows estimated gas, storage R/W, event count as tiny badges. Studio inspector highlights `storage::set` lines with amber underline.
3.  **Dry-Run Invoke Sandbox:** In Studio + Function page, fill args in a form → `Invoke (testnet mock)` → shows `events`, `auth required`, `return value`, `trace` without deploying. Feels like Hugging Face Inference widget.
4.  **Fork Graph & Remix Strip:** Visual fork tree (like GitHub network graph but minimal, 1px lines). On Explore, a horizontal "Remix strip" — contracts most forked this week.
5.  **Natural-Language Explain (AI Lens):** Button `Explain this function` → slide-over shows plain-English summary, auth flow, and "gotchas" bullets. Mock the output.
6.  **Coverage Gutter + One-Click Test Writer:** Editor gutter shows green/red per line. Click a function → `Generate test` scaffolds a test file; bench shows coverage %.
7.  **Dependency / Call Graph Mini:** Right rail shows `calls → called-by` graph for the contract (2-level SVG, HF Spaces-style).
8.  **Time-Travel Slider on History:** Drag to scrub contract history, file viewer updates live.
9.  **Embed Card (HF-style):** `</> Embed this contract` modal gives iframe snippet + markdown badge: `![Handshake](https://handshake.zexvro.in/embed/C...)`
10. **Contract Collections (like HF Collections):** Users curate "AMM patterns", "Stellar Auth patterns" — a collection page of contracts.
11. **Chain Badge Everywhere:** Every contract ID is always paired with `chain:network` pill. Never show a bare ID.
12. **One-Click Open in Studio:** Every code view has a persistent `Open in Studio (fork)` — clicking forks if needed and lands in the editor at that exact line.

---

### 6) CONTRACT STUDIO — DETAILED SPEC

**Reader mode vs Editor mode:** Reader = syntax highlight, line-anchored permalinks, copy, `Open in Studio`. Editor = mutable Monaco, file tree, diagnostics, build/test/invoke, publish.

**Studio layout (wireframe):**
```
[Top bar: name • chain:network • Build ✓ | Test ▶ | Invoke ⚡ | Publish ↑]
[File Tree 240px | Editor (Monaco) flex-1 | Inspector 280px ]
[Bottom Panel: Problems • Tests (✔/✘) • Invokes (request/response) • Logs ] 280px resizable
```

**Test Writer:** `+ Add test` scaffolds from function signature. Test file naming `test_transfer.rs`. Inline run shows pass/fail inline. Coverage gutter in editor.

**Web3 feel, lightweight:** No heavy plugin system. Bundle < 200kb for editor chunk. Instant file switch. Command palette `⌘K → "Invoke transfer"`.

---

### 7) COPY & EMPTY STATES

- Tone: Clear, direct, developer-friendly. Not hype. Use "Publish", "Fork", "Read source", "Copy ID", "Open in Studio".
- Empty: `No functions indexed yet — add source to index.` / `No forks — be the first to remix.` with `Publish` / `Fork` CTA.
- Errors: Inline, not toast spam.

---

### 8) ACCEPTANCE CHECKLIST

- [ ] Inter everywhere (UI), JetBrains Mono for every contract ID / signature / code.
- [ ] Dark-first tokens match `design.md`; light mode polished.
- [ ] TopNav + ⌘K + Publish flow reachable from every page.
- [ ] Explore → Contract Overview → Blob Reader → Function Deep page → History → Forks all navigable with mock data.
- [ ] Branch selector repurposed for `network/version`; contract ID copy works everywhere + chain badge.
- [ ] Studio three-pane + Tests + Invokes sandbox mocks; `Open in Studio` on every code surface.
- [ ] Function cards show gas/storage badges + cross-chain diff strip mock.
- [ ] Profile `/u/[username]`, 404 (with contract-ID easter egg), settings, notifications all exist.
- [ ] Likes/Forks counts + Embed card modal + Collections page stub.
- [ ] Responsive: sidebar → sheet on mobile; tables → cards on <768px; editor stacks correctly.
- [ ] a11y: focus rings, keyboard nav for command + tabs, alt text for avatars.
- [ ] Build passes: `npm run build` clean, no hardcoded fifth-service-only lists.

---

### 9) DELIVERABLE

A fully clickable mock that *looks like Hugging Face meets GitHub*, reads like Handshake, and demos the lightweight Web3 Contract Editor/Reader end-to-end. Publish this repo, open it, and a new Web3 dev instantly gets: discover → read function → fork → edit → test → publish — without leaving the browser.
