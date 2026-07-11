import { describe, expect, it } from 'vitest'
import { extractDeploymentResult } from './stellarGateway.js'

const contractId = 'CCJDPP5VB74QI7CO656L7PQGXKOHI7RQ5PGGQXMM2CUWQ3SYEFXF3KRT'

describe('Stellar deployment result parsing', () => {
  it('accepts the SDK generic deploy result client shape', () => {
    const deployment = extractDeploymentResult({
      sendTransactionResponse: { hash: 'submit-hash' },
      result: {
        options: {
          contractId,
        },
      },
    })

    expect(deployment).toEqual({
      contractId,
      transactionHash: 'submit-hash',
    })
  })

  it('falls back to the finalized transaction hash', () => {
    const deployment = extractDeploymentResult({
      getTransactionResponse: { txHash: 'final-hash' },
      result: {
        options: {
          contractId,
        },
      },
    })

    expect(deployment?.transactionHash).toBe('final-hash')
  })

  it('rejects incomplete deployment results', () => {
    expect(
      extractDeploymentResult({
        sendTransactionResponse: { hash: 'submit-hash' },
        result: { options: { contractId: 'not-a-contract' } },
      }),
    ).toBeUndefined()
    expect(
      extractDeploymentResult({
        result: { options: { contractId } },
      }),
    ).toBeUndefined()
  })
})
