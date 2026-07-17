# ZEXVRO De-pin Gateway

De-pin is a fail-closed reverse proxy for idempotent HTTP APIs. It uses x402 v2 `exact` payments over Stellar testnet USDC and the official `@x402/stellar` server implementation.

**Product framing for teammates:** De-pin is the economic enforcement plane of **ZEXVRO Access Shield**—helping platforms stop industrial free-tier farming and agent spam by requiring pay-per-request access. Full narrative, architecture, and non-goals: [`docs/access_shield.md`](../../docs/access_shield.md). The gateway MVP below is what is implemented today; Access Shield control-plane UI is proposed.

## Request flow

1. An unpaid request receives the standard x402 `402` response and `PAYMENT-REQUIRED` header.
2. A request with `PAYMENT-SIGNATURE` is verified by the configured facilitator.
3. De-pin claims the authorization fingerprint, calls the upstream with a timeout, and buffers a successful response.
4. The payment is settled. The facilitator sponsors the Stellar transaction fee.
5. Only a successful settlement releases the upstream body, together with `PAYMENT-RESPONSE`.

Upstream errors are not settled. Settlement failures never expose the buffered resource. Reused payment authorizations are rejected before a second upstream call.

## Configuration

For local development, keep environment variables in the repository-root
`.env` and start all services from the root when needed:

```bash
cp .env.example .env
npm run dev:all
```

Copy `depin.config.example.json` to `depin.config.json`, replace the recipient with the provider's Stellar G-address, and set any referenced secrets in the environment. Secret values are injected as `Authorization: Bearer ...` upstream and are never accepted from or returned to clients.

### Facilitator (Stellar x402)

- Local unpaid `402` probes can keep `facilitatorUrl: "https://x402.org/facilitator"`.
- For **real Stellar settlement** (testnet/mainnet), prefer OpenZeppelin Channels:
  - Testnet: `https://channels.openzeppelin.com/x402/testnet`
  - Mainnet: `https://channels.openzeppelin.com/x402`
- Set `OZ_API_KEY` (or `X402_FACILITATOR_API_KEY`) in the process environment. The gateway sends `Authorization: Bearer …` on facilitator `supported` / `verify` / `settle` calls. Generate a testnet key at [channels.openzeppelin.com/testnet/gen](https://channels.openzeppelin.com/testnet/gen).
- `payTo` is always a classic **G…** account (needs a USDC trustline). Do not put the USDC SAC **C…** address in `recipient`.

### Config sources (boot only)

Priority:

1. `DEPIN_CONFIG_JSON` — inline JSON (containers / Secrets Manager-injected env)
2. `DEPIN_CONFIG_URL` — HTTPS JSON document fetched once at startup
3. `DEPIN_CONFIG_PATH` — local file (default `depin.config.json`)

Production ownership: platform/ops owns the managed JSON document and secret env
names (`upstreamSecretRef`); service owners do not bake secrets into the image.

### Replay / rate-limit state

| `DEPIN_STATE_BACKEND` | Behavior |
| --- | --- |
| `memory` | Single-process only (not multi-instance safe) |
| `file` | Shared JSON file via `DEPIN_STATE_PATH` (default `.data/depin-state.json`) — **prefer for multi-process / production** |
| `redis` | Reserved; not implemented yet |

Root `.env.example` recommends `DEPIN_STATE_BACKEND=file`. Multi-instance hosts must not use `memory`. In `NODE_ENV=production` with memory, the gateway logs a warning unless `DEPIN_ALLOW_MEMORY_STATE=1`.

V1 accepts concrete `GET` and `HEAD` routes only. Streaming, sessions, mutable POST compute, custom facilitators, physical-device adapters, and a provider marketplace remain outside this version.

```bash
npm install
npm run lint
npm test
npm run build
DEPIN_CONFIG_PATH=depin.config.json npm start
```

The gateway exposes `/health` for readiness and `/status` for the frontend setup screen. `/status` returns sanitized provider routes, prices, recipients, network, timeout policy, upstream origins, `configSource`, `stateBackend`, `multiInstanceSafe`, and facilitator readiness (`settleReady`, `facilitatorAuthConfigured`, `facilitatorOzChannels`). It does not expose upstream secret values, secret reference names, or API keys.

## Local smoke (unpaid)

```bash
# From repo root (NFT API + De-pin + frontend)
cp .env.example .env   # if needed
cp services/depin/depin.config.example.json services/depin/depin.config.json
# set recipient to your provider G-address in depin.config.json
npm run dev:all

# In another terminal
npm --prefix services/depin run smoke
# or: DEPIN_URL=http://127.0.0.1:4102 node services/depin/scripts/smoke.mjs
```

Manual unpaid probe:

```bash
curl -i http://127.0.0.1:4102/v1/nft-health
```

From the frontend, open **Resource Gateway → De-pin x402 Gateway** and use **Probe 402**. The screen shows settle readiness and multi-instance state.

## Paid settle smoke

1. Prefer OpenZeppelin Channels facilitator URL in `depin.config.json` and set `OZ_API_KEY` in root `.env`.
2. Fund the buyer identity with Stellar testnet USDC.
3. Run the bounded demo client (keeps secrets out of history):

```bash
STELLAR_PRIVATE_KEY="$(stellar keys secret zexvro-buyer)" \
DEPIN_EXPECTED_RECIPIENT="$(stellar keys address zexvro-provider)" \
npm --prefix services/depin run demo:client
```

The demo refuses a recipient mismatch or a payment above `10000` atomic USDC
(`0.001 USDC`). Override `DEPIN_URL`, `DEPIN_EXPECTED_RECIPIENT`, or
`DEPIN_MAX_PAYMENT_ATOMIC` only when deliberately testing another route.


See also [`docs/depin_local_smoke.md`](../../docs/depin_local_smoke.md).

## Optional: ZEXVRO Gate capability (Access Shield plane 1)

De-pin does **not** classify humans/agents. When configured, it verifies a Gate capability token before payment, and can bind the x402 **payer** to `allowed_payer_pks`.

```json
{
  "capabilityGate": {
    "gateApiBase": "http://127.0.0.1:4103",
    "siteSecret": "sk_test_demo_secret_do_not_use_prod",
    "defaultMinClass": "agent",
    "bindPayer": true
  },
  "providers": [
    {
      "route": "/v1/weather",
      "method": "GET",
      "requireCapability": true,
      "capabilityAction": "depin.weather.get",
      "capabilityMinClass": "agent",
      "bindCapabilityPayer": true,
      "upstreamUrl": "https://api.example.com/weather",
      "description": "Weather behind Gate + pay",
      "price": "$0.001",
      "recipient": "G...",
      "network": "stellar:testnet",
      "timeoutMs": 5000
    }
  ]
}
```

Client headers: `X-Zexvro-Capability`, optional `X-Zexvro-Pop`, then `PAYMENT-SIGNATURE` as usual.
