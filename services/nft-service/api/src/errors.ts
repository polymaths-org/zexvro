import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'Request validation failed',
        details: error.issues,
      },
    })
    return
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    })
    return
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  response.status(500).json({
    error: {
      code: 'internal_error',
      message: 'The NFT service could not complete the request',
      details: process.env.NODE_ENV === 'production' ? undefined : message,
    },
  })
}
