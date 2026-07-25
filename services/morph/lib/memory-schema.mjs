/**
 * Shared memory conventions for Morph + dashboard + future agents.
 *
 * Platform bag (username → DynamoDB memory object):
 *   projectMemory:<projectId>   → MemoryEntry[]
 *   workspaceMemory:<workspaceId> → MemoryEntry[]
 *   morph:*                     → scalar bindings (ids, urls — never secrets)
 *
 * MemoryEntry (JSON):
 *   id, service, summary, label, decisions[], blockers[], followUps[],
 *   filesChanged[], verification?, owner, source, date, createdAt?
 */

/** @param {Partial<{
 *   service: string
 *   summary: string
 *   label: string
 *   decisions: string[]
 *   blockers: string[]
 *   followUps: string[]
 *   filesChanged: string[]
 *   verification: string
 *   owner: string
 *   source: string
 * }>} partial */
export function makeMemoryEntry(partial) {
  const now = new Date()
  return {
    id: `mem-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    service: partial.service || 'Morph',
    summary: partial.summary || '',
    label: partial.label || 'context',
    decisions: partial.decisions || [],
    blockers: partial.blockers || [],
    followUps: partial.followUps || [],
    filesChanged: partial.filesChanged || [],
    verification: partial.verification || '',
    owner: partial.owner || 'Morph',
    source: partial.source || 'morph',
    date: 'Just now',
    createdAt: now.toISOString(),
  }
}

export function projectMemoryKey(projectId) {
  return `projectMemory:${projectId}`
}

export function workspaceMemoryKey(workspaceId) {
  return `workspaceMemory:${workspaceId}`
}
