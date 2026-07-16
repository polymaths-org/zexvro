# ZEXVRO AWS inventory & monthly cost estimate

Account `290294660486` · Region `us-east-1` · Snapshot **2026-07-15**.

Cost Explorer currently reports ~$0 (billing lag / free tier / credits).  
Numbers below are **list-price estimates (USD/month)** for light MVP traffic unless noted.

---

## Master table

| # | Resource | AWS service | What it does | Config / endpoint | Est. $/mo |
|---:|---|---|---|---|---:|
| 1 | `zexvro-agent-backend` | **Lambda** | Main API: auth device codes, workspaces, projects, employees, payroll, memory, ZK worker proxy, chat | Python 3.12, 128 MB, 180s timeout | $0–2 |
| 2 | `zexvro-api` (`qkuostruh3`) | **API Gateway HTTP** | Public HTTPS front door for Lambda | `https://qkuostruh3.execute-api.us-east-1.amazonaws.com` | $0–3 |
| 3 | `User pool - xcycxn` | **Cognito** | Dashboard / NFT login | Pool `us-east-1_vyONcitBD`, client `7qmkq33si9qk8pgo6ebi3qantm` | $0 (free tier) |
| 4 | `zexvro-device-codes` | **DynamoDB** | CLI device auth codes | On-demand · 6 items | $0–1 |
| 5 | `zexvro-workspaces` | **DynamoDB** | Workspaces | On-demand · 156 items | $0–1 |
| 6 | `zexvro-projects` | **DynamoDB** | Projects | On-demand · 6 items | $0–1 |
| 7 | `zexvro-employees` | **DynamoDB** | Zer0 team directory | On-demand · 4 items | $0–1 |
| 8 | `zexvro-payroll-runs` | **DynamoDB** | Payroll runs / payments | On-demand · 90 items | $0–1 |
| 9 | `zexvro-payroll-taxonomy` | **DynamoDB** | Roles / departments | On-demand · 4 items | $0–1 |
| 10 | `zexvro-user-memory` | **DynamoDB** | Shared `/api/memory` store | On-demand · 4 items · ~54 KB | $0–1 |
| 11 | `zexvro-nft` | **DynamoDB** | NFT collections / inventory / checkout | On-demand · 10 items · 2 GSIs | $0–2 |
| 12 | `zexvro-nft-api` | **App Runner** | Hosted NFT Express API (S3+Dynamo+Stellar) | `https://iyk6idmup6.us-east-1.awsapprunner.com` · 0.25 vCPU / 0.5 GB | **$7–18** |
| 13 | `zexvro-depin` | **App Runner** | Hosted De-pin x402 gateway | `https://sr9k3xpmbj.us-east-1.awsapprunner.com` · 0.25 vCPU / 0.5 GB | **$7–18** |
| 14 | ECR `zexvro-nft-api` | **ECR** | NFT container images | ~90 MB compressed | $0–1 |
| 15 | ECR `zexvro-depin` | **ECR** | De-pin container images | ~105 MB compressed | $0–1 |
| 16 | S3 `zexvro-nft-media-…` | **S3** | NFT media / metadata objects | ~1.6 MB · 8 objects | $0–1 |
| 17 | S3 `zexvro-deploy-…` | **S3** | Build source tarballs | ~144 KB | $0–1 |
| 18 | S3 `zexvro-agent-assets-…` | **S3** | Agent assets (empty) | 0 objects | $0 |
| 19 | CloudFront `E29QH7B9BDBJZW` | **CloudFront** | CDN for NFT media | `https://d1a0z3arlwwfrj.cloudfront.net` | $0–2 |
| 20 | `zexvro/nft/sponsor-secret` | **Secrets Manager** | Stellar sponsor seed for NFT | Injected into App Runner | **$0.40** |
| 21 | `zexvro/depin/config-json` | **Secrets Manager** | De-pin provider config JSON | Injected into App Runner | **$0.40** |
| 22 | `zexvro-zk-prover` `i-02ee1b304375575d0` | **EC2** | RapidSNARK / ZK settle worker | **c6i.xlarge · RUNNING** · `52.23.146.176:8787` | **~$124** |
| 23 | EIP `52.23.146.176` | **Elastic IP** | Stable IP for ZK worker | Attached to running instance | $0 |
| 24 | CloudWatch `/aws/lambda/…` | **CloudWatch Logs** | Lambda logs | ~30 MB stored | $0–2 |
| 25 | App Runner log groups | **CloudWatch Logs** | NFT + De-pin logs | New / small | $0–2 |
| 26 | `zexvro-nft-depin-build` | **CodeBuild** | Image build project (idle) | Account build limit 0 concurrent | $0 unless run |
| 27 | IAM roles (App Runner, CodeBuild, EC2 builder) | **IAM** | Access control | Free | $0 |

---

## By product area

| Product | Backend pieces | Primary AWS services |
|---|---|---|
| **Auth / dashboard API** | Cognito + Lambda + API GW + device-codes / workspaces / projects / memory tables | Cognito, Lambda, API Gateway, DynamoDB |
| **Zer0 payroll** | Employees, payroll runs, taxonomy tables; ZK prove/settle via Lambda → EC2 worker | DynamoDB, Lambda, **EC2 c6i.xlarge** |
| **NFT Studio** | App Runner API + Dynamo `zexvro-nft` + S3 media + CloudFront + sponsor secret | App Runner, DynamoDB, S3, CloudFront, Secrets Manager, ECR |
| **De-pin (Access Shield MVP)** | App Runner gateway + Secrets config | App Runner, Secrets Manager, ECR |

---

## Cost rollup (estimated)

| Bucket | What | Light usage | Notes |
|---|---|---:|---|
| **Always-on compute (big)** | EC2 `c6i.xlarge` ZK worker | **~$124** | Dominates bill if left running 24/7 |
| **Always-on compute (APIs)** | 2× App Runner 0.25 vCPU / 0.5 GB | **~$15–35** | Idle provisioned + light traffic |
| **Secrets** | 2 secrets | **$0.80** | Fixed |
| **Serverless data plane** | Lambda + API GW + DynamoDB + S3 + CF + ECR + logs | **~$1–10** | Free tier absorbs most of this at current size |
| **TOTAL (worker ON)** | | **~$140–170 / mo** | |
| **TOTAL (worker STOPPED)** | stop EC2 when idle | **~$20–45 / mo** | Lambda can auto-start worker when needed |

### Assumptions
- App Runner min instances ≈ 1 each, low request volume.
- DynamoDB on-demand, tiny tables (all &lt; 100 KB except payroll/memory).
- Cognito within free tier (&lt; 50k MAU).
- EC2 on-demand `c6i.xlarge` ≈ **$0.17/hr** → **~$124/mo** (us-east-1 list).
- EIP free while attached to a running instance.
- No RDS, no ALB, no NAT gateway (good — those get expensive).

---

## Cost control tips

1. **Stop the ZK EC2 when not settling pays** — biggest saver (~$124/mo). Your Lambda already knows `ZK_WORKER_INSTANCE_ID=i-02ee1b304375575d0` and can wake it.
2. Keep App Runner on the smallest size until traffic grows.
3. Secrets Manager is fixed $0.40 each; consolidate later if needed.
4. CodeBuild project is free idle; avoid frequent large builds.
5. Watch CloudWatch log retention (Lambda logs already ~30 MB).

---

## Quick health endpoints

```bash
# Lambda API (via API Gateway)
curl -s https://qkuostruh3.execute-api.us-east-1.amazonaws.com/api/memory -H 'Authorization: Bearer test' | head

# NFT
curl -s https://iyk6idmup6.us-east-1.awsapprunner.com/health

# De-pin
curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/health
curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/status
```

Related docs: [aws_nft_production.md](./aws_nft_production.md), [aws_nft_depin_runtime.md](./aws_nft_depin_runtime.md), [aws_deployment.md](./aws_deployment.md).
