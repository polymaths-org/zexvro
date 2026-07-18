# ZEXVRO Gate — Signals & Privacy (MVP)

**Status:** Proposed companion to Gate privacy posture (see ADRs + developer guide).  
**Owner:** Rushi / `Wraient`

## Purpose of processing

Issue and verify short-lived **capability tokens** so a tenant can enforce human vs agent **policy** on named actions. Not advertising. Not training foundation models by default.

## What we collect (MVP)

| Signal | Stored | Retention target | Why |
| --- | --- | --- | --- |
| Site id, action, decision, class, confidence | Yes | Days | Auth audit |
| Challenge id, jti, expiry | Yes | Hours–days (TTL) | Replay protection |
| Agent public key (registered) | Yes | Until revoked | Agent ceremony |
| Origin allowlist | Yes | Until changed | CSRF / multi-tenant safety |
| Coarse automation hints | Ephemeral / hashed | Hours | Soft risk only |
| Salted IP/ASN hash (optional) | Optional | Hours | Abuse rate limits |
| WebAuthn credential id (later) | Yes (not raw biometric) | Until user unlinks | Human hard step-up |

## What we do **not** collect in MVP

- Continuous mouse/keystroke biometrics
- Face or voice video
- Persistent cross-site device fingerprints as identity
- Page content from customer apps for model training
- Human Data Marketplace payloads (separate future product with consent architecture)

## User rights / tenant duties

- Tenants must disclose Gate use in their own privacy notice where required.
- Appeal path for false human denials (`/v1/appeals` — planned).
- Deletion: drop challenge rows by TTL; honor agent revoke; document secret rotation.

## Honesty

Confidence scores are **not** perfect detection. Policy + channel binding + economics (De-pin) do the heavy lifting.

## Related

- `context.md` Agent Auth boundaries
- `docs/agent_auth_DEVELOPER_GUIDE.md`
