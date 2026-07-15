import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk'
import { x402Client, x402HTTPClient } from '@x402/fetch'
import { createEd25519Signer, getNetworkPassphrase } from '@x402/stellar'
import { ExactStellarScheme } from '@x402/stellar/exact/client'

const network = 'stellar:testnet'

async function main() {
  const privateKey = process.env.STELLAR_PRIVATE_KEY
  if (privateKey === undefined || privateKey === '') {
    throw new Error('STELLAR_PRIVATE_KEY is required')
  }

  const target = new URL(
    process.env.DEPIN_URL ?? 'http://127.0.0.1:4102/v1/nft-health',
  )
  const expectedRecipient = process.env.DEPIN_EXPECTED_RECIPIENT
  if (expectedRecipient === undefined || expectedRecipient === '') {
    throw new Error('DEPIN_EXPECTED_RECIPIENT is required')
  }
  const maximumAmount = BigInt(
    process.env.DEPIN_MAX_PAYMENT_ATOMIC ?? '10000',
  )
  const signer = createEd25519Signer(privateKey, network)
  const client = new x402Client().register(
    'stellar:*',
    new ExactStellarScheme(signer, {
      url: 'https://soroban-testnet.stellar.org',
    }),
  )
  const httpClient = new x402HTTPClient(client)

  const challenge = await fetch(target)
  if (challenge.status !== 402) {
    throw new Error(`Expected HTTP 402, received ${String(challenge.status)}`)
  }

  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    challenge.headers.get(name),
  )
  const requirement = paymentRequired.accepts.find(
    (candidate) =>
      candidate.scheme === 'exact' && candidate.network === network,
  )
  if (requirement === undefined) {
    throw new Error('The gateway did not offer exact Stellar testnet payment')
  }
  if (requirement.payTo !== expectedRecipient) {
    throw new Error('The payment recipient does not match the expected provider')
  }
  if (BigInt(requirement.amount) > maximumAmount) {
    throw new Error('The requested payment exceeds the configured demo limit')
  }

  let paymentPayload = await client.createPaymentPayload(paymentRequired)
  const transactionXdr = paymentPayload.payload.transaction
  if (typeof transactionXdr !== 'string') {
    throw new Error('The Stellar payment payload did not contain a transaction')
  }

  const networkPassphrase = getNetworkPassphrase(network)
  const transaction = new Transaction(transactionXdr, networkPassphrase)
  const sorobanData = transaction.toEnvelope().v1()?.tx().ext().sorobanData()
  if (sorobanData !== undefined) {
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(transaction, {
          fee: '1',
          networkPassphrase,
          sorobanData,
        })
          .build()
          .toXDR(),
      },
    }
  }

  console.log(
    `Authorizing ${requirement.amount} atomic USDC from ${signer.address} to ${requirement.payTo}`,
  )
  const response = await fetch(target, {
    headers: httpClient.encodePaymentSignatureHeader(paymentPayload),
  })
  const body = await response.text()
  const settlement = response.headers.has('PAYMENT-RESPONSE')
    ? httpClient.getPaymentSettleResponse((name) => response.headers.get(name))
    : undefined

  if (!response.ok) {
    throw new Error(
      `Paid request failed with HTTP ${String(response.status)}: ${body}`,
    )
  }

  console.log(`Access granted: HTTP ${String(response.status)} ${body}`)
  console.log(`Settlement: ${JSON.stringify(settlement)}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown client error'
  if (message.includes('resulting balance is not within the allowed range')) {
    console.error('The buyer needs at least 0.001 testnet USDC before payment')
  } else {
    console.error(message)
  }
  process.exitCode = 1
})
