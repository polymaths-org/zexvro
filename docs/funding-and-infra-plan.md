# ZEXVRO — Funding & Infrastructure Plan

**Date:** 2026-08-15 · **Author:** Consultant pass (live AWS + on-chain data) · **Inputs:** `docs/aws_inventory_and_cost.md`, `docs/roadmap-unified-paas.md`, `context.md`, `memory.md`

**Why this exists:** ZEXVRO placed **3rd at Stellar Garage Pune** and is receiving grant funds for the next build. This plan answers three questions with real numbers, not guesses:

1. What have we actually spent so far (AWS + on-chain)?
2. What does the current platform cost, and what will it cost as we expand?
3. How much funding do we need, when, and for what — step by step?

---

## 1. Executive summary

| Metric | Value |
|---|---|
| **Actual AWS billed (last 3 months)** | **≈ $0** (AWS startup credits + free tier are covering everything) |
| **List-price cost of current footprint** | **≈ $86/mo** (worker OFF) · **≈ $211/mo** (ZK worker ON) |
| **On-chain (Stellar) spend to date** | ≈ 50–90 XLM ≈ **$8–14** (contract deploys + fees; not a driver) |
| **Cash on-chain today** | Zer0 deployer 5.42 XLM · NFTo sponsor 8.02 XLM (≈ $2 total) |
| **Grant scenarios modeled** | Conservative **$5k** · Base **$10k** · Optimistic **$25k** |
| **12-month cash need (3 co-founders, no salary, part-time hires)** | **$8k–12k** for infra/tools/ops + **$1k–4k/mo** once team hires begin |
| **Single biggest cost risk** | ZK prover EC2 left running (**$125/mo**) and credits expiring (bill jumps to ~$86/mo overnight) |

**Bottom line:** The platform is currently **free to run** because credits cover it. The plan treats **list price (~$86/mo)** as the real baseline so that when credits expire the bill is survivable. Every expansion below is priced against that baseline.

---

## 2. Current state — what is live, what it costs

Pulled live from AWS account `290294660486` (us-east-1) on 2026-08-15.

| Resource | Detail | Status | Est. $/mo (list) |
|---|---:|---:|---:|
| App Runner `zexvro-nft-api` | 0.25 vCPU / 0.5 GB, min 1 | RUNNING | ~$23 |
| App Runner `zexvro-depin` | 0.25 vCPU / 0.5 GB, min 1 | RUNNING | ~$23 |
| ECS Fargate `zexvro-gate` (REQWID) | 0.25 vCPU / 0.5 GB, 1 task | RUNNING | ~$9 |
| ALB `zexvro-gate-alb` | HTTP:80 | active | ~$18 |
| EC2 `c6i.xlarge` (Zer0 ZK prover) | i-02ee1b304375575d0 · 30 GB gp3 | **STOPPED** | $0 (≈$125 if on) |
| Elastic IP `52.23.146.176` | attached to **stopped** instance | billed while stopped | $3.60 |
| Secrets Manager | 7 secrets | — | $2.80 |
| DynamoDB | 23 tables on-demand (16 zexvro-*, 7 peakctf-*) | tiny | ~$2 |
| Lambda | `zexvro-agent-backend`, cognito-custom-message, peakctf-api | low | ~$1 |
| S3 | 4 buckets | tiny | ~$1 |
| CloudFront | 1 dist (NFT media) | deployed | ~$1 |
| CloudWatch + ECR + CodeBuild | logs ~90 MB, 2–3 repos, 2 idle projects | small | ~$2 |

**TOTAL (worker OFF) ≈ $86/mo · TOTAL (worker ON) ≈ $211/mo**

> **Flag:** `peakctf-*` resources (7 Dynamo tables, an S3 bucket, a Lambda) live in the same account but look like a separate project. Confirm ownership — don't let someone else's workload burn your credits.

### The credits insight
Cost Explorer reports ~$0 across the last 3 months even though App Runner/Fargate/ALB have run continuously since ~July 15. That means **AWS Activate / startup credits + free tier** are absorbing the bill. Two consequences:

1. **When credits expire the bill appears at once (~$86/mo).** Budget for it now, not when the email arrives.
2. **Verify the credit balance in the Billing console** (no public API) — it determines your actual runway.

### Three immediate cost wins (all free to do)
1. **Release or re-attach EIP `52.23.146.176`** — it's billed ($3.60/mo) because the ZK instance is stopped. Either keep the worker off *and* release the EIP, or wire Lambda to start the instance + attach on demand.
2. **Keep the ZK worker OFF by default** — this is the ~$125/mo line. It is already stopped; the Lambda auto start/stop path in `docs/aws_inventory_and_cost.md` is the production pattern.
3. **Check CloudWatch log retention** — the `zexvro-agent-backend` log group is already ~90 MB; set a 14-day retention policy now to cap ingestion/storage.

---

## 3. On-chain spend (Stellar) — "how much value went into contracts"

Contract deployment on Stellar costs **XLM** (upload WASM + create instances + fees), not AWS dollars. Recorded history from `memory.md`:

| Activity | Cost |
|---|---|
| Zer0: WASM upload + 4 pool deploys + `initialize` | ~18.7 XLM (deployer funded +30 XLM, now 5.42 left) |
| NFTo: mainnet WASM upload | ~18.7 XLM + sponsor top-ups (sponsor now 8.02 XLM) |
| Testnet ops (NFT deploy/mint/sale, De-pin settle) | small testnet amounts (friendbot-funded) |
| **Total on-chain spend** | **≈ 50–90 XLM ≈ $8–14** at $0.159/XLM |

**Takeaway:** On-chain costs are negligible and self-sustaining at MVP traffic. The plan only adds a real XLM line when mainnet transaction volume grows (sponsor fees: each sponsored envelope costs a fraction of an XLM; budget ~$5–10/mo per 1,000 sponsored txs). Keep the sponsor funded; its 8 XLM covers ~a few hundred txs.

---

## 4. Revenue basis (why the funding math works)

ZEXVRO bills in three ways today; the unified credits ledger (Phase B) will route them through one metering plane:

| Stream | How it prices | Assumption for planning |
|---|---|---|
| **ZCR credits** | $0.05 / ZCR, packs + custom amounts | Freemium wedge: 1 service free, pay for the rest |
| **NFTo** | Fixed USDC (SEP-41) per NFT checkout | Take on primary sales; fees cover sponsor envelope |
| **DEDSEC** | x402 exact USDC per request | Price per request/1k tokens later; settle before release |

**Business-model framing (from `startup-financial-modeling` skill):** this is a **platform/usage SaaS**. Target metrics for the model: gross margin 75–85% (infra is tiny vs fees), CAC payback < 12 months, LTV/CAC > 3. Revenue scales as *usage* grows, not seat count — so infra must be costed per unit of usage (per checkout, per request, per proof).

---

## 5. Future infrastructure cost model (roadmap Phases A–D)

Mapped to `docs/roadmap-unified-paas.md`. Each phase lists the **new** infra it needs and its monthly list-price impact.

### Phase A — Unify the spine (weeks 1–3) · ~$0 new infra
Pure code + routing. One CloudFront/API-Gateway origin. **No new paid infra.** *Rule: don't buy anything this phase.*

### Phase B — Unify value (weeks 4–6) · +$30–60/mo
One ZCR ledger per workspace + workspace provisioning + audit plane. This is where the first real databases appear.

| System | Why | Cheapest honest option | $/mo |
|---|---|---|---|
| **Postgres (control-plane ledger/audit)** | ZCR ledger, workspace provisioning, audit log | RDS Postgres `db.t4g.micro` (13) → Aurora Serverless v2 (60–120) once writes grow | 13–60 |
| **Redis (DEDSEC replay/rate-limit, sessions)** | Durable multi-instance abuse controls (currently memory/file) | ElastiCache Serverless (~25–40) or single `t3.micro` (13) | 13–40 |
| **Total Phase B delta** | | | **~$30–60/mo** |

### Phase C — Agentic + delivery (weeks 7–10) · +$10–40/mo
Morph + REQWID as modules, CI/CD, cost discipline.

| System | Why | $/mo |
|---|---|---|
| CI runners (GitHub Actions minutes or 1 small self-hosted EC2 `t3.micro`) | Green gate + deploy on push | 0–8 |
| Premium Soroban RPC (QuickNode/Ankr) *optional* | Remove public-RPC rate limits for NFTo/Zer0 prod | 0–99 |
| LLM API for Morph (CodexIn/Grok key) | Agent usage in dev/demo | 0–50 |
| **Total Phase C delta** | | **~$10–40/mo** |

### Phase D — Programs, team, first client (weeks 10+) · salaries dominate
Infra stays sub-$200/mo; the real line is **team**. Cost discipline from Phase C (worker off, App Runner smallest) keeps infra flat while revenue grows.

---

## 6. Future systems — "what IPFS, databases, and the rest will cost with more funds"

These are the systems the user asked about, priced at the point they actually become necessary (not before):

| System | First real need | Cheap option | Scale option |
|---|---|---|---|
| **IPFS / decentralized storage** | NFTo media if a partner demands content-addressed storage | Keep **S3 + CloudFront** (current default, decided in `context.md`); Pinata $20/mo only if a client requires it | Self-host IPFS `t3.medium` ~$30/mo; Storj/Filecoin ~$4–8/TB/mo for archival |
| **Postgres** | Phase B control-plane ledger | RDS `t4g.micro` ~$13/mo | Aurora Serverless v2 ~$60–120/mo |
| **Redis** | DEDSEC multi-instance anti-replay | ElastiCache Serverless ~$25–40/mo | Managed nodes ~$13–50/mo |
| **DynamoDB** | Already the store of record | On-demand, ~$0.25/million reads — tiny | Scales automatically; watch hot keys on the credits ledger |
| **Soroban RPC** | Zer0/NFTo at real volume | Public RPC free | Premium ~$49–99/mo |
| **ZK proving capacity** | Zer0 settle bursts | Batch + EC2 **spot** (c6i.xlarge ~$0.05/vCPU-hr) ≈ $0–36/mo | Reserve instances / GPU later only if proofs go real-time |
| **Email / notifications** | Brevo already in use (Lambda) | Free tier → ~$10–40/mo | — |
| **Analytics** | PostHog/Tinybird free tier first | $0–25/mo | Self-host ClickHouse ~$30–100/mo |
| **Observability** | Grafana Cloud free tier → CloudWatch retention caps | $0–20/mo | — |

**Rule of thumb:** don't add any of these until a phase needs it (Phase B = DB+Redis, Phase C = RPC, Phase D = team + analytics). Every premature system adds fixed cost to a credits-funded runway.

---

## 7. Funding plan — how much, when, for what

### Grant scenarios (Stellar Garage Pune 3rd place — plug in the real amount)

| | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| Grant | $5,000 | $10,000 | $25,000 |
| Monthly burn (no salary) | ~$150 | ~$150–300 | ~$300–500 |
| **Runway (infra only)** | **~33 months** | **~33–66 months** | **~50–80 months** |

With infra at ~$86–150/mo, **infrastructure alone is not the constraint.** The constraint is **time and team**: at 3 co-founders working for free, the 12-month need is small; the moment you hire part-time devrel/security/BD (Phase D), salary becomes the burn.

### Milestone-based cash needs (base scenario)

| Milestone | Window | Deliverable | Cash needed | Used for |
|---|---|---|---|---|
| **M0 — Unify spine** | Weeks 1–3 | Service Registry + unified gateway/auth + green tests | **$0–500** | Domain (`zexvro.in`/`gate.zexvro.in`), one CloudFront origin, test tooling |
| **M1 — Unify value** | Weeks 4–6 | ZCR metering plane + workspace provisioning + NFTo/DEDSEC onboarded | **$500–1,000** | RDS Postgres + Redis (or first credits) + premium RPC for load tests |
| **M2 — Agentic + delivery** | Weeks 7–10 | Morph + REQWID as modules, CI/CD, cost discipline | **$1,000–2,500** | CI runners, LLM API budget for Morph, RPC, legal/ops |
| **M3 — Programs + team** | Weeks 10–16 | SCF/T-Hub/MeitY applications + first hires (part-time) | **$3,000–10,000** | 1 part-time security reviewer + devrel for ~3–6 months; grant applications travel/legal |
| **M4 — First client** | Weeks 16+ | SPPU → NFTo studios → cross-sell DEDSEC/Zer0 | **$5,000–15,000** | Working capital for infra + onboarding support; free-trial isolation |
| **12-month total (base, no-founder-salary)** | | | **≈ $8k–12k** | |

> **Use-of-funds split (benchmark from `startup-financial-modeling` skill):** Product/infra 40% · Go-to-market 40% · Ops/G&A 20%. At $10k: $4k infra+dev, $4k GTM, $2k ops.

### Funding sources ladder (apply in order)
1. **Stellar Garage Pune (3rd place)** — anchor narrative, actual amount TBD.
2. **Stellar Community Fund / SDF grants** — $5k–25k; strongest fit (Stellar-native stack).
3. **Stellar hackathons/bootcamps** — fast cash + demos (SPPU bootcamp already real usage).
4. **T-Hub, 100x Entrepreneurs, MeitY TIDE** (India accelerators).
5. **YC / GV later** — only after first client + revenue prove the model.

---

## 8. Next 90 days — goals and execution (define-goal output)

Written per the `define-goal` skill: measurable, evidenced, bounded.

- **OKR 1 — Unify the platform.** "All 5 services read one Service Registry; the console, landing, docs, and Morph agent render the same catalog; `npm run lint && npm test && npm run build` green (12 failing tests fixed)." Evidence: refactored `frontend/src/data/serviceCatalog.ts` consumed by the ~20 hardcoded copies; CI badge green on `main`.
- **OKR 2 — First paying usage.** "At least 1 workspace pays for a ZCR pack OR 3 NFTo studios deploy collections on mainnet, with one settlement per service recorded in `memory.md`." Evidence: credits ledger entries + on-chain sale/checkout hashes.
- **OKR 3 — Cost discipline.** "AWS list-price burn stays ≤ $120/mo; ZK worker off by default with Lambda auto start/stop proven; EIP released; log retention capped; credits balance checked monthly." Evidence: Cost Explorer < $120, worker stopped, `docs/aws_inventory_and_cost.md` refreshed.

---

## 9. Next 30 days — execution checklist

**Week 1 (immediately, free):**
- [ ] Plug the real grant amount into §7 and lock the scenario.
- [ ] Release EIP `52.23.146.176` or keep worker+EIP discipline (save $3.60/mo).
- [ ] Set CloudWatch log retention to 14 days on all groups.
- [ ] Verify AWS credit balance + expiry in Billing console; record in `memory.md`.
- [ ] Confirm ownership of `peakctf-*` resources.

**Weeks 1–3 (Phase A, ~$0):**
- [ ] A1 **Service Registry** — single manifest consumed by sidebar/services/docs/landing/agent (this is the first funded build).
- [ ] A0 Green gate — fix the 12 red frontend tests.
- [ ] A2 Unified API Gateway origin; A3 one Cognito session across services.

**Weeks 4–6 (Phase B, first paid infra):**
- [ ] B1 ZCR metering plane; B2 workspace provisioning; B3 audit+health; B4 onboard NFTo + DEDSEC.
- [ ] Provision RDS Postgres + Redis only when the ledger write path is ready.

**Ongoing:**
- [ ] Monthly AWS cost check (put it in `memory.md`).
- [ ] Run the new skills: `planning-with-files` (this plan), `startup-financial-modeling`, `fundraising` when writing grant applications.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Credits expire unexpectedly | Bill jumps ~$86/mo overnight | Treat list price as baseline; monthly cost check; release EIP now |
| ZK worker left running | +$125/mo | Default OFF + Lambda auto start/stop (Phase C4) |
| Phase B DB/Redis added too early | Fixed $30–60/mo on a $0-revenue runway | Gate provisioning behind the ledger write path |
| `peakctf-*` resources drift | Unknown burn inside credits | Confirm ownership this week |
| Scope creep / stealing tickets | Diffused team | Keep `context.md` ownership map; cross-cutting needs a `memory.md` entry |

---

*Related: `docs/aws_inventory_and_cost.md` (resource inventory), `docs/roadmap-unified-paas.md` (Phase A–D), `docs/aws_nft_depin_runtime.md` (sponsor ops), `zer0-pool/README.md` (mainnet deploy).*
