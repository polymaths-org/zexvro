import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyGateNftConstants,
  ensureBuyTopupWeb3,
  ensureProtectPurchase,
  upsertConstString,
} from './migrate-web3.mjs'

describe('morph migrate idempotent rewrites (shipped)', () => {
  it('upsertConstString rewrites GATE_SITE_KEY on re-run', () => {
    let src = 'const GATE_SITE_KEY = ""\nconst NFT_COLLECTION_ID = "old"\n'
    src = upsertConstString(src, 'GATE_SITE_KEY', 'site_abc')
    src = upsertConstString(src, 'NFT_COLLECTION_ID', 'col_1')
    assert.match(src, /const GATE_SITE_KEY = "site_abc"/)
    assert.match(src, /const NFT_COLLECTION_ID = "col_1"/)
  })

  it('applyGateNftConstants updates all GATE_* on second migrate', () => {
    let src = `const STARTING_TERA = 120
const NFT_COLLECTION_ID = "x"
const NFT_CHECKOUT_ORIGIN = "https://old.example"
const GATE_API_URL = "https://old.gate"
const GATE_SITE_KEY = ""
const NFT_API_URL = ""
`
    src = applyGateNftConstants(src, {
      collectionId: '4b64',
      checkoutOrigin: 'https://console.zexvro.in',
      gateUrl: 'https://api.zexvro.in/gate',
      siteKey: 'RECOVERY_KEY',
      nftApi: 'https://nft.example',
    })
    assert.match(src, /const GATE_SITE_KEY = "RECOVERY_KEY"/)
    assert.match(src, /const GATE_API_URL = "https:\/\/api\.zexvro\.in\/gate"/)
    assert.match(src, /const NFT_COLLECTION_ID = "4b64"/)
    // second pass
    src = applyGateNftConstants(src, {
      collectionId: '4b64',
      checkoutOrigin: 'https://console.zexvro.in',
      gateUrl: 'https://api.zexvro.in/gate',
      siteKey: 'KEY2',
      nftApi: '',
    })
    assert.match(src, /const GATE_SITE_KEY = "KEY2"/)
    assert.doesNotMatch(src, /const GATE_SITE_KEY = ""/)
  })

  it('ensureBuyTopupWeb3 does not produce async async', () => {
    let src = `function buyTopupPack(packId) {
  const pack = TOPUP_PACKS.find((p) => p.id === packId)
  if (!pack) return
  creditTera(pack.tera, pack.name)
}
`
    src = ensureBuyTopupWeb3(src)
    src = ensureBuyTopupWeb3(src)
    src = ensureBuyTopupWeb3(src)
    assert.doesNotMatch(src, /async async function buyTopupPack/)
    assert.match(src, /async function buyTopupPack/)
    assert.match(src, /morph-migrate:web3-buyTopup/)
    assert.match(src, /protectPurchase\('token\.purchase'\)/)
    // only one function definition
    const count = (src.match(/function buyTopupPack/g) || []).length
    assert.equal(count, 1)
  })

  it('ensureBuyTopupWeb3 repairs already-broken async async', () => {
    let src = `async async function buyTopupPack(packId) {
  return
}
`
    src = ensureBuyTopupWeb3(src)
    assert.doesNotMatch(src, /async async/)
    assert.match(src, /async function buyTopupPack/)
  })

  it('ensureProtectPurchase requires non-empty site key at runtime path', () => {
    let src = 'const GATE_SITE_KEY = "x"\n// ─── Canvas\n'
    src = ensureProtectPurchase(src)
    assert.match(src, /async function protectPurchase/)
    assert.match(src, /GATE_SITE_KEY missing/)
    assert.match(src, /captcha\.js/)
  })
})
