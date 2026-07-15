import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAccessTokenMiddleware } from './auth.js'

describe('NFT API access-token middleware', () => {
  function appWithVerifier(verify: (token: string) => Promise<{ sub: string }>) {
    const app = express()
    app.use(createAccessTokenMiddleware({ verify }))
    app.get('/private', (_request, response) => {
      response.json({ subject: response.locals.nftIdentity.subject })
    })
    return app
  }

  it('rejects missing and invalid bearer tokens without leaking verifier errors', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('raw verifier detail'))
    const app = appWithVerifier(verify)

    await request(app).get('/private').expect(401, {
      error: { code: 'unauthorized', message: 'A valid access token is required' },
    })
    const invalid = await request(app)
      .get('/private')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)

    expect(invalid.text).not.toContain('raw verifier detail')
  })

  it('stores only the verified subject in request-local state', async () => {
    const verify = vi.fn().mockResolvedValue({ sub: 'cognito-subject' })

    const response = await request(appWithVerifier(verify))
      .get('/private')
      .set('Authorization', 'Bearer signed-token')
      .expect(200)

    expect(verify).toHaveBeenCalledWith('signed-token')
    expect(response.body).toEqual({ subject: 'cognito-subject' })
  })
})
