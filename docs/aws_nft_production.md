# AWS NFT production resources

Account `290294660486`, region `us-east-1`.

Provisioned for the NFT service S3 media + DynamoDB records + sponsor secret path.

## Resources

| Resource | Name / value |
| --- | --- |
| DynamoDB table | `zexvro-nft` (PAY_PER_REQUEST) |
| GSI | `workspace-index` (`gsi1pk`/`gsi1sk`) |
| GSI | `idempotency-index` (`gsi2pk`/`gsi2sk`) |
| S3 media bucket | `zexvro-nft-media-290294660486-us-east-1` |
| CloudFront | `E29QH7B9BDBJZW` → `https://d1a0z3arlwwfrj.cloudfront.net` |
| Secrets Manager | `zexvro/nft/sponsor-secret` |

Bucket is private; objects are readable only through CloudFront (OAC).

## Root `.env` for AWS-backed local/prod-like API

```bash
NFT_STORAGE_MODE=s3
NFT_S3_BUCKET=zexvro-nft-media-290294660486-us-east-1
NFT_S3_REGION=us-east-1
NFT_CDN_BASE_URL=https://d1a0z3arlwwfrj.cloudfront.net
NFT_REPOSITORY=dynamo
NFT_DYNAMO_TABLE=zexvro-nft
NFT_DYNAMO_REGION=us-east-1
NFT_DYNAMO_GSI_WORKSPACE=workspace-index
NFT_DYNAMO_GSI_IDEMPOTENCY=idempotency-index
NFT_COLLECTION_WASM_HASH=df42dfceaf2036be527561f313392cee4b756d34745d7cc5f7a1c96936543710
```

Load sponsor secret **into process env** (do not commit):

```bash
export STELLAR_SPONSOR_SECRET="$(aws secretsmanager get-secret-value \
  --secret-id zexvro/nft/sponsor-secret \
  --query SecretString --output text)"
```

Or keep `STELLAR_SPONSOR_SECRET` empty and use `npm run dev` + Stellar CLI identity for local.

For a strict production process:

```bash
export NODE_ENV=production
# requires STELLAR_SPONSOR_SECRET + NFT_COLLECTION_WASM_HASH
```

AWS credentials: default CLI/SDK chain (`~/.aws/credentials` or task role).

## De-pin multi-instance (local durable)

```bash
DEPIN_STATE_BACKEND=file
DEPIN_STATE_PATH=.data/depin-state.json
```

Managed provider config (optional):

```bash
# DEPIN_CONFIG_JSON='{...}'
# or DEPIN_CONFIG_URL=https://...
DEPIN_CONFIG_PATH=depin.config.json
```

## Verify

```bash
aws dynamodb describe-table --table-name zexvro-nft --query Table.TableStatus
aws s3 ls s3://zexvro-nft-media-290294660486-us-east-1/
aws cloudfront get-distribution --id E29QH7B9BDBJZW --query Distribution.Status
aws secretsmanager describe-secret --secret-id zexvro/nft/sponsor-secret --query Name
```

NFT API:

```bash
export STELLAR_SPONSOR_SECRET="$(aws secretsmanager get-secret-value --secret-id zexvro/nft/sponsor-secret --query SecretString --output text)"
npm run dev:nft
# health should report storageMode=s3 and stellarConfigured=true when wasm hash set
curl -s http://127.0.0.1:4101/health
```

## Runtime hosting

See [aws_nft_depin_runtime.md](./aws_nft_depin_runtime.md) for App Runner URLs.

## Not included yet

- Custom domain mapping for App Runner services.
- IAM least-privilege task role (currently uses your CLI/root-equivalent user).
- Custom domain on CloudFront.
- Automated secret rotation.

## Safety

- Never commit `STELLAR_SPONSOR_SECRET` or `PINATA_JWT`.
- Do not open the media bucket for public ACLs; use CloudFront only.
