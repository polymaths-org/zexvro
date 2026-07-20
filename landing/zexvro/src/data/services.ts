import { ServiceItem } from '../types';

/** Six MVP services from ZEXVRO context.md */
export const activeServices: ServiceItem[] = [
  {
    id: 'zer0',
    name: 'Zer0',
    shortDesc: 'Zero-knowledge privacy for business payments',
    fullDesc:
      'Transaction privacy for teams that need Web3 settlement without public exposure. Dashboard, pay flows, proofs, and stealth tooling — enterprise-grade privacy without the jargon.',
    iconName: 'ShieldCheck',
    techDetails: ['ZK proofs', 'Stealth addresses', 'Pay party', 'Compliance view-keys'],
    hologramColor: 'from-violet-500/20 via-purple-500/10 to-transparent',
  },
  {
    id: 'morph',
    name: 'Morph',
    shortDesc: 'Transformation agent for Web2 → Web3 migration',
    fullDesc:
      'Inspect repos, explain migration work, and deploy through CLI and web. Shared memory between agents so ZEXVRO stays agent-first — not a bolt-on chatbot.',
    iconName: 'Zap',
    techDetails: ['CLI + web agent', 'Repo inspection', 'Persistent memory', 'Deploy assist'],
    hologramColor: 'from-amber-500/20 via-orange-500/10 to-transparent',
  },
  {
    id: 'a2a',
    name: 'A2A Trade',
    shortDesc: 'Agent-to-agent negotiation and settlement',
    fullDesc:
      'Trusted pipeline for agents to approach, negotiate, and complete trades with clear identity, offer state, and settlement boundaries — without blind custody.',
    iconName: 'RefreshCw',
    techDetails: ['Offer / counteroffer', 'Identity bounds', 'Settlement state', 'Auth rules'],
    hologramColor: 'from-cyan-500/20 via-teal-500/10 to-transparent',
  },
  {
    id: 'agent-auth',
    name: 'Agent Auth',
    shortDesc: 'Human vs agent classification for product flows',
    fullDesc:
      'SDK/API that labels internet users as human or agent with confidence scores. Foundation for HDM-style human data markets and gated access — without claiming perfect detection.',
    iconName: 'UserCheck',
    techDetails: ['SDK / API', 'Confidence scores', 'Appeal flow', 'Privacy model'],
    hologramColor: 'from-blue-500/20 via-indigo-500/10 to-transparent',
  },
  {
    id: 'nft',
    name: 'NFT Service',
    shortDesc: 'Deploy and sell NFTs without chain complexity',
    fullDesc:
      'Guided collection create, mint, sale, and embed checkout on Stellar/Soroban. Built for indie studios and product teams who want NFTs — not wallets and gas lectures.',
    iconName: 'Coins',
    techDetails: ['Soroban collections', 'USDC checkout', 'Embed SDK', 'Studio analytics'],
    hologramColor: 'from-pink-500/20 via-purple-500/10 to-transparent',
  },
  {
    id: 'depin',
    name: 'De-pin',
    shortDesc: 'x402 paid access gateway for APIs & compute',
    fullDesc:
      'HTTP 402 payment challenges in front of resources. Verify Soroban auth, settle USDC per request, fail closed — economic access control for agent traffic and free-tier abuse.',
    iconName: 'CreditCard',
    techDetails: ['x402 v2', 'USDC exact', 'Replay protection', 'Access Shield'],
    hologramColor: 'from-emerald-500/20 via-teal-500/10 to-transparent',
  },
];

export const comingSoonServicesCount = 0;
