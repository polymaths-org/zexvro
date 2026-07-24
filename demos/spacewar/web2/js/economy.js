/**
 * Pure economy helpers for EDGERUN (Web2).
 * Morph can wrap these for captcha-gated / NFT top-ups without rewriting combat.
 */

export function formatTera(n, currency = 'TERA') {
  return `${Number(n) || 0} ${currency}`
}

export function creditTera(state, amount) {
  const next = { ...state, tera: (Number(state.tera) || 0) + Math.max(0, Number(amount) || 0) }
  return next
}

export function canAfford(state, price) {
  return (Number(state.tera) || 0) >= (Number(price) || 0)
}

/**
 * Spend TERA and apply a shop item once.
 * @returns {{ ok: true, state } | { ok: false, error: string }}
 */
export function purchaseWithTera(state, item) {
  if (!item || !item.id) return { ok: false, error: 'unknown_item' }
  if (item.ownedKey && state[item.ownedKey]) return { ok: false, error: 'already_owned' }
  if (Array.isArray(state.ownedItems) && state.ownedItems.includes(item.id)) {
    return { ok: false, error: 'already_owned' }
  }
  const price = Number(item.price) || 0
  if (!canAfford(state, price)) return { ok: false, error: 'insufficient_tera' }

  let next = { ...state, tera: state.tera - price }
  if (item.ownedKey) next = { ...next, [item.ownedKey]: true }
  if (item.once || item.type === 'cosmetic') {
    const owned = Array.isArray(next.ownedItems) ? [...next.ownedItems] : []
    if (!owned.includes(item.id)) owned.push(item.id)
    next.ownedItems = owned
  }
  if (typeof item.apply === 'function') {
    next = item.apply(next) || next
  }
  return { ok: true, state: next }
}

/** Free or paid top-up pack credit (Web2: free claim packs). */
export function claimTopupPack(state, pack, claimedIds = []) {
  if (!pack?.id) return { ok: false, error: 'unknown_pack', claimedIds }
  if (claimedIds.includes(pack.id)) return { ok: false, error: 'already_claimed', claimedIds }
  const amount = Number(pack.tera) || 0
  const next = creditTera(state, amount)
  return { ok: true, state: next, claimedIds: [...claimedIds, pack.id], amount }
}

export function killReward(enemyType) {
  if (enemyType === 'maxtac') return 25
  if (enemyType === 'gonk') return 15
  return 10
}

export function winBonus() {
  return 75
}
