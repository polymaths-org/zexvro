import { describe, expect, it } from 'vitest'
import { loadConfig, requiresManagedSponsor } from './config.js'

const baseEnv = {
  NFT_PUBLIC_BASE_URL: 'http://127.0.0.1:4101',
  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  STELLAR_USDC_CONTRACT: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
} as const

describe('loadConfig sponsor requirements', () => {
  it('allows local startup without sponsor secret', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'development',
    })
    expect(config.NFT_REQUIRE_SPONSOR).toBe(false)
    expect(config.STELLAR_SPONSOR_SECRET).toBeUndefined()
  })

  it('requires sponsor secret and wasm hash in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
      }),
    ).toThrow(/STELLAR_SPONSOR_SECRET is required/)

    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        STELLAR_SPONSOR_SECRET: 'S' + 'A'.repeat(55),
      }),
    ).toThrow(/NFT_COLLECTION_WASM_HASH is required/)
  })

  it('honors NFT_REQUIRE_SPONSOR outside production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'development',
        NFT_REQUIRE_SPONSOR: '1',
      }),
    ).toThrow(/STELLAR_SPONSOR_SECRET is required/)
  })

  it('accepts production when sponsor and wasm hash are present', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      STELLAR_SPONSOR_SECRET: 'S' + 'A'.repeat(55),
      NFT_COLLECTION_WASM_HASH: 'a'.repeat(64),
    })
    expect(config.NFT_REQUIRE_SPONSOR).toBe(true)
    expect(config.STELLAR_SPONSOR_SECRET).toHaveLength(56)
    expect(config.NFT_COLLECTION_WASM_HASH).toHaveLength(64)
  })

  it('allows opting out of production sponsor gate with NFT_REQUIRE_SPONSOR=0', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      NFT_REQUIRE_SPONSOR: '0',
    })
    expect(config.NFT_REQUIRE_SPONSOR).toBe(false)
  })

  it('derives requiresManagedSponsor from NODE_ENV and explicit flags', () => {
    expect(requiresManagedSponsor({ NODE_ENV: 'production' })).toBe(true)
    expect(requiresManagedSponsor({ NODE_ENV: 'development' })).toBe(false)
    expect(requiresManagedSponsor({ NFT_REQUIRE_SPONSOR: 'true' })).toBe(true)
    expect(
      requiresManagedSponsor({ NODE_ENV: 'production', NFT_REQUIRE_SPONSOR: 'false' }),
    ).toBe(false)
  })
})
