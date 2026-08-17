# Task Plan — ZEXVRO Funding & Infra Plan (post Stellar Garage Pune 3rd place)

Goal: Produce a consultant-grade cost audit + funding plan for ZEXVRO's next build phase, grounded in real AWS + on-chain data, with per-milestone cash needs and skill-backed execution, then start the first funded build.

Verification: docs/funding-and-infra-plan.md written with real data snapshot; all phases in this file report Status: complete; memory.md entry appended.

## Scope
- Current AWS spend (real snapshot via aws CLI).
- On-chain (Stellar) spend + balances.
- Future infra cost model (IPFS, DB, Redis, RPC, ZK, analytics) per roadmap Phases A–D.
- Funding scenarios + per-milestone cash needs.
- Install goal / planning / finance / orchestration skills.
- Define 90-day goals (OKR shape).

## Out of scope
- Writing Phase A1 Service Registry code in this session (proposed as next step, not executed here).
- Actual grant amount: user to plug in; scenarios use 5k/10k/25k.

## Phases

### Phase 1 — Pull live AWS + on-chain cost data
**Status:** complete
- Cost Explorer (3 months) ≈ $0 (free tier / AWS credits).
- Live inventory pulled: Lambda (3), DynamoDB (23 tables), App Runner (2 running), ECS Fargate gate (1), ALB (1), EIPs (3), EC2 c6i.xlarge STOPPED, S3 (4), CloudFront (1), Secrets (7), CodeBuild (2).
- Stellar balances: Zer0 deployer 5.42 XLM, NFTo sponsor 8.02 XLM (XLM = $0.159).

### Phase 2 — Build current cost model (list price)
**Status:** complete
- Always-on compute: 2× App Runner ≈ $46/mo, Fargate gate ≈ $9/mo, ALB ≈ $18/mo, EIP on stopped instance $3.60/mo.
- Serverless: Secrets $2.80, DynamoDB ~$2, Lambda ~$1, S3+CF ~$2, logs ~$1, ECR ~$1.
- **Total list price: worker OFF ≈ $86/mo; worker ON ≈ $211/mo. Actual billed ≈ $0 (credits).**

### Phase 3 — Future infra + funding scenarios
**Status:** complete
- Phase A (unify spine): ~$0 new infra.
- Phase B (ledger + workspace): +$30–60/mo (RDS Postgres + Redis).
- Phase C (Morph/REQWID modules + CI): +$10–40/mo (runners, RPC premium).
- Phase D (team + programs): salaries dominate ($1k–4k/mo part-time hires).
- Scenarios: conservative $5k / base $10k / optimistic $25k grant.

### Phase 4 — Install skills (goal/planning/finance/fundraising/orchestration)
**Status:** complete
- Installed: openai/skills@define-goal, othmanadi/planning-with-files, wshobson/agents@startup-financial-modeling, wshobson/agents@startup-metrics-framework, refoundai/lenny-skills@fundraising, stablyai/orca@orchestration.

### Phase 5 — Write deliverable docs
**Status:** complete
- [x] docs/funding-and-infra-plan.md (main deliverable)
- [x] presentation/ppt/ZEXVRO_Funding_Plan.pptx + .pdf (12 slides)
- [x] findings.md + progress.md refreshed
- [x] memory.md entry appended

### Phase 6 — 90-day goals + start Phase A1 execution
**Status:** in_progress
- [x] Write 3 OKRs (unify spine / first revenue / cost discipline) into the plan doc.
- [x] peakCTF confirmed separate project (PQDF) — excluded from plan.
- [ ] Next build: Phase A1 Service Registry — pending user go-ahead + grant figure.

## Next Step
Confirm the real grant figure; give go-ahead to start Phase A1 Service Registry.

## Decisions Made
| Date | Decision |
|------|----------|
| 2026-08-15 | Use real AWS snapshot (Cost Explorer $0 = credits) as the basis; plan on list-price baseline (~$86/mo) so the bill is survivable when credits expire. |
| 2026-08-15 | Worker stays OFF by default; EIP on stopped instance must be released or instance started (saves $3.60/mo). |
| 2026-08-15 | Infra default: keep AWS S3+CloudFront over IPFS (already decided in context.md); IPFS optional legacy only. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None | — | — |
