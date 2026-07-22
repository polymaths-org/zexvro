# Capability ↔ De-pin payment binding (Proposed contract)

**Owners:** Rushi (claims/issuer), Nabil (edge enforce)  
**Status:** Proposed — do not merge De-pin classifier logic

## Three addresses

| Field | Meaning |
| --- | --- |
| `payTo` / provider `recipient` | Merchant receives USDC |
| x402 **payer** G… | Who pays this request |
| capability `stellar_pk` | Who is authorized (agent/human principal) |

## Edge order

```text
1. Verify X-Zexvro-Capability (sig, exp, jti, site, action, class vs policy)
2. If route paid: require PAYMENT-SIGNATURE (existing x402)
3. Extract payer G… from verified payment
4. Require payer ∈ capability.allowed_payer_pks (or == stellar_pk when pay_mode=self)
5. Settle → release (existing fail-closed)
```

## Failure codes

| Condition | HTTP | Notes |
| --- | --- | --- |
| Missing capability | 401 / 428 | Identity; include challenge URL if 428 |
| Policy class deny | 403 | Not a CAPTCHA |
| Missing payment | 402 | Unchanged De-pin |
| Payer not allowlisted | 403 `payer_mismatch` | Fail closed before settle |

## Claim fields (Gate → edge)

- `class`, `act`, `site_id`, `jti`, `exp`
- `stellar_pk`, `pay_mode` (`self`|`sponsored`|`none`)
- `allowed_payer_pks: string[]`
- `depin_network` (optional, reject cross-network)

## Non-goals

- Binding to `payTo`
- Payment upgrades principal class
- Classifier inside `services/depin`

See `docs/agent_auth_DEVELOPER_GUIDE.md` and ADRs for Stellar payer claims.


## Implementation status (2026-07-17)

**Shipped in `services/depin`:**

- `capabilityGate.ts` — remote Gate `/v1/verify` + `assertPayerAllowed` + payer extract
- Provider flags: `requireCapability`, `capabilityAction`, `capabilityMinClass`, `bindCapabilityPayer`
- Config: top-level `capabilityGate`
- Order: capability → payment authorize → payer bind → upstream → settle

No classifier was added under De-pin (ownership preserved).
