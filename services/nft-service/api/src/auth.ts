import type { RequestHandler } from 'express'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

export interface NftIdentity {
  subject: string
}

declare module 'express-serve-static-core' {
  interface Locals {
    nftIdentity: NftIdentity
  }
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<{ sub: string }>
}

const unauthorized = {
  error: {
    code: 'unauthorized',
    message: 'A valid access token is required',
  },
}

export function createAccessTokenMiddleware(
  verifier: AccessTokenVerifier,
): RequestHandler {
  return (request, response, next) => {
    const authorization = request.header('Authorization')
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '')
    if (match?.[1] === undefined) {
      response.status(401).json(unauthorized)
      return
    }

    void verifier
      .verify(match[1])
      .then((payload) => {
        if (payload.sub === '') {
          response.status(401).json(unauthorized)
          return
        }
        response.locals.nftIdentity = { subject: payload.sub }
        next()
      })
      .catch(() => {
        response.status(401).json(unauthorized)
      })
  }
}

export function createCognitoAccessTokenMiddleware(input: {
  userPoolId: string
  clientId: string
}): RequestHandler {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: input.userPoolId,
    tokenUse: 'access',
    clientId: input.clientId,
  })
  return createAccessTokenMiddleware(verifier)
}
