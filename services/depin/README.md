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

V1 accepts concrete `GET` and `HEAD` routes only. Streaming, sessions, mutable POST compute, custom facilitators, physical-device adapters, and a provider marketplace remain outside this version.

```bash
npm install
npm run lint
npm test
npm run build
DEPIN_CONFIG_PATH=depin.config.json npm start
```

The gateway exposes `/health` for readiness and `/status` for the frontend setup screen. `/status` returns sanitized provider routes, prices, recipients, network, timeout policy, and upstream origins; it does not expose upstream secret values or secret reference names.

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
