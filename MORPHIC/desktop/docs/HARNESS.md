# Harness reliability work — 2026-10-16

This is an iteration baseline, not a claim of autonomous reliability on arbitrary websites.
Use the real Electron app: the embedded browser, utility-process Core and preload bridge
are part of the harness. Development inference uses opencode-cc on localhost:8787;
release inference stays on the Morph endpoint with model `auto` and runtime credentials.

## Research and priorities

Pinned source comparisons are in [OpenCode v2.0.29](research/opencode.md),
[Codex](research/codex.md), and [Zcode, Grok Build and agent-browser](research/zcode-grok-browser.md).
Those reports describe the **pre-upgrade baseline**, so their line numbers and shortcomings
must be read alongside this implementation record. They are source reviews, not benchmark runs
of those other harnesses.

The common useful pattern is observe → choose a typed action → validate → execute → return
its outcome → observe again. Model intelligence helps choose the action, but cannot replace
state retention, stale-reference rejection, exact edit checks or verification.

What to borrow from each source:

- OpenCode v2: a bounded drain loop, persisted typed call/result parts, execution ownership and durable jobs.
- Codex: paired call IDs/results, explicit interrupted/failed/completed lifecycle, token-aware compaction,
  cancellation and real tool/check feedback.
- Zcode: persistent browser targeting, list/claim the intended tab, fresh snapshots and capability-aware tools.
- Grok Build: repeated-call recovery, compaction checkpoints and stale-safe hashline edits. Its reviewed source
  has no built-in interactive browser driver; browser access requires external tools.
- agent-browser: named browser sessions, stable tab IDs and non-recycled refs, strict missing-tab errors,
  and console/network/trace/recording primitives. Capturing video does not mean a model can understand it.

The first priorities were browser continuity, actual tool-result feedback and truthful stopping.
Long-term personal memory is not working memory. Turning personal memory off must not make
an agent forget the current form, original task or facts it just read on another page.

## Implemented

- Chat turns receive the current embedded page and prior task outcome. Same-URL follow-ups
  preserve the live DOM rather than navigate again. Full user requests survive model goal paraphrases.
- Browser tasks persist a last-page checkpoint and bounded evidence from eight visited URLs.
  Observations remain untrusted website data in the live user portion of the prompt.
- Native `browser_step` schema and text JSON use the same validation path. Malformed replies
  and failed actions receive bounded repair feedback. Clicks/selections trigger fresh observations;
  waits are explicit and bounded. Step limits and repeated no-progress actions pause unfinished tasks. A repeated click is withheld
  once with explicit recovery feedback before the loop is stopped.
- DOM refs use isolated-world node identities rather than page-editable recycled attributes.
  Actions carry snapshot revisions, check URL/element signatures and reject changed/disabled controls.
  Targets are rechecked after the visible highlight delay, immediately before dispatch. Consequential
  reviews also re-observe and compare the page and form values after approval; changed state expires the review.
- Restarted in-flight tasks become paused; old approvals expire. Browser tasks are serialized
  across conversations so two tasks cannot drive the shared view concurrently.
- General tools have a six-round result/error feedback loop. `open_website` feeds back into
  answering, rather than merely opening a page and ending. Disabled tools are rejected at runtime.
- Consequential browser clicks require review and record a task-scoped dispatch key containing
  URL, target label and form values. Identical submissions are not automatically replayed within
  that task. A receipt must still be inspected; dispatch is not proof of server acceptance.
- Opt-in coding tools list/read files, propose hash-checked exact edits with review, and execute
  one operator-configured check command with bounded output/time and cancellation. No unrestricted
  shell tool is advertised. Paths escaping the root, symlinks and common secret paths are rejected.
- Browser reasoning is explicitly text/DOM-only. Image alt text, accessible descriptions and
  expandable transcripts are available; unseen pixels and video are not silently inferred.

The workspace check command is **not an OS sandbox**. It executes with desktop-user permissions,
with a reduced environment. Enable it only for an intended workspace and check command.

## Reproduce

```sh
npm test
npm run build
npx playwright test e2e/harness.spec.ts e2e/browser.spec.ts
npm run eval:harness -- --label=trial --models=cat-jam-free,deepseek-v4.1-flash-free --cases=settings,dynamic,media,inventory,injection,coding,journey
node evals/regrade.mjs .dev-profile/evals/<run-directory>
```

The live runner creates isolated profiles and a temporary coding workspace. It uses one fixed
model per case, deliberately disabling fallback for fair attribution. Normal app development
keeps DeepSeek → Space Bunny → Cat Jam fallback. Big Pickle is excluded.

Fixtures run on two independent localhost origins. Cases cover same-page follow-up, delayed
form controls, accessible media, vendor-spec comparison and an approved request, page prompt
injection, a code-edit/check loop, and twelve setup stages requiring at least 24 actions.
Authoritative server state and actual configured check results grade effects. Reading tasks
must report the answer to the user; hidden checkpoints do not earn credit. Paused/failed tasks
and duplicate submissions fail strict grading even when some requested effects happened.
The runner can be used as a gate with `--gate`; ordinary exploratory runs preserve failures
without crashing the remaining matrix.

Artifacts live under ignored `.dev-profile/evals/<timestamp>-<label>/`: per-case trace.json
(request/response, timing, snapshots/checkpoints, approvals and fixture requests), final.png,
results.json and optionally results-strict.json. New UI-driven runs also save browser.png
from the embedded view; renderer screenshots alone do not include that native surface. These local fixture traces are useful diagnostics;
they are not a full DevTools network waterfall or screen recording. Real-world traces may contain
private page content and should not be committed.

## Remaining architectural limits

1. The provider adapter still flattens native calls into text markers. Preserve native call IDs,
   structured tool results, finish reasons, usage and provider metadata in a future internal protocol.
2. Page evidence is retained within a browser task; cross-task recall still depends on recorded
   task results/history and the currently open page. Add an explicit task-resume protocol before
   claiming complete working-memory continuity across arbitrary interruptions. A single shared embedded view has no durable conversation/tab ownership. Serialization prevents
   concurrent driving but does not isolate pages between conversations. Tab ownership and explicit
   resume/reacquire after restart are the next browser lifecycle work.
3. Checkpoints retain text and task state, not a serialized live DOM. App restart does not restore
   form DOM or resume a side effect automatically. Pending approvals intentionally expire.
4. Completion outside fixtures remains model judged. Receipts, expected values and task-specific
   postconditions should become first-class evidence. Prompt instructions alone cannot guarantee
   a weak model reports a truthful success.
5. Generic click classification uses labels/form type and is heuristic. It cannot identify every
   real-world side effect. The duplicate guard is scoped to the current task, not a server idempotency key;
   crashes, follow-up tasks and genuinely changed values require fresh verification.
6. DOM snapshots do not cover arbitrary cross-origin frames, shadow roots, canvas or image-only UIs.
   OCR/vision/transcription must be optional capability adapters with an explicit unavailable path.
   No live image/video model input has been implemented or claimed.
7. Coding is a narrow edit/check slice, not a full coding harness: no git transactions, broad patch
   engine, background terminal, dependency installation or OS sandbox. Race-resistant file edits
   reduce accidental stale writes but do not defend against a hostile process mutating the filesystem.
8. One trial per model/scenario is exploratory evidence, not a model intelligence ranking or robust
   reliability estimate. Repeat with seeds, perturbations, delays, restarts and counterexamples before release.

## Trial history and interpretation

Raw runs are retained locally, including failures; no run is overwritten to make a result look better.

- Baseline `1792104893833-baseline`: the settings follow-up case failed browser reuse for both
  Cat Jam and DeepSeek. Cat Jam also failed the initial draft. The dynamic case had a broken
  inline handler in the fixture, so its baseline failures are invalid model comparisons.
- First candidate `1792105879755-candidate`: both models passed settings continuity, coding
  checks and the 12-stage journey (a repetitive navigation stress case, not a realistic hard-task benchmark). Cat Jam passed media alternatives and DeepSeek passed the
  read-only injection case. Both alternated indefinitely between inventory/specs because only
  action history, not the vendor facts, survived navigation. Strict regrading corrected a false
  pass for DeepSeek media: answers were entered, but the task paused after repeated checks.
- Repair run `1792146578248-repair`: after fixture repair, both models reported TECH-402 and
  passed the read-only invoice and text-alternative media cases. Both selected the right product
  using retained page evidence. Inventory still failed: Cat Jam submitted twice, and DeepSeek
  repeatedly reviewed instead of submitting because its own goal paraphrase contradicted the
  original request. These observations led to the dispatch guard and removal of that paraphrase
  from the execution instructions.

`results-strict.json` is authoritative for these archived runs. The repair runner had a grading
bug matching role `assistant` instead of Morph's actual `morph`; regrading fixes this from saved
user-visible messages without new inference. Three grading regressions prevent checkpoint-only
answers, unfinished effects and duplicate effects from being counted as passes.

These experiments demonstrate specific failure mechanisms and repairs. They do not establish
that one free model is smarter than another. User intelligence/execution ratings remain in
[MODELS.md](MODELS.md), separately from measured scenario outcomes.

- UI run `1792147025722-final-ui`: prompts were entered through the actual composer. Cat Jam
  passed inventory (one approved request), settings continuity and coding. DeepSeek passed
  settings and coding but repeated Review request on inventory and paused. Space Bunny passed
  coding; it saved the correct settings drafts and reused the page, but its initial task paused
  while scrolling, so strict grading failed that scenario. It also paused at inventory review.
  This is why effect correctness and terminal completion are reported separately. The final
  recovery feedback and review-state binding were added after this run and checked separately.

## Verification

- Production build and both TypeScript projects pass.
- 63 Core/workspace tests and three evaluation-grading regressions pass.
- The broad Electron run exercised 17 scenarios: 15 passed initially; two outdated test
  assumptions were corrected and passed in a focused rerun. A new changed-form approval
  regression raises coverage to 18 unique scenarios. The final affected browser suite passes
  all eight tests, including unchanged-form submission and changed-form refusal.
- Live windows were verified floating at 1920×1080 on workspace 12. Release credential scan
  found zero hits in tracked files or compiled outputs.

The source comparison, trial summary and raw local artifacts provide different evidence:
[trials.csv](research/trials.csv) contains concise trial results; full traces remain ignored.
The fixture suite is a reproducible starting point. It still needs more realistic branching,
stateful multi-site work, interruption/restart perturbations, ambiguous controls, inaccessible
media and repeat seeds before it can serve as a release reliability benchmark.

Final recovery run `1792147374938-recovery-ui` (latest browser logic): Cat Jam passed inventory
in 26.6 s / 10 model calls; DeepSeek passed in 58.5 s / 13 calls. Each submitted exactly once
with one explicit approval. Space Bunny selected and submitted the correct request exactly
once, but continued reviewing and paused (92.9 s / 19 calls), so strict completion failed.
This is a remaining model/harness interaction problem, not a wrong-product or duplicate-order
failure. Prioritize salient observation deltas, action postconditions and explicit completion
criteria next; raising step limits alone would hide the failure and increase latency.

The development app is launched with `npm run dev:local`; runtime config and the workspace-12
rule are preserved. No commit, push or release was performed.


## Adversarial extension

The newer dense/unhappy-path, impossible-task and public-site suite is documented in [HARD-EVALS.md](HARD-EVALS.md), with OSWorld and agent-browser source pins in [research/osworld-agent-browser.md](research/osworld-agent-browser.md). The earlier trial history above is preserved as its baseline.
