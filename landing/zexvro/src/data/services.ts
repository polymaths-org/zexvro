import { ServiceItem } from '../types';
import { serviceLogoUrl } from '../lib/serviceAssets';

function logos(id: string) {
  return {
    logo32: serviceLogoUrl(id, 32),
    logo64: serviceLogoUrl(id, 64),
    logo: serviceLogoUrl(id, 256),
  };
}

/** Five MVP services from ZEXVRO context.md (A2A removed from MVP) */
export const activeServices: ServiceItem[] = [
  {
    id: 'zer0',
    name: 'Zer0',
    headline: 'Private by default. Verifiable when it matters.',
    shortDesc: 'Zero-knowledge privacy for business payments',
    fullDesc:
      'Transaction privacy for teams that need Web3 settlement without public exposure. Dashboard, pay flows, proofs, and stealth tooling — enterprise-grade privacy without the jargon.',
    iconName: 'ShieldCheck',
    techDetails: ['ZK proofs', 'Stealth addresses', 'Pay party', 'Compliance view-keys'],
    hologramColor: 'from-violet-500/20 via-purple-500/10 to-transparent',
    what: 'Private settlement for business payments — dashboards, pay flows, ZK proofs, and stealth tooling in one place.',
    forWho: 'Finance and ops teams that need Web3 settlement without public exposure.',
    why: 'Private by default, verifiable when it matters — compliance view-keys keep it auditable without leaking the ledger.',
    ...logos('zer0'),
  },
  {
    id: 'morph',
    name: 'Morph',
    headline: 'Turn Web2 into Web3 — step by step.',
    shortDesc: 'Transformation agent for Web2 → Web3 migration',
    fullDesc:
      'Inspect repos, explain migration work, and deploy through CLI and web. Shared memory between agents so ZEXVRO stays agent-first — not a bolt-on chatbot.',
    iconName: 'Zap',
    techDetails: ['CLI + web agent', 'Repo inspection', 'Persistent memory', 'Deploy assist'],
    hologramColor: 'from-amber-500/20 via-orange-500/10 to-transparent',
    what: 'An agent that inspects your repos, explains the migration work, and deploys — through CLI or web.',
    forWho: 'Web2 product teams starting a Web3 migration without an in-house chain team.',
    why: 'Step-by-step transformation with persistent agent memory — a guided path, not a rewrite.',
    ...logos('morph'),
  },
  {
    id: 'reqwid',
    name: 'REQWID',
    headline: 'Know who — or what — is calling.',
    shortDesc: 'Human vs agent classification for product flows',
    fullDesc:
      'SDK/API that labels internet users as human or agent with confidence scores. Foundation for HDM-style human data markets and gated access — without claiming perfect detection.',
    iconName: 'UserCheck',
    techDetails: ['SDK / API', 'Confidence scores', 'Appeal flow', 'Privacy model'],
    hologramColor: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    what: 'SDK/API that labels traffic as human or agent, with confidence scores and an appeal flow.',
    forWho: 'Product and API teams who gate access, fight bot abuse, or build human-data flows.',
    why: 'Know who — or what — is calling, and gate or price it accordingly, without claiming perfect detection.',
    ...logos('reqwid'),
  },
  {
    id: 'nfto',
    name: 'NFTo',
    headline: 'Ship NFTs without the chain lecture.',
    shortDesc: 'Deploy and sell NFTs without chain complexity',
    fullDesc:
      'Guided collection create, mint, sale, and embed checkout on Stellar/Soroban. Built for indie studios and product teams who want NFTs — not wallets and gas lectures.',
    iconName: 'Coins',
    techDetails: ['Soroban collections', 'USDC checkout', 'Embed SDK', 'Studio analytics'],
    hologramColor: 'from-pink-500/20 via-purple-500/10 to-transparent',
    what: 'Guided collection create, mint, sale, and embed checkout on Stellar/Soroban.',
    forWho: 'Indie studios, creators, and product teams that want NFTs — not wallets and gas lectures.',
    why: 'USDC checkout and an embed SDK mean you ship NFTs with zero chain complexity.',
    ...logos('nfto'),
  },
  {
    id: 'dedsec',
    name: 'DEDSEC',
    headline: 'Charge for API access, automatically.',
    shortDesc: 'x402 paid access gateway for APIs & compute',
    fullDesc:
      'HTTP 402 payment challenges in front of resources. Verify Soroban auth, settle USDC per request, fail closed — economic access control for agent traffic and free-tier abuse.',
    iconName: 'CreditCard',
    techDetails: ['x402 v2', 'USDC exact', 'Replay protection', 'Edge enforcement'],
    hologramColor: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    what: 'x402 payment challenges in front of your resources — Soroban auth verified, USDC settled per request.',
    forWho: 'API and compute providers dealing with agent traffic and free-tier abuse.',
    why: 'Economic access control that fails closed — every request paid, verified, and replay-protected.',
    ...logos('dedsec'),
  },
];

/** ZEXVRO Labs — learning track surfaced in the carousel (not one of the 5 MVP services). */
export const labsService: ServiceItem = {
  id: 'labs',
  name: 'ZEXVRO Labs',
  headline: 'Learn Web3 by building it.',
  shortDesc: 'Hands-on Web3 learning track',
  fullDesc:
    'Learn Web3 by building — not by lectures. Guided labs, badges, and certificates at labs.zexvro.in.',
  iconName: 'GraduationCap',
  techDetails: ['Guided labs', 'Badges & certs', 'Projects', 'Know the stack'],
  hologramColor: 'from-indigo-500/20 via-violet-500/10 to-transparent',
  href: 'https://labs.zexvro.in',
  what: 'Hands-on Web3 learning track with guided labs, badges, and certificates.',
  forWho: 'Developers and teams who need to understand the stack before building on it.',
  why: 'Learn Web3 by building it — not by lectures.',
  ...logos('zer0'),
};

export const comingSoonServicesCount = 0;
