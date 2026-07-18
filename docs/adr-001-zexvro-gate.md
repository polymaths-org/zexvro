# ADR-001: ZEXVRO Gate dual-channel capability model

- **Status:** Proposed
- **Date:** 2026-07-17
- **Owner:** Rushi / `Wraient`
- **Service:** Captcha-like Agent Authentication → product **ZEXVRO Gate**

## Context

Platforms need to distinguish humans from agents **without** default-denying agents, and without allowing human solver farms to mint agent access (or agents to pass as humans). Classic CAPTCHA products optimize "probably human browser" and are relay-friendly.

## Decision

Build a **dual-channel capability gate**:

1. Separate **human** and **agent** ceremonies.
2. Issue short-lived JWTs with signed `class`, `act`, `aud`/`origin`, `jti`, optional Stellar payer claims.
3. Enforce **policy modes**: human_only | agent_only | either | dual_path.
4. Compose with De-pin for economics; do not mix payment into Gate v1 core.
5. Stellar is for **principal + payer binding**, not proof of humanness.

## Consequences

- SDK must ship agent HTTP path first-class.
- No image puzzles as the security core.
- Marketing must not claim perfect detection.
- De-pin must not reimplement classification (coordinate claims only).

## Alternatives considered

| Alt | Why rejected for v1 |
| --- | --- |
| reCAPTCHA-style score only | Agents forced to spoof; transferable |
| World ID only | Heavy UX; not general agent API gate |
| On-chain human NFT | Theater + friction |
| Pure behavioral biometrics | Privacy model incomplete |

## References

- `docs/agent_auth_local_demo.md`
- `docs/access_shield.md`
- `context.md` § Agent Authentication
