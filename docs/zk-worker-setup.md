# ZK Prover Worker — EC2 ON/OFF from Payroll Settings

## Live deployment (us-east-1, 2026-07-14)

| Item | Value |
|------|--------|
| Instance | `i-02ee1b304375575d0` (`c6i.xlarge`, Name=`zexvro-zk-prover`) |
| Elastic IP | `52.23.146.176` |
| Prover URL | `http://52.23.146.176:8787` |
| Health | `GET /health` |
| Prove | `POST /prove` |
| Engine | **RapidSNARK** (`/opt/rapidsnark/package/bin/prover`) + snarkjs witness; snarkjs fullProve fallback |
| Benchmark (depth-20 withdraw, c6i.xlarge) | RapidSNARK **~220ms** vs snarkjs **~1.0–1.3s** (~5×) |
| Artifacts | `/opt/zexvro-zk-prover/artifacts` from `zer0-pool/backups/zk-proofs-LATEST` |
| Key pair | `zexvro-zk-prover` (local: `/tmp/zexvro-zk-prover.pem` if created on this machine) |
| SG | `zexvro-zk-prover-sg` (22, 8787) |

Lambda `zexvro-agent-backend` env already set:
`ZK_WORKER_INSTANCE_ID`, `ZK_PROVER_URL`, `ZK_PROVER_PORT`, `ZK_PROVER_SHARED_SECRET`.

## User flow

1. Open **Payroll → Settings → Security**
2. Section **ZK prover worker (EC2)**
3. **Turn ON** before private pay / payroll testing (cold start 30s–2 min)
4. Run private payments (app uses remote prove when online)
5. **Turn OFF** when testing is done

## Lambda environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ZK_WORKER_INSTANCE_ID` | for start/stop | EC2 instance id `i-...` |
| `ZK_PROVER_URL` | recommended | `http://PUBLIC_IP:8787` or fixed Lightsail URL |
| `ZK_PROVER_PORT` | no | default `8787` if building URL from public IP |
| `ZK_PROVER_SHARED_SECRET` | recommended | must match worker env |

## IAM (Lambda role)

```json
{
  "Effect": "Allow",
  "Action": [
    "ec2:StartInstances",
    "ec2:StopInstances",
    "ec2:DescribeInstances"
  ],
  "Resource": "*"
}
```

(Scope Resource to the instance ARN in production.)

## API routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/zk-worker/status` | state / online / ip |
| POST | `/api/zk-worker/start` | start EC2 |
| POST | `/api/zk-worker/stop` | stop EC2 |
| POST | `/api/zk-worker/prove` | proxy prove to worker |

## Deploy Lambda

Redeploy `scratch_lambda/lambda_function.py` (zip + update function) after pull, then set env vars in AWS console.

## Worker

See `services/zk-prover/README.md`.
