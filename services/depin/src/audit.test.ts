import { describe, expect, it } from 'vitest'
import { redactAuditValue } from './audit.js'

describe('audit redaction', () => {
  it('redacts nested credentials and payment signatures', () => {
    expect(
      redactAuditValue({
        event: 'test',
        authorization: 'Bearer upstream-secret',
        nested: {
          paymentSignature: 'signed-payment',
          access_token: 'token-value',
          status: 200,
        },
      }),
    ).toEqual({
      event: 'test',
      authorization: '[REDACTED]',
      nested: {
        paymentSignature: '[REDACTED]',
        access_token: '[REDACTED]',
        status: 200,
      },
    })
  })
})
