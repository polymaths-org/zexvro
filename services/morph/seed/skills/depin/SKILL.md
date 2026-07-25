---
name: depin
description: Wire ZEXVRO De-pin x402 for paid scarce APIs (tips, coach, metered data).
compatibility: opencode
metadata:
  product: zexvro
  service: depin
---

# ZEXVRO De-pin (x402)

**Base:** App Runner De-pin · override `ZEXVRO_DEPIN_URL`  
**Network:** `stellar:testnet`

## Health

- `GET /health` · `GET /status` → `settleReady`, priced routes

## Pattern

1. Unpaid protected GET → **HTTP 402** + payment requirements
2. Client pays USDC (testnet) → retry with payment headers
3. Settled → resource body

## Morph

Optional paid tip / power-up. Probe with MCP `depin_probe` (expect 402).  
Skip if product has no paid surface.

## MCP

`depin_status`, `depin_probe`, `zexvro_health`
