import { Project, Deployment, Service, TeamMember, CollaborationNote, MemoryEntry, AuditLog, SecurityKey } from '../types';
import { serviceCatalog } from './serviceCatalog';

// AI NOTE: Mock data cleaned for VC readiness. Services are pulled from the
// canonical serviceCatalog (single source of truth). All other mock arrays are
// empty — screens should show clean empty states instead of fake data.
// A2A Trade is out of MVP.

export const mockProjects: Project[] = [];

export const mockDeployments: Deployment[] = [];

/**
 * @deprecated — Use `serviceCatalog` from `./serviceCatalog.ts` directly.
 * This re-export exists only for legacy consumers that still import from mock.
 */
export const mockServices: Service[] = serviceCatalog;

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
