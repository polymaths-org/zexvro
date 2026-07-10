import { Project, Deployment, Service, TeamMember, CollaborationNote, MemoryEntry, AuditLog, SecurityKey } from '../types';

// AI NOTE: Mock data has been cleaned. Only the 6 MVP service definitions remain
// as real product data. All fake team members, deployments, projects, metrics,
// and security keys have been removed. Screens should show clean empty states.

export const mockProjects: Project[] = [];

export const mockDeployments: Deployment[] = [];

export const mockServices: Service[] = [
  {
    id: 'srv-privacy',
    name: 'Zero-Knowledge Privacy Pool',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Private transaction workflow for companies that need Web3 verification without public transaction detail exposure.',
    progress: 0,
    lastActivity: 'Needs requirements',
    category: 'privacy'
  },
  {
    id: 'srv-trade',
    name: 'A-2-A Trade Pipeline',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Agent-to-agent negotiation and settlement pipeline. Protocol and wallet rules still need owner decisions.',
    progress: 0,
    lastActivity: 'Needs protocol draft',
    category: 'trade'
  },
  {
    id: 'srv-agent-auth',
    name: 'Captcha-like Agent Authentication Service',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Human vs agent access classification service with SDK/API direction. Privacy model and signals are not finalized.',
    progress: 25,
    lastActivity: 'Cognito sign-in/signup/reset UI connected',
    category: 'auth'
  },
  {
    id: 'srv-nft',
    name: 'NFT Service',
    owner: 'Unassigned',
    status: 'inactive',
    description: 'Simple NFT deployment and management flow for non-Web3 users such as indie game developers and small studios.',
    progress: 20,
    lastActivity: 'Local collection, contract, and API scaffolds verified',
    category: 'nft'
  },
  {
    id: 'srv-depin',
    name: 'De-pin',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Stellar x402 gateway for exact USDC payments that unlock HTTP API and compute resources for autonomous agents.',
    progress: 15,
    lastActivity: 'Local gateway scaffold verified',
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
