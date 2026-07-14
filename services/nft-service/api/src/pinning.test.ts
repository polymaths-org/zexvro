import { describe, expect, it, vi } from 'vitest'
import { PinataPinningService } from './pinning.js'

describe('PinataPinningService', () => {
  it('keeps the JWT server-side and uploads to public IPFS', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { cid: 'bafytest', size: 4, mime_type: 'image/png' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const service = new PinataPinningService('server-secret', fetchMock)

    const asset = await service.pinFile({
      bytes: new Uint8Array([1, 2, 3, 4]),
      filename: 'cover.png',
      mimeType: 'image/png',
    })

    expect(asset).toEqual({
      cid: 'bafytest',
      uri: 'ipfs://bafytest',
      size: 4,
      mimeType: 'image/png',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://uploads.pinata.cloud/v3/files',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer server-secret' },
      }),
    )
    const [, options] = fetchMock.mock.calls[0] ?? []
    const form = options?.body as FormData
    expect(form.get('network')).toBe('public')
    expect(form.get('name')).toBe('cover.png')
  })

  it('pins JSON as application/json and returns an ipfs URI', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { cid: 'bafymeta', size: 12, mime_type: 'application/json' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const service = new PinataPinningService('server-secret', fetchMock)

    const asset = await service.pinJson({
      value: { name: 'Sky Forge', schema_version: 1 },
      filename: 'collection.json',
    })

    expect(asset.uri).toBe('ipfs://bafymeta')
    expect(asset.mimeType).toBe('application/json')
    const [, options] = fetchMock.mock.calls[0] ?? []
    const form = options?.body as FormData
    expect(form.get('name')).toBe('collection.json')
  })

  it('fails closed when credentials are absent, rejected, empty, or unreachable', async () => {
    const unconfigured = new PinataPinningService(undefined)
    await expect(
      unconfigured.pinJson({ value: { name: 'test' }, filename: 'test.json' }),
    ).rejects.toMatchObject({ code: 'pinning_not_configured', status: 503 })

    const rejected = new PinataPinningService(
      'secret',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'denied' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(
      rejected.pinJson({ value: { name: 'test' }, filename: 'test.json' }),
    ).rejects.toMatchObject({
      code: 'pinata_upload_failed',
      status: 502,
      details: { status: 401 },
    })

    const emptyCid = new PinataPinningService(
      'secret',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data: { cid: '' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    await expect(
      emptyCid.pinFile({
        bytes: new Uint8Array([1]),
        filename: 'x.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: 'pinata_upload_failed', status: 502 })

    const unreachable = new PinataPinningService(
      'secret',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNREFUSED')),
    )
    await expect(
      unreachable.pinFile({
        bytes: new Uint8Array([1]),
        filename: 'x.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      code: 'pinata_unreachable',
      status: 502,
      details: { reason: 'ECONNREFUSED' },
    })
  })

  it('never includes the JWT in error payloads', async () => {
    const jwt = 'super-secret-jwt-value'
    const service = new PinataPinningService(
      jwt,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'nope' }), { status: 500 }),
      ),
    )

    try {
      await service.pinFile({
        bytes: new Uint8Array([1]),
        filename: 'x.png',
        mimeType: 'image/png',
      })
      throw new Error('expected pinFile to fail')
    } catch (error) {
      const serialized = JSON.stringify(error)
      expect(serialized).not.toContain(jwt)
      expect(serialized).not.toContain('Bearer')
    }
  })
})
