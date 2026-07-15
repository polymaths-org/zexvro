import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FileStateStore,
  MemoryRateLimitStore,
  MemoryReplayStore,
  createStateStores,
} from './stores.js'

describe('state stores', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('memory replay rejects second claim', async () => {
    const store = new MemoryReplayStore(() => 1_000)
    await expect(store.claim('k1', 5_000)).resolves.toBe(true)
    await expect(store.claim('k1', 5_000)).resolves.toBe(false)
  })

  it('memory rate limit blocks after max', async () => {
    const store = new MemoryRateLimitStore(() => 1_000)
    await expect(store.consume('ip', 2, 60_000)).resolves.toMatchObject({ allowed: true })
    await expect(store.consume('ip', 2, 60_000)).resolves.toMatchObject({ allowed: true })
    await expect(store.consume('ip', 2, 60_000)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: expect.any(Number),
    })
  })

  it('file store shares replay and rate-limit state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'depin-state-'))
    tempDirs.push(dir)
    const path = join(dir, 'state.json')
    const storeA = new FileStateStore(path, () => 2_000)
    const storeB = new FileStateStore(path, () => 2_000)

    await expect(storeA.claim('pay-1', 10_000)).resolves.toBe(true)
    await expect(storeB.claim('pay-1', 10_000)).resolves.toBe(false)

    await expect(storeA.consume('client', 1, 60_000)).resolves.toMatchObject({
      allowed: true,
    })
    await expect(storeB.consume('client', 1, 60_000)).resolves.toMatchObject({
      allowed: false,
    })
  })

  it('createStateStores defaults to memory and supports file', async () => {
    const memory = createStateStores({})
    expect(memory.backend).toBe('memory')

    const dir = await mkdtemp(join(tmpdir(), 'depin-state-'))
    tempDirs.push(dir)
    const file = createStateStores({
      DEPIN_STATE_BACKEND: 'file',
      DEPIN_STATE_PATH: join(dir, 'shared.json'),
    })
    expect(file.backend).toBe('file')
    await expect(file.replayStore.claim('x', 1_000)).resolves.toBe(true)
  })

  it('rejects redis backend until implemented', () => {
    expect(() => createStateStores({ DEPIN_STATE_BACKEND: 'redis' })).toThrow(/not implemented/)
  })
})
