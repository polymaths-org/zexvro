import express from 'express'
import { loadConfig } from './config.js'
import { createGateApp } from './app.js'
import { MemoryRepository } from './repository.js'
import { DynamoRepository } from './repository.dynamo.js'

const config = loadConfig()

// Production must never fall back to the dev signing default.
if (config.isProd && config.signingSecret === 'dev-only-change-me-please') {
  console.error(
    'Fatal: AGENT_AUTH_SIGNING_SECRET is missing or still the dev default in production',
  )
  process.exit(1)
}

const repo =
  config.stateBackend === 'dynamo'
    ? new DynamoRepository({ tableName: config.dynamoTable })
    : new MemoryRepository()

if (repo.kind === 'dynamo') {
  const dynamo = repo as DynamoRepository
  // Never seed demo tenant in production.
  if (!config.isProd) {
    await dynamo.ensureDemoTenant()
  }
  try {
    await dynamo.bootstrapFromCacheSeed()
    console.log(`Dynamo backend ready table=${config.dynamoTable}`)
  } catch (err) {
    console.warn(
      'Dynamo bootstrap failed (empty table is OK until sites are provisioned):',
      err instanceof Error ? err.message : err,
    )
  }
} else if (!config.isProd) {
  await repo.ensureDemoTenant()
}

const gate = createGateApp(config, repo)
const root = express()
root.disable('x-powered-by')

// Public mount: https://api.zexvro.in/gate → basePath `/gate`
// Also expose the same routes at `/` so App Runner health checks can hit /health.
if (config.basePath) {
  root.use(config.basePath, gate)
}
root.use(gate)

root.get('/', (_req, res) => {
  res.json({
    service: 'zexvro-gate',
    issuer: config.issuer,
    basePath: config.basePath || '/',
    health: config.basePath ? `${config.basePath}/health` : '/health',
  })
})

root.listen(config.port, () => {
  console.log(
    `ZEXVRO Gate listening on :${String(config.port)} issuer=${config.issuer} basePath=${config.basePath || '/'} backend=${repo.kind} isProd=${String(config.isProd)}`,
  )
})
