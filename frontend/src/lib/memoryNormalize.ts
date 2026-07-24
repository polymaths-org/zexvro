import type { MemoryEntry, MemoryLabel } from '../types'

/** Coerce legacy / partial API rows into a full MemoryEntry */
export function normalizeMemoryEntry(raw: unknown): MemoryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<MemoryEntry> & Record<string, unknown>
  const id =
    typeof r.id === 'string' && r.id
      ? r.id
      : `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const summary = typeof r.summary === 'string' ? r.summary : ''
  if (!summary.trim() && !Array.isArray(r.decisions) && !Array.isArray(r.blockers)) return null

  const asLines = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
    if (typeof v === 'string' && v.trim()) return [v.trim()]
    return []
  }

  let label = (r.label as MemoryLabel) || 'general'
  if (!['decision', 'blocker', 'handoff', 'context', 'migration', 'general'].includes(label)) {
    label = 'general'
  }

  let decisions = asLines(r.decisions)
  let blockers = asLines(r.blockers)
  if (label === 'decision' && decisions.length === 0 && summary) decisions = [summary]
  if (label === 'blocker' && blockers.length === 0 && summary) blockers = [summary]

  return {
    id,
    service: typeof r.service === 'string' && r.service ? r.service : 'Other',
    filesChanged: asLines(r.filesChanged),
    summary: summary || decisions[0] || blockers[0] || 'Note',
    decisions,
    followUps: asLines(r.followUps),
    blockers,
    verification: typeof r.verification === 'string' ? r.verification : '',
    date: typeof r.date === 'string' ? r.date : '—',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
    owner: typeof r.owner === 'string' ? r.owner : 'You',
    source:
      r.source === 'morph' || r.source === 'cli' || r.source === 'system' || r.source === 'human'
        ? r.source
        : 'human',
    label,
    status: r.status === 'resolved' ? 'resolved' : 'open',
    resolvedAt: typeof r.resolvedAt === 'string' ? r.resolvedAt : undefined,
  }
}
