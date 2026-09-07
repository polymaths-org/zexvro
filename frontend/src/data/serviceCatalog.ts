import type { Service } from '../types';

/**
 * CANONICAL SERVICE CATALOG — Single Source of Truth
 *
 * Every UI surface (sidebar, services page, landing, docs, agent KB)
 * MUST consume this array. Do NOT hardcode service lists elsewhere.
 *
 * Updated 2026-08-27 (Track A honesty pass):
 * LIVE (zexvro.in + console + on-chain verifiable):
 * - NFTo: mainnet WASM + App Runner + USDC checkout (ACTIVE)
 * - Zer0: 4 mainnet pool contracts + ZK prover + full product UI (ACTIVE)
 * - DEDSEC: x402 gateway on App Runner + probe dashboard (ACTIVE)
 * - Morph: Lambda chat + CLI + Agentic Ops dashboard (CONFIGURING — agent ready)
 * - REQWID: ECS gate API + Agent Auth page (CONFIGURING — gate ready)
 * PROPOSED (spec ready, NOT live — planned SCF #46 T2):
 * - ZEXVRO Node / Storage / Gas Relayer: status 'proposed', progress 10-15
 * - A2A Trade: REMOVED from MVP (not listed)
 * - ZDB: exploration track, NOT in this catalog (see context.md §6)
 */
export const serviceCatalog: Service[] = [
  {
    id: 'srv-privacy',
    name: 'Zer0',
    owner: 'Paris',
    status: 'active',
    description: 'Private payment flows with ZK proofs on Stellar. Deposit, settle, and prove without exposing transaction details.',
    progress: 85,
    lastActivity: 'Product UI live · 4 mainnet pool contracts',
    category: 'privacy',
  },
  {
    id: 'srv-transformation',
    name: 'Morph',
    owner: 'Paris',
    status: 'configuring',
    description: 'Web2→Web3 migration agent. Inspects repos, plans migration, executes with human approval.',
    progress: 55,
    lastActivity: 'Agent ready · CLI + dashboard dock live',
    category: 'transformation',
  },
  {
    id: 'srv-agent-auth',
    name: 'REQWID',
    owner: 'Rushi / Wraient',
    status: 'configuring',
    description: 'Dual-channel human/agent capability gate. Policy modes, SDK (@zexvro/gate), and anti-relay challenges.',
    progress: 50,
    lastActivity: 'Gate API live · Phase 1 scaffold complete',
    category: 'auth',
  },
  {
    id: 'srv-nft',
    name: 'NFTo',
    owner: 'Nabil',
    status: 'active',
    description: 'NFT collections on Stellar mainnet. Create, mint, and sell with embedded USDC/XLM checkout — no blockchain knowledge needed.',
    progress: 95,
    lastActivity: 'Mainnet live · WASM + App Runner + checkout',
    category: 'nft',
  },
  {
    id: 'srv-depin',
    name: 'DEDSEC',
    owner: 'Nabil',
    status: 'active',
    description: 'x402 paid-access gateway. Protect any HTTP API with per-request Stellar USDC micro-payments.',
    progress: 90,
    lastActivity: 'Gateway live · protect-route + probe dashboard',
    category: 'depin',
  },
  {
    id: 'srv-node-rpc',
    name: 'ZEXVRO Node',
    owner: 'Paris',
    status: 'proposed',
    description: 'Proposed — high-availability Soroban RPC & Horizon gateway with API-key auth and event indexing. Spec ready, 1-day wrapper.',
    progress: 15,
    lastActivity: 'Proposed · spec ready · not yet deployed (planned SCF T2)',
    category: 'rpc',
  },
  {
    id: 'srv-storage-ipfs',
    name: 'ZEXVRO Storage',
    owner: 'Paris',
    status: 'proposed',
    description: 'Proposed — decentralized IPFS & S3 storage drive. Unified upload endpoint + CDN links. 1-day build on existing Pinata/S3.',
    progress: 15,
    lastActivity: 'Proposed · spec ready · not yet deployed (planned SCF T2)',
    category: 'storage',
  },
  {
    id: 'srv-gas-relay',
    name: 'ZEXVRO Gas Relayer',
    owner: 'Paris',
    status: 'proposed',
    description: 'Proposed — fee-bump transaction sponsor. Developers spend ZCR to make end-user Soroban calls gasless. 2-day relayer endpoint.',
    progress: 10,
    lastActivity: 'Proposed · spec ready · not yet deployed (planned SCF T2)',
    category: 'relay',
  },
];
