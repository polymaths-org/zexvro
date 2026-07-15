import { createHash } from 'node:crypto'
import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { ApiError } from './errors.js'
import type { PinnedAsset, PinningService } from './domain.js'

export interface S3PinningOptions {
  bucket: string
  region: string
  publicBaseUrl?: string | undefined
  keyPrefix?: string | undefined
  client?: S3Client
  clientConfig?: S3ClientConfig
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '')
}

function extensionFor(mimeType: string, filename: string): string {
  const fromName = filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : ''
  if (fromName.length >= 2 && fromName.length <= 12) return fromName
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'application/json') return '.json'
  return ''
}

export class S3AssetPinningService implements PinningService {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly region: string
  private readonly publicBaseUrl: string | undefined
  private readonly keyPrefix: string

  constructor(options: S3PinningOptions) {
    this.bucket = options.bucket
    this.region = options.region
    this.publicBaseUrl =
      options.publicBaseUrl === undefined
        ? undefined
        : normalizeBaseUrl(options.publicBaseUrl)
    this.keyPrefix = (options.keyPrefix ?? 'nft').replace(/^\/+|\/+$/g, '')
    this.client =
      options.client ??
      new S3Client({
        region: options.region,
        ...(options.clientConfig ?? {}),
      })
  }

  async pinFile(input: {
    bytes: Uint8Array
    filename: string
    mimeType: string
  }): Promise<PinnedAsset> {
    const bytes = Uint8Array.from(input.bytes)
    const digest = createHash('sha256')
      .update(input.mimeType)
      .update('\0')
      .update(input.filename)
      .update('\0')
      .update(bytes)
      .digest('hex')
    const extension = extensionFor(input.mimeType, input.filename)
    const key = `${this.keyPrefix}/${digest}${extension}`

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: input.mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
    } catch (error) {
      throw new ApiError(502, 's3_upload_failed', 'S3 rejected the upload', {
        reason: error instanceof Error ? error.message : 'unknown',
      })
    }

    const uri =
      this.publicBaseUrl === undefined
        ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
        : `${this.publicBaseUrl}/${key}`

    return {
      cid: digest,
      uri,
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
}
