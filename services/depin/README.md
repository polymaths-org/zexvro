# ZEXVRO De-pin Gateway

De-pin is a fail-closed reverse proxy for idempotent HTTP APIs. It uses x402 v2 `exact` payments over Stellar testnet USDC and the official `@x402/stellar` server implementation.

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
| `memory` (default) | Single-process only |
| `file` | Shared JSON file via `DEPIN_STATE_PATH` (default `.data/depin-state.json`) |
| `redis` | Reserved; not implemented yet |

Multi-instance hosts must not use `memory`.

V1 accepts concrete `GET` and `HEAD` routes only. Streaming, sessions, mutable POST compute, custom facilitators, physical-device adapters, and a provider marketplace remain outside this version.

```bash
npm install
npm run lint
npm test
npm run build
DEPIN_CONFIG_PATH=depin.config.json npm start
```

The gateway exposes `/health` for readiness and `/status` for the frontend setup screen. `/status` returns sanitized provider routes, prices, recipients, network, timeout policy, upstream origins, `configSource`, and `stateBackend`; it does not expose upstream secret values or secret reference names.

## Local testnet smoke test

The machine-local `depin.config.json` is ignored by Git. With the gateway and
its configured upstream running, an unpaid request should return HTTP `402`:

```bash
curl -i http://127.0.0.1:4102/v1/nft-health
```

From the frontend dev server, the same gateway is available through `/api/depin` when Vite is running. The project De-pin screen uses `/api/depin/status` and an unpaid probe request to verify that the standard `PAYMENT-REQUIRED` challenge is returned.

For a paid smoke test, fund the buyer identity with Stellar testnet USDC and
run the bounded demo client. The command substitution keeps the secret out of
the repository and shell history:

```bash
STELLAR_PRIVATE_KEY="$(stellar keys secret zexvro-buyer)" \
DEPIN_EXPECTED_RECIPIENT="$(stellar keys address zexvro-provider)" \
npm run demo:client
```

The demo refuses a recipient mismatch or a payment above `10000` atomic USDC
(`0.001 USDC`). Override `DEPIN_URL`, `DEPIN_EXPECTED_RECIPIENT`, or
`DEPIN_MAX_PAYMENT_ATOMIC` only when deliberately testing another route.
