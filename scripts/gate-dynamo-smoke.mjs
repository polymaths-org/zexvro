import { DynamoRepository } from '../services/agent-auth/dist/repository.dynamo.js'
import { randomId } from '../services/agent-auth/dist/crypto.js'

const table = process.env.GATE_DYNAMO_TABLE || 'zexvro-agent-auth'
const repo = new DynamoRepository({ tableName: table, region: 'us-east-1' })
await repo.ensureDemoTenant()
await repo.bootstrapFromCacheSeed()
const jti = randomId('jti')
const exp = Date.now() + 120_000
await repo.registerJti(jti, exp, 2)
const a = await repo.consumeJti(jti)
const b = await repo.consumeJti(jti)
const c = await repo.consumeJti(jti)
const site = await repo.getSiteByKey('zk_test_demo_public')
const agentPk = `pk_smoke_${Date.now()}`
await repo.putAgent({
  agentId: randomId('agent'),
  projectId: 'proj_demo',
  siteId: 'site_demo',
  publicKey: agentPk,
  name: 'dynamo-smoke',
  createdAt: new Date().toISOString(),
  allowedPayerPublicKeys: [agentPk],
  payMode: 'self',
})
const agent = await repo.getAgentByPublicKey('site_demo', agentPk)
console.log(
  JSON.stringify(
    {
      table,
      jti,
      consume: [a, b, c],
      siteId: site?.siteId,
      agentFound: Boolean(agent),
    },
    null,
    2,
  ),
)
