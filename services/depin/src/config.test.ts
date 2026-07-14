import { describe, expect, it } from 'vitest'
import {
  assertSecretReferences,
  loadConfigFromEnvironment,
  parseConfig,
  parseConfigJson,
} from './config.js'

const recipient = 'GCSPMRWNIC4CLCGGWX42GH4TFXC3RAHNO5VHMKHRPBN6EJ56T6AZTDK3'

const valid = {
  providers: [
    {
      route: '/v1/weather',
      method: 'GET',
      upstreamUrl: 'https://api.example.com/weather',
      description: 'Weather data',
      price: '$0.001',
      recipient,
      network: 'stellar:testnet',
      timeoutMs: 5000,
      upstreamSecretRef: 'WEATHER_TOKEN',
    },
  ],
}

describe('De-pin configuration', () => {
  it('applies safe defaults to a valid Stellar testnet provider', () => {
    const config = parseConfig(valid)
    expect(config).toMatchObject({
      port: 4102,
      facilitatorUrl: 'https://x402.org/facilitator',
      replayTtlMs: 600_000,
    })
  })

  it.each([
    { method: 'POST' },
    { network: 'stellar:pubnet' },
    { price: '$0' },
    { route: '/../admin' },
    { route: '/health' },
    { route: '/v1/weather/' },
    { upstreamUrl: 'file:///etc/passwd' },
    { recipient: 'not-a-stellar-address' },
  ])('rejects unsafe provider configuration %o', (change) => {
    expect(() =>
      parseConfig({
        ...valid,
        providers: [{ ...valid.providers[0], ...change }],
      }),
    ).toThrow()
  })

  it('rejects duplicate method and route pairs', () => {
    expect(() =>
      parseConfig({ providers: [valid.providers[0], valid.providers[0]] }),
    ).toThrow(/Duplicate provider route/)
  })

  it('fails startup when a referenced secret is absent', () => {
    const config = parseConfig(valid)
    expect(() => assertSecretReferences(config, {})).toThrow(/WEATHER_TOKEN/)
    expect(() =>
      assertSecretReferences(config, { WEATHER_TOKEN: 'configured' }),
    ).not.toThrow()
  })

  it('parses inline JSON config', () => {
    const config = parseConfigJson(JSON.stringify(valid))
    expect(config.providers[0]?.route).toBe('/v1/weather')
  })

  it('loads DEPIN_CONFIG_JSON before path/url', async () => {
    const loaded = await loadConfigFromEnvironment({
      DEPIN_CONFIG_JSON: JSON.stringify(valid),
      DEPIN_CONFIG_PATH: '/does/not/exist.json',
      DEPIN_CONFIG_URL: 'https://example.com/depin.json',
    })
    expect(loaded.source).toEqual({ type: 'inline', detail: 'DEPIN_CONFIG_JSON' })
    expect(loaded.config.providers).toHaveLength(1)
  })

  it('loads DEPIN_CONFIG_URL when inline is absent', async () => {
    const fetchMock = async () =>
      new Response(JSON.stringify(valid), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    const loaded = await loadConfigFromEnvironment(
      { DEPIN_CONFIG_URL: 'https://config.example/providers.json' },
      fetchMock,
    )
    expect(loaded.source.type).toBe('url')
    expect(loaded.source.detail).toContain('https://config.example')
  })
})
