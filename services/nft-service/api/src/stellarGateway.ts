import {
  Address,
  BASE_FEE,
  Client,
  Keypair,
  StrKey,
  TransactionBuilder,
  contract,
  rpc,
  scValToNative,
} from './index.js'
import type { AssembledTransaction } from '@stellar/stellar-sdk/contract'
import type { Operation as StellarOperation } from '@stellar/stellar-sdk'
import type {
  CollectionDeploymentInput,
  DeploymentResult,
  NftChainGateway,
  PreparedContractCall,
  SubmissionResult,
} from './domain.js'
import { ApiError } from './errors.js'

interface StellarGatewayConfig {
  rpcUrl: string
  networkPassphrase: string
  sponsorSecret: string
  collectionWasmHash: string
}

interface ExpectedInvocation {
  contractId: string
  method: 'mint' | 'purchase' | 'set_sale_config'
  arguments: unknown[]
}

interface DeploymentSentTransaction {
  sendTransactionResponse?: { hash?: unknown }
  getTransactionResponse?: { txHash?: unknown }
  result?: unknown
}

export function extractDeploymentResult(
  sent: DeploymentSentTransaction,
): DeploymentResult | undefined {
  const transactionHash =
    typeof sent.sendTransactionResponse?.hash === 'string'
      ? sent.sendTransactionResponse.hash
      : typeof sent.getTransactionResponse?.txHash === 'string'
        ? sent.getTransactionResponse.txHash
        : undefined
  const contractId = extractContractId(sent.result)

  if (transactionHash === undefined || contractId === undefined) return undefined
  return { contractId, transactionHash }
}

function extractContractId(result: unknown): string | undefined {
  if (result === null || typeof result !== 'object') return undefined
  const options = (result as { options?: unknown }).options
  if (options === null || typeof options !== 'object') return undefined
  const contractId = (options as { contractId?: unknown }).contractId
  if (typeof contractId !== 'string' || !StrKey.isValidContract(contractId)) {
    return undefined
  }
  return contractId
}

export function simulationFailureToApiError(error: unknown): ApiError | undefined {
  const message = error instanceof Error ? error.message : ''
  if (
    !message.includes('Transaction simulation failed') &&
    !message.includes('HostError')
  ) {
    return undefined
  }

  const contractError = /Error\(Contract, #(\d+)\)/.exec(message)?.[1]
  if (contractError === '3') {
    return new ApiError(
      409,
      'token_already_minted',
      'That token ID is already minted. Choose another token ID.',
    )
  }
  if (contractError === '5') {
    return new ApiError(
      400,
      'invalid_primary_sale_price',
      'Primary sale price must be greater than zero.',
    )
  }
  if (contractError === '6') {
    return new ApiError(
      409,
      'primary_sale_not_configured',
      'Primary sale is not configured for this collection yet. The creator must sign and submit sale configuration before buyers can prepare checkout.',
    )
  }

  return new ApiError(
    502,
    'stellar_simulation_failed',
    'Stellar simulation failed before producing a signable transaction.',
  )
}

export class UnavailableNftChainGateway implements NftChainGateway {
  private unavailable(): never {
    throw new ApiError(
      503,
      'stellar_not_configured',
      'STELLAR_SPONSOR_SECRET and NFT_COLLECTION_WASM_HASH are required',
    )
  }

  async deployCollection(_input: CollectionDeploymentInput): Promise<DeploymentResult> {
    return this.unavailable()
  }

  async prepareMint(): Promise<PreparedContractCall> {
    return this.unavailable()
  }

  async submitMint(): Promise<SubmissionResult> {
    return this.unavailable()
  }

  async prepareSaleConfig(): Promise<PreparedContractCall> {
    return this.unavailable()
  }

  async submitSaleConfig(): Promise<SubmissionResult> {
    return this.unavailable()
  }

  async prepareCheckout(): Promise<PreparedContractCall> {
    return this.unavailable()
  }

  async submitCheckout(): Promise<SubmissionResult> {
    return this.unavailable()
  }

  async getTransactionStatus(): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
    return this.unavailable()
  }
}

export class StellarNftChainGateway implements NftChainGateway {
  private readonly sponsor: Keypair
  private readonly signer: ReturnType<typeof contract.basicNodeSigner>
  private readonly server: rpc.Server
  private submissionQueue: Promise<void> = Promise.resolve()

  constructor(private readonly config: StellarGatewayConfig) {
    try {
      this.sponsor = Keypair.fromSecret(config.sponsorSecret)
    } catch {
      throw new Error('STELLAR_SPONSOR_SECRET is not a valid Stellar secret key')
    }

    if (!/^[0-9a-f]{64}$/i.test(config.collectionWasmHash)) {
      throw new Error('NFT_COLLECTION_WASM_HASH must be a 32-byte hexadecimal hash')
    }

    this.signer = contract.basicNodeSigner(this.sponsor, config.networkPassphrase)
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: new URL(config.rpcUrl).protocol === 'http:',
    })
  }

  async deployCollection(input: CollectionDeploymentInput): Promise<DeploymentResult> {
    return this.withSubmissionLock(async () => {
      const transaction = await Client.deploy(
        {
          owner: input.ownerAddress,
          name: input.name,
          symbol: input.symbol,
          base_uri: input.baseMetadataUri,
          royalty_receiver: input.royaltyRecipient,
          royalty_bps: input.royaltyBps,
        },
        {
          ...this.clientOptions(),
          wasmHash: this.config.collectionWasmHash,
          format: 'hex',
          timeoutInSeconds: 60,
        },
      )

      const sent = await transaction.signAndSend()
      const deployment = extractDeploymentResult(sent)
      if (deployment === undefined) {
        throw new ApiError(
          502,
          'stellar_deployment_incomplete',
          'Stellar accepted the deployment but did not return its final identifiers',
        )
      }

      return deployment
    })
  }

  async prepareMint(input: {
    contractId: string
    operatorAddress: string
    recipientAddress: string
    tokenId: number
  }): Promise<PreparedContractCall> {
    const client = this.client(input.contractId)
    const transaction = await client.mint({
      operator: input.operatorAddress,
      to: input.recipientAddress,
      token_id: input.tokenId,
    })
    return this.serializePrepared(transaction)
  }

  async submitMint(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult> {
    const client = this.client(input.contractId)
    const expected = client.fromJSON.mint(input.expectedSerializedTransaction)
    const transaction = client.fromJSON.mint(input.serializedTransaction)
    this.assertExpectedInvocation(expected, input.contractId, 'mint')
    const invocation = this.readInvocation(expected)
    this.assertEquivalent(transaction, expected, invocation)
    return this.submit(transaction)
  }

  async prepareSaleConfig(input: {
    contractId: string
    ownerAddress: string
    paymentTokenAddress: string
    price: bigint
  }): Promise<PreparedContractCall> {
    const client = this.client(input.contractId)
    const transaction = await client.set_sale_config({
      operator: input.ownerAddress,
      payment_token: input.paymentTokenAddress,
      price: input.price,
    })
    return this.serializePrepared(transaction)
  }

  async submitSaleConfig(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult> {
    const client = this.client(input.contractId)
    const expected = client.fromJSON.set_sale_config(
      input.expectedSerializedTransaction,
    )
    const transaction = client.fromJSON.set_sale_config(input.serializedTransaction)
    this.assertExpectedInvocation(expected, input.contractId, 'set_sale_config')
    const invocation = this.readInvocation(expected)
    this.assertEquivalent(transaction, expected, invocation)
    return this.submit(transaction)
  }

  async prepareCheckout(input: {
    contractId: string
    buyerAddress: string
    tokenId: number
  }): Promise<PreparedContractCall> {
    const client = this.client(input.contractId)
    const transaction = await client.purchase({
      buyer: input.buyerAddress,
      token_id: input.tokenId,
    })
    return this.serializePrepared(transaction)
  }

  async submitCheckout(input: {
    contractId: string
    expectedSerializedTransaction: string
    serializedTransaction: string
  }): Promise<SubmissionResult> {
    const client = this.client(input.contractId)
    const expected = client.fromJSON.purchase(input.expectedSerializedTransaction)
    const transaction = client.fromJSON.purchase(input.serializedTransaction)
    this.assertExpectedInvocation(expected, input.contractId, 'purchase')
    const invocation = this.readInvocation(expected)
    this.assertEquivalent(transaction, expected, invocation)
    return this.submit(transaction)
  }

  async getTransactionStatus(
    transactionHash: string,
  ): Promise<'pending' | 'confirmed' | 'failed' | 'not_found'> {
    const result = await this.server.getTransaction(transactionHash)
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return 'confirmed'
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) return 'failed'
    return 'not_found'
  }

  private client(contractId: string): Client {
    return new Client({
      contractId,
      ...this.clientOptions(),
    })
  }

  private clientOptions() {
    return {
      rpcUrl: this.config.rpcUrl,
      networkPassphrase: this.config.networkPassphrase,
      publicKey: this.sponsor.publicKey(),
      signTransaction: this.signer.signTransaction,
      allowHttp: new URL(this.config.rpcUrl).protocol === 'http:',
    }
  }

  private serializePrepared(transaction: AssembledTransaction<unknown>): PreparedContractCall {
    let serializedTransaction: string
    try {
      serializedTransaction = transaction.toJSON()
    } catch (error) {
      throw simulationFailureToApiError(error) ?? error
    }

    const requiredSigners = transaction.needsNonInvokerSigningBy()
    if (requiredSigners.length === 0) {
      throw new ApiError(
        422,
        'authorization_not_required',
        'The prepared call did not require the expected creator or buyer authorization',
      )
    }
    return {
      serializedTransaction,
      requiredSigners,
    }
  }

  private async submit(transaction: AssembledTransaction<unknown>): Promise<SubmissionResult> {
    const missingSigners = transaction.needsNonInvokerSigningBy()
    if (missingSigners.length > 0) {
      throw new ApiError(
        422,
        'missing_authorization',
        'The contract authorization entries are not fully signed',
        { missingSigners },
      )
    }

    return this.withSubmissionLock(() => this.submitWithFreshSponsorSequence(transaction))
  }

  private async submitWithFreshSponsorSequence(
    transaction: AssembledTransaction<unknown>,
  ): Promise<SubmissionResult> {
    const built = transaction.built
    const operation = built?.toEnvelope().v1().tx().operations()[0]
    if (operation === undefined) {
      throw new ApiError(400, 'invalid_transaction', 'Expected one contract invocation')
    }

    const account = await this.server.getAccount(this.sponsor.publicKey())
    const rebuilt = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build()
    const prepared = await this.server.prepareTransaction(rebuilt)
    prepared.sign(this.sponsor)
    const sent = await this.server.sendTransaction(prepared)
    if (sent.status !== 'PENDING' && sent.status !== 'DUPLICATE') {
      throw new ApiError(
        502,
        'stellar_submission_failed',
        `Stellar rejected transaction submission with status ${sent.status}`,
      )
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = await this.server.getTransaction(sent.hash)
      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return { transactionHash: sent.hash, status: 'confirmed' }
      }
      if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new ApiError(
          502,
          'stellar_transaction_failed',
          'The sponsored Stellar transaction failed on-chain',
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }

    throw new ApiError(
      504,
      'stellar_transaction_timeout',
      'Stellar did not confirm the transaction before the timeout',
    )
  }

  private withSubmissionLock<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.submissionQueue.then(operation, operation)
    this.submissionQueue = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }

  private assertEquivalent(
    signed: AssembledTransaction<unknown>,
    expected: AssembledTransaction<unknown>,
    expectedInvocation: ExpectedInvocation,
  ): void {
    const signedTransaction = signed.built
    const expectedTransaction = expected.built
    if (signedTransaction === undefined || expectedTransaction === undefined) {
      throw new ApiError(400, 'invalid_transaction', 'The transaction is not simulated')
    }

    const signedInvocation = this.readInvocation(signed)
    const stableEnvelopeMatches =
      signedTransaction.source === this.sponsor.publicKey() &&
      signedTransaction.source === expectedTransaction.source &&
      signedTransaction.sequence === expectedTransaction.sequence &&
      signedTransaction.fee === expectedTransaction.fee &&
      JSON.stringify(signedTransaction.timeBounds) ===
        JSON.stringify(expectedTransaction.timeBounds) &&
      signedInvocation.contractId === expectedInvocation.contractId &&
      signedInvocation.method === expectedInvocation.method &&
      JSON.stringify(signedInvocation.arguments) ===
        JSON.stringify(expectedInvocation.arguments)

    if (!stableEnvelopeMatches) {
      throw new ApiError(
        422,
        'transaction_mismatch',
        'The signed transaction does not match the checkout or mint intent',
      )
    }
  }

  private assertExpectedInvocation(
    transaction: AssembledTransaction<unknown>,
    contractId: string,
    method: ExpectedInvocation['method'],
  ): void {
    const invocation = this.readInvocation(transaction)
    if (invocation.contractId !== contractId || invocation.method !== method) {
      throw new ApiError(
        422,
        'transaction_mismatch',
        'The prepared transaction targets an unexpected contract or method',
      )
    }
  }

  private readInvocation(transaction: AssembledTransaction<unknown>): ExpectedInvocation {
    const operation = transaction.built?.operations[0] as
      | StellarOperation.InvokeHostFunction
      | undefined
    if (operation?.type !== 'invokeHostFunction') {
      throw new ApiError(400, 'invalid_transaction', 'Expected one contract invocation')
    }

    const hostFunction = operation.func
    if (hostFunction.switch().name !== 'hostFunctionTypeInvokeContract') {
      throw new ApiError(400, 'invalid_transaction', 'Expected a contract call')
    }

    const invocation = hostFunction.invokeContract()
    const method = invocation.functionName().toString()
    if (
      method !== 'mint' &&
      method !== 'purchase' &&
      method !== 'set_sale_config'
    ) {
      throw new ApiError(422, 'invalid_contract_method', 'Unexpected contract method')
    }

    return {
      contractId: Address.fromScAddress(invocation.contractAddress()).toString(),
      method,
      arguments: invocation.args().map((argument) => scValToNative(argument) as unknown),
    }
  }
}
