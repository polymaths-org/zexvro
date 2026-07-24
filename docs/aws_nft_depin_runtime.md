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

## NFT API Stellar network (2026-07-25)

Hosted NFT API is on **Stellar mainnet (pubnet)**:

| Env | Value |
| --- | --- |
| `NFT_COLLECTION_WASM_HASH` | `4beb4b6f90eb65291db698ca148903cf1946b20b7ffb381f5b1e25fe779af700` |
| `STELLAR_RPC_URL` | `https://mainnet.sorobanrpc.com` |
| `STELLAR_NETWORK_PASSPHRASE` | `Public Global Stellar Network ; September 2015` |
| `STELLAR_USDC_CONTRACT` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` (Circle USDC) |
| Image | `zexvro-nft-api:mainnet-20260725011109` |

Sponsor secret remains Secrets Manager `zexvro/nft/sponsor-secret` (pubkey `GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ`). Keep sponsor funded on **mainnet** for fee sponsorship.

Health should report `capabilities.network: "stellar:pubnet"`.

## Storage (already provisioned)

See [aws_nft_production.md](./aws_nft_production.md).
