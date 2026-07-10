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

Copy `depin.config.example.json` to `depin.config.json`, replace the recipient with the provider's Stellar G-address, and set any referenced secrets in the environment. Secret values are injected as `Authorization: Bearer ...` upstream and are never accepted from or returned to clients.

V1 accepts concrete `GET` and `HEAD` routes only. Streaming, sessions, mutable POST compute, custom facilitators, physical-device adapters, and a provider marketplace remain outside this version.

```bash
npm install
npm run lint
npm test
npm run build
DEPIN_CONFIG_PATH=depin.config.json npm start
```
