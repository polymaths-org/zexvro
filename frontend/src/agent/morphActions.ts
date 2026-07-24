import {
  destinationsForScope,
  getMorphDestination,
  resolveMorphPath,
  resolveMorphScope,
  suggestMorphDestinations,
  type MorphNavDest,
  type MorphRouteContext,
} from './platformKb'

export type MorphAction = {
  id: string
  label: string
  path: string
  source: 'model' | 'suggest' | 'link' | 'default'
  /** Optional: copy text instead of navigate */
  copyText?: string
  kind?: 'nav' | 'copy'
}

/** [[nav:reqwid|Open REQWID]] */
const NAV_RE = /\[\[nav:([a-z0-9_-]+)\|([^\]]+)\]\]/gi
/** Markdown internal links: [label](/dashboard/...) */
const MD_LINK_RE = /\[([^\]]+)\]\((\/dashboard\/[^)\s]+)\)/gi
/** Bare dashboard paths in backticks or plain */
const PATH_RE = /(?:^|\s)(\/dashboard\/[a-zA-Z0-9_./-]+)/g

function allowedDestMap(ctx: MorphRouteContext): Map<string, MorphNavDest> {
  const scope = resolveMorphScope(ctx)
  const m = new Map<string, MorphNavDest>()
  for (const d of destinationsForScope(scope)) m.set(d.id, d)
  return m
}

function pushAction(
  list: MorphAction[],
  seen: Set<string>,
  action: MorphAction,
  max = 4,
) {
  if (list.length >= max) return
  const key = action.copyText ? `copy:${action.copyText}` : `nav:${action.path}`
  if (seen.has(key)) return
  if (!action.path && !action.copyText) return
  seen.add(key)
  list.push(action)
}

function pathToDestId(path: string, ctx: MorphRouteContext): MorphNavDest | null {
  const scope = resolveMorphScope(ctx)
  // Match known templates by suffix / segment
  const candidates = destinationsForScope(scope)
  const resolved = candidates
    .map((d) => {
      const p = resolveMorphPath(d.path, ctx)
      return p ? { d, p } : null
    })
    .filter(Boolean) as Array<{ d: MorphNavDest; p: string }>

  // Exact match first
  for (const { d, p } of resolved) {
    if (p === path || path.startsWith(p + '/')) return d
  }
  // Heuristic by last segment
  const last = path.split('/').filter(Boolean).pop() || ''
  const bySeg: Record<string, string> = {
    overview: path.includes('/p/') ? 'project-overview' : 'overview',
    projects: 'projects',
    new: path.includes('collections') ? 'nft-new' : 'new-project',
    credits: 'credits',
    team: 'team',
    audit: 'audit',
    security: 'security',
    analytics: 'analytics',
    settings: path.includes('/p/') ? 'project-settings' : 'settings',
    memory: path.includes('/p/') ? 'project-memory' : 'memory',
    agent: 'agent',
    zer0: path.includes('/p/') ? 'project-zer0' : 'zer0',
    services: path.includes('/p/') ? 'project-services' : 'services',
    platform: 'platform',
    'agent-auth': 'reqwid',
    nft: 'nft',
    depin: 'depin',
  }
  const id = bySeg[last]
  if (id) {
    const dest = getMorphDestination(id)
    if (dest && allowedDestMap(ctx).has(dest.id)) return dest
  }
  return null
}

/**
 * Pull [[nav:]] tags + internal markdown links from model text.
 * Strips nav tags from visible text; keeps normal markdown links.
 */
export function extractMorphActions(
  text: string,
  ctx: MorphRouteContext,
): { cleanText: string; actions: MorphAction[] } {
  const actions: MorphAction[] = []
  const seen = new Set<string>()
  const allowed = allowedDestMap(ctx)
  const scope = resolveMorphScope(ctx)

  // 1) Explicit [[nav:id|label]]
  let cleanText = text
    .replace(NAV_RE, (_full, id: string, label: string) => {
      const destId = String(id).toLowerCase()
      const dest = getMorphDestination(destId)
      if (!dest || !allowed.has(dest.id)) return ''
      if (scope === 'workspace' && dest.needsProject) return ''
      const path = resolveMorphPath(dest.path, ctx)
      if (!path) return ''
      pushAction(actions, seen, {
        id: dest.id,
        label: label.trim() || dest.label,
        path,
        source: 'model',
        kind: 'nav',
      })
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // 2) Markdown links to /dashboard/...
  let m: RegExpExecArray | null
  const md = new RegExp(MD_LINK_RE.source, 'gi')
  while ((m = md.exec(text)) !== null) {
    const label = m[1]!.trim()
    const path = m[2]!.trim()
    // Only accept paths we can resolve for this scope
    if (scope === 'workspace' && /\/p\//.test(path) && !path.includes('/projects')) {
      // project-level product pages without project context — skip
      if (!/\/projects(\/|$)/.test(path)) continue
    }
    const dest = pathToDestId(path, ctx)
    pushAction(actions, seen, {
      id: dest?.id || path,
      label: label || dest?.label || 'Open page',
      path,
      source: 'link',
      kind: 'nav',
    })
  }

  // 3) Bare /dashboard paths
  const pr = new RegExp(PATH_RE.source, 'g')
  while ((m = pr.exec(text)) !== null) {
    const path = m[1]!
    const dest = pathToDestId(path, ctx)
    if (!dest) continue
    const resolved = resolveMorphPath(dest.path, ctx)
    if (!resolved) continue
    pushAction(actions, seen, {
      id: dest.id,
      label: dest.label,
      path: resolved,
      source: 'link',
      kind: 'nav',
    })
  }

  return { cleanText, actions }
}

export function mergeSuggestedActions(
  userText: string,
  existing: MorphAction[],
  ctx: MorphRouteContext,
  limit = 2,
): MorphAction[] {
  const seen = new Set(existing.map((a) => (a.copyText ? `copy:${a.copyText}` : `nav:${a.path}`)))
  const out = [...existing]
  for (const dest of suggestMorphDestinations(userText, ctx, limit + 3)) {
    const path = resolveMorphPath(dest.path, ctx)
    if (!path) continue
    pushAction(
      out,
      seen,
      {
        id: dest.id,
        label: actionVerbLabel(dest),
        path,
        source: 'suggest',
        kind: 'nav',
      },
      existing.length + limit,
    )
  }
  return out
}

function actionVerbLabel(d: MorphNavDest): string {
  // Friendlier CTA labels
  const map: Record<string, string> = {
    reqwid: 'Open REQWID',
    nft: 'Open NFTo',
    'nft-new': 'Create collection',
    depin: 'Open DEDSEC',
    credits: 'Open credits',
    team: 'Open team',
    projects: 'Open projects',
    'new-project': 'Create project',
    memory: 'Open shared memory',
    'project-memory': 'Open project memory',
    agent: 'Open Morph studio',
    overview: 'Workspace overview',
    'project-overview': 'Project overview',
    services: 'Services manager',
    'project-services': 'Project services',
    settings: 'Workspace settings',
    'project-settings': 'Project settings',
    zer0: 'Open Zer0',
    'project-zer0': 'Open project Zer0',
    audit: 'Open audit log',
    platform: 'Platform admin',
  }
  return map[d.id] || d.label
}

export function quickStartActions(ctx: MorphRouteContext): MorphAction[] {
  const scope = resolveMorphScope(ctx)
  const ids =
    scope === 'project'
      ? (['reqwid', 'nft', 'depin', 'project-memory'] as const)
      : (['projects', 'credits', 'team', 'memory'] as const)
  const out: MorphAction[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const dest = getMorphDestination(id)
    if (!dest) continue
    if (scope === 'workspace' && dest.needsProject) continue
    const path = resolveMorphPath(dest.path, ctx)
    if (!path) continue
    pushAction(out, seen, {
      id: dest.id,
      label: actionVerbLabel(dest),
      path,
      source: 'default',
      kind: 'nav',
    })
  }
  return out
}

/**
 * Always produce a useful button row for an assistant turn.
 * Combines model tags + reply/user keyword inference + scope defaults.
 * Safe: only navigates to known console routes (or copies CLI text).
 */
export function finalizeMorphReply(
  rawReply: string,
  userText: string,
  ctx: MorphRouteContext,
): { cleanText: string; actions: MorphAction[] } {
  const { cleanText, actions: modelActions } = extractMorphActions(rawReply, ctx)
  const seen = new Set(modelActions.map((a) => (a.copyText ? `copy:${a.copyText}` : `nav:${a.path}`)))
  const actions = [...modelActions]

  // Infer from user question + assistant prose (model often forgets tags)
  const blob = `${userText}\n${cleanText}`
  for (const dest of suggestMorphDestinations(blob, ctx, 5)) {
    const path = resolveMorphPath(dest.path, ctx)
    if (!path) continue
    pushAction(
      actions,
      seen,
      {
        id: dest.id,
        label: actionVerbLabel(dest),
        path,
        source: 'suggest',
        kind: 'nav',
      },
      4,
    )
  }

  // Scope defaults if still empty or thin
  if (actions.length < 2) {
    for (const a of quickStartActions(ctx)) {
      pushAction(actions, seen, a, 3)
    }
  }

  // CLI install copy when user mentions install/cli/morph terminal
  const q = userText.toLowerCase()
  if (
    /\b(install|cli|terminal|curl|bind|morph login)\b/.test(q) ||
    /\bmorph (login|use|bind|install)\b/.test(cleanText.toLowerCase())
  ) {
    const ws = ctx.workspaceId || '<workspaceId>'
    const proj = ctx.projectId ? ` ${ctx.projectId}` : ''
    const script = [
      'curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash',
      'export PATH="$HOME/.local/bin:$PATH"',
      'morph login',
      `morph use ${ws}${proj}`.trim(),
      'cd your-app && morph bind',
      'morph providers add codexin',
      'morph',
    ].join('\n')
    pushAction(
      actions,
      seen,
      {
        id: 'copy-cli-setup',
        label: 'Copy CLI setup',
        path: '',
        copyText: script,
        source: 'suggest',
        kind: 'copy',
      },
      4,
    )
  }

  return { cleanText, actions: actions.slice(0, 4) }
}

export function listAllResolvableDestinations(
  ctx: MorphRouteContext,
): Array<MorphNavDest & { pathResolved: string }> {
  const scope = resolveMorphScope(ctx)
  return destinationsForScope(scope)
    .map((d) => {
      const pathResolved = resolveMorphPath(d.path, ctx)
      return pathResolved ? { ...d, pathResolved } : null
    })
    .filter(Boolean) as Array<MorphNavDest & { pathResolved: string }>
}
