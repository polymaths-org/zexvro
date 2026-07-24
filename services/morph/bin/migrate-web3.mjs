#!/usr/bin/env node
/**
 * morph migrate — idempotent Web2→Web3 patch for EDGERUN-style games.
 * Adds ZEXVRO NFT checkout + Gate captcha on TERA pack / token purchase.
 *
 * Usage (from game project root):
 *   morph migrate
 *   morph migrate --site-key <publicSiteKey> --origin https://console.zexvro.in
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MORPH_HOME = process.env.MORPH_HOME || join(__dirname, '..')
const cwd = process.cwd()

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}

/** Rewrite or insert a const string binding (idempotent). Exported for tests. */
export function upsertConstString(source, name, value) {
  const line = `const ${name} = ${JSON.stringify(value)}`
  const re = new RegExp(`const ${name} = (["'\`])[\\s\\S]*?\\1`)
  if (re.test(source)) return source.replace(re, line)
  // double-quote only form from prior migrate
  const re2 = new RegExp(`const ${name} = "[^"]*"`)
  if (re2.test(source)) return source.replace(re2, line)
  const re3 = new RegExp(`const ${name} = '[^']*'`)
  if (re3.test(source)) return source.replace(re3, line)
  return null // caller inserts block
}

/** Ensure buyTopupPack is single async function with captcha+checkout. */
export function ensureBuyTopupWeb3(source) {
  const web3Body = `async function buyTopupPack(packId) {
  // morph-migrate:web3-buyTopup
  const pack = TOPUP_PACKS.find((p) => p.id === packId)
  if (!pack) return
  try {
    toast('Complete captcha to buy tokens…')
    await protectPurchase('token.purchase')
  } catch (e) {
    toast(e?.message || 'Captcha failed')
    return
  }
  toast('Opening ZEXVRO checkout for +' + pack.tera + ' ' + CURRENCY + '…')
  setPendingCheckout({ kind: 'topup', packId: pack.id })
  try {
    openCheckout({
      collectionId: NFT_COLLECTION_ID,
      checkoutOrigin: NFT_CHECKOUT_ORIGIN,
      onSuccess: (payload) => fulfillCheckoutSuccess(payload || {}),
      onError: ({ message }) => toast('Top-up failed: ' + (message || 'error')),
      onClose: () => {
        if (getPendingCheckout()) toast('Closed checkout — Claim if already paid')
      },
    })
  } catch (err) {
    toast(err.message || 'Checkout unavailable')
  }
}`

  // Match any broken/prior variants: async async function | async function | function
  const re = /(?:async\s+)+function buyTopupPack\(packId\) \{[\s\S]*?\n\}|function buyTopupPack\(packId\) \{[\s\S]*?\n\}/
  if (re.test(source)) {
    return source.replace(re, web3Body)
  }
  return source + '\n\n' + web3Body + '\n'
}

export function ensureProtectPurchase(source) {
  const helper = `/** Gate captcha before token / pack purchase (Morph migrate). */
async function protectPurchase(action) {
  if (!GATE_SITE_KEY) {
    throw new Error('GATE_SITE_KEY missing — re-run: morph migrate --site-key <publicSiteKey>')
  }
  const base = GATE_API_URL.replace(/\\/$/, '')
  const mod = await import(/* @vite-ignore */ base + '/v1/sdk/captcha.js')
  const out = await mod.protectWithCaptcha({
    apiBase: base,
    siteKey: GATE_SITE_KEY,
    action: action || 'token.purchase',
    origin: typeof location !== 'undefined' ? location.origin : undefined,
  })
  return out?.capability || null
}
`

  // Drop prior inject comment blocks to avoid duplicate headers on re-migrate
  let out = source.replace(
    /(?:\/\*\* Gate captcha before token \/ pack purchase \(Morph migrate\)\. \*\/\n)+/g,
    '',
  )
  if (out.includes('async function protectPurchase')) {
    return out.replace(/async function protectPurchase\([\s\S]*?\n\}/, helper.trim() + '\n')
  }
  if (out.includes('// ─── Canvas')) {
    return out.replace('// ─── Canvas', helper + '\n// ─── Canvas')
  }
  return helper + '\n' + out
}

export function applyGateNftConstants(source, { collectionId, checkoutOrigin, gateUrl, siteKey, nftApi }) {
  let game = source
  const pairs = [
    ['NFT_COLLECTION_ID', collectionId],
    ['NFT_CHECKOUT_ORIGIN', checkoutOrigin],
    ['GATE_API_URL', gateUrl.replace(/\/$/, '')],
    ['GATE_SITE_KEY', siteKey || ''],
    ['NFT_API_URL', String(nftApi || '').replace(/\/$/, '')],
  ]

  let missing = []
  for (const [name, value] of pairs) {
    const next = upsertConstString(game, name, value)
    if (next == null) missing.push([name, value])
    else game = next
  }

  if (missing.length) {
    const block =
      '// ZEXVRO Web3 adapters (injected by morph migrate)\n' +
      missing.map(([n, v]) => `const ${n} = ${JSON.stringify(v)}`).join('\n') +
      '\n'
    if (game.includes('const STARTING_TERA')) {
      game = game.replace(/const STARTING_TERA = \d+\n/, (m) => m + block)
    } else if (game.includes('const CURRENCY =')) {
      game = game.replace(/const CURRENCY = ['"][^'"]*['"]\n/, (m) => m + block)
    } else {
      game = block + game
    }
    // rewrite all again so full set is consistent
    for (const [name, value] of pairs) {
      const next = upsertConstString(game, name, value)
      if (next) game = next
    }
  }

  return game
}

/**
 * Create a Gate site when siteKey is missing but admin key is available.
 * Makes morph migrate one-shot: captcha works without a separate console step.
 * Returns public siteKey or ''.
 */
export async function ensureGateSiteKey({ gateUrl, siteKey, siteName, origins }) {
  if (siteKey) return siteKey
  const adminKey = (
    process.env.ZEXVRO_GATE_ADMIN_KEY ||
    process.env.GATE_ADMIN_API_KEY ||
    ''
  ).trim()
  if (!adminKey) return ''

  const base = gateUrl.replace(/\/$/, '')
  const body = {
    name: siteName || `Morph migrate ${new Date().toISOString().slice(0, 10)}`,
    allowedOrigins: origins.filter(Boolean),
  }
  if (!body.allowedOrigins.length) {
    body.allowedOrigins = ['http://localhost:5173', 'http://localhost:4173']
  }

  const res = await fetch(`${base}/v1/admin/sites`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'morph-migrate/1.0',
      'x-gate-admin-key': adminKey,
      authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('✗ Gate site auto-create failed HTTP', res.status, json?.detail || json?.error || '')
    return ''
  }
  const key = json.siteKey || json.site?.siteKey || ''
  if (key) {
    console.log('✓ Gate site created (public siteKey injected; secretKey not written to disk)')
    if (json.secretKey) {
      console.log('  secretKey shown once by Gate API — store in server env only, never commit')
    }
  }
  return key
}

async function main() {
  const checkoutOrigin =
    arg('--origin') ||
    process.env.ZEXVRO_CHECKOUT_ORIGIN ||
    process.env.VITE_CHECKOUT_ORIGIN ||
    'https://console.zexvro.in'
  const gateUrl =
    arg('--gate-url') || process.env.ZEXVRO_GATE_URL || process.env.VITE_GATE_API_URL || 'https://api.zexvro.in/gate'
  const nftApi = arg('--nft-url') || process.env.ZEXVRO_NFT_URL || process.env.VITE_NFT_API_URL || ''
  const collectionId =
    arg('--collection') ||
    process.env.ZEXVRO_NFT_COLLECTION_ID ||
    process.env.VITE_NFT_COLLECTION_ID ||
    '4b64373d-b6fe-467d-b404-b5ea55ba849f'
  let siteKey = arg('--site-key') || process.env.ZEXVRO_GATE_SITE_KEY || process.env.VITE_GATE_SITE_KEY || ''

  const gameJs = join(cwd, 'js', 'game.js')
  const indexHtml = join(cwd, 'index.html')
  if (!existsSync(gameJs) || !existsSync(indexHtml)) {
    console.error('✗ Not an EDGERUN-style game root (need index.html + js/game.js). cwd=', cwd)
    process.exit(1)
  }

  // Optional deploy origin so captcha CORS allows production host
  const deployOrigin = arg('--deploy-origin') || process.env.ZEXVRO_DEPLOY_ORIGIN || ''
  if (!siteKey) {
    siteKey = await ensureGateSiteKey({
      gateUrl,
      siteKey: '',
      siteName: arg('--site-name') || 'Morph Web3 game',
      origins: [
        deployOrigin,
        'http://localhost:4173',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
        'http://localhost:8080',
        checkoutOrigin,
      ],
    })
  }

  let game = readFileSync(gameJs, 'utf8')
  let html = readFileSync(indexHtml, 'utf8')

  mkdirSync(join(cwd, 'js'), { recursive: true })
  const sdkSrc = join(MORPH_HOME, 'seed', 'migrate', 'nft-checkout.js')
  const fromZip = join(
    MORPH_HOME,
    '..',
    '..',
    'demos',
    'spacewar',
    'extracted',
    'Test-nft',
    'js',
    'nft-checkout.js',
  )
  if (existsSync(sdkSrc)) copyFileSync(sdkSrc, join(cwd, 'js', 'nft-checkout.js'))
  else if (existsSync(fromZip)) copyFileSync(fromZip, join(cwd, 'js', 'nft-checkout.js'))
  else if (!existsSync(join(cwd, 'js', 'nft-checkout.js'))) {
    console.error('✗ Missing nft-checkout.js seed')
    process.exit(1)
  }

  game = applyGateNftConstants(game, {
    collectionId,
    checkoutOrigin,
    gateUrl,
    siteKey,
    nftApi,
  })

  if (!game.includes("from './nft-checkout.js'") && !game.includes('from "./nft-checkout.js"')) {
    game = `import { openCheckout } from './nft-checkout.js'\n` + game
  }

  // Pending helpers if missing
  if (!game.includes('function setPendingCheckout')) {
    const pendingHelpers = `
const PENDING_KEY = 'edgerun_pending_checkout'
const PURCHASES_KEY = 'edgerun_purchases_web3'
function setPendingCheckout(pending) {
  if (!pending) { sessionStorage.removeItem(PENDING_KEY); return }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...pending, at: Date.now() }))
}
function getPendingCheckout() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null') } catch { return null }
}
function readPurchases() {
  try {
    const list = JSON.parse(localStorage.getItem(PURCHASES_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch { return [] }
}
function writePurchases(list) {
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(list))
  player.purchases = list
}
function alreadyRecorded(transactionHash, tokenId) {
  return (player.purchases || []).some(
    (p) => (transactionHash && p.transactionHash === transactionHash) ||
      (tokenId !== undefined && p.tokenId === tokenId && p.collectionId === NFT_COLLECTION_ID),
  )
}
function recordPurchase(entry) {
  const list = readPurchases()
  list.unshift({ ...entry, at: Date.now() })
  writePurchases(list)
  return true
}
function fulfillCheckoutSuccess(payload = {}) {
  const pending = getPendingCheckout()
  const tokenId = payload.tokenId
  const transactionHash = payload.transactionHash || ''
  const buyerAddress = payload.buyerAddress || ''
  if (alreadyRecorded(transactionHash, tokenId)) {
    setPendingCheckout(null)
    toast('Purchase already applied', true)
    return
  }
  if (buyerAddress) player.buyerAddress = buyerAddress
  if (pending?.kind === 'topup') {
    const pack = TOPUP_PACKS.find((p) => p.id === pending.packId) || TOPUP_PACKS[0]
    creditTera(pack.tera, pack.name + ' (on-chain)')
    recordPurchase({ kind: 'topup', packId: pack.id, tera: pack.tera, tokenId, transactionHash, buyerAddress, collectionId: NFT_COLLECTION_ID })
    setPendingCheckout(null)
    if (typeof renderTopup === 'function') renderTopup()
    if (typeof renderMarket === 'function') renderMarket()
    toast('TOP UP OK · +' + pack.tera + ' ' + CURRENCY, true)
    return
  }
  const unlock = pending?.unlock || 'legendary_runner'
  if (typeof applyCosmeticUnlock === 'function') applyCosmeticUnlock(unlock)
  else if (typeof applyNftUnlock === 'function') applyNftUnlock(unlock, { buyerAddress })
  recordPurchase({ kind: 'nft', unlock, tokenId, transactionHash, buyerAddress, collectionId: NFT_COLLECTION_ID })
  setPendingCheckout(null)
  if (typeof renderMarket === 'function') renderMarket()
  toast('NFT unlocked · token #' + (tokenId ?? '—'), true)
}
`
    if (game.includes('// ─── Canvas')) {
      game = game.replace('// ─── Canvas', pendingHelpers + '\n// ─── Canvas')
    } else {
      game = pendingHelpers + game
    }
  }

  game = ensureProtectPurchase(game)
  game = ensureBuyTopupWeb3(game)

  if (!html.includes('data-zexvro-migrated')) {
    html = html.replace('<html lang="en">', '<html lang="en" data-zexvro-migrated="web3">')
  }

  writeFileSync(
    join(cwd, 'zexvro.config.json'),
    JSON.stringify(
      {
        mode: 'web3',
        nftCollectionId: collectionId,
        checkoutOrigin,
        gateApiUrl: gateUrl.replace(/\/$/, ''),
        gateSiteKey: siteKey || null,
        nftApiUrl: nftApi || null,
        captchaOnTokenPurchase: true,
        captchaRequiresSiteKey: true,
        migratedBy: 'morph migrate',
        migratedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  )

  writeFileSync(gameJs, game)
  writeFileSync(indexHtml, html)

  // Fail hard if siteKey still empty — captcha cannot demo without it
  const written = readFileSync(gameJs, 'utf8')
  const m = written.match(/const GATE_SITE_KEY = ["']([^"']*)["']/)
  const keyInGame = m ? m[1] : ''
  if (!keyInGame) {
    console.error('✗ GATE_SITE_KEY is empty in js/game.js')
    console.error('  Options:')
    console.error('  1) morph migrate --site-key <publicSiteKey>')
    console.error('  2) export GATE_ADMIN_API_KEY=… (or ZEXVRO_GATE_ADMIN_KEY) then re-run morph migrate')
    console.error('     → auto-creates a Gate site and injects public siteKey')
    process.exit(2)
  }
  if (written.includes('async async function buyTopupPack')) {
    console.error('✗ broken async async buyTopupPack after migrate')
    process.exit(3)
  }

  console.log('✓ Morph migrate applied (Web3 adapters)')
  console.log('  collection ', collectionId)
  console.log('  checkout   ', checkoutOrigin)
  console.log('  gate       ', gateUrl)
  console.log('  siteKey    ', keyInGame.slice(0, 8) + '…')
  console.log('  captcha    token.purchase (throws if captcha fails)')
  console.log('')
  console.log('Next: deploy this folder. Human completes Freighter in checkout after captcha.')
}

// only run main when executed as CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  main().catch((err) => {
    console.error('✗ morph migrate failed:', err?.message || err)
    process.exit(1)
  })
}
