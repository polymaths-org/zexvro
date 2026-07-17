# ZEXVRO Gate — Final Implementation Plan (2026-07-17)

This is the consolidated plan for the Captcha-like Agent Authentication product (**ZEXVRO Gate**).

## Goal

Painless, good-looking, secure dual-channel access control:

- Developers drop SDK and protect **any action**
- Classify **human vs agent** (honest, not perfect detection)
- **Do not** default-deny agents
- **Humans cannot solve for agents** and **agents cannot solve for humans**
- Optional **Stellar** for agent identity + De-pin payment binding

## Product model

| Concept | Detail |
| --- | --- |
| Name | **ZEXVRO Gate** (route may stay `/agent-auth`) |
| Header | `X-Zexvro-Capability` |
| Agent PoP | `X-Zexvro-Pop` / verify `pop` body |
| Policies | `human_only` · `agent_only` · `either` |
| Human prod soft | **session_pop** (Ed25519 key possession) |
| Human prod hard | **WebAuthn** (next) |
| Human dev | soft_confirm (disabled in production) |
| Agent | Registered Ed25519 + challenge sign + PoP |

## Architecture

```text
SDK (browser / agent) → Gate API → capability JWT
Customer origin → verify(action, minClass, pop?)
Optional De-pin → pay if expensive → origin
```

## Stellar

- Agents: public keys (`G…` / Ed25519)
- Claims: `stellar_pk`, `pay_mode`, `allowed_payer_pks`
- De-pin binds **payer**, not merchant `payTo`
- Never: wallet ⇒ human

## Repo map

| Path | Role |
| --- | --- |
| `services/agent-auth/` | API |
| `packages/agent-auth-sdk/` | `@zexvro/gate` + middleware |
| `docs/adr-002-gate-protocol-v0.2.md` | Freezes |
| `docs/agent_auth_implementation_plan.md` | Long plan |
| `docs/agent_auth_production_ops.md` | Deploy |
| `docs/agent_auth_ui_spec.md` | UI |
| `docs/agent_auth_depin_bind.md` | Access Shield bind |

## Commands

```bash
npm run dev:agent-auth
npm run test:agent-auth
npm run agent-auth:smoke
# optional stack
node scripts/dev.mjs --with-agent-auth
```

## Milestone status

| M | Item | Status |
| --- | --- | --- |
| M1 | Dual-channel + jti budget + Ed25519 + PoP | **Done** (tests 21) |
| M1b | session_pop human + Dynamo codec + middleware | **Done** |
| M2 | DX polish / publish | Middleware + browser helper + widget |
| M3 | WebAuthn | Pending |
| M4 | Cognito admin | **Implemented** (GATE_ADMIN_REQUIRE_AUTH + Cognito JWT on admin routes) |
| M5 | De-pin payer enforce | Pending (Nabil) |
| M6 | App Runner + Dynamo live | **Dynamo+Secret created**; App Runner image pending |

## Security honesty

| Claim | OK? |
| --- | --- |
| Cross-class mint blocked | Yes |
| Agent auth with PoP | Yes |
| String CAPTCHA anti-farm | **No** |
| session_pop stops farms | Partial (anti-relay; not liveness) |
| Perfect detection | **No** |

## DX target

Time-to-first-protect < 10 minutes:

1. Start Gate
2. Demo keys
3. `protect` / `verify` or middleware
4. Register agent key for agent path

## Next engineering order

1. WebCrypto `session_pop` helper in browser SDK  
2. WebAuthn hard human ceremony  
3. Dynamo DocumentClient + App Runner  
4. De-pin middleware flag with Nabil  
5. Design partner dogfood  



## AWS resources (live 2026-07-17)

| Resource | Value |
| --- | --- |
| DynamoDB | `zexvro-agent-auth` ACTIVE (pk/sk, TTL `ttl`) |
| Secret | `zexvro/agent-auth/issuer-signing` |
| ECR | `290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-agent-auth` |
| IAM instance | `arn:aws:iam::290294660486:role/zexvro-gate-apprunner-instance` |
| IAM ECR access | `arn:aws:iam::290294660486:role/zexvro-gate-apprunner-ecr-access` |
| App Runner service | **pending** (needs docker build/push) |

Runtime: `GATE_STATE_BACKEND=dynamo` · DocumentClient in `repository.dynamo.ts`



## WebAuthn endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/webauthn/register/options` | Passkey registration options |
| POST | `/v1/webauthn/register/verify` | Store credential |
| POST | `/v1/challenges/:id/webauthn-options` | Auth options for challenge |
| POST | `/v1/challenges/:id/complete` `proofType=webauthn` | Complete hard human ceremony |


## Admin auth

| Env | Meaning |
| --- | --- |
| `GATE_ADMIN_REQUIRE_AUTH` | Default **true** in production, **false** in dev |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | Shared platform Cognito |

Protected when auth required: `/v1/admin/*`, `/v1/webauthn/register/*`.
Public: `/health`, `/status`, `/v1/challenges*`, `/v1/verify`.


## De-pin composition (shipped)

Optional per-provider flags in De-pin config:

- `requireCapability: true`
- `capabilityAction`, `capabilityMinClass`
- `bindCapabilityPayer: true`
- top-level `capabilityGate: { gateApiBase, siteSecret, bindPayer }`

See `services/depin/README.md` and `services/depin/src/capabilityGate.ts`.


## Deploy blockers (2026-07-17)

- Local Docker daemon: inactive  
- CodeBuild: account concurrent builds = **0**  
- Script ready: `npm run gate:deploy` (`scripts/deploy-agent-auth-codebuild.mjs`)


## Post-critique hardening (2026-07-17 ~02:30 IST)

Dual-agent security + DX review drove these **Accepted** changes:

| Fix | Status |
| --- | --- |
| Atomic `completeChallengeIfPending` (memory + Dynamo CAS) | **Done** |
| Agent `clientPublicKey === agentPublicKey` | **Done** |
| Honest `conf` / ceremony_strength by proof type (not fake ML) | **Done** |
| Human maxReuse default **1** (webauthn 3) | **Done** |
| Request-bound Pop via `expectedHtm/Htu/bodyHash` | **Done** |
| Optional `requireHumanPop` for session human presentation | **Done** |
| SDK: soft_confirm requires `allowInsecureDev`; `gateFetch` | **Done** |
| Middleware wires `requirePop` + expected request binding | **Done** |
| WebAuthn tasks copy no longer says "not implemented" | **Done** |

### Remaining honest gaps

1. Human soft/WebAuthn JWT is still **bearer after mint** unless origin enforces `requireHumanPop` + session key Pop.
2. Gate alone cannot see the real HTTP request — origin must pass `expectedHtu` etc.
3. App Runner public Gate URL blocked until CodeBuild concurrent builds quota > 0 (request PENDING) or Docker starts.
4. Publish `@zexvro/gate` to npm; dashboard CRUD still scaffold.
5. SEP-10 optional Stellar link not implemented (claims + De-pin payer bind only).

### Tests

- agent-auth: **33** green
- depin: **38** green
