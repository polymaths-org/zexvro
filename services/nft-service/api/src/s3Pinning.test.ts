import { describe, expect, it, vi } from 'vitest'
import { S3AssetPinningService } from './s3Pinning.js'

describe('S3AssetPinningService', () => {
  it('uploads to S3 and returns a CDN HTTPS URI', async () => {
    const send = vi.fn().mockResolvedValue({})
    const service = new S3AssetPinningService({
      bucket: 'zexvro-nft-assets',
      region: 'us-east-1',
      publicBaseUrl: 'https://cdn.example.com',
      client: { send } as never,
    })

    const asset = await service.pinFile({
      bytes: new Uint8Array([1, 2, 3, 4]),
      filename: 'cover.png',
      mimeType: 'image/png',
    })

    expect(asset.uri).toMatch(/^https:\/\/cdn\.example\.com\/nft\/[a-f0-9]{64}\.png$/)
    expect(asset.cid).toHaveLength(64)
    expect(asset.mimeType).toBe('image/png')
    expect(send).toHaveBeenCalledOnce()
    const command = send.mock.calls[0]?.[0] as {
      input: {
        Bucket: string
        Key: string
        ContentType: string
      }
    }
    expect(command.input.Bucket).toBe('zexvro-nft-assets')
    expect(command.input.Key).toMatch(/^nft\/[a-f0-9]{64}\.png$/)
    expect(command.input.ContentType).toBe('image/png')
  })

  it('falls back to regional S3 HTTPS URI when CDN base is unset', async () => {
    const send = vi.fn().mockResolvedValue({})
    const service = new S3AssetPinningService({
      bucket: 'zexvro-nft-assets',
      region: 'eu-west-1',
      client: { send } as never,
    })

    const asset = await service.pinJson({
      value: { name: 'Sky Forge' },
      filename: 'collection.json',
    })

    expect(asset.uri).toMatch(
      /^https:\/\/zexvro-nft-assets\.s3\.eu-west-1\.amazonaws\.com\/nft\/[a-f0-9]{64}\.json$/,
    )
    expect(asset.mimeType).toBe('application/json')
  })

  it('maps S3 failures to 502 without leaking credentials', async () => {
    const send = vi.fn().mockRejectedValue(new Error('AccessDenied'))
    const service = new S3AssetPinningService({
      bucket: 'zexvro-nft-assets',
      region: 'us-east-1',
      client: { send } as never,
    })

    await expect(
      service.pinFile({
        bytes: new Uint8Array([9]),
        filename: 'x.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      code: 's3_upload_failed',
      status: 502,
      details: { reason: 'AccessDenied' },
    })
  })
})
