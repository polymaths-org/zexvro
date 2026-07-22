# ZEXVRO Gate — Production Ops Checklist

## Runtime

| Item | Recommendation |
| --- | --- |
| Host | App Runner `zexvro-agent-auth` (same pattern as NFT/De-pin) |
| Region | `us-east-1` |
| Port | 4103 |
| Node | ≥22 |
| State | DynamoDB single-table `zexvro-agent-auth` (codec in `stores.dynamo.ts`) |
| Secrets | Secrets Manager `zexvro/agent-auth/issuer-signing` |
| Env | `NODE_ENV=production` (kills soft_confirm + dev HMAC) |
| Pop | `GATE_REQUIRE_POP=true` |

## Env (production)

```bash
NODE_ENV=production
AGENT_AUTH_PORT=4103
AGENT_AUTH_ISSUER=https://gate.example
AGENT_AUTH_SIGNING_SECRET=... # load from Secrets Manager
GATE_ALLOW_DEV_HUMAN=false    # forced false by NODE_ENV=production
GATE_ALLOW_DEV_HMAC=false
GATE_REQUIRE_POP=true
GATE_STATE_BACKEND=dynamo
GATE_DYNAMO_TABLE=zexvro-agent-auth
AWS_REGION=us-east-1
```

## Ceremonies

| Channel | Production proof | Class |
| --- | --- | --- |
| Human | `session_pop` (Ed25519 ephemeral key) now; **WebAuthn** next | human |
| Human | `soft_confirm` | **disabled** |
| Agent | Ed25519 `nonce_sign` + **PoP** on verify | agent |

## Deploy sketch

```bash
# 1) Create Dynamo table (pk S, sk S, TTL attribute ttl)
# 2) Secret for signing
# 3) Docker build from services/agent-auth
# 4) App Runner service + IAM: dynamodb + secretsmanager
# 5) Smoke: NODE_ENV=production curl health + agent Ed25519 flow
```

## Compose with De-pin

See `docs/agent_auth_depin_bind.md`. Enforce on edge:

1. Verify capability (+ pop for agents)
2. Policy class
3. x402 pay
4. `payer ∈ allowed_payer_pks`
5. Settle / release

## Do not claim

- soft_confirm / session_pop alone stops human farms forever
- Perfect bot detection
- Stellar wallet = human

## Status

`GET /status` → `securityProfile` shows live flags.


## Live ARNs (us-east-1 / 290294660486)

- DynamoDB table: `zexvro-agent-auth`
- Secret: `zexvro/agent-auth/issuer-signing`
- ECR: `290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-agent-auth`
- App Runner instance role: `arn:aws:iam::290294660486:role/zexvro-gate-apprunner-instance`
- App Runner ECR access role: `arn:aws:iam::290294660486:role/zexvro-gate-apprunner-ecr-access`

### Blocked locally

Docker daemon was inactive in the agent environment; image build/push must run on a host with Docker:

```bash
docker build -t zexvro-agent-auth:latest services/agent-auth
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 290294660486.dkr.ecr.us-east-1.amazonaws.com
docker tag zexvro-agent-auth:latest 290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-agent-auth:latest
docker push 290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-agent-auth:latest
```


## CodeBuild note (2026-07-17)

`npm run gate:deploy` stages source and creates project `zexvro-agent-auth-build`, but this AWS account currently has **CodeBuild concurrent build limit 0** (`AccountLimitExceededException`). Inventory already noted this for `zexvro-nft-depin-build`.

**Unblock options:**

1. AWS Support / Service Quotas → CodeBuild concurrent builds ≥ 1  
2. Build/push on a machine with Docker (see commands above)  
3. Use an alternate CI with Docker-in-Docker

Until then Gate runs locally (`npm run dev:agent-auth`) with optional `GATE_STATE_BACKEND=dynamo` against the live table.
