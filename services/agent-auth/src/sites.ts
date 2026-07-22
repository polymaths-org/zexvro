import { randomBytes } from 'node:crypto'
import type { SiteRecord } from './domain.js'
import { hashSecret, randomId } from './crypto.js'
import type { GateRepository } from './repository.js'

export interface CreateSiteInput {
  name: string
  allowedOrigins: string[]
  projectId?: string
}

export interface CreateSiteResult {
  site: SiteRecord
  secretKey: string
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

export function normalizeOrigins(origins: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of origins) {
    const o = normalizeOrigin(raw)
    if (!o) continue
    try {
      const u = new URL(o)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
      if (u.username || u.password) continue
      // origin only (no path)
      const canon = `${u.protocol}//${u.host}`
      if (seen.has(canon)) continue
      seen.add(canon)
      out.push(canon)
    } catch {
      /* skip invalid */
    }
  }
  return out
}

export function generateSiteKey(): string {
  return `zk_live_${randomBytes(18).toString('base64url')}`
}

export function generateSiteSecret(): string {
  return `sk_live_${randomBytes(24).toString('base64url')}`
}

export async function createSite(
  repo: GateRepository,
  input: CreateSiteInput,
): Promise<CreateSiteResult> {
  const allowedOrigins = normalizeOrigins(input.allowedOrigins)
  if (allowedOrigins.length === 0) {
    throw new Error('allowedOrigins_required')
  }
  const name = input.name.trim()
  if (name.length < 2) throw new Error('name_required')

  const siteId = randomId('site')
  const siteKey = generateSiteKey()
  const secretKey = generateSiteSecret()
  const site: SiteRecord = {
    siteId,
    projectId: input.projectId?.trim() || 'proj_default',
    siteKey,
    secretHash: hashSecret(secretKey),
    allowedOrigins,
    name,
    createdAt: new Date().toISOString(),
  }
  await repo.createSite(site, secretKey)
  return { site, secretKey }
}
