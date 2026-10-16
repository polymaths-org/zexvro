# Development model intelligence and routing

Checked 2026-10-16. Development inference uses opencode-cc (`http://127.0.0.1:8787/v1`).
Release inference uses the Morph endpoint (`https://morph-endpoint.zcode-inbox.workers.dev/v1`), model `auto`.

## User ratings and active fallback order

Wraient's ratings cover both intelligence and execution. They are subjective ratings out of 10,
not conversions of published benchmark scores.

1. `deepseek-v4.1-flash-free` — **7.5/10**.
2. `space-bunny-free` — **7.3/10**.
3. `cat-jam-free` — **6.5/10**.

Big Pickle is excluded by user request. Do not add it as a fallback.
All three active models returned HTTP 200 for a simple completion and a valid native function
call through the local proxy. One native-tool probe per model took 1.68 s, 1.74 s, and 1.59 s
respectively; these are single-request smoke timings, not latency benchmarks or intelligence scores.
The real Electron app also passed online status and a memory tool call using the local chain.

Custom gateways receive sequential requests with a single `model` field. A refused/unavailable
model advances to the next; rate/network failures use the existing back-off. Stock OpenRouter
retains its provider-native `models` array. Cancellation does not advance the chain.

## Published intelligence scores

Artificial Analysis Intelligence Index **v4.3.2**, 0–100, higher is better. Scores apply to the
named benchmark configuration, not a separate evaluation of the free OpenCode endpoint.
Contributor-tier equivalence, gateway defaults and reasoning settings have not been independently
verified here. Do not compare these directly with the old June snapshot in agentic-dev.

| Model | Published score | Configuration / source | Local catalog |
| --- | ---: | --- | --- |
| Muse Spark 1.3 | 48 | [Max](https://artificialanalysis.ai/models/muse-spark-1-3) | Contributor free listed; Responses protocol |
| Muse Spark 1.2 | 40 | [Xhigh](https://artificialanalysis.ai/models/muse-spark-1-2) | Legacy contributor free listed; deprecated upstream model |
| DeepSeek V4.1 Flash | 39 | [Max](https://artificialanalysis.ai/models/deepseek-v4-1-flash) | Active primary; smoke-tested |
| MiMo V2.6 Flash | 38 | [Published model page](https://artificialanalysis.ai/models/mimo-v2-6-flash) | Free listed; inference not tested here |
| Nemotron 3.5 Super VL | 26.5 | [Evaluator release article](https://artificialanalysis.ai/zh/articles/nemotron-3-5-super-and-bolt) | Free listed; inference not tested here |
| Nemotron 3 Ultra | 23 | [Reasoning](https://artificialanalysis.ai/models/nvidia-nemotron-3-ultra-550b-a55b) | Official free option; absent locally |
| Nemotron 3.5 Lightning | 13 | [Reasoning](https://artificialanalysis.ai/models/nemotron-3-5-lightning) | Free listed; inference not tested here |

## Other free options / missing scores

The [official OpenCode catalog](https://dev.opencode.ai/v2/docs/console/models) lists the free
options below. No comparable verified index score was found for these exact names in this pass.
Missing is not zero; stealth identities must not be inferred from rumors or model self-reports.

| Model | Status |
| --- | --- |
| Space Bunny | Stealth; local catalog; active fallback, smoke-tested; user rating 7.3/10 |
| Cat Jam | Stealth; local catalog; active fallback, smoke-tested; user rating 6.5/10 |
| LongCat 2.5 Preview | Local catalog; no verified comparable index score found |
| Jev 1.13 | Local catalog; specialized typed decision model using System One, not ordinary chat |
| MiMo V2.5 | Official free option; absent locally; no verified comparable score for this exact variant |
| Exo | Official free option; absent locally; no verified comparable score found |
| Big Pickle | Excluded by user; no inference requests made |

The local `/v1/models` list had 11 free/legacy entries (including excluded Big Pickle and legacy
Muse 1.2). Official free listing is broader; catalog presence alone does not prove inference works.
We did not modify the shared proxy catalog, credentials, or service configuration.

## Ownership

CI/CD was handed to [the separate release thread](t3-thread://v1/mcp:cd31a3a6-0d1d-4db0-a1fe-993e1463a1f7),
branch `morphic/release-pipeline`. This checkout owns model/tool/browser iteration. The release
thread owns validated `release:v<semver>` automation and Windows/macOS/Linux packaging tests.
