---
name: web2-web3
description: ZEXVRO Web2→Web3 migration fit map and implementation loop for any app.
compatibility: opencode
metadata:
  product: zexvro
  agent: morph
---

# Web2 → Web3 (ZEXVRO)

Migrate a real product. Don't bolt chain onto random features.

## Fit map

| Product signal | Service | Do |
| --- | --- | --- |
| Free abuse surface (scores, open writes, bots) | **Gate** | Captcha / agent path on that route |
| Collectibles, skins, ownership, trophies | **NFT** | Testnet collection + client unlock/mint |
| Paid scarce API (tips, coach, metered data) | **De-pin** | x402 unpaid→402 → pay → settle |
| Payroll privacy / ZK | **Zer0** | Only if user asks |

## Loop

1. **Scan** — find submit/mutation/config entrypoints
2. **Plan** — which services fit + files + user-visible outcome
3. **Implement** — small patches; app stays usable
4. **Prove** — MCP health tools + how to run/deploy that project
5. **Never** — mainnet, client secrets, "add blockchain" with no UX reason

## Order

1. Entrypoints (client submit, server mutation, mode/feature flags)
2. Wire services only where they earn their keep
3. Gate: public `siteKey` client-side; secret server/env only
4. NFT: unlock path after ownership / mint (testnet)
5. De-pin: optional paid surface; unpaid must 402

Demo apps in a monorepo (if any) are sample **migration targets** — same process as a customer codebase.
