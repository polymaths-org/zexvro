# Findings — Live cost/inventory snapshot (2026-08-15)

All data pulled live from AWS account `290294660486` (us-east-1) and Stellar mainnet Horizon. List prices = USD, current (2026).

## AWS Cost Explorer (actual billed)
| Period | UnblendedCost |
|---|---|
| 2026-05-15 → 06-01 | $0.00 |
| 2026-06-01 → 07-01 | $0.00 |
| 2026-07-01 → 08-01 | ~$0.00 |
| 2026-08-01 → 08-15 (est) | ~$0.00 |

Conclusion: account is being covered by AWS Activate / startup credits + free tier. The moment credits expire, the list-price burn below becomes the real bill. Verify exact credit balance in Billing console (no public API).

## Live inventory (list-price / mo)
| Resource | Detail | Status | Est. $/mo |
|---|---|---|---|
| App Runner `zexvro-nft-api` | 0.25 vCPU / 0.5 GB, min 1 | RUNNING | ~$23 |
| App Runner `zexvro-depin` | 0.25 vCPU / 0.5 GB, min 1 | RUNNING | ~$23 |
| ECS Fargate `zexvro-gate` | task 0.25 vCPU / 0.5 GB (rev 4) | 1 task running | ~$9 |
| ALB `zexvro-gate-alb` | HTTP:80, 2 EIPs | active | ~$18 |
| EC2 c6i.xlarge (ZK prover) | i-02ee1b304375575d0 + 30GB gp3 | **STOPPED** | $0 (was ~$125) |
| EIP 52.23.146.176 | attached to STOPPED instance | billed while stopped | $3.60 |
| Secrets Manager | 7 secrets (sponsor, depin config, agent-auth ×2, labs session, github ×2) | — | $2.80 |
| DynamoDB | 23 tables on-demand (16 zexvro-*, 7 peakctf-*) | tiny | ~$2 |
| Lambda | zexvro-agent-backend, zexvro-cognito-custom-message, peakctf-api | low volume | ~$1 |
| S3 | 4 buckets (nft-media, deploy, agent-assets, peakctf-deploy) | tiny | ~$1 |
| CloudFront | E29QH7B9BDBJZW (NFT media) | deployed | ~$1 |
| CloudWatch | lambda logs ~90MB (agent-backend dominates) | small | ~$1 |
| ECR | 2-3 repos | small | ~$1 |
| CodeBuild | zexvro-nft-depin-build, zexvro-agent-auth-build | idle | $0 |

**TOTAL list price: worker OFF ≈ $86/mo · worker ON ≈ $211/mo · actual billed ≈ $0 (credits)**

Note: `peakctf-*` resources (7 tables, S3 bucket, Lambda) are in the same account — separate project? Flag for ownership before they accumulate cost.

## Stellar mainnet on-chain (XLM = $0.159)
| Account | Balance XLM | ≈ USD |
|---|---|---|
| Zer0 deployer `GADWIZ...LPQ` | 5.42 | $0.86 |
| NFTo sponsor `GCD4S...RCZ` | 8.02 | $1.27 |

Historical contract-deploy spend (from memory.md): Zer0 deployer funded +30 XLM, WASM upload + 4 pool deploys + init consumed ~18.7 XLM; NFTo mainnet WASM upload cost ~18.7 XLM plus sponsor topups. Total on-chain ops spend ≈ 50–90 XLM ≈ **$8–14** at current price. Small; not a funding driver.

## Skills installed (2026-08-15)
- `openai/skills@define-goal` — goal definition
- `othmanadi/planning-with-files@planning-with-files` — persistent file planning (this plan)
- `wshobson/agents@startup-financial-modeling` — 3-yr model / burn / runway
- `wshobson/agents@startup-metrics-framework` — SaaS metrics
- `refoundai/lenny-skills@fundraising` — fundraising guidance
- `stablyai/orca@orchestration` — agent orchestration

## Pricing references (list)
- App Runner: vCPU $0.0000294/s, mem $0.00000322/GB-s → 0.25/0.5 always-on ≈ $23/mo each.
- Fargate: $0.04048/vCPU-hr, $0.004445/GB-hr → 0.25/0.5 ≈ $9/mo.
- ALB: $0.0225/hr + LCU ≈ $18/mo. EIP idle: $0.005/hr = $3.60/mo.
- c6i.xlarge on-demand: $0.17/hr = $122.40/mo + 30GB gp3 $2.40.
- Secrets Manager: $0.40/secret/mo. DynamoDB on-demand: ~$1.25/million WCU, $0.25/million RCU.
- RDS Postgres t4g.micro ≈ $13/mo; Aurora Serverless v2 ≈ $60-120/mo baseline.
- ElastiCache serverless ≈ $25-40/mo; t3.micro node ≈ $13/mo.
- Pinata IPFS: $20-200/mo; self-host IPFS t3.medium ≈ $30/mo; Storj/Filecoin ≈ $4-8/TB/mo.
- Premium Soroban RPC (QuickNode/Ankr): $49-99/mo. Public RPC: free.
- ZK proving batch (AWS Batch + c6i spot): ≈ $0.05/vCPU-hr → bursty ~$36/mo if near-24/7, less for batches.
