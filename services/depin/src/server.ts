import { loadConfigFromEnvironment, assertSecretReferences } from './config.js'
import { facilitatorSettleReadiness } from './facilitator.js'
import { X402PaymentProtocol } from './payment.js'
import { createDepinApp } from './proxy.js'
import { createStateStores } from './stores.js'

const { config, source } = await loadConfigFromEnvironment()
assertSecretReferences(config, process.env)

const state = createStateStores(process.env)
const facilitator = facilitatorSettleReadiness(config.facilitatorUrl, process.env)

if (
  process.env.NODE_ENV === 'production' &&
  state.backend === 'memory' &&
  process.env.DEPIN_ALLOW_MEMORY_STATE !== '1'
) {
  console.warn(
    '[depin] DEPIN_STATE_BACKEND=memory is not multi-instance safe in production. ' +
      'Set DEPIN_STATE_BACKEND=file (and DEPIN_STATE_PATH) or DEPIN_ALLOW_MEMORY_STATE=1 to silence.',
  )
}

if (!facilitator.settleReady) {
  console.warn(
    '[depin] Facilitator requires auth for settle (OpenZeppelin Channels) but OZ_API_KEY / X402_FACILITATOR_API_KEY is unset. ' +
      'Unpaid 402 probes still work; paid settle will fail until a key is provided.',
  )
}

const protocol = new X402PaymentProtocol(config)
await protocol.initialize()

createDepinApp({
  config,
  protocol,
  configSource: source,
  stateBackend: state.backend,
  replayStore: state.replayStore,
  rateLimitStore: state.rateLimitStore,
}).listen(config.port, () => {
  console.log(
    `De-pin gateway listening on http://localhost:${String(config.port)} ` +
      `configSource=${source.type}:${source.detail} stateBackend=${state.backend} ` +
      `settleReady=${String(facilitator.settleReady)} multiInstanceSafe=${String(state.backend === 'file')}`,
  )
})
