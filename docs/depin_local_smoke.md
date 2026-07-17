# De-pin local smoke checklist

Owner: Nabil (`n4bi10p`). Gateway MVP for **Access Shield** economic enforcement.

## Prerequisites

1. Root `.env` from `.env.example` (prefer `DEPIN_STATE_BACKEND=file`).
2. `services/depin/depin.config.json` from `depin.config.example.json` with a real **G…** `recipient` (USDC trustline).
3. NFT API upstream available if probing `/v1/nft-health` (default example).

## Unpaid (always)

```bash
# Terminal 1
npm run dev:all

# Terminal 2
npm --prefix services/depin run smoke
```

Expect:

- `/health` → `service: depin`
- `/status` → providers, `stateBackend`, `multiInstanceSafe`, `capabilities.settleReady`
- First provider unpaid → **HTTP 402** + `PAYMENT-REQUIRED`

Dashboard: project → **De-pin x402 Gateway** → **Probe 402**.

## Paid settle (optional)

1. Set facilitator to OZ Channels testnet and `OZ_API_KEY` in `.env`.
2. Fund `zexvro-buyer` with testnet USDC.
3. Run:

```bash
STELLAR_PRIVATE_KEY="$(stellar keys secret zexvro-buyer)" \
DEPIN_EXPECTED_RECIPIENT="$(stellar keys address zexvro-provider)" \
npm --prefix services/depin run demo:client
```

Record success (tx hash, amounts) in `memory.md`. Never commit secrets.

## Production notes

- Multi-process: `DEPIN_STATE_BACKEND=file` (or future redis).
- Managed config: `DEPIN_CONFIG_JSON` or `DEPIN_CONFIG_URL`.
- Do not claim Access Shield GA; gateway exact GET/HEAD is the shipped enforcement plane.
