export interface Project {
  id: string;
  name: string;
  status: 'active' | 'deploying' | 'failed' | 'paused';
  serviceUsage: string[];
  region: string;
  network: string;
  lastDeployment: string;
  owner: string;
  branch: string;
  framework: string;
}

export interface Deployment {
  id: string;
  projectName: string;
  commitHash: string;
  commitMessage: string;
  status: 'Live' | 'Building' | 'Failed' | 'Pending';
  timestamp: string;
  duration: string;
  author: string;
  logs: string[];
}

export interface Service {
  id: string;
  name: string;
  owner: string;
  status: 'active' | 'configuring' | 'inactive';
  description: string;
  progress: number;
  lastActivity: string;
  category: 'privacy' | 'transformation' | 'trade' | 'auth' | 'nft' | 'depin';
}

export interface TeamMember {
  id: string;
  name: string;
  alias: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Developer' | 'Viewer' | 'Agent';
  status: 'active' | 'invited' | 'inactive';
  lastActive: string;
  servicesOwned: string[];
}

export interface CollaborationNote {
  id: string;
  author: string;
  timestamp: string;
  currentState: string;
  nextStep: string;
  filesToInspect: string[];
  doNotTouch: string[];
  ownerNeeded: string;
}

export interface MemoryEntry {
  id: string;
  service: string;
  filesChanged: string[];
  summary: string;
  decisions: string[];
  followUps: string[];
  blockers: string[];
  verification: string;
  date: string;
  owner: string;
  label: 'decision' | 'blocker' | 'handoff' | 'general';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  status: 'success' | 'warning' | 'failed';
  ip: string;
}

export interface SecurityKey {
  id: string;
  name: string;
  keyPrefix: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
  owner: string;
}

export type ThemeType = 'system' | 'light' | 'dark';
export type DensityType = 'comfortable' | 'compact';

export type CollectionStatus = 'draft' | 'deploying' | 'live' | 'failed';

export interface NftCollectionDraft {
  name: string;
  symbol: string;
  description: string;
  coverName: string;
  royaltyBps: number;
}

export interface NftCollection extends NftCollectionDraft {
  id: string;
  workspaceId: string;
  itemCount: number;
  status: CollectionStatus;
  createdAt: string;
}
