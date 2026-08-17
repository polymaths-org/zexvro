# Progress — 2026-08-15 Startup Funding Plan session

## Session log
- 2026-08-15 12:00 — Booted per AGENTS.md (README, context, memory, git status). Verified AWS CLI configured as root `290294660486`.
- 2026-08-15 — Pulled live Cost Explorer (3 months ≈ $0), full inventory (App Runner ×2 RUNNING, Fargate gate RUNNING, ALB, EC2 c6i.xlarge STOPPED, 23 Dynamo tables, 7 secrets, 3 Lambdas, 4 buckets, 1 CloudFront, 2 CodeBuild, 3 EIPs).
- 2026-08-15 — Found zexvro-gate ALB + Fargate task (was missing from `docs/aws_inventory_and_cost.md`).
- 2026-08-15 — Stellar mainnet balances: Zer0 deployer 5.42 XLM, NFTo sponsor 8.02 XLM (XLM=$0.159). On-chain spend ≈ $8–14 total.
- 2026-08-15 — Installed 6 skills: define-goal, planning-with-files, startup-financial-modeling, startup-metrics-framework, fundraising, orchestration.
- 2026-08-15 — Wrote findings.md (raw data) + docs/funding-and-infra-plan.md (deliverable).
- 2026-08-15 — Appended memory.md entry.

## Key numbers
- Actual billed: ~$0 (credits). List price: ~$86/mo (worker off), ~$211/mo (worker on).
- 12-month cash need (base $10k scenario): ~$8k–12k.
- First funded build: Phase A1 Service Registry.

## Errors encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `aws ecs list-tasks --cluster zexvro-gate` → ClusterNotFoundException | described service directly | Fixed by `describe-services --cluster zexvro-gate --services zexvro-gate` |
| skills ls raced with installs | re-ran ls | All 6 present |

## Next step
Plug real grant amount; start Phase A1 Service Registry; confirm peakctf ownership.
