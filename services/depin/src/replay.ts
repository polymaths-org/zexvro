import { createHash } from 'node:crypto'
import type { ReplayStore } from './domain.js'
import { MemoryReplayStore } from './stores.js'

export function paymentFingerprint(paymentSignature: string): string {
  return createHash('sha256').update(paymentSignature).digest('hex')
}

export async function claimPaymentReplay(
  store: ReplayStore,
  paymentSignature: string,
  ttlMs: number,
): Promise<boolean> {
  return store.claim(paymentFingerprint(paymentSignature), ttlMs)
}

/** Thin adapter over MemoryReplayStore for tests that prefer a class API. */
export class ReplayGuard {
  private readonly store: ReplayStore

  constructor(
    private readonly ttlMs: number,
    now: () => number = Date.now,
    store?: ReplayStore,
  ) {
    this.store = store ?? new MemoryReplayStore(now)
  }

  fingerprint(paymentSignature: string): string {
    return paymentFingerprint(paymentSignature)
  }

  async claim(paymentSignature: string): Promise<boolean> {
    return claimPaymentReplay(this.store, paymentSignature, this.ttlMs)
  }
}
