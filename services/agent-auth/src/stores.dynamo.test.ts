import { describe, expect, it } from 'vitest'
import { createMemoryStores, seedDemoTenant } from './stores.js'
import { dynamoItemsToMemory, memoryToDynamoItems } from './stores.dynamo.js'

describe('dynamo codec', () => {
  it('roundtrips demo tenant', () => {
    const stores = createMemoryStores()
    seedDemoTenant(stores)
    stores.agents.set('agent_1', {
      agentId: 'agent_1',
      projectId: 'proj_demo',
      siteId: 'site_demo',
      publicKey: 'pk',
      name: 'a',
      createdAt: new Date().toISOString(),
      allowedPayerPublicKeys: ['pk'],
      payMode: 'self',
    })
    stores.replay.set('jti_x', Date.now() + 60_000)
    stores.reuseRemaining.set('jti_x', 3)

    const items = memoryToDynamoItems(stores)
    expect(items.some((i) => i.entity === 'site')).toBe(true)
    expect(items.some((i) => i.entity === 'agent')).toBe(true)
    expect(items.some((i) => i.entity === 'jti')).toBe(true)

    const restored = dynamoItemsToMemory(items)
    expect(restored.sites.get('site_demo')?.siteKey).toBe('zk_test_demo_public')
    expect(restored.siteKeyIndex.get('zk_test_demo_public')).toBe('site_demo')
    expect(restored.agents.get('agent_1')?.publicKey).toBe('pk')
    expect(restored.reuseRemaining.get('jti_x')).toBe(3)
  })
})
