import { Project, Deployment, Service, TeamMember, CollaborationNote, MemoryEntry, AuditLog, SecurityKey } from '../types';

// AI NOTE: This file intentionally uses product-safe placeholders, not fake production metrics.
// Keep values realistic for an MVP workspace and avoid claims that live blockchain/backend systems exist.

export const mockProjects: Project[] = [
  {
    id: 'proj-platform-ui',
    name: 'zexvro-platform-ui',
    status: 'active',
    serviceUsage: ['Transformation Agent', 'Agent Memory'],
    region: 'Local prototype',
    network: 'Stellar Testnet planned',
    lastDeployment: 'Not deployed',
    owner: 'paris-29',
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
    owner: 'paris-29',
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
    owner: 'paris-29',
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
    lastDeployment: 'Waiting for Nabil',
    owner: 'n4bi10p',
    branch: 'blocked/depin-scope',
    framework: 'Not selected'
  }
];

export const mockDeployments: Deployment[] = [
  {
    id: 'dep-ui-local',
    projectName: 'zexvro-platform-ui',
    commitHash: 'local',
    commitMessage: 'Generated frontend prototype extracted from AI Studio zip',
    status: 'Pending',
    timestamp: '2026-07-06 13:08',
    duration: 'Not run',
    author: 'paris-29',
    logs: [
      '[INFO] Prototype extracted into extracted/zexvro-ui.',
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
    author: 'Codex',
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
    author: 'Codex',
    logs: [
      '[PROMPT] Google AI Studio frontend prompt added.',
      '[SCOPE] Vite + React + shadcn/ui direction captured.',
      '[NEXT] Review generated UI and replace dummy content with product placeholders.'
    ]
  }
];

export const mockServices: Service[] = [
  {
    id: 'srv-privacy',
    name: 'Zero-Knowledge Privacy Pool',
    owner: 'paris-29',
    status: 'configuring',
    description: 'Private transaction workflow for companies that need Web3 verification without public transaction detail exposure.',
    progress: 35,
    lastActivity: 'Architecture pending',
    category: 'privacy'
  },
  {
    id: 'srv-transform',
    name: 'Transformation Agent',
    owner: 'paris-29',
    status: 'active',
    description: 'Agent-first migration workspace for scanning repositories, planning Web2-to-Web3 changes, and preparing approved actions.',
    progress: 55,
    lastActivity: 'Prompt and memory docs ready',
    category: 'transformation'
  },
  {
    id: 'srv-trade',
    name: 'A-2-A Trade Pipeline',
    owner: 'Wraient',
    status: 'configuring',
    description: 'Agent-to-agent negotiation and settlement pipeline. Protocol and wallet rules still need owner decisions.',
    progress: 20,
    lastActivity: 'Needs protocol draft',
    category: 'trade'
  },
  {
    id: 'srv-agent-auth',
    name: 'Captcha-like Agent Authentication Service',
    owner: 'Wraient',
    status: 'configuring',
    description: 'Human vs agent access classification service with SDK/API direction. Privacy model and signals are not finalized.',
    progress: 25,
    lastActivity: 'Needs classification model',
    category: 'auth'
  },
  {
    id: 'srv-nft',
    name: 'NFT Service',
    owner: 'n4bi10p',
    status: 'inactive',
    description: 'Simple NFT deployment and management flow for non-Web3 users such as indie game developers and small studios.',
    progress: 10,
    lastActivity: 'Needs chain/storage decision',
    category: 'nft'
  },
  {
    id: 'srv-depin',
    name: 'De-pin',
    owner: 'n4bi10p',
    status: 'inactive',
    description: 'Scope not defined yet. Do not implement until Nabil provides the service concept and boundaries.',
    progress: 0,
    lastActivity: 'Blocked on Nabil',
    category: 'depin'
  }
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'team-paris',
    name: 'Paris',
    alias: 'paris-29',
    email: 'paris@zexvro.local',
    role: 'Owner',
    status: 'active',
    lastActive: 'Just now',
    servicesOwned: ['Zero-Knowledge Privacy Pool', 'Transformation Agent']
  },
  {
    id: 'team-rushi',
    name: 'Rushi',
    alias: 'Wraient',
    email: 'rushi@zexvro.local',
    role: 'Developer',
    status: 'active',
    lastActive: 'Needs sync',
    servicesOwned: ['A-2-A Trade Pipeline', 'Captcha-like Agent Authentication Service']
  },
  {
    id: 'team-nabil',
    name: 'Nabil',
    alias: 'n4bi10p',
    email: 'nabil@zexvro.local',
    role: 'Developer',
    status: 'active',
    lastActive: 'Needs De-pin scope',
    servicesOwned: ['NFT Service', 'De-pin']
  },
  {
    id: 'team-agent',
    name: 'ZEXVRO Assistant',
    alias: 'workspace-agent',
    email: 'agent@zexvro.local',
    role: 'Agent',
    status: 'active',
    lastActive: 'Prototype only',
    servicesOwned: ['Transformation Agent']
  }
];

export const mockCollaborationNotes: CollaborationNote[] = [
  {
    id: 'note-ui',
    author: 'paris-29',
    timestamp: '2026-07-06 13:08',
    currentState: 'AI Studio generated a frontend prototype and it was extracted into extracted/zexvro-ui.',
    nextStep: 'Improve spacing, branding, copy, and replace generated dummy data with setup placeholders.',
    filesToInspect: ['src/App.tsx', 'src/components/dashboard/Overview.tsx', 'src/data/mock.ts'],
    doNotTouch: ['context.md service ownership rules without recording a decision'],
    ownerNeeded: 'paris-29'
  },
  {
    id: 'note-depin',
    author: 'Codex',
    timestamp: '2026-07-06 10:27',
    currentState: 'De-pin remains intentionally undefined in context.md.',
    nextStep: 'Ask Nabil for the De-pin concept, target users, MVP boundary, and data model.',
    filesToInspect: ['context.md', 'memory.md'],
    doNotTouch: ['services/depin implementation files until scope is accepted'],
    ownerNeeded: 'n4bi10p'
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
    owner: 'Codex',
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
    owner: 'Codex',
    label: 'general'
  },
  {
    id: 'mem-depin',
    service: 'De-pin',
    filesChanged: ['context.md', 'memory.md'],
    summary: 'De-pin scope is blocked until Nabil provides service details.',
    decisions: ['Blocked - Do not implement De-pin before scope is documented.'],
    followUps: ['Collect Nabil brainstorming and update context.md plus memory.md.'],
    blockers: ['Needs Nabil input.'],
    verification: 'Context and memory both list De-pin as blocked.',
    date: '2026-07-05',
    owner: 'n4bi10p',
    label: 'blocker'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-design',
    timestamp: '2026-07-06 10:27',
    actor: 'Codex',
    action: 'ADD_DESIGN_GUIDANCE',
    target: 'design.md',
    status: 'success',
    ip: 'local'
  },
  {
    id: 'log-prompt',
    timestamp: '2026-07-06 10:16',
    actor: 'Codex',
    action: 'ADD_FRONTEND_PROMPT',
    target: 'docs/prompts/google-ai-studio-frontend-ui.md',
    status: 'success',
    ip: 'local'
  },
  {
    id: 'log-blocker',
    timestamp: '2026-07-05 20:48',
    actor: 'Codex',
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
    owner: 'paris-29'
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
    owner: 'Codex'
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
  { name: 'paris-29', runs: 4, projects: 2, keys: 1 },
  { name: 'Wraient', runs: 0, projects: 1, keys: 0 },
  { name: 'n4bi10p', runs: 0, projects: 1, keys: 0 },
  { name: 'workspace-agent', runs: 6, projects: 0, keys: 1 }
];
