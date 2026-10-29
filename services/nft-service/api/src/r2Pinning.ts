import { createHash } from 'node:crypto'
import type { PinnedAsset, PinningService } from './domain.js'
import type { PublicAssetReader } from './localPinning.js'
interface AssetBucket {
  head(key: string): Promise<{ key: string } | null>
  get(
    key: string,
  ): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>
    customMetadata?: Record<string, string>
    httpMetadata?: { contentType?: string }
  } | null>
  put(
    key: string,
    value: Uint8Array,
    options: {
      httpMetadata: { contentType: string }
      customMetadata: Record<string, string>
    },
  ): Promise<unknown>
}
export class R2AssetPinningService
  implements PinningService, PublicAssetReader
{
  constructor(
    private readonly bucket: AssetBucket,
    private readonly baseUrl: string,
  ) {}
  async pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset> {
    const bytes = Uint8Array.from(input.bytes)
    const id = createHash('sha256')
      .update(input.mimeType)
      .update('\0')
      .update(bytes)
      .digest('hex')
    // Content-addressing makes repeated uploads reuse the same object.
    const exists = await this.bucket.head(id)
    if (!exists)
      await this.bucket.put(id, bytes, {
        httpMetadata: { contentType: input.mimeType },
        customMetadata: { filename: input.filename.slice(0, 200) },
      })
    return {
      cid: id,
      uri: `${this.baseUrl}/v1/assets/${id}`,
      size: bytes.byteLength,
      mimeType: input.mimeType,
    }
  }
  async pinJson(input: { value: Record<string, unknown>; filename: string }) {
    return this.pinFile({
      bytes: new TextEncoder().encode(JSON.stringify(input.value)),
      filename: input.filename,
      mimeType: 'application/json',
    })
  }
  async readAsset(id: string) {
    const object = await this.bucket.get(id)
    if (!object) return undefined
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      filename: object.customMetadata?.filename || id,
      mimeType: object.httpMetadata?.contentType || 'application/octet-stream',
    }
  }
}
