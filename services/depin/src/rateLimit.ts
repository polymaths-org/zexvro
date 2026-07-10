interface RateLimitEntry {
  count: number
  resetsAt: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export class UnpaidRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string): RateLimitResult {
    const timestamp = this.now()
    const current = this.entries.get(key)
    const entry =
      current === undefined || current.resetsAt <= timestamp
        ? { count: 0, resetsAt: timestamp + this.windowMs }
        : current
    entry.count += 1
    this.entries.set(key, entry)
    return {
      allowed: entry.count <= this.maxRequests,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetsAt - timestamp) / 1_000)),
    }
  }
}
