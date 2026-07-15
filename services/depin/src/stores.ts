import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RateLimitResult, RateLimitStore, ReplayStore } from './domain.js'

interface ReplayEntry {
  expiresAt: number
}

interface RateLimitEntry {
  count: number
  resetsAt: number
}

interface FileStateDocument {
  replays: Record<string, ReplayEntry>
  rateLimits: Record<string, RateLimitEntry>
}

export class MemoryReplayStore implements ReplayStore {
  private readonly entries = new Map<string, ReplayEntry>()

  constructor(private readonly now: () => number = Date.now) {}

  async claim(key: string, ttlMs: number): Promise<boolean> {
    const timestamp = this.now()
    this.prune(timestamp)
    if (this.entries.has(key)) return false
    this.entries.set(key, { expiresAt: timestamp + ttlMs })
    return true
  }

  private prune(timestamp: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= timestamp) this.entries.delete(key)
    }
  }
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(private readonly now: () => number = Date.now) {}

  async consume(
    key: string,
    max: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const timestamp = this.now()
    const current = this.entries.get(key)
    const entry =
      current === undefined || current.resetsAt <= timestamp
        ? { count: 0, resetsAt: timestamp + windowMs }
        : current
    entry.count += 1
    this.entries.set(key, entry)
    return {
      allowed: entry.count <= max,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetsAt - timestamp) / 1_000)),
    }
  }
}

export class FileStateStore implements ReplayStore, RateLimitStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly path: string,
    private readonly now: () => number = Date.now,
  ) {}

  async claim(key: string, ttlMs: number): Promise<boolean> {
    return this.withDocument((document, timestamp) => {
      const entry = document.replays[key]
      if (entry !== undefined && entry.expiresAt > timestamp) return false
      document.replays[key] = { expiresAt: timestamp + ttlMs }
      return true
    })
  }

  async consume(
    key: string,
    max: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    return this.withDocument((document, timestamp) => {
      const current = document.rateLimits[key]
      const entry =
        current === undefined || current.resetsAt <= timestamp
          ? { count: 0, resetsAt: timestamp + windowMs }
          : current
      entry.count += 1
      document.rateLimits[key] = entry
      return {
        allowed: entry.count <= max,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetsAt - timestamp) / 1_000),
        ),
      }
    })
  }

  private async withDocument<T>(
    mutate: (document: FileStateDocument, timestamp: number) => T,
  ): Promise<T> {
    const run = this.writeQueue.then(async () => {
      const document = await this.readDocument()
      const timestamp = this.now()
      this.prune(document, timestamp)
      const result = mutate(document, timestamp)
      await this.writeDocument(document)
      return result
    })
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async readDocument(): Promise<FileStateDocument> {
    try {
      const raw = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw) as Partial<FileStateDocument>
      return {
        replays:
          parsed.replays !== undefined && typeof parsed.replays === 'object'
            ? parsed.replays
            : {},
        rateLimits:
          parsed.rateLimits !== undefined && typeof parsed.rateLimits === 'object'
            ? parsed.rateLimits
            : {},
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { replays: {}, rateLimits: {} }
      }
      throw error
    }
  }

  private async writeDocument(document: FileStateDocument): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const tempPath = `${this.path}.${String(process.pid)}.tmp`
    await writeFile(tempPath, `${JSON.stringify(document)}\n`, 'utf8')
    await rename(tempPath, this.path)
  }

  private prune(document: FileStateDocument, timestamp: number): void {
    for (const [key, entry] of Object.entries(document.replays)) {
      if (entry.expiresAt <= timestamp) delete document.replays[key]
    }
    for (const [key, entry] of Object.entries(document.rateLimits)) {
      if (entry.resetsAt <= timestamp) delete document.rateLimits[key]
    }
  }
}

export interface DepinStateStores {
  backend: 'memory' | 'file'
  replayStore: ReplayStore
  rateLimitStore: RateLimitStore
}

export function createStateStores(
  environment: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): DepinStateStores {
  const backend = (environment.DEPIN_STATE_BACKEND ?? 'memory').toLowerCase()
  if (backend === 'redis') {
    throw new Error(
      'DEPIN_STATE_BACKEND=redis is not implemented yet; use memory or file',
    )
  }
  if (backend === 'file') {
    const path = environment.DEPIN_STATE_PATH ?? '.data/depin-state.json'
    const store = new FileStateStore(path, now)
    return {
      backend: 'file',
      replayStore: store,
      rateLimitStore: store,
    }
  }
  if (backend !== 'memory') {
    throw new Error(
      `Unsupported DEPIN_STATE_BACKEND=${backend}; expected memory|file|redis`,
    )
  }
  return {
    backend: 'memory',
    replayStore: new MemoryReplayStore(now),
    rateLimitStore: new MemoryRateLimitStore(now),
  }
}
