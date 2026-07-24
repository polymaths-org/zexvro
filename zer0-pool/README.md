# Zer0 Privacy Pool

Soroban multi-denomination privacy pools (Poseidon Merkle + Groth16 BN254).

## Tiers

| Tier | Denomination (stroops) |
| --- | ---: |
| 1 XLM | 10_000_000 |
| 10 XLM | 100_000_000 |
| 100 XLM | 1_000_000_000 |
| 1000 XLM | 10_000_000_000 |

Same WASM for all tiers; `initialize(admin, denomination, token)` sets note size + native SAC.

## Build (optimized)

```bash
cd zer0-pool
stellar contract build --package zer0-pool
# → target/wasm32v1-none/release/zer0_pool.wasm (~26 KB, opt-level=z + LTO)
```

## Mainnet deploy

1. **Fund deployer** (CLI identity `zexvro-privacy` by default):

   ```
   GADWIZHQJKSWTKMADYHB4DAUE74TJX47CUK4KJH3QBGURYQ4LDCSZLPQ
   ```

   Send **50–80 XLM** on mainnet (upload + 4 deploys + init + fees).

2. Run:

   ```bash
   export STELLAR_IDENTITY=zexvro-privacy
   export MAINNET_RPC_URL=https://mainnet.sorobanrpc.com   # optional
   ./scripts/deploy-mainnet.sh
   ```

3. Script writes `mainnet-pools.env` with:

   - `VITE_ZER0_CONTRACT_MAINNET` / `_1` / `_10` / `_100` / `_1000`
   - `VITE_SOROBAN_RPC_MAINNET`

4. Copy those into console env and rebuild/deploy frontend.

5. Optional: seed anonymity set (SAC transfer XLM into each pool + deposit commitments).

### Token addresses

| Network | Native XLM SAC |
| --- | --- |
| Testnet | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Mainnet | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |

## Testnet redeploy (new init signature)

Existing testnet pools stay valid. For a fresh testnet install with `token` arg:

```bash
./scripts/redeploy-testnet-token-arg.sh
```

## Frontend

`frontend/src/api/privacyPool.ts` loads mainnet tiers only when `VITE_ZER0_CONTRACT_*_MAINNET` are set.
