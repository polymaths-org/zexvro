import type { RequestHandler } from 'express'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { problem } from './challenges.js'

export interface AdminIdentity {
  subject: string
}

declare module 'express-serve-static-core' {
  interface Locals {
    gateAdmin?: AdminIdentity
  }
}

export interface AdminAuthConfig {
  /** When false, admin routes are open (local/dev only). */
  requireAuth: boolean
  userPoolId?: string
  clientId?: string
}

export function createAdminAuthMiddleware(config: AdminAuthConfig): RequestHandler {
  if (!config.requireAuth) {
    return (_req, res, next) => {
      res.locals.gateAdmin = { subject: 'dev-admin' }
      next()
    }
  }

  if (!config.userPoolId || !config.clientId) {
    return (_req, res) => {
      res
        .status(500)
        .json(
          problem(
            500,
            'admin_auth_misconfigured',
            'GATE_ADMIN_REQUIRE_AUTH is true but Cognito pool/client are missing',
          ),
        )
    }
  }

  const verifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  })

  return (request, response, next) => {
    if (request.method === 'OPTIONS') {
      next()
      return
    }
    const authorization = request.header('Authorization')
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '')
    if (match?.[1] === undefined) {
      response
        .status(401)
        .json(problem(401, 'unauthorized', 'A valid Cognito access token is required for admin routes'))
      return
    }
    void verifier
      .verify(match[1])
      .then((payload) => {
        if (!payload.sub) {
          response.status(401).json(problem(401, 'unauthorized', 'Invalid access token subject'))
          return
        }
        response.locals.gateAdmin = { subject: payload.sub }
        next()
      })
      .catch(() => {
        response.status(401).json(problem(401, 'unauthorized', 'Invalid or expired access token'))
      })
  }
}
