import type { RequestHandler } from 'express'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { problem } from './challenges.js'
import { secretsEqual } from './crypto.js'

export interface AdminIdentity {
  subject: string
  via: 'dev' | 'cognito' | 'admin_key'
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
  /** Optional shared admin key for bootstrap / automation (Bearer or X-Gate-Admin-Key). */
  adminApiKey?: string
}

export function createAdminAuthMiddleware(config: AdminAuthConfig): RequestHandler {
  if (!config.requireAuth) {
    return (_req, res, next) => {
      res.locals.gateAdmin = { subject: 'dev-admin', via: 'dev' }
      next()
    }
  }

  const adminKey = config.adminApiKey?.trim() || ''
  const hasCognito = Boolean(config.userPoolId && config.clientId)

  if (!hasCognito && !adminKey) {
    return (_req, res) => {
      res
        .status(500)
        .json(
          problem(
            500,
            'admin_auth_misconfigured',
            'Admin auth required but Cognito and GATE_ADMIN_API_KEY are both missing',
          ),
        )
    }
  }

  // Accept access tokens (preferred) and id tokens (device-code / console may forward either).
  const accessVerifier = hasCognito
    ? CognitoJwtVerifier.create({
        userPoolId: config.userPoolId!,
        tokenUse: 'access',
        clientId: config.clientId!,
      })
    : null
  const idVerifier = hasCognito
    ? CognitoJwtVerifier.create({
        userPoolId: config.userPoolId!,
        tokenUse: 'id',
        clientId: config.clientId!,
      })
    : null

  return (request, response, next) => {
    if (request.method === 'OPTIONS') {
      next()
      return
    }

    const headerKey = request.header('x-gate-admin-key') || ''
    if (adminKey && headerKey && secretsEqual(adminKey, headerKey)) {
      response.locals.gateAdmin = { subject: 'admin-key', via: 'admin_key' }
      next()
      return
    }

    const authorization = request.header('Authorization')
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '')
    const token = match?.[1]

    if (adminKey && token && secretsEqual(adminKey, token)) {
      response.locals.gateAdmin = { subject: 'admin-key', via: 'admin_key' }
      next()
      return
    }

    if ((!accessVerifier && !idVerifier) || !token) {
      response
        .status(401)
        .json(
          problem(
            401,
            'unauthorized',
            'A valid Cognito access token or X-Gate-Admin-Key is required for admin routes',
          ),
        )
      return
    }

    void (async () => {
      try {
        let payload: { sub?: string } | null = null
        if (accessVerifier) {
          try {
            payload = await accessVerifier.verify(token)
          } catch {
            /* try id token next */
          }
        }
        if (!payload && idVerifier) {
          payload = await idVerifier.verify(token)
        }
        if (!payload?.sub) {
          response.status(401).json(problem(401, 'unauthorized', 'Invalid access token subject'))
          return
        }
        response.locals.gateAdmin = { subject: payload.sub, via: 'cognito' }
        next()
      } catch {
        response.status(401).json(problem(401, 'unauthorized', 'Invalid or expired access token'))
      }
    })()
  }
}
