# Handshake

Owner: ZEXVRO / platform  
Status: **In development** — 2026-09-09  
Code path: `services/handshake/`  
Catalog: `srv-handshake` · category `handshake` · status `configuring` (frontends show "In development")

> **One sentence:** Handshake is a GitHub-like, code-first discovery platform for smart contracts — look up any contract by chain and contract ID, read function-by-function how it is built, fork it, and publish your own.

## What it is

- **Discover** — browse/search contracts across chains (Stellar primary, multi-chain roadmap) by contract ID / address, chain, network (mainnet / testnet / custom).
- **Read** — source-first view: contract → chain context → function list → annotated source. Contract ID is always visible and copyable.
- **Modify / fork** — copy a contract's code into your workspace, edit functions, test locally, and keep provenance to the origin.
- **Publish** — submit/publish your own contracts to Handshake. You bring the code; Handshake indexes the contract ID + chain + network and makes it discoverable. Works for both mainnet and testnet publishes.

Code is the product. The platform is for builders who want to **learn from real contracts**, not marketing pages.

## Current scope (wired — 2026-09-15)

- **SpacetimeDB backend live:** `zexvro-handshake` on `maincloud` (identity `c200b97fd7…b17`, dashboard https://spacetimedb.com/zexvro-handshake) — Rust module at `services/handshake/spacetimedb/` with `handshake_contract` + `handshake_stats` tables, BTree indexes on `chain`/`network`/`contract_id`/`owner`/`name`/`language`/`verified`/`created_at`/`updated_at`, `contract_key` unique (`chain:network:contract_id` lower), materialized `total` O(1).
- **Wired frontend:** `services/handshake/handshake/` now uses `spacetimedb@2.10` + generated bindings `src/spacetime/` + `src/spacetime/handshakeClient.ts` (`subscribeHandshakeContracts` live + `publishViaHandshake` transactional). `src/context/AppContext.tsx` subscribes and replaces `seedContracts` when live data exists; `src/pages/PublishWizardPage.tsx` publishes via `publish_contract` reducer (fallback to local if offline). Seed of 8 demo contracts already published (soroban-amm, passkey-vault, …).
- **Builds:** `cargo check` on `spacetimedb` clean, `vite build` 820KB OK, `tsc --noEmit` OK. Env `VITE_SPACETIMEDB_HOST` / `VITE_SPACETIMEDB_HANDSHAKE_DB` (set to `off` for local seed only).

Legacy scope:
- Service registry entry (`frontend/src/data/serviceCatalog.ts` `srv-handshake`, `frontend/src/types.ts` category `handshake`, `Services.tsx` meta).
- No chain indexer / verification yet. `SERVICE.md` remains source of truth for intent.

## Planned surface (when building)

- Contract submission: `POST /v1/handshake/contracts` — {chain, network, contractId, source / sourceUrl, name, description, tags, license}
- Contract read: `GET /v1/handshake/contracts/:id` (+ `?chain=&network=`), function list + source blocks, raw source download
- Browse: `GET /v1/handshake/contracts?chain=&q=&network=&tag=&sort=recent|popular`
- Fork: `POST /v1/handshake/contracts/:id/fork` → workspace copy with `originContractId`
- Verification hook (roadmap): optional on-chain existence check + source attestation; never gate discoverability on verification alone

## Data model (draft)

```
Contract {
  id, chain, network, contractId, name, publisherId,
  source, language, functions: Function[],
  originContractId?, createdAt, updatedAt, visibility
}
Function { name, signature, docs, sourceSlice, lineRange }
```

## Agent note

- Do not claim mainnet verification, cross-chain execution, or audit guarantees until an indexer + verifier is actually deployed.
- Prefer content-addressed source storage (ZDB / S3 + CloudFront pattern from NFTo) when storage is chosen; document why if another store is needed.
- Keep chain semantics explicit: `stellar:pubnet` vs `stellar:testnet` vs `eip155:1` — never collapse to "mainnet" without a chain prefix.
