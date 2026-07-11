import cors from 'cors'
import express, { type RequestHandler } from 'express'
import multer, { MulterError } from 'multer'
import { StrKey } from './index.js'
import { z } from 'zod'
import type { CheckoutIntentRecord, CollectionRecord } from './domain.js'
import { ApiError, errorHandler } from './errors.js'
import type { PublicAssetReader } from './localPinning.js'
import { NftService } from './service.js'

const stellarAccount = z.string().refine(StrKey.isValidEd25519PublicKey, {
  message: 'Expected a Stellar G-address',
})

const identifier = z.string().trim().min(1).max(128)
const ipfsUri = z
  .string()
  .regex(/^ipfs:\/\/[A-Za-z0-9]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*\/?$/)
const baseMetadataUri = ipfsUri.refine((value) => value.endsWith('/'), {
  message: 'Base metadata URI must end with a slash',
})
const httpAssetUri = z.url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'http:' || url.protocol === 'https:'
}, 'Asset URI must use HTTP(S)')
const assetUri = z.union([ipfsUri, httpAssetUri])

const createCollectionSchema = z.object({
  workspaceId: identifier,
  name: z.string().trim().min(3).max(64),
  symbol: z.string().regex(/^[A-Z0-9]{2,10}$/),
  description: z.string().trim().min(10).max(1_000),
  ownerAddress: stellarAccount,
  baseMetadataUri: baseMetadataUri.optional(),
  coverImageUri: assetUri,
  royaltyRecipient: stellarAccount,
  royaltyBps: z.number().int().min(0).max(1_000),
  externalUrl: httpAssetUri.optional(),
})

const updateCollectionSchema = createCollectionSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one collection field is required',
  })

const mintPrepareSchema = z.object({
  operatorAddress: stellarAccount,
  recipientAddress: stellarAccount,
  tokenId: z.number().int().min(0).max(4_294_967_295),
})

const salePrepareSchema = z.object({
  ownerAddress: stellarAccount,
  priceAtomic: z
    .string()
    .regex(/^[1-9]\d{0,38}$/)
    .refine((value) => BigInt(value) <= (1n << 127n) - 1n, {
      message: 'Price exceeds the Soroban i128 range',
    })
    .transform((value) => BigInt(value)),
})

const transactionSubmissionSchema = z.object({
  preparedTransaction: z.string().min(1).max(500_000),
  signedTransaction: z.string().min(1).max(500_000),
})

const checkoutSchema = z.object({
  collectionId: z.uuid(),
  buyerAddress: stellarAccount,
  tokenId: z.number().int().min(0).max(4_294_967_295),
})

const signedCheckoutSchema = z.object({
  signedTransaction: z.string().min(1).max(500_000),
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      callback(
        new ApiError(
          415,
          'unsupported_media_type',
          'Only PNG, JPEG, and WebP images are accepted',
        ),
      )
      return
    }
    callback(null, true)
  },
})

const asyncRoute = (handler: RequestHandler): RequestHandler => handler

export interface NftServiceCapabilities {
  network: 'stellar:testnet'
  pinningConfigured: boolean
  stellarConfigured: boolean
  storageMode: 'pinata' | 'local'
}

interface CreateAppOptions {
  authenticate: RequestHandler
  capabilities: NftServiceCapabilities
  allowedOrigins: string[]
  assetReader?: PublicAssetReader
}

function subjectScope(subject: string): string {
  return Buffer.from(subject).toString('base64url')
}

function scopeWorkspace(subject: string, workspaceId: string): string {
  return `${subjectScope(subject)}.${Buffer.from(workspaceId).toString('base64url')}`
}

function presentCollection(
  collection: CollectionRecord,
  subject: string,
): CollectionRecord {
  const prefix = `${subjectScope(subject)}.`
  if (!collection.workspaceId.startsWith(prefix)) {
    throw new ApiError(404, 'collection_not_found', 'Collection not found')
  }
  return {
    ...collection,
    workspaceId: Buffer.from(
      collection.workspaceId.slice(prefix.length),
      'base64url',
    ).toString('utf8'),
  }
}

async function requireOwnedCollection(
  service: NftService,
  collectionId: string,
  subject: string,
): Promise<CollectionRecord> {
  const collection = await service.getCollection(collectionId)
  presentCollection(collection, subject)
  return collection
}

function scopeIdempotencyKey(subject: string, key: string): string {
  return `${subjectScope(subject)}.${key}`
}

function presentIntent(
  intent: CheckoutIntentRecord,
  subject: string,
): CheckoutIntentRecord {
  const prefix = `${subjectScope(subject)}.`
  if (!intent.idempotencyKey.startsWith(prefix)) {
    throw new ApiError(404, 'checkout_intent_not_found', 'Checkout intent not found')
  }
  return { ...intent, idempotencyKey: intent.idempotencyKey.slice(prefix.length) }
}

function publicCheckoutIdempotencyKey(buyerAddress: string, key: string): string {
  return `public.${Buffer.from(buyerAddress).toString('base64url')}.${key}`
}

function presentPublicCollection(collection: CollectionRecord) {
  if (collection.status !== 'live') {
    throw new ApiError(404, 'collection_not_found', 'Collection not found')
  }
  return {
    id: collection.id,
    name: collection.name,
    symbol: collection.symbol,
    description: collection.description,
    baseMetadataUri: collection.baseMetadataUri,
    collectionMetadataUri: collection.collectionMetadataUri,
    coverImageUri: collection.coverImageUri,
    royaltyBps: collection.royaltyBps,
    ...(collection.externalUrl === undefined ? {} : { externalUrl: collection.externalUrl }),
    ...(collection.primarySale === undefined ? {} : { primarySale: collection.primarySale }),
    status: collection.status,
    contractId: collection.contractId,
    deploymentTxHash: collection.deploymentTxHash,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  }
}

function presentPublicIntent(intent: CheckoutIntentRecord) {
  return {
    id: intent.id,
    collectionId: intent.collectionId,
    tokenId: intent.tokenId,
    buyerAddress: intent.buyerAddress,
    serializedTransaction: intent.serializedTransaction,
    requiredSigners: intent.requiredSigners,
    status: intent.status,
    expiresAt: intent.expiresAt,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    ...(intent.transactionHash === undefined ? {} : { transactionHash: intent.transactionHash }),
    ...(intent.failureReason === undefined ? {} : { failureReason: intent.failureReason }),
  }
}

export function createApp(service: NftService, options: CreateAppOptions) {
  const app = express()
  app.disable('x-powered-by')
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(
          null,
          origin === undefined || options.allowedOrigins.includes(origin),
        )
      },
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'nft-service',
      capabilities: options.capabilities,
    })
  })

  app.get(
    '/v1/assets/:assetId',
    asyncRoute(async (request, response) => {
      if (options.assetReader === undefined) {
        throw new ApiError(404, 'asset_not_found', 'Asset not found')
      }
      const { assetId } = z
        .object({ assetId: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(request.params)
      const asset = await options.assetReader.readAsset(assetId)
      if (asset === undefined) {
        throw new ApiError(404, 'asset_not_found', 'Asset not found')
      }
      response.setHeader('Content-Type', asset.mimeType)
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      response.setHeader('ETag', `"${assetId}"`)
      response.send(Buffer.from(asset.bytes))
    }),
  )

  app.get(
    '/v1/public/collections/:collectionId/tokens/:tokenId',
    asyncRoute(async (request, response) => {
      const { collectionId, tokenId } = z
        .object({
          collectionId: z.uuid(),
          tokenId: z.coerce.number().int().min(0).max(4_294_967_295),
        })
        .parse(request.params)
      const metadata = await service.getPublicTokenMetadata(collectionId, tokenId)
      response.setHeader('Cache-Control', 'public, max-age=60')
      response.json(metadata)
    }),
  )

  app.get(
    '/v1/public/collections/:collectionId',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const collection = await service.getCollection(collectionId)
      response.setHeader('Cache-Control', 'public, max-age=60')
      response.json({ collection: presentPublicCollection(collection) })
    }),
  )

  app.post(
    '/v1/public/checkout/intents',
    asyncRoute(async (request, response) => {
      const idempotencyKey = request.header('Idempotency-Key')
      if (idempotencyKey === undefined || idempotencyKey.length > 128) {
        throw new ApiError(
          400,
          'idempotency_key_required',
          'A valid Idempotency-Key header is required',
        )
      }
      const input = checkoutSchema.parse(request.body)
      const intent = await service.createCheckoutIntent({
        idempotencyKey: publicCheckoutIdempotencyKey(
          input.buyerAddress,
          idempotencyKey,
        ),
        ...input,
      })
      response.status(201).json({ intent: presentPublicIntent(intent) })
    }),
  )

  app.post(
    '/v1/public/checkout/intents/:intentId/submit',
    asyncRoute(async (request, response) => {
      const { intentId } = z.object({ intentId: z.uuid() }).parse(request.params)
      const input = signedCheckoutSchema.parse(request.body)
      const current = await service.getCheckoutIntent(intentId)
      if (!current.idempotencyKey.startsWith('public.')) {
        throw new ApiError(404, 'checkout_intent_not_found', 'Checkout intent not found')
      }
      const intent = await service.submitCheckoutIntent({ intentId, ...input })
      response.status(201).json({ intent: presentPublicIntent(intent) })
    }),
  )

  app.use(options.authenticate)

  app.post(
    '/v1/media',
    upload.single('file'),
    asyncRoute(async (request, response) => {
      if (request.file === undefined) {
        throw new ApiError(400, 'file_required', 'A file field is required')
      }
      const asset = await service.uploadMedia({
        bytes: request.file.buffer,
        filename: request.file.originalname,
        mimeType: request.file.mimetype,
      })
      response.status(201).json({ asset })
    }),
  )

  app.post(
    '/v1/collections',
    asyncRoute(async (request, response) => {
      const input = createCollectionSchema.parse(request.body)
      const subject = response.locals.nftIdentity.subject
      const collection = await service.createCollection({
        ...input,
        workspaceId: scopeWorkspace(subject, input.workspaceId),
      })
      response.status(201).json({
        collection: presentCollection(collection, subject),
      })
    }),
  )

  app.get(
    '/v1/collections',
    asyncRoute(async (request, response) => {
      const { workspaceId } = z.object({ workspaceId: identifier }).parse(request.query)
      const subject = response.locals.nftIdentity.subject
      const collections = await service.listCollections(
        scopeWorkspace(subject, workspaceId),
      )
      response.json({
        collections: collections.map((collection) =>
          presentCollection(collection, subject),
        ),
      })
    }),
  )

  app.get(
    '/v1/collections/:collectionId',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const subject = response.locals.nftIdentity.subject
      const collection = await requireOwnedCollection(
        service,
        collectionId,
        subject,
      )
      response.json({ collection: presentCollection(collection, subject) })
    }),
  )

  app.patch(
    '/v1/collections/:collectionId',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const input = updateCollectionSchema.parse(request.body)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const collection = await service.updateFailedCollection(collectionId, input)
      response.json({
        collection: presentCollection(
          collection,
          response.locals.nftIdentity.subject,
        ),
      })
    }),
  )

  app.post(
    '/v1/collections/:collectionId/retry',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const collection = await service.retryCollectionDeployment(collectionId)
      response.status(201).json({
        collection: presentCollection(
          collection,
          response.locals.nftIdentity.subject,
        ),
      })
    }),
  )

  app.delete(
    '/v1/collections/:collectionId',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      await service.deleteCollection(collectionId)
      response.status(204).send()
    }),
  )

  app.get(
    '/v1/collections/:collectionId/status',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const collection = await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      response.json({
        collectionId: collection.id,
        status: collection.status,
        contractId: collection.contractId,
        transactionHash: collection.deploymentTxHash,
        failureReason: collection.failureReason,
      })
    }),
  )

  app.post(
    '/v1/collections/:collectionId/sale-config/intent',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const { ownerAddress, priceAtomic } = salePrepareSchema.parse(request.body)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const intent = await service.prepareSaleConfig({
        collectionId,
        ownerAddress,
        price: priceAtomic,
      })
      response.status(201).json({ intent })
    }),
  )

  app.post(
    '/v1/collections/:collectionId/sale-config/submit',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const input = transactionSubmissionSchema.parse(request.body)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const transaction = await service.submitSaleConfig({ collectionId, ...input })
      response.status(201).json({ transaction })
    }),
  )

  app.post(
    '/v1/collections/:collectionId/mints/intent',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const input = mintPrepareSchema.parse(request.body)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const intent = await service.prepareMint({ collectionId, ...input })
      response.status(201).json({ intent })
    }),
  )

  app.post(
    '/v1/collections/:collectionId/mints/submit',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const input = transactionSubmissionSchema.parse(request.body)
      await requireOwnedCollection(
        service,
        collectionId,
        response.locals.nftIdentity.subject,
      )
      const transaction = await service.submitMint({ collectionId, ...input })
      response.status(201).json({ transaction })
    }),
  )

  app.post(
    '/v1/checkout/intents',
    asyncRoute(async (request, response) => {
      const idempotencyKey = request.header('Idempotency-Key')
      if (idempotencyKey === undefined || idempotencyKey.length > 128) {
        throw new ApiError(
          400,
          'idempotency_key_required',
          'A valid Idempotency-Key header is required',
        )
      }
      const input = checkoutSchema.parse(request.body)
      const subject = response.locals.nftIdentity.subject
      const intent = await service.createCheckoutIntent({
        idempotencyKey: scopeIdempotencyKey(subject, idempotencyKey),
        ...input,
      })
      response.status(201).json({ intent: presentIntent(intent, subject) })
    }),
  )

  app.get(
    '/v1/checkout/intents/:intentId',
    asyncRoute(async (request, response) => {
      const { intentId } = z.object({ intentId: z.uuid() }).parse(request.params)
      const intent = await service.getCheckoutIntent(intentId)
      const subject = response.locals.nftIdentity.subject
      response.json({ intent: presentIntent(intent, subject) })
    }),
  )

  app.post(
    '/v1/checkout/intents/:intentId/submit',
    asyncRoute(async (request, response) => {
      const { intentId } = z.object({ intentId: z.uuid() }).parse(request.params)
      const input = signedCheckoutSchema.parse(request.body)
      const subject = response.locals.nftIdentity.subject
      const current = await service.getCheckoutIntent(intentId)
      presentIntent(current, subject)
      const intent = await service.submitCheckoutIntent({ intentId, ...input })
      response.status(201).json({ intent: presentIntent(intent, subject) })
    }),
  )

  app.use((_request, _response, next) => {
    next(new ApiError(404, 'route_not_found', 'Route not found'))
  })

  app.use((error: unknown, _request: unknown, _response: unknown, next: (error: unknown) => void) => {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'file_too_large', 'Images must be 5 MB or smaller'))
      return
    }
    next(error)
  })
  app.use(errorHandler)
  return app
}
