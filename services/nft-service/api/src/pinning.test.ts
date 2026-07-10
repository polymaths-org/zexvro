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

    expect(asset.uri).toBe('ipfs://bafytest')
    const [, options] = fetchMock.mock.calls[0] ?? []
    expect(options?.headers).toEqual({ Authorization: 'Bearer server-secret' })
    const form = options?.body as FormData
    expect(form.get('network')).toBe('public')
  })

  it('fails closed when credentials are absent or Pinata rejects an upload', async () => {
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
    ).rejects.toMatchObject({ code: 'pinata_upload_failed', status: 502 })
  })
})
