import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PinnedAsset, PinningService } from './domain.js'

interface StoredAssetMetadata {
  filename: string
  mimeType: string
  size: number
}

export interface PublicAsset {
  bytes: Uint8Array
  filename: string
  mimeType: string
}

export interface PublicAssetReader {
  readAsset(id: string): Promise<PublicAsset | undefined>
}

export class LocalAssetPinningService
  implements PinningService, PublicAssetReader
{
  private readonly publicBaseUrl: string

  constructor(
    private readonly directory: string,
    publicBaseUrl: string,
  ) {
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '')
  }

  async pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset> {
    const bytes = Uint8Array.from(input.bytes)
    const id = createHash('sha256')
      .update(input.mimeType)
      .update('\0')
      .update(input.filename)
      .update('\0')
      .update(bytes)
      .digest('hex')
    const metadata: StoredAssetMetadata = {
      filename: input.filename.slice(0, 255),
      mimeType: input.mimeType,
      size: bytes.byteLength,
    }

    await mkdir(this.directory, { recursive: true })
    await writeFile(join(this.directory, `${id}.bin`), bytes, { mode: 0o600 })
    await writeFile(
      join(this.directory, `${id}.json`),
      JSON.stringify(metadata),
      { encoding: 'utf8', mode: 0o600 },
    )

    return {
      cid: id,
      uri: `${this.publicBaseUrl}/v1/assets/${id}`,
      size: bytes.byteLength,
      mimeType: input.mimeType,
    }
  }

  pinJson(input: {
    value: Record<string, unknown>
    filename: string
  }): Promise<PinnedAsset> {
    return this.pinFile({
      bytes: new TextEncoder().encode(JSON.stringify(input.value)),
      filename: input.filename,
      mimeType: 'application/json',
    })
  }

  async readAsset(id: string): Promise<PublicAsset | undefined> {
    if (!/^[a-f0-9]{64}$/.test(id)) return undefined
    try {
      const [bytes, metadataRaw] = await Promise.all([
        readFile(join(this.directory, `${id}.bin`)),
        readFile(join(this.directory, `${id}.json`), 'utf8'),
      ])
      const metadata = JSON.parse(metadataRaw) as Partial<StoredAssetMetadata>
      if (
        typeof metadata.filename !== 'string' ||
        typeof metadata.mimeType !== 'string' ||
        metadata.size !== bytes.byteLength
      ) {
        return undefined
      }
      return {
        bytes,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }
}
