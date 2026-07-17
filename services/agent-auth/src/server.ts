import { loadConfig } from './config.js'
import { createGateApp } from './app.js'
import { MemoryRepository } from './repository.js'
import { DynamoRepository } from './repository.dynamo.js'

const config = loadConfig()

const repo =
  config.stateBackend === 'dynamo'
    ? new DynamoRepository({ tableName: config.dynamoTable })
    : new MemoryRepository()

if (repo.kind === 'dynamo') {
  const dynamo = repo as DynamoRepository
  await dynamo.ensureDemoTenant()
  try {
    await dynamo.bootstrapFromCacheSeed()
    console.log(`Dynamo backend ready table=${config.dynamoTable}`)
  } catch (err) {
    console.warn(
      'Dynamo bootstrap failed (will still serve with cache seed):',
      err instanceof Error ? err.message : err,
    )
  }
} else {
  await repo.ensureDemoTenant()
}

const app = createGateApp(config, repo)

app.listen(config.port, () => {
  console.log(
    `ZEXVRO Gate (agent-auth) listening on http://localhost:${String(config.port)} issuer=${config.issuer} backend=${repo.kind}`,
  )
})
