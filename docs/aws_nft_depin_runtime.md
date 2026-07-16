# NFT + De-pin App Runner runtime

Account `290294660486`, region `us-east-1`.

## Live endpoints

| Service | URL | Status |
| --- | --- | --- |
| NFT API | https://iyk6idmup6.us-east-1.awsapprunner.com | App Runner `zexvro-nft-api` |
| De-pin gateway | https://sr9k3xpmbj.us-east-1.awsapprunner.com | App Runner `zexvro-depin` |

## Frontend env (production build / hosted dashboard)

```bash
VITE_NFT_API_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
VITE_DEPIN_API_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
```

Local dev can keep relative `/api/nft` and `/api/depin` (Vite proxy to local services).

## What is on AWS

### Compute
- **App Runner** services pull images from **ECR**
  - `290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-nft-api`
  - `290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-depin`
- Instance role: `zexvro-apprunner-instance` (DynamoDB + S3 + Secrets Manager)
- ECR access role: `zexvro-apprunner-ecr-access`

### Storage (pre-existing)
See [aws_nft_production.md](./aws_nft_production.md):
- DynamoDB `zexvro-nft`
- S3 `zexvro-nft-media-290294660486-us-east-1`
- CloudFront `https://d1a0z3arlwwfrj.cloudfront.net`
- Secrets Manager `zexvro/nft/sponsor-secret`
- Secrets Manager `zexvro/depin/config-json` (provider config JSON)

### NFT runtime env highlights
- `NFT_STORAGE_MODE=s3`
- `NFT_REPOSITORY=dynamo`
- `NFT_REQUIRE_SPONSOR=1`
- `STELLAR_SPONSOR_SECRET` from Secrets Manager
- CORS includes localhost + `zexvrodashboard.xyz` + `zexvro.pages.dev`

### De-pin runtime env highlights
- `DEPIN_CONFIG_JSON` from Secrets Manager
- `DEPIN_STATE_BACKEND=memory` (single-instance OK; multi-instance needs durable store)

## Health checks

```bash
curl -s https://iyk6idmup6.us-east-1.awsapprunner.com/health
# {"status":"ok","service":"nft-service","capabilities":{...,"storageMode":"s3","stellarConfigured":true}}

curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/health
curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/status
```

## Redeploy images

Dockerfiles:
- `services/nft-service/api/Dockerfile`
- `services/depin/Dockerfile`

Helper script (CodeBuild path may be blocked on free-tier build limits; EC2 builder works):

```bash
node scripts/deploy-nft-depin-aws.mjs
```

Manual push flow:
1. Build/push images to ECR tags
2. `aws apprunner update-service` with new `ImageIdentifier`

## Notes / follow-ups
- Prefer `RuntimeEnvironmentSecrets` over plain env for sponsor + depin config.
- De-pin replay/rate-limit state is in-memory; for multi-instance use file/redis later.
- Custom domains for App Runner optional.
- Temporary EC2 image builder should be terminated after deploys.
