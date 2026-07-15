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

  it('maps owner-only and unauthorized minter contract errors', () => {
    expect(
      simulationFailureToApiError(
        new Error('Transaction simulation failed: "HostError: Error(Contract, #1)"'),
      ),
    ).toMatchObject({
      status: 403,
      code: 'collection_owner_required',
    })
    expect(
      simulationFailureToApiError(
        new Error('Transaction simulation failed: "HostError: Error(Contract, #2)"'),
      ),
    ).toMatchObject({
      status: 403,
      code: 'unauthorized_minter',
    })
  })

  it('detects missing trustline errors from SAC token transfers', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: missing entry for trustline"'),
    )

    expect(error).toMatchObject({
      status: 422,
      code: 'buyer_missing_trustline',
    })
    expect(error?.details).toMatchObject({
      simulationError: expect.stringContaining('trustline'),
    })
  })

  it('detects storage-level missing entry errors', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: Error(Storage, #1)"'),
    )

    expect(error).toMatchObject({
      status: 422,
      code: 'buyer_missing_trustline',
    })
  })

  it('detects insufficient balance errors from token transfers', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: insufficient balance for transfer"'),
    )

    expect(error).toMatchObject({
      status: 422,
      code: 'buyer_insufficient_balance',
    })
    expect(error?.details).toMatchObject({
      simulationError: expect.stringContaining('insufficient'),
    })
  })

  it('detects value-level errors as balance issues', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: Error(Value, #2)"'),
    )

    expect(error).toMatchObject({
      status: 422,
      code: 'buyer_insufficient_balance',
    })
  })

  it('detects unauthorized token holder errors', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: not authorized to hold asset"'),
    )

    expect(error).toMatchObject({
      status: 422,
      code: 'buyer_not_authorized',
    })
  })

  it('includes raw simulation error in the generic 502 fallback', () => {
    const error = simulationFailureToApiError(
      new Error('Transaction simulation failed: "HostError: Error(WasmVm, InternalError)"'),
    )

    expect(error).toMatchObject({
      status: 502,
      code: 'stellar_simulation_failed',
    })
    expect(error?.details).toMatchObject({
      simulationError: expect.stringContaining('WasmVm'),
    })
  })

  it('ignores non-simulation errors', () => {
    expect(simulationFailureToApiError(new Error('network down'))).toBeUndefined()
  })
})
