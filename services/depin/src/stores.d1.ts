import type { D1Database } from '@cloudflare/workers-types'
import type { ReplayStore } from './domain.js'

/** One payment claim across isolates; duplicates do not rewrite the row. */
export class D1ReplayStore implements ReplayStore {
  constructor(private readonly db: D1Database, private readonly now = Date.now) {}
  async claim(key: string, ttlMs: number): Promise<boolean> {
    const now = this.now()
    const row = await this.db.prepare(`
      INSERT INTO depin_replays(key,expires_at) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at
      WHERE depin_replays.expires_at<=? RETURNING key
    `).bind(key,now+ttlMs,now).first()
    return Boolean(row)
  }
}
