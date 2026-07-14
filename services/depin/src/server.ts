import { loadConfigFromEnvironment, assertSecretReferences } from './config.js'
import { X402PaymentProtocol } from './payment.js'
import { createDepinApp } from './proxy.js'
import { createStateStores } from './stores.js'

const { config, source } = await loadConfigFromEnvironment()
assertSecretReferences(config, process.env)

const state = createStateStores(process.env)
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
    `De-pin gateway listening on http://localhost:${String(config.port)} configSource=${source.type}:${source.detail} stateBackend=${state.backend}`,
  )
})
