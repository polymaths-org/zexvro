import { Project, Deployment, Service, TeamMember, CollaborationNote, MemoryEntry, AuditLog, SecurityKey } from '../types';

// AI NOTE: This file intentionally uses product-safe placeholders, not production metrics.
// Keep values realistic for a setup workspace and avoid claims that live blockchain/backend systems exist.

export const mockProjects: Project[] = [
  {
    id: 'proj-platform-ui',
    name: 'zexvro-platform-ui',
    status: 'active',
    serviceUsage: ['Transformation Agent', 'Agent Memory'],
    region: 'Local prototype',
    network: 'Network not connected',
    lastDeployment: 'Not deployed',
    owner: 'Workspace',
    branch: 'main',
    framework: 'Vite + React'
  },
  {
    id: 'proj-service-contracts',
    name: 'service-contract-drafts',
    status: 'paused',
    serviceUsage: ['Zero-Knowledge Privacy Pool', 'Captcha-like Agent Authentication Service'],
    region: 'Architecture draft',
    network: 'TBD',
    lastDeployment: 'Needs backend scope',
    owner: 'Unassigned',
    branch: 'docs/service-contracts',
    framework: 'OpenAPI draft'
  },
  {
    id: 'proj-agent-memory',
    name: 'agent-memory-workflow',
    status: 'active',
    serviceUsage: ['Transformation Agent', 'Memory'],
    region: 'Repository docs',
    network: 'None',
    lastDeployment: 'Documented in memory.md',
    owner: 'Workspace Agent',
    branch: 'main',
    framework: 'Markdown + future API'
  },
  {
    id: 'proj-depin-scope',
    name: 'depin-scope-placeholder',
    status: 'paused',
    serviceUsage: ['De-pin'],
    region: 'Blocked',
    network: 'TBD',
    lastDeployment: 'Waiting for product scope',
    owner: 'Unassigned',
    branch: 'blocked/depin-scope',
    framework: 'Not selected'
  }
];

export const mockDeployments: Deployment[] = [
  {
    id: 'dep-ui-local',
    projectName: 'zexvro-platform-ui',
    commitHash: 'local',
    commitMessage: 'Generated frontend prototype from AI Studio zip',
    status: 'Pending',
    timestamp: '2026-07-06 13:08',
    duration: 'Not run',
    author: 'Workspace',
    logs: [
      '[INFO] Prototype prepared in the frontend workspace.',
      '[NEXT] Install dependencies, run type check, review UI spacing.',
      '[NOTE] No backend, auth, wallet, or deployment provider is connected yet.'
    ]
  },
  {
    id: 'dep-design-docs',
    projectName: 'agent-memory-workflow',
    commitHash: '3029afa',
    commitMessage: 'Add design system guidance',
    status: 'Live',
    timestamp: '2026-07-06 10:27',
    duration: 'Docs only',
    author: 'Workspace Agent',
    logs: [
      '[DOCS] design.md added as stable UI reference.',
      '[DOCS] context.md now tells agents to read design.md before UI work.',
      '[VERIFY] Markdown reviewed and pushed to origin/main.'
    ]
  },
  {
    id: 'dep-ui-prompt',
    projectName: 'zexvro-platform-ui',
    commitHash: '0460c9d',
    commitMessage: 'Add frontend UI generation prompt',
    status: 'Live',
    timestamp: '2026-07-06 10:16',
    duration: 'Docs only',
    author: 'Workspace Agent',
    logs: [
      '[PROMPT] Google AI Studio frontend prompt added.',
      '[SCOPE] Vite + React + shadcn/ui direction captured.',
      '[NEXT] Review generated UI and replace demo content with product placeholders.'
    ]
  }
];

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
    id: 'srv-transform',
    name: 'Transformation Agent',
    owner: 'Unassigned',
    status: 'configuring',
    description: 'Agent-first migration workspace for scanning repositories, planning Web2-to-Web3 changes, and preparing approved actions.',
    progress: 0,
    lastActivity: 'Ready for setup draft',
    category: 'transformation'
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
    progress: 0,
    lastActivity: 'Needs classification model',
    category: 'auth'
  },
  {
    id: 'srv-nft',
    name: 'NFT Service',
    owner: 'Unassigned',
    status: 'inactive',
    description: 'Simple NFT deployment and management flow for non-Web3 users such as indie game developers and small studios.',
    progress: 0,
    lastActivity: 'Needs chain/storage decision',
    category: 'nft'
  },
  {
    id: 'srv-depin',
    name: 'De-pin',
    owner: 'Unassigned',
    status: 'inactive',
    description: 'Scope not defined yet. Do not implement until the service concept, target user, and boundaries are accepted.',
    progress: 0,
    lastActivity: 'Needs product scope',
    category: 'depin'
  }
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'team-owner',
    name: 'Workspace Admin',
    alias: 'workspace-admin',
    email: 'admin@zexvro.local',
    role: 'Owner',
    status: 'active',
    lastActive: 'Just now',
    servicesOwned: []
  },
  {
    id: 'team-frontend',
    name: 'Frontend Reviewer',
    alias: 'frontend-reviewer',
    email: 'frontend@zexvro.local',
    role: 'Developer',
    status: 'active',
    lastActive: 'Invite pending',
    servicesOwned: []
  },
  {
    id: 'team-service',
    name: 'Service Designer',
    alias: 'service-designer',
    email: 'services@zexvro.local',
    role: 'Developer',
    status: 'active',
    lastActive: 'Invite pending',
    servicesOwned: []
  },
  {
    id: 'team-agent',
    name: 'Workspace Agent',
    alias: 'workspace-agent',
    email: 'agent@zexvro.local',
    role: 'Agent',
    status: 'active',
    lastActive: 'Prototype only',
    servicesOwned: ['Agent Memory']
  }
];

export const mockCollaborationNotes: CollaborationNote[] = [
  {
    id: 'note-ui',
    author: 'Workspace',
    timestamp: '2026-07-06 13:08',
    currentState: 'AI Studio generated the first frontend prototype and it now lives in the frontend workspace.',
    nextStep: 'Improve spacing, branding, copy, and replace generated demo content with setup placeholders.',
    filesToInspect: ['src/App.tsx', 'src/components/dashboard/Overview.tsx', 'src/data/mock.ts'],
    doNotTouch: ['context.md service ownership rules without recording a decision'],
    ownerNeeded: 'workspace-admin'
  },
  {
    id: 'note-depin',
    author: 'Workspace Agent',
    timestamp: '2026-07-06 10:27',
    currentState: 'De-pin remains intentionally undefined in context.md.',
    nextStep: 'Collect the De-pin concept, target users, MVP boundary, and data model before implementation.',
    filesToInspect: ['context.md', 'memory.md'],
    doNotTouch: ['services/depin implementation files until scope is accepted'],
    ownerNeeded: 'service-designer'
  }
];

export const mockMemoryEntries: MemoryEntry[] = [
  {
    id: 'mem-design',
    service: 'Design System',
    filesChanged: ['design.md', 'README.md', 'context.md', 'memory.md'],
    summary: 'Added dark-first UI direction, required light theme, typography, colors, motion, charts, and component rules.',
    decisions: ['Proposed - Use design.md as the stable design reference for frontend UI work.'],
    followUps: ['Map tokens into Tailwind and shadcn variables after scaffold is finalized.'],
    blockers: [],
    verification: 'Logo and typo-logo were visually inspected and the Markdown was reviewed.',
    date: '2026-07-06',
    owner: 'Workspace Agent',
    label: 'decision'
  },
  {
    id: 'mem-prompt',
    service: 'Frontend UI',
    filesChanged: ['docs/prompts/google-ai-studio-frontend-ui.md', 'memory.md'],
    summary: 'Created the Google AI Studio prompt used to generate the first platform dashboard prototype.',
    decisions: ['Proposed - Use the prompt as initial frontend generation spec before final scaffold.'],
    followUps: ['Review generated code, then merge only the useful parts into the final app.'],
    blockers: [],
    verification: 'Prompt file was pushed to origin/main.',
    date: '2026-07-06',
    owner: 'Workspace Agent',
    label: 'general'
  },
  {
    id: 'mem-depin',
    service: 'De-pin',
    filesChanged: ['context.md', 'memory.md'],
    summary: 'De-pin scope is blocked until service details are documented.',
    decisions: ['Blocked - Do not implement De-pin before scope is documented.'],
    followUps: ['Collect De-pin scope notes and update context.md plus memory.md.'],
    blockers: ['Needs product scope input.'],
    verification: 'Context and memory both list De-pin as blocked.',
    date: '2026-07-05',
    owner: 'Service Designer',
    label: 'blocker'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-design',
    timestamp: '2026-07-06 10:27',
    actor: 'Workspace Agent',
    action: 'ADD_DESIGN_GUIDANCE',
    target: 'design.md',
    status: 'success',
    ip: 'local'
  },
  {
    id: 'log-prompt',
    timestamp: '2026-07-06 10:16',
    actor: 'Workspace Agent',
    action: 'ADD_FRONTEND_PROMPT',
    target: 'docs/prompts/google-ai-studio-frontend-ui.md',
    status: 'success',
    ip: 'local'
  },
  {
    id: 'log-blocker',
    timestamp: '2026-07-05 20:48',
    actor: 'Workspace Agent',
    action: 'RECORD_BLOCKER',
    target: 'De-pin scope',
    status: 'warning',
    ip: 'local'
  }
];

export const mockSecurityKeys: SecurityKey[] = [
  {
    id: 'key-placeholder-1',
    name: 'Frontend local development key',
    keyPrefix: 'zex_test_placeholder_••••',
    created: 'Not created',
    lastUsed: 'Never',
    status: 'active',
    owner: 'Workspace'
  },
  {
    id: 'key-placeholder-2',
    name: 'Agent read-only memory key',
    keyPrefix: 'zex_agent_placeholder_••••',
    created: 'Needs backend',
    lastUsed: 'Never',
    status: 'active',
    owner: 'workspace-agent'
  },
  {
    id: 'key-placeholder-3',
    name: 'Old generated demo key',
    keyPrefix: 'zex_demo_revoked_••••',
    created: 'Generated prototype',
    lastUsed: 'Never',
    status: 'revoked',
    owner: 'Workspace Agent'
  }
];

export const requestAnalytics = [
  { name: 'Mon', requests: 0, errors: 0, latency: 0 },
  { name: 'Tue', requests: 0, errors: 0, latency: 0 },
  { name: 'Wed', requests: 1, errors: 0, latency: 0 },
  { name: 'Thu', requests: 2, errors: 0, latency: 0 },
  { name: 'Fri', requests: 3, errors: 0, latency: 0 },
  { name: 'Sat', requests: 4, errors: 0, latency: 0 },
  { name: 'Sun', requests: 6, errors: 0, latency: 0 }
];

export const serviceAdoptionData = [
  { name: 'Agent', value: 35, color: '#3B82F6' },
  { name: 'Privacy', value: 24, color: '#7C3AED' },
  { name: 'Auth', value: 18, color: '#22C55E' },
  { name: 'NFT', value: 13, color: '#F59E0B' },
  { name: 'De-pin', value: 10, color: '#71717A' }
];

export const agentRunsData = [
  { name: 'Jul 2', transform: 0, deploy: 0, audit: 1 },
  { name: 'Jul 3', transform: 1, deploy: 0, audit: 1 },
  { name: 'Jul 4', transform: 1, deploy: 0, audit: 2 },
  { name: 'Jul 5', transform: 2, deploy: 0, audit: 3 },
  { name: 'Jul 6', transform: 4, deploy: 0, audit: 4 }
];

export const memberPerformanceData = [
  { name: 'Workspace', runs: 0, projects: 0, keys: 0 },
  { name: 'Frontend', runs: 0, projects: 0, keys: 0 },
  { name: 'Services', runs: 0, projects: 0, keys: 0 },
  { name: 'Agent', runs: 0, projects: 0, keys: 0 }
];
