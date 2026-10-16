# Hard evaluation design: OSWorld and agent-browser

Reviewed 2026-10-16 against primary sources. This is an implementation/design reference, not an official OSWorld evaluation result.

## Source pins

- OSWorld 1 source: [`b138d348256078fa634fc3b73567a7337c793e6b`](https://github.com/xlang-ai/OSWorld/tree/b138d348256078fa634fc3b73567a7337c793e6b). Inspected three public Chrome task JSON files. Example: [Do Not Track task](https://github.com/xlang-ai/OSWorld/blob/b138d348256078fa634fc3b73567a7337c793e6b/evaluation_examples/examples/chrome/030eeff7-b492-4218-b312-701ec99ee0cc.json) separates setup/post-setup actions from a getter and exact-match evaluator.
- OSWorld v2.1 tag resolved to [`3d778a3c9a34a079316f70df023b166700445792`](https://github.com/xlang-ai/OSWorld-V2/tree/3d778a3c9a34a079316f70df023b166700445792). The [release manifest](https://github.com/xlang-ai/OSWorld-V2/blob/3d778a3c9a34a079316f70df023b166700445792/benchmark_releases/osworld-v2.1.json) pins code, 108 task files, assets, mocked websites and VM/runtime images. Do not mix main/latest task, asset and website versions.
- [V2 task-class guide](https://github.com/xlang-ai/OSWorld-V2/blob/3d778a3c9a34a079316f70df023b166700445792/evaluation_examples/task_class/README_v2.1.md): official task implementations are gated Hugging Face downloads. Public code describes BaseTask setup/evaluate contracts and migration of infeasible tasks. A literal FAIL signal is part of that benchmark's infeasibility contract; Morph's local tests additionally require task-specific evidence and no forbidden effect, so indiscriminate blocking cannot pass successful tasks.
- [V2 result format](https://github.com/xlang-ai/OSWorld-V2/blob/3d778a3c9a34a079316f70df023b166700445792/docs/EVALUATE_RESULT_JSON.md) supports detailed per-criterion results alongside the canonical score. Morph records individual checks and terminal completion separately; its local checks are not that benchmark score.
- Vercel agent-browser [`dac13bb87468fe9d74a040d862720f6cc17a9565`](https://github.com/vercel-labs/agent-browser/tree/dac13bb87468fe9d74a040d862720f6cc17a9565), package 0.39.1. Inspected [README](https://github.com/vercel-labs/agent-browser/blob/dac13bb87468fe9d74a040d862720f6cc17a9565/README.md) and [snapshot refs](https://github.com/vercel-labs/agent-browser/blob/dac13bb87468fe9d74a040d862720f6cc17a9565/skill-data/core/references/snapshot-refs.md).

## What to adapt

OSWorld's useful separation is instruction, reproducible initial environment, execution trajectory and an independent evaluator of application state/artifacts. Browser-only DOM tests cannot exercise all desktop apps or establish a comparable GUI benchmark score. Long horizon must involve dependencies, branching decisions, changing facts and recovery; repeating Next many times is only a navigation stress test.

Agent-browser demonstrates a richer access surface: compact/scoped snapshots, semantic find by role/text/label, stable refs, condition-based waits, snapshot diffs, named sessions/tabs, frame and dialog handling, and network/trace/recording diagnostics. These capabilities make relevant state easier to retrieve; dumping a larger full page into a small model is not a sufficient solution. A missing tab should be explicit, and a failed click requires a fresh observation rather than blind replay. Recording an image/video does not establish model perception.

Morph adaptation in this iteration:

1. Add `inspect` to browser_step: a bounded read of matching rendered DOM contexts, with paging, total/match counts and truncation metadata. Offscreen rendered cards are searchable; unrendered server records, shadow roots and cross-origin frames remain separate capability gaps.
2. Include row/card context beside duplicate control names. Preserve stable node refs and review binding while changing observation scope.
3. Retain transient status/error notices separately from the latest page text. Replacing a stock-conflict banner with a successful review must not erase the earlier availability evidence.
4. Stop repeated state/action cycles, including alternating actions. Preserve explicit unfinished state rather than consume the entire budget silently.
5. Add explicit blocked results and expected needs-input/declined outcomes. An unavailable capability should be reported; a provider outage alone is not evidence that a user task is impossible.
6. Recover from empty native-tool output through explicit text JSON, preserving provider errors rather than reporting only the last fallback connection failure. Normalize flattened argument envelopes before the usual schema validation; never invent missing argument values.
7. Capture isolated-profile browser request timings/statuses and model calls, and provide an offline waterfall/action viewer. These timings are not a complete HAR/CDP recording.

## Running official OSWorld here

The local machine exposes /dev/kvm and has Docker installed, but the official VM and website stack have not been provisioned. The release manifest's Ubuntu archive is approximately 14.9 GB compressed, before extraction, task assets and website services. This laptop currently has 14 GiB RAM and substantial swap use, so first run one isolated VM, not a farm of parallel desktop environments.

A legitimate official run needs:

- Access granted to the official task and asset datasets, authenticated through their supported private credential mechanism.
- The same v2.1 release for code, task files, assets, website deployment and provider image. Verify the manifest hashes; keep task/evaluator files outside the agent's workspace and accessible tools.
- A dedicated disposable VM and reset before every task. The user's real Hyprland desktop and browser profile are not the benchmark environment.
- An agent adapter for OSWorld's action/observation contract. Morph's current WebContentsView/DOM actions cannot operate LibreOffice, GIMP, file-manager or OS settings tasks. Its current model interface does not send screenshot pixels.
- A capability-appropriate track: a GUI adapter plus verified image support for visual tasks, or an explicitly declared text/accessibility/DOM track where permitted. Do not relabel enhanced DOM access as a screenshot-only score.
- Unmodified official evaluators and task IDs, per-task trajectories, budgets, model/provider configuration and separate infrastructure-failure accounting.

Do not claim an official result from the local inspired suite. The immediate path is to harden the embedded browser on reproducible local tasks, then bridge a disposable VM for the full desktop track once dataset access and modality support are available.
