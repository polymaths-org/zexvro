import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalAssetPinningService } from './localPinning.js'

describe('LocalAssetPinningService', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    )
  })

  it('stores content-addressed assets and returns a public local URL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zexvro-assets-'))
    directories.push(directory)
    const service = new LocalAssetPinningService(
      directory,
      'http://127.0.0.1:4101',
    )

    const pinned = await service.pinFile({
      bytes: new Uint8Array([1, 2, 3, 4]),
      filename: 'cover.png',
      mimeType: 'image/png',
    })
    const stored = await service.readAsset(pinned.cid)

    expect(pinned.uri).toBe(`http://127.0.0.1:4101/v1/assets/${pinned.cid}`)
    expect(stored).toMatchObject({ filename: 'cover.png', mimeType: 'image/png' })
    expect(Array.from(stored?.bytes ?? [])).toEqual([1, 2, 3, 4])
  })

  it('rejects malformed asset identifiers', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zexvro-assets-'))
    directories.push(directory)
    const service = new LocalAssetPinningService(
      directory,
      'http://127.0.0.1:4101',
    )

    await expect(service.readAsset('../secret')).resolves.toBeUndefined()
  })
})
