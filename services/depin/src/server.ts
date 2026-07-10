import { resolve } from 'node:path'
import { assertSecretReferences, loadConfig } from './config.js'
import { X402PaymentProtocol } from './payment.js'
import { createDepinApp } from './proxy.js'

const configPath = resolve(process.env.DEPIN_CONFIG_PATH ?? 'depin.config.json')
const config = await loadConfig(configPath)
assertSecretReferences(config, process.env)

const protocol = new X402PaymentProtocol(config)
await protocol.initialize()

createDepinApp({ config, protocol }).listen(config.port, () => {
  console.log(`De-pin gateway listening on http://localhost:${String(config.port)}`)
})
