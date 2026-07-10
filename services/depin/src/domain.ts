import type { Request } from 'express'
import type {
  HTTPRequestContext,
  HTTPResponseInstructions,
  PaymentCancellationDispatcher,
  ProcessSettleResultResponse,
} from '@x402/core/server'
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types'

export interface ProviderConfig {
  route: string
  method: 'GET' | 'HEAD'
  upstreamUrl: string
  description: string
  price: string
  recipient: string
  network: 'stellar:testnet'
  timeoutMs: number
  upstreamSecretRef?: string | undefined
}

export interface DepinConfig {
  port: number
  facilitatorUrl: string
  maxUpstreamResponseBytes: number
  replayTtlMs: number
  unpaidRateLimit: {
    maxRequests: number
    windowMs: number
  }
  providers: ProviderConfig[]
}

export interface VerifiedPayment {
  requestContext: HTTPRequestContext
  paymentPayload: PaymentPayload
  paymentRequirements: PaymentRequirements
  declaredExtensions?: Record<string, unknown>
  cancellationDispatcher: PaymentCancellationDispatcher
}

export type PaymentDecision =
  | { type: 'verified'; payment: VerifiedPayment }
  | { type: 'payment-error'; response: HTTPResponseInstructions }

export interface PaymentProtocol {
  initialize(): Promise<void>
  authorize(request: Request): Promise<PaymentDecision>
  settle(
    payment: VerifiedPayment,
    responseBody: Buffer,
    responseHeaders: Record<string, string>,
  ): Promise<ProcessSettleResultResponse>
  cancel(
    payment: VerifiedPayment,
    input: {
      reason: 'handler_threw' | 'handler_failed'
      error?: unknown
      responseStatus?: number
    },
  ): Promise<void>
}

export interface AuditRecord {
  event: string
  level?: 'info' | 'error'
  requestId?: string
  route?: string
  method?: string
  status?: number
  reason?: string
  durationMs?: number
  transaction?: string
}

export interface AuditLogger {
  info(record: AuditRecord): void
  error(record: AuditRecord): void
}
