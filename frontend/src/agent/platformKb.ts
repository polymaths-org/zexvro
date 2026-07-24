/**
 * Morph platform knowledge + destination catalog.
 * Used as system context so Morph can guide users and emit one-click nav actions.
 */

export type MorphNavDest = {
  id: string
  label: string
  /** Path with optional {workspaceId} / {projectId} placeholders */
  path: string
  /** Keywords that help auto-suggest this destination */
  keywords: string[]
  blurb: string
  needsProject?: boolean
}

export const MORPH_NAV_DESTINATIONS: MorphNavDest[] = [
  {
    id: 'overview',
    label: 'Workspace overview',
    path: '/dashboard/w/{workspaceId}/overview',
    keywords: ['overview', 'home', 'dashboard', 'start'],
    blurb: 'Workspace home: projects, quick actions, health.',
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/dashboard/w/{workspaceId}/projects',
    keywords: ['project', 'projects', 'create project', 'new project'],
    blurb: 'List and open projects in this workspace.',
  },
  {
    id: 'new-project',
    label: 'Create project',
    path: '/dashboard/w/{workspaceId}/projects/new',
    keywords: ['create project', 'new project', 'add project'],
    blurb: 'Wizard to create a new project.',
  },
  {
    id: 'credits',
    label: 'ZCR credits',
    path: '/dashboard/w/{workspaceId}/credits',
    keywords: ['credit', 'credits', 'zcr', 'pack', 'promo', 'billing', 'buy credits'],
    blurb: 'Workspace ZCR balance, ledger, promo codes, credit packs (NFT checkout).',
  },
  {
    id: 'team',
    label: 'Team & invites',
    path: '/dashboard/w/{workspaceId}/team',
    keywords: ['team', 'invite', 'member', 'role', 'rbac', 'collaborator'],
    blurb: 'Invite members, roles, roster.',
  },
  {
    id: 'audit',
    label: 'Audit log',
    path: '/dashboard/w/{workspaceId}/audit',
    keywords: ['audit', 'log', 'history', 'activity'],
    blurb: 'Durable workspace audit ledger.',
  },
  {
    id: 'security',
    label: 'Security',
    path: '/dashboard/w/{workspaceId}/security',
    keywords: ['security', 'token', 'secret'],
    blurb: 'Workspace security settings (local drafts + banners).',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/dashboard/w/{workspaceId}/analytics',
    keywords: ['analytics', 'metrics', 'usage'],
    blurb: 'Workspace analytics.',
  },
  {
    id: 'settings',
    label: 'Workspace settings',
    path: '/dashboard/w/{workspaceId}/settings',
    keywords: ['settings', 'workspace settings', 'rename'],
    blurb: 'Rename workspace and workspace-level config.',
  },
  {
    id: 'memory',
    label: 'Shared memory',
    path: '/dashboard/w/{workspaceId}/memory',
    keywords: ['memory', 'shared memory', 'handoff', 'blocker', 'decision'],
    blurb: 'Developer shared memory for agents and humans.',
  },
  {
    id: 'agent',
    label: 'Morph Agent studio',
    path: '/dashboard/w/{workspaceId}/agent',
    keywords: ['morph agent', 'agent studio', 'full chat', 'agentic'],
    blurb: 'Full Morph chat surface with context panel.',
  },
  {
    id: 'zer0',
    label: 'Zer0 (Finance)',
    path: '/dashboard/w/{workspaceId}/zer0',
    keywords: ['zer0', 'zero', 'privacy', 'pool', 'payroll', 'finance', 'zk'],
    blurb: 'Privacy pools / multi-denom ZK pays (Finance).',
  },
  {
    id: 'services',
    label: 'Services manager',
    path: '/dashboard/w/{workspaceId}/services',
    keywords: ['services', 'enable service', 'service manager'],
    blurb: 'Enable Zer0, REQWID, NFTo, DEDSEC for projects.',
  },
  {
    id: 'platform',
    label: 'Platform admin',
    path: '/dashboard/platform',
    keywords: ['platform', 'admin', 'directory', 'all workspaces'],
    blurb: 'Platform workspace directory (admins).',
  },
  {
    id: 'project-overview',
    label: 'Project overview',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/overview',
    keywords: ['project overview', 'this project'],
    blurb: 'Current project setup checklist and metrics.',
    needsProject: true,
  },
  {
    id: 'reqwid',
    label: 'REQWID (Gate captcha)',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/agent-auth',
    keywords: [
      'reqwid',
      'gate',
      'captcha',
      'bot',
      'human check',
      'site key',
      'protect',
      'agent-auth',
      'anti-bot',
    ],
    blurb: 'Human captcha gate: register site, public siteKey, secret, install + test.',
    needsProject: true,
  },
  {
    id: 'nft',
    label: 'NFTo collections',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/nft',
    keywords: ['nft', 'nfto', 'collection', 'mint', 'sale', 'checkout', 'token'],
    blurb: 'NFT collections, mint, primary sale, Freighter checkout (mainnet live).',
    needsProject: true,
  },
  {
    id: 'nft-new',
    label: 'Create NFT collection',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/nft/collections/new',
    keywords: ['new collection', 'create collection', 'deploy collection'],
    blurb: 'Create a new NFT collection.',
    needsProject: true,
  },
  {
    id: 'depin',
    label: 'DEDSEC (De-pin)',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/depin',
    keywords: ['depin', 'dedsec', 'de-pin', 'paywall', 'weather', '402', 'api pay'],
    blurb: 'HTTP 402 paywalled APIs / De-pin gateway.',
    needsProject: true,
  },
  {
    id: 'project-settings',
    label: 'Project settings',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/settings',
    keywords: ['project settings', 'network', 'testnet', 'mainnet', 'service network'],
    blurb: 'Project settings including service network prefs.',
    needsProject: true,
  },
  {
    id: 'project-services',
    label: 'Project services',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/services',
    keywords: ['project services', 'enable nft', 'enable gate'],
    blurb: 'Per-project service toggles.',
    needsProject: true,
  },
  {
    id: 'project-memory',
    label: 'Project shared memory',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/memory',
    keywords: ['project memory'],
    blurb: 'Shared memory scoped to the project.',
    needsProject: true,
  },
  {
    id: 'project-zer0',
    label: 'Project Zer0',
    path: '/dashboard/w/{workspaceId}/p/{projectId}/zer0',
    keywords: ['project zer0', 'project finance'],
    blurb: 'Zer0 inside project context.',
    needsProject: true,
  },
]

export type MorphScope = 'workspace' | 'project'

export type MorphRouteContext = {
  /** Explicit scope — workspace Morph must not pretend to be in a project */
  scope?: MorphScope
  workspaceId?: string | null
  projectId?: string | null
  workspaceName?: string | null
  projectName?: string | null
  currentScreen?: string | null
  path?: string | null
  /** Project names in this workspace (workspace Morph context) */
  projectNames?: string[]
}

export function resolveMorphScope(ctx: MorphRouteContext): MorphScope {
  if (ctx.scope === 'workspace' || ctx.scope === 'project') return ctx.scope
  return ctx.projectId ? 'project' : 'workspace'
}

/** Destinations allowed for the current Morph surface */
export function destinationsForScope(scope: MorphScope): MorphNavDest[] {
  if (scope === 'workspace') {
    // No project-only tools (REQWID/NFTo/DEDSEC live under a project)
    return MORPH_NAV_DESTINATIONS.filter((d) => !d.needsProject)
  }
  return MORPH_NAV_DESTINATIONS
}

export function resolveMorphPath(
  template: string,
  ctx: MorphRouteContext,
): string | null {
  let path = template
  if (path.includes('{workspaceId}')) {
    if (!ctx.workspaceId) return null
    path = path.replaceAll('{workspaceId}', ctx.workspaceId)
  }
  if (path.includes('{projectId}')) {
    if (!ctx.projectId) return null
    path = path.replaceAll('{projectId}', ctx.projectId)
  }
  return path
}

export function getMorphDestination(id: string): MorphNavDest | undefined {
  return MORPH_NAV_DESTINATIONS.find((d) => d.id === id)
}

/** Keyword fallback when the model forgets to emit [[nav:...]] */
export function suggestMorphDestinations(
  userText: string,
  ctx: MorphRouteContext,
  limit = 3,
): MorphNavDest[] {
  const scope = resolveMorphScope(ctx)
  const pool = destinationsForScope(scope)
  const q = userText.toLowerCase()
  const scored = pool.map((d) => {
    let score = 0
    for (const kw of d.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length
    }
    if (d.needsProject && (!ctx.projectId || scope !== 'project')) score = 0
    if (d.path.includes('{workspaceId}') && !ctx.workspaceId) score = 0
    return { d, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.d)
}

export const PLATFORM_KB = `
# ZEXVRO platform (Morph must know this)

ZEXVRO is a Web3 PaaS console for teams. Product names:
- **REQWID** = Gate / agent-auth = human captcha + capability tokens (api.zexvro.in/gate)
- **NFTo** = NFT collections on Stellar (console mint/sale; hosted API often mainnet)
- **DEDSEC** = De-pin = paywalled HTTP APIs (402)
- **Zer0** = privacy pools / multi-denom ZK pays (under Finance)
- **Morph** = migration agent (CLI + this assistant + shared memory)
- **ZCR** = workspace credits for platform usage; packs may open NFT checkout

## Console IA (where things live)
- Workspace shell: Overview, Projects, Team, Credits, Audit, Security, Analytics, Settings, Shared Memory, Morph Agent
- Project shell: Overview, Services, REQWID, NFTo, DEDSEC, Zer0, Memory, Settings
- Platform admin: /dashboard/platform (admins only)

## How-to recipes (guide + one-click nav)

### REQWID / captcha on my site
1. Open a **project** (not just workspace).
2. Go to **REQWID**.
3. Register website (name + allowed origins like https://myapp.com).
4. Copy **public siteKey** into the browser; store **secretKey** only on server.
5. Frontend: load Gate captcha SDK from \`https://api.zexvro.in/gate/v1/sdk/captcha.js\` and call protectWithCaptcha({ apiBase, siteKey, action }).
6. Backend: verify capability / secret as needed.
7. Test captcha in the REQWID Test tab.
Nav: [[nav:reqwid|Open REQWID]]

### Buy / manage ZCR credits
1. Workspace → **Credits**.
2. View balance + ledger; redeem promo if any.
3. Buy pack → may open Freighter NFT checkout (collection configured for packs).
Nav: [[nav:credits|Open Credits]]

### Create NFT collection / mint
1. Project → **NFTo**.
2. Create collection or open existing.
3. Connect Freighter (network matches Settings / service pref; hosted API may be mainnet).
4. Mint / configure primary sale; buyers use checkout popup.
Nav: [[nav:nft|Open NFTo]] [[nav:nft-new|New collection]]

### De-pin / paid API
1. Project → **DEDSEC**.
2. Configure paywalled routes; clients get 402 until paid.
Nav: [[nav:depin|Open DEDSEC]]

### Invite teammates
1. Workspace → **Team**.
2. Invite by email + role; accept link goes to /invite/accept.
Nav: [[nav:team|Open Team]]

### Morph CLI (Web2→Web3 coding agent)
Not in-browser. User runs locally:
\`\`\`
morph login
morph use <workspaceId>
cd my-app && morph bind
morph providers add codexin   # or platform demo provider
morph
morph migrate --site-key <publicSiteKey>   # EDGERUN-style games
\`\`\`
Shared memory: console **Shared memory** + CLI \`morph memory add\`.
Nav: [[nav:memory|Open shared memory]] [[nav:agent|Open Morph studio]]

### Enable services on a project
1. Project → **Services** or workspace Services manager.
2. Toggle REQWID / NFTo / DEDSEC / Zer0 as needed.
Nav: [[nav:project-services|Project services]] [[nav:services|Services manager]]

### Network (testnet/mainnet)
- Project **Settings** and NFTo header can set Freighter preference.
- Hosted NFT API may already be mainnet — check service health.
Nav: [[nav:project-settings|Project settings]]

## Safety
- Never invent secret keys or claim a deploy finished without evidence.
- Prefer short steps + a single primary [[nav:...]] button.
- If project is required but missing, say "Open a project first" and offer [[nav:projects|Choose a project]].
`.trim()

export function buildMorphSystemPrompt(ctx: MorphRouteContext): string {
  const scope = resolveMorphScope(ctx)
  const allowed = destinationsForScope(scope)
  const destLines = allowed
    .map((d) => `- \`${d.id}\` → ${d.label}: ${d.blurb}`)
    .join('\n')

  const projectsLine =
    scope === 'workspace' && ctx.projectNames?.length
      ? `projectsInWorkspace: ${ctx.projectNames.join(', ')}`
      : scope === 'workspace'
        ? 'projectsInWorkspace: (none yet — suggest creating a project)'
        : null

  const ctxBlock = [
    `morphScope: ${scope}`,
    `workspaceId: ${ctx.workspaceId || '(none)'}`,
    `workspaceName: ${ctx.workspaceName || '—'}`,
    scope === 'project'
      ? `projectId: ${ctx.projectId || '(missing)'}`
      : 'projectId: (not on a project page — do NOT use project-only nav ids)',
    scope === 'project' ? `projectName: ${ctx.projectName || '—'}` : null,
    projectsLine,
    `currentScreen: ${ctx.currentScreen || '—'}`,
    `path: ${ctx.path || '—'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const scopeRules =
    scope === 'workspace'
      ? `
## Scope: WORKSPACE Morph
You are on the **workspace** Morph Agent page (not inside a project).
- Help with: team, credits/ZCR, projects list/create, workspace memory, audit, settings, CLI bind to this workspace, platform overview.
- Do **not** open REQWID / NFTo / DEDSEC / project settings as if they were already selected — those need a project.
- If the user asks for captcha, NFT, or De-pin: explain they pick a project first, then emit [[nav:projects|Open projects]] (and optionally [[nav:new-project|Create project]]).
- Prefer workspace nav ids only from the allowed list below.
`
      : `
## Scope: PROJECT Morph
You are inside project **${ctx.projectName || ctx.projectId || 'current'}** under workspace **${ctx.workspaceName || ctx.workspaceId || 'current'}**.
- Help with: REQWID, NFTo, DEDSEC, project services/settings, project memory, migration for this app.
- You may still link workspace tools (credits, team) when relevant.
- Prefer project-specific nav for product setup.
`

  return `You are **Morph**, the in-console assistant for ZEXVRO.

## Mission
You are a **console co-pilot**. When the user asks how to do something:
1. Answer in short steps (max ~5).
2. **Always** end with navigation buttons the UI will render (see format below).
3. Prefer "open this page and click X" over abstract theory.
4. Never claim you already created resources unless the user confirms.
${scopeRules}
## Buttons (REQUIRED — every helpful reply)
The website turns these tags into clickable buttons. Put them on their **own lines at the end**:

[[nav:DEST_ID|Button label]]

Examples:
[[nav:credits|Open credits]]
[[nav:projects|Open projects]]
[[nav:reqwid|Open REQWID]]

**Allowed DEST_ID values for this scope (${scope}):**
${destLines}

Rules:
- Always include **at least one** [[nav:...]] when a console page exists for the task.
- Prefer 1 primary + optional 1 secondary. Max 3.
- Use only listed DEST_IDs for this scope.
- Do not invent URLs. Do not put nav tags inside code fences.
- You may also write normal markdown links to /dashboard/... paths; the UI will buttonize those too.

## Live user context
${ctxBlock}

${PLATFORM_KB}

## Tone
Practical, confident, product-accurate. Use product names REQWID / NFTo / DEDSEC / Zer0 / Morph / ZCR.
`
}
