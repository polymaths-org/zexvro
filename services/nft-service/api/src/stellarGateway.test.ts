import { describe, expect, it } from 'vitest'
import {
  extractDeploymentResult,
  simulationFailureToApiError,
} from './stellarGateway.js'

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

describe('Stellar simulation failure mapping', () => {
  it('reports disabled primary sales before falling back to signer errors', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: Error(Contract, #6)"'),
    )

    expect(error).toMatchObject({
      status: 409,
      code: 'primary_sale_not_configured',
      message: expect.stringContaining('Primary sale is not configured'),
    })
  })

  it('reports duplicate token IDs from contract errors', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: Error(Contract, #3)"'),
    )

    expect(error).toMatchObject({
      status: 409,
      code: 'token_already_minted',
    })
  })

  it('ignores non-simulation errors', () => {
    expect(simulationFailureToApiError(new Error('network down'))).toBeUndefined()
  })
})
