import { createHash } from 'node:crypto'

interface ReplayEntry {
  expiresAt: number
}

export class ReplayGuard {
  private readonly entries = new Map<string, ReplayEntry>()

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  fingerprint(paymentSignature: string): string {
    return createHash('sha256').update(paymentSignature).digest('hex')
  }

  claim(paymentSignature: string): boolean {
    const timestamp = this.now()
    this.prune(timestamp)
    const fingerprint = this.fingerprint(paymentSignature)
    if (this.entries.has(fingerprint)) return false
    this.entries.set(fingerprint, { expiresAt: timestamp + this.ttlMs })
    return true
  }

  private prune(timestamp: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= timestamp) this.entries.delete(key)
    }
  }
}
