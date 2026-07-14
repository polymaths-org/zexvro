import type { RateLimitResult, RateLimitStore } from './domain.js'
import { MemoryRateLimitStore } from './stores.js'

export type { RateLimitResult }

/** Thin adapter over MemoryRateLimitStore for tests that prefer a class API. */
export class UnpaidRateLimiter {
  private readonly store: RateLimitStore

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    now: () => number = Date.now,
    store?: RateLimitStore,
  ) {
    this.store = store ?? new MemoryRateLimitStore(now)
  }

  async consume(key: string): Promise<RateLimitResult> {
    return this.store.consume(key, this.maxRequests, this.windowMs)
  }
}
