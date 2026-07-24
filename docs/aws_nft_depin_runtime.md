# NFT + De-pin App Runner runtime

Account `290294660486`, region `us-east-1`.

| Service | URL |
| --- | --- |
| NFT API | https://iyk6idmup6.us-east-1.awsapprunner.com |
| De-pin gateway | https://sr9k3xpmbj.us-east-1.awsapprunner.com |

## Frontend env (production)

```bash
VITE_NFT_API_URL=https://iyk6idmup6.us-east-1.awsapprunner.com
VITE_DEPIN_API_URL=https://sr9k3xpmbj.us-east-1.awsapprunner.com
```

Local dev can keep relative `/api/nft` and `/api/depin` (Vite proxy).

## Redeploy

```bash
node scripts/deploy-nft-depin-aws.mjs
```

## Health

```bash
curl -s https://iyk6idmup6.us-east-1.awsapprunner.com/health
curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/health
curl -s https://sr9k3xpmbj.us-east-1.awsapprunner.com/status
```

## Storage (already provisioned)

See [aws_nft_production.md](./aws_nft_production.md).
