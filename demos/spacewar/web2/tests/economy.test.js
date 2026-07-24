import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAfford,
  claimTopupPack,
  creditTera,
  formatTera,
  killReward,
  purchaseWithTera,
  winBonus,
} from '../js/economy.js'

describe('EDGERUN economy (shipped)', () => {
  it('formats TERA', () => {
    assert.equal(formatTera(120), '120 TERA')
  })

  it('credits TERA', () => {
    const next = creditTera({ tera: 10 }, 25)
    assert.equal(next.tera, 35)
  })

  it('purchaseWithTera deducts and marks owned', () => {
    const item = {
      id: 'blades',
      price: 200,
      ownedKey: 'hasBlades',
      apply: (s) => ({ ...s, damage: (s.damage || 25) + 15 }),
    }
    const r = purchaseWithTera({ tera: 250, hasBlades: false, damage: 25 }, item)
    assert.equal(r.ok, true)
    assert.equal(r.state.tera, 50)
    assert.equal(r.state.hasBlades, true)
    assert.equal(r.state.damage, 40)
  })

  it('rejects purchase when broke', () => {
    const r = purchaseWithTera({ tera: 10 }, { id: 'x', price: 50 })
    assert.equal(r.ok, false)
    assert.equal(r.error, 'insufficient_tera')
  })

  it('claims top-up pack once', () => {
    const pack = { id: 'pack_starter', tera: 100 }
    const a = claimTopupPack({ tera: 0 }, pack, [])
    assert.equal(a.ok, true)
    assert.equal(a.state.tera, 100)
    const b = claimTopupPack(a.state, pack, a.claimedIds)
    assert.equal(b.ok, false)
    assert.equal(b.error, 'already_claimed')
  })

  it('kill and win rewards are positive', () => {
    assert.ok(killReward('drone') >= 10)
    assert.ok(killReward('maxtac') > killReward('drone'))
    assert.ok(winBonus() >= 50)
    assert.equal(canAfford({ tera: 100 }, 50), true)
  })
})
