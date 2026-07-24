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
  source: 'model' | 'suggest'
}

/** [[nav:reqwid|Open REQWID]] */
const NAV_RE = /\[\[nav:([a-z0-9_-]+)\|([^\]]+)\]\]/gi

export function extractMorphActions(
  text: string,
  ctx: MorphRouteContext,
): { cleanText: string; actions: MorphAction[] } {
  const actions: MorphAction[] = []
  const seen = new Set<string>()

  const scope = resolveMorphScope(ctx)
  const allowedIds = new Set(destinationsForScope(scope).map((d) => d.id))

  const cleanText = text
    .replace(NAV_RE, (_full, id: string, label: string) => {
      const destId = String(id).toLowerCase()
      const dest = getMorphDestination(destId)
      if (!dest || !allowedIds.has(dest.id)) return ''
      // Workspace Morph: never resolve project-only paths
      if (scope === 'workspace' && dest.needsProject) return ''
      const path = resolveMorphPath(dest.path, ctx)
      if (!path) return ''
      const key = path
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({
          id: dest.id,
          label: label.trim() || dest.label,
          path,
          source: 'model',
        })
      }
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleanText, actions }
}

export function mergeSuggestedActions(
  userText: string,
  existing: MorphAction[],
  ctx: MorphRouteContext,
  limit = 2,
): MorphAction[] {
  const seen = new Set(existing.map((a) => a.path))
  const out = [...existing]
  for (const dest of suggestMorphDestinations(userText, ctx, limit + 2)) {
    const path = resolveMorphPath(dest.path, ctx)
    if (!path || seen.has(path)) continue
    seen.add(path)
    out.push({
      id: dest.id,
      label: dest.label,
      path,
      source: 'suggest',
    })
    if (out.length >= existing.length + limit) break
  }
  return out
}

export function quickStartActions(ctx: MorphRouteContext): MorphAction[] {
  const scope = resolveMorphScope(ctx)
  const ids =
    scope === 'project'
      ? (['reqwid', 'nft', 'depin', 'project-memory'] as const)
      : (['projects', 'credits', 'team', 'memory'] as const)
  const out: MorphAction[] = []
  for (const id of ids) {
    const dest = getMorphDestination(id)
    if (!dest) continue
    if (scope === 'workspace' && dest.needsProject) continue
    const path = resolveMorphPath(dest.path, ctx)
    if (!path) continue
    out.push({ id: dest.id, label: dest.label, path, source: 'suggest' })
  }
  return out
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
