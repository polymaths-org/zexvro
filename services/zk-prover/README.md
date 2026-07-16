# ZEXVRO ZK Prover Worker

On-demand prove service for Zer0 private payroll.

## MVP engine

- **Now:** Node + `snarkjs` (same circuit as browser; runs on a bigger EC2 CPU)
- **Next:** swap `prove()` to **RapidSNARK** CLI with the same HTTP contract

## Artifacts

Copy from backup (never regenerate casually):

```bash
# already in monorepo:
zer0-pool/backups/zk-proofs-LATEST/frontend-public-zk/withdraw.wasm
zer0-pool/backups/zk-proofs-LATEST/frontend-public-zk/withdraw_0000.zkey
```

Or set `ZK_ARTIFACT_DIR` to that folder.

## Run locally

```bash
cd services/zk-prover
npm install
ZK_ARTIFACT_DIR=../../zer0-pool/backups/zk-proofs-LATEST/frontend-public-zk npm start
# POST http://127.0.0.1:8787/prove  { "input": { ... circuit signals ... } }
# GET  http://127.0.0.1:8787/health
```

## EC2 (recommended MVP)

1. Launch Ubuntu EC2 (e.g. `c6i.xlarge` or `c7i.xlarge`), **20–40 GB gp3** EBS.
2. Install Node 20, clone/copy this service + artifacts.
3. Open security group: **8787** from Lambda NAT / your API only (not 0.0.0.0/0 if possible).
4. `systemd` unit for `node server.mjs`.
5. Note instance id + public IP (or attach Elastic IP).
6. Lambda env:
   - `ZK_WORKER_INSTANCE_ID=i-...`
   - `ZK_PROVER_URL=http://x.x.x.x:8787` (optional if public IP is used dynamically)
   - `ZK_PROVER_SHARED_SECRET=...` (same on worker)
7. IAM: Lambda role needs `ec2:StartInstances`, `ec2:StopInstances`, `ec2:DescribeInstances` on that instance.

## Lightsail (convenience)

Always-on box with fixed IP → set only `ZK_PROVER_URL` (no start/stop). Manage power in console.

## Frontend

Payroll → **Settings → Security → ZK prover worker (EC2)**  
**Turn ON** before testing private pay · **Turn OFF** when done.

Private pays call `POST /api/zk-worker/prove`. If worker offline, client falls back to browser snarkjs.
