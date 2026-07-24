import { Project, Deployment, Service, TeamMember, CollaborationNote, MemoryEntry, AuditLog, SecurityKey } from '../types';

// AI NOTE: Mock data has been cleaned. Only the 5 MVP service definitions remain
// as real product data. All fake team members, deployments, projects, metrics,
// and security keys have been removed. Screens should show clean empty states.
// A-2-A Trade is out of MVP (scaffold may remain in routes).

export const mockProjects: Project[] = [];

export const mockDeployments: Deployment[] = [];

export const mockServices: Service[] = [
  {
    id: 'srv-privacy',
    name: 'Zer0',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Private transaction workflow for companies that need Web3 verification without public transaction detail exposure.',
    progress: 0,
    lastActivity: 'Needs requirements',
    category: 'privacy'
  },
  {
    id: 'srv-transformation',
    name: 'Morph',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Repository inspection and Web2-to-Web3 migration planning with human approval before any code-changing action.',
    progress: 10,
    lastActivity: 'Read-only planning available',
    category: 'transformation'
  },
  {
    id: 'srv-agent-auth',
    name: 'REQWID',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Dual-channel human/agent capability gate with policy modes, SDK (@zexvro/gate), and anti-relay challenges. Not a puzzle CAPTCHA.',
    progress: 45,
    lastActivity: 'Gate API + captcha engine on main',
    category: 'auth'
  },
  {
    id: 'srv-nft',
    name: 'NFTo',
    owner: 'Unassigned',
    status: 'inactive',
    description: 'Simple NFT deployment and management flow for non-Web3 users such as indie game developers and small studios.',
    progress: 20,
    lastActivity: 'Local collection, contract, and API scaffolds verified',
    category: 'nft'
  },
  {
    id: 'srv-depin',
    name: 'DEDSEC',
    owner: 'Platform',
    status: 'configuring',
    description: 'Stellar x402 gateway for exact USDC payments that unlock HTTP API and compute resources for autonomous agents.',
    progress: 70,
    lastActivity: 'Gateway + dashboard probe live',
    category: 'depin'
  }
];

export const mockTeamMembers: TeamMember[] = [];

export const mockCollaborationNotes: CollaborationNote[] = [];

export const mockMemoryEntries: MemoryEntry[] = [];

export const mockAuditLogs: AuditLog[] = [];

export const mockSecurityKeys: SecurityKey[] = [];

export const requestAnalytics = [
  { name: 'Mon', requests: 0, errors: 0, latency: 0 },
  { name: 'Tue', requests: 0, errors: 0, latency: 0 },
  { name: 'Wed', requests: 0, errors: 0, latency: 0 },
  { name: 'Thu', requests: 0, errors: 0, latency: 0 },
  { name: 'Fri', requests: 0, errors: 0, latency: 0 },
  { name: 'Sat', requests: 0, errors: 0, latency: 0 },
  { name: 'Sun', requests: 0, errors: 0, latency: 0 }
];

export const serviceAdoptionData: { name: string; value: number; color: string }[] = [];

export const agentRunsData: { name: string; transform: number; deploy: number; audit: number }[] = [];

export const memberPerformanceData: { name: string; runs: number; projects: number; keys: number }[] = [];
