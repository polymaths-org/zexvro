# Handshake — Detailed Service Document

> Product name: **Handshake** · code: `services/handshake/` · catalog `srv-handshake`
> Status: **In development** · Owner: ZEXVRO (platform)
> Frontend status: `configuring` / "In development" · category `handshake`

---

## 1. Problem

Developers learn smart contracts by reading real code, not docs. Today that is fragmented:

- Explorers show bytecode/addresses but not readable, function-by-function source.
- GitHub holds source but has no chain → contract ID → deployed instance binding.
- Publishing a contract (mainnet vs testnet) has no shared "submit once, discoverable everywhere" hub.

**Handshake's thesis:** a single, code-specified, chain-aware hub where every contract is addressable by **chain + contract ID + network**, with source and function views, and where anyone who builds can **publish** and anyone who learns can **read, modify, and fork**.

## 2. One-line definitions

- **For marketing:** _The GitHub for smart contracts — discover, read, and publish contracts by chain and contract ID._
- **For product:** _A content platform whose primitive is a contract's source, split chain → contract → function, indexed by chain + network + contract ID._
- **For agents:** _Plain JSON API + indexer so humans and coding agents can look up how a function is built and fork it._

## 3. MVP intent (what "done" means for v0)

1. **Submit / publish** — an authenticated user can publish a contract by providing chain, network (mainnet / testnet / custom RPC label), contract ID/address, and source (inline or repo URL). No gatekeeping; testnet and mainnet are equally first-class.
2. **Discover** — anyone can browse/search/paginate contracts by chain, network, name, tag, and free text; open a contract page and see chain + contract ID + copy button.
3. **Read function-by-function** — contract page renders the source partitioned into functions with signatures, docs, and anchored source slices. Chain-to-chain and function-to-function navigation is explicit.
4. **Fork / modify** — "Fork" clones source into the user's context with provenance (`originContractId`, `originChain`) so the learner can edit without mutating the origin.
5. **Contract ID as identity** — every view surfaces the on-chain identifier (Stellar `C…`, EVM `0x…`, etc.) and its network; copy and deep-link work.

Non-goals for v0: formal verification, audit badges, cross-chain deployment, fee/monetization.

## 4. Who it is for

- Builders who want to study how real contracts are structured before writing their own.
- Teams publishing reusable contract code who want discoverability beyond their own repo.
- Agents that need to look up a contract's implementation detail to reason about integration.

## 5. Architecture (proposed — not yet built)

```
Publish → API Gateway (Cognito) → Handshake API
                                ├─ Registry (DynamoDB): contract meta + function index
                                ├─ Source store (S3 + CloudFront, or ZDB shards for verifiability)
                                ├─ Indexer (optional v0.1): existence check via RPC by chain/network
                                └─ Search (Dynamo GSI + later OpenSearch)
Read    → GET /v1/handshake/contracts/:id?chain=&network=  → source + function slices
Browse  → GET /v1/handshake/contracts?chain=&network=&q=
Fork    → POST /v1/handshake/contracts/:id/fork  (provenance link)
```

**Choice notes:**

- Stellar is the first chain (consistent with ZEXVRO rails), but the data model is chain-prefixed from day one.
- Source storage reuses the NFTo pattern (S3 + CloudFront, content-addressed) or ZDB CID shards when verifiability is desired — decision recorded before build.
- Verification is additive (badge/existence check), never a precondition for listing.

## 6. API shape (draft — subject to ADR)

```
POST   /v1/handshake/contracts               { chain, network, contractId, name, source|sourceUrl, description, tags, license }
GET    /v1/handshake/contracts               ?chain=&network=&q=&tag=&sort=recent|popular&page=&limit=
GET    /v1/handshake/contracts/:id           ?chain=&network=  → { contract, functions, source }
GET    /v1/handshake/contracts/:id/source    → raw source
POST   /v1/handshake/contracts/:id/fork      → { newContractDraftId, originContractId }
PUT    /v1/handshake/contracts/:id           (owner only)
DELETE /v1/handshake/contracts/:id           (owner only)
```

Auth: Cognito access token for publish/fork/mutate; read/browse is public. Workspace scoping follows the platform's workspace model.

## 7. Trust & safety

- Submitter attests they have rights to publish the source; license field is required.
- On-chain existence is checked via public RPC when an indexer exists; failure is shown as "unverified — not found on <chain> <network>" rather than a block.
- No claim of audit, correctness, or endorsement. Display is "as published, learn from the code."

## 8. Roadmap

- **v0.1 (registry):** publish + browse + read + copy contract ID; chain = `stellar`, networks `pubnet|testnet`; S3 solo, no indexer.
- **v0.2 (functions):** function splitter/AST view, anchor links, fork with provenance, search GSI.
- **v0.3 (multi-chain):** add `eip155` chains, per-chain RPC config, chain facet on browse.
- **v0.4 (verification):** RPC existence checks, optional source attestation (hash match), IPFS/ZDB replication option.
- **v0.5 (social):** stars, remixes graph, activity feed, MCP/skill for agents.

## 9. Agent boundaries

- Do not claim multi-chain verification or audit guarantees without the indexer/attestor being live.
- Do not auto-execute or deploy contracts on behalf of users without explicit approval + audit log.
- Document any new storage/search dependency versus reusing S3/Dynamo/ZDB.
