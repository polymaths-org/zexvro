import express, { type RequestHandler } from 'express'
import multer, { MulterError } from 'multer'
import { StrKey } from './index.js'
import { z } from 'zod'
import { ApiError, errorHandler } from './errors.js'
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

const createCollectionSchema = z.object({
  workspaceId: identifier,
  name: z.string().trim().min(3).max(64),
  symbol: z.string().regex(/^[A-Z0-9]{2,10}$/),
  description: z.string().trim().min(10).max(1_000),
  ownerAddress: stellarAccount,
  baseMetadataUri,
  coverImageUri: ipfsUri,
  royaltyRecipient: stellarAccount,
  royaltyBps: z.number().int().min(0).max(1_000),
  externalUrl: z.url().optional(),
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

export function createApp(service: NftService) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'nft-service' })
  })

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
      const collection = await service.createCollection(
        createCollectionSchema.parse(request.body),
      )
      response.status(201).json({ collection })
    }),
  )

  app.get(
    '/v1/collections',
    asyncRoute(async (request, response) => {
      const { workspaceId } = z.object({ workspaceId: identifier }).parse(request.query)
      const collections = await service.listCollections(workspaceId)
      response.json({ collections })
    }),
  )

  app.get(
    '/v1/collections/:collectionId',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const collection = await service.getCollection(collectionId)
      response.json({ collection })
    }),
  )

  app.get(
    '/v1/collections/:collectionId/status',
    asyncRoute(async (request, response) => {
      const { collectionId } = z
        .object({ collectionId: z.uuid() })
        .parse(request.params)
      const collection = await service.getCollection(collectionId)
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
      const intent = await service.createCheckoutIntent({
        idempotencyKey,
        ...input,
      })
      response.status(201).json({ intent })
    }),
  )

  app.get(
    '/v1/checkout/intents/:intentId',
    asyncRoute(async (request, response) => {
      const { intentId } = z.object({ intentId: z.uuid() }).parse(request.params)
      const intent = await service.getCheckoutIntent(intentId)
      response.json({ intent })
    }),
  )

  app.post(
    '/v1/checkout/intents/:intentId/submit',
    asyncRoute(async (request, response) => {
      const { intentId } = z.object({ intentId: z.uuid() }).parse(request.params)
      const input = signedCheckoutSchema.parse(request.body)
      const intent = await service.submitCheckoutIntent({ intentId, ...input })
      response.status(201).json({ intent })
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
