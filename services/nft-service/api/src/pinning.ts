import { ApiError } from './errors.js'
import type { PinnedAsset, PinningService } from './domain.js'

interface PinataUploadResponse {
  data?: {
    cid?: string
    size?: number
    mime_type?: string
  }
}

export class PinataPinningService implements PinningService {
  constructor(
    private readonly jwt: string | undefined,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset> {
    if (this.jwt === undefined) {
      throw new ApiError(
        503,
        'pinning_not_configured',
        'PINATA_JWT is required for media and metadata uploads',
      )
    }

    const form = new FormData()
    form.set('network', 'public')
    form.set('name', input.filename)
    form.set(
      'file',
      new File([Uint8Array.from(input.bytes).buffer], input.filename, {
        type: input.mimeType,
      }),
    )

    let response: Response
    try {
      response = await this.fetchImplementation('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.jwt}` },
        body: form,
      })
    } catch (error) {
      throw new ApiError(502, 'pinata_unreachable', 'Pinata upload could not be reached', {
        reason: error instanceof Error ? error.message : 'unknown',
      })
    }

    const payload = (await response.json().catch(() => ({}))) as PinataUploadResponse
    if (!response.ok || payload.data?.cid === undefined) {
      throw new ApiError(502, 'pinata_upload_failed', 'Pinata rejected the upload', {
        status: response.status,
      })
    }

    return {
      cid: payload.data.cid,
      uri: `ipfs://${payload.data.cid}`,
      size: payload.data.size ?? input.bytes.byteLength,
      mimeType: payload.data.mime_type ?? input.mimeType,
    }
  }

  async pinJson(input: {
    value: Record<string, unknown>
    filename: string
  }): Promise<PinnedAsset> {
    return this.pinFile({
      bytes: new TextEncoder().encode(JSON.stringify(input.value)),
      filename: input.filename,
      mimeType: 'application/json',
    })
  }
}
