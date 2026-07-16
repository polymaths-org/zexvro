import { ZEXVRO_CONFIG } from './config.js';
import { CATALOG } from './assets/catalog.js';
import { createNftCheckoutClient, openCheckout } from './vendor/zexvro-nft-checkout-sdk.js';

const STORAGE_KEY = 'zexvro-nft-rpg-owned-v1';
const TILE = 32;
const COLS = 20;
const ROWS = 14;

/** @type {Set<string>} */
const owned = new Set(loadOwned());
/** @type {Map<string, { tokenId?: number, transactionHash?: string }>} */
const ownershipMeta = new Map(loadMeta());

const els = {
  canvas: /** @type {HTMLCanvasElement} */ (document.getElementById('game')),
  shop: document.getElementById('shop'),
  log: document.getElementById('log'),
  badgeMode: document.getElementById('badge-mode'),
  badgeWallet: document.getElementById('badge-wallet'),
  badgeCollection: document.getElementById('badge-collection'),
  equip: document.getElementById('equip'),
  modeSelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('checkout-mode')),
  collectionMeta: document.getElementById('collection-meta'),
  headlessModal: document.getElementById('headless-modal'),
  headlessBody: document.getElementById('headless-body'),
  headlessClose: document.getElementById('headless-close'),
};

const ctx = els.canvas.getContext('2d');
els.canvas.width = COLS * TILE;
els.canvas.height = ROWS * TILE;

const player = {
  x: 4,
  y: 4,
  facing: 1,
  color: '#38bdf8',
};

const keys = new Set();
let lastMove = 0;
let slashUntil = 0;
let blocking = false;
let trail = [];
/** @type {ReturnType<typeof openCheckout> | null} */
let activePopup = null;
/** @type {string | null} */
let buyingItemId = null;

let checkoutMode =
  ZEXVRO_CONFIG.checkoutMode === 'headless' ||
  ZEXVRO_CONFIG.checkoutMode === 'offline' ||
  ZEXVRO_CONFIG.checkoutMode === 'popup'
    ? ZEXVRO_CONFIG.checkoutMode
    : 'popup';

const defaultCollectionId = (ZEXVRO_CONFIG.collectionId || '').trim();
const itemCollections =
  ZEXVRO_CONFIG.itemCollections && typeof ZEXVRO_CONFIG.itemCollections === 'object'
    ? ZEXVRO_CONFIG.itemCollections
    : {};
const unlockItemId = ZEXVRO_CONFIG.unlockItemId || 'oak-shield';

function collectionForItem(itemId) {
  const entry = itemCollections[itemId];
  if (entry?.collectionId) {
    return {
      collectionId: String(entry.collectionId).trim(),
      checkoutOrigin: (entry.checkoutOrigin || ZEXVRO_CONFIG.checkoutOrigin || 'http://localhost:3000').replace(
        /\/$/,
        '',
      ),
      priceLabel: entry.priceLabel || ZEXVRO_CONFIG.priceLabel,
    };
  }
  if (defaultCollectionId) {
    return {
      collectionId: defaultCollectionId,
      checkoutOrigin: (ZEXVRO_CONFIG.checkoutOrigin || 'http://localhost:3000').replace(/\/$/, ''),
      priceLabel: ZEXVRO_CONFIG.priceLabel,
    };
  }
  return null;
}

function isLive() {
  return checkoutMode !== 'offline' && Boolean(collectionForItem(unlockItemId) || defaultCollectionId);
}

const primaryLive = collectionForItem(unlockItemId);
const client = primaryLive
  ? createNftCheckoutClient({ apiBase: ZEXVRO_CONFIG.apiBase })
  : null;

/** @type {{ name?: string, coverImageUri?: string, priceLabel?: string, mintedCount?: number, saleReady?: boolean } | null} */
let collectionInfo = null;

function loadOwned() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function loadMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:meta`) || '{}');
    return Object.entries(raw);
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...owned]));
  localStorage.setItem(
    `${STORAGE_KEY}:meta`,
    JSON.stringify(Object.fromEntries(ownershipMeta.entries())),
  );
}

function log(message, kind = 'info') {
  const row = document.createElement('div');
  row.className = kind;
  row.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  els.log.prepend(row);
}

function setBadge(el, text, cls) {
  el.textContent = text;
  el.className = `badge ${cls}`;
}

function refreshBadges() {
  const live = collectionForItem(unlockItemId);
  if (!isLive()) {
    setBadge(els.badgeMode, 'Offline demo (local unlocks)', 'warn');
    setBadge(
      els.badgeCollection,
      live ? 'collection ready · mode offline' : 'Set itemCollections in config.js',
      'warn',
    );
  } else if (checkoutMode === 'headless') {
    setBadge(els.badgeMode, 'Headless client + Freighter', 'ok');
    setBadge(els.badgeCollection, `Collection ${live.collectionId.slice(0, 8)}…`, 'ok');
  } else {
    setBadge(els.badgeMode, 'Popup checkout (openCheckout)', 'ok');
    setBadge(els.badgeCollection, `Oak Shield · ${live.collectionId.slice(0, 8)}…`, 'ok');
  }
  setBadge(els.badgeWallet, `Owned items: ${owned.size}`, owned.size ? 'ok' : 'warn');
}

function has(itemId) {
  return owned.has(itemId);
}

function unlockItem(itemId, meta = {}) {
  owned.add(itemId);
  ownershipMeta.set(itemId, { ...ownershipMeta.get(itemId), ...meta });
  persist();
  refreshBadges();
  renderShop();
  updateEquip();
  log(`Unlocked ${itemId}`, 'ok');
}

function updateEquip() {
  const parts = [];
  if (has('iron-sword')) parts.push('Sword');
  if (has('oak-shield')) parts.push('Shield');
  if (has('swift-boots')) parts.push('Boots×1.25');
  if (has('mana-potion')) parts.push('Mana aura');
  if (has('star-crystal')) parts.push('Crown');
  els.equip.textContent = parts.length
    ? `Equipped: ${parts.join(' · ')}`
    : 'Equipped: nothing (buy in shop)';
}

function buyLabel(item) {
  if (has(item.id)) return 'Owned';
  const nft = collectionForItem(item.id);
  if (!nft || checkoutMode === 'offline') return 'Unlock (demo)';
  if (checkoutMode === 'headless') return 'Buy (custom UI)';
  if (item.id === 'oak-shield') return 'Buy Oak Shield (ZEXVRO)';
  return 'Buy with ZEXVRO';
}

function renderCollectionMeta() {
  if (!els.collectionMeta) return;
  const live = collectionForItem(unlockItemId);
  if (!collectionInfo) {
    els.collectionMeta.innerHTML = live
      ? `<p>Probing Oak Shield collection <code>${live.collectionId}</code>…</p>`
      : `<p>No itemCollections.oak-shield — offline UI only.</p>`;
    return;
  }
  const cover = collectionInfo.coverImageUri
    ? `<img src="${collectionInfo.coverImageUri}" alt="" class="cover" />`
    : '';
  els.collectionMeta.innerHTML = `
    <div class="collection-row">
      ${cover}
      <div>
        <strong>${collectionInfo.name || 'Collection'}</strong>
        <div class="muted">
          ${collectionInfo.priceLabel || ZEXVRO_CONFIG.priceLabel || 'primary sale'}
          · minted ${collectionInfo.mintedCount ?? 0}
          · unlocks <code>${unlockItemId}</code>
        </div>
        <div class="muted">${collectionInfo.saleReady ? 'Primary sale ready' : '⚠ Configure primary sale in Studio'}</div>
      </div>
    </div>
  `;
}

function renderShop() {
  els.shop.innerHTML = '';
  for (const item of CATALOG) {
    const ownedItem = has(item.id);
    const nft = collectionForItem(item.id);
    const isTargetSku = Boolean(nft) && checkoutMode !== 'offline';
    const card = document.createElement('article');
    card.className = 'card' + (isTargetSku ? ' sku-live' : '');
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <h2>${item.emoji} ${item.name}</h2>
        <p>${item.description}${isTargetSku ? ' · <strong>live NFT · openCheckout</strong>' : ''}</p>
        <div class="meta">
          <span class="tag">${Object.entries(item.stats)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')}</span>
          <button type="button" data-id="${item.id}" ${ownedItem ? 'disabled class="owned"' : ''}>
            ${buyLabel(item)}
          </button>
        </div>
      </div>
    `;
    const btn = card.querySelector('button');
    btn?.addEventListener('click', () => void buyItem(item));
    els.shop.appendChild(card);
  }
}

/**
 * ZEXVRO NFT — popup checkout (Razorpay-style).
 * Studio Integrate SDK sample: openCheckout when the player buys Oak Shield.
 */
function buyOakShieldWithPopup() {
  const nft = collectionForItem('oak-shield');
  if (!nft) {
    throw new Error('Oak Shield has no collectionId in config.itemCollections');
  }

  log('Opening ZEXVRO checkout popup for Oak Shield…', 'info');
  activePopup?.close();
  activePopup = openCheckout({
    collectionId: nft.collectionId,
    checkoutOrigin: nft.checkoutOrigin,
    onSuccess: ({ tokenId, transactionHash, buyerAddress }) => {
      console.log('Purchase confirmed', { tokenId, transactionHash, buyerAddress });
      unlockItem('oak-shield', {
        tokenId,
        transactionHash,
        buyerAddress,
        source: 'zexvro-popup',
      });
      log(
        `Oak Shield purchase OK · token #${tokenId} · tx ${String(transactionHash || '').slice(0, 12)}…`,
        'ok',
      );
      log('Hold Space to block (Oak Shield equipped).', 'info');
      buyingItemId = null;
      activePopup = null;
      void probeCollection();
    },
    onError: ({ message }) => {
      console.error('Checkout failed', message);
      log(`Checkout error: ${message || 'unknown'}`, 'err');
    },
    onClose: () => {
      console.log('Player closed checkout');
      log('Player closed checkout', 'info');
      buyingItemId = null;
      activePopup = null;
    },
  });
}

async function buyItem(item) {
  if (has(item.id)) return;

  const nft = collectionForItem(item.id);
  if (!nft || checkoutMode === 'offline') {
    unlockItem(item.id, { source: 'offline-demo' });
    log('Offline demo unlock — use popup mode + itemCollections for real NFT checkout', 'info');
    return;
  }

  buyingItemId = item.id;

  // Oak Shield: exact Studio popup sample path
  if (item.id === 'oak-shield' && checkoutMode === 'popup') {
    try {
      buyOakShieldWithPopup();
    } catch (error) {
      log(error instanceof Error ? error.message : String(error), 'err');
      buyingItemId = null;
    }
    return;
  }

  if (checkoutMode === 'headless') {
    await purchaseWithCustomUi(item, nft);
    return;
  }

  log(`Opening ZEXVRO checkout popup for ${item.name}…`, 'info');
  try {
    activePopup?.close();
    activePopup = openCheckout({
      collectionId: nft.collectionId,
      checkoutOrigin: nft.checkoutOrigin,
      onSuccess: ({ tokenId, transactionHash, buyerAddress }) => {
        console.log('Purchase confirmed', { tokenId, transactionHash, buyerAddress });
        unlockItem(item.id, {
          tokenId,
          transactionHash,
          buyerAddress,
          source: 'zexvro-popup',
        });
        log(
          `Purchase OK token #${tokenId} tx ${String(transactionHash || '').slice(0, 12)}…`,
          'ok',
        );
        buyingItemId = null;
        activePopup = null;
        void probeCollection();
      },
      onError: ({ message }) => {
        console.error('Checkout failed', message);
        log(`Checkout error: ${message || 'unknown'}`, 'err');
      },
      onClose: () => {
        console.log('Player closed checkout');
        log('Checkout popup closed', 'info');
        buyingItemId = null;
        activePopup = null;
      },
    });
  } catch (error) {
    log(error instanceof Error ? error.message : String(error), 'err');
    buyingItemId = null;
  }
}

/**
 * Headless path matching Studio Integrate SDK sample:
 * createNftCheckoutClient → createCheckoutIntent → Freighter sign → submit.
 * Full AssembledTransaction auth signing needs the ZEXVRO FE wallet helper;
 * this modal walks the same API steps and links Freighter + optional popup fallback.
 */
async function purchaseWithCustomUi(item, nft) {
  const target = nft || collectionForItem(item.id);
  if (!target) return;
  const headlessClient = createNftCheckoutClient({ apiBase: ZEXVRO_CONFIG.apiBase });
  openHeadlessModal(item);

  try {
    setHeadlessStatus('Loading collection…');
    const { collection, inventory } = await headlessClient.getCollection(target.collectionId);
    log(
      `Headless: ${collection.name} · minted ${inventory?.mintedCount ?? 0}`,
      'info',
    );

    setHeadlessStatus(
      'Connect Freighter on Testnet, then prepare a checkout intent. ' +
        'Auth-entry signing uses the hosted popup helper for the sign step ' +
        '(same serializedTransaction path as Studio).',
    );

    const freighter = await loadFreighterApi();
    if (!freighter) {
      setHeadlessStatus(
        'Freighter extension not detected. Install Freighter, unlock it, allow this origin, then retry — or switch mode to Popup.',
        true,
      );
      return;
    }

    setHeadlessActions([
      {
        label: '1 · Connect Freighter',
        primary: true,
        onClick: async () => {
          try {
            setHeadlessStatus('Requesting Freighter public key…');
            if (typeof freighter.requestAccess === 'function') {
              await freighter.requestAccess();
            }
            const address =
              typeof freighter.getAddress === 'function'
                ? (await freighter.getAddress()).address || (await freighter.getAddress())
                : await freighter.getPublicKey();
            const buyerAddress = typeof address === 'string' ? address : address?.address;
            if (!buyerAddress || !/^G[A-Z2-7]{55}$/.test(buyerAddress)) {
              throw new Error('Freighter did not return a G-address.');
            }
            setHeadlessStatus(`Connected ${buyerAddress.slice(0, 6)}…${buyerAddress.slice(-4)}`);
            setHeadlessActions([
              {
                label: '2 · Create intent (auto token id)',
                primary: true,
                onClick: async () => {
                  try {
                    setHeadlessStatus('Creating checkout intent…');
                    const intent = await headlessClient.createCheckoutIntent({
                      collectionId: target.collectionId,
                      buyerAddress,
                    });
                    log(`Reserved token #${intent.tokenId} intent ${intent.id.slice(0, 8)}…`, 'ok');
                    setHeadlessStatus(
                      `Token #${intent.tokenId} reserved. Next: sign auth entries. ` +
                        `AssembledTransaction JSON signing is implemented in the hosted embed — ` +
                        `open popup to finish Freighter sign + submit for this intent path, ` +
                        `or use Popup mode for the full one-click flow.`,
                    );
                    setHeadlessActions([
                      {
                        label: '3 · Finish in ZEXVRO popup',
                        primary: true,
                        onClick: () => {
                          closeHeadlessModal();
                          checkoutMode = 'popup';
                          if (els.modeSelect) els.modeSelect.value = 'popup';
                          refreshBadges();
                          renderShop();
                          void buyItem(item);
                        },
                      },
                      {
                        label: 'Cancel',
                        onClick: () => closeHeadlessModal(),
                      },
                    ]);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    setHeadlessStatus(message, true);
                    log(message, 'err');
                  }
                },
              },
              {
                label: 'Cancel',
                onClick: () => closeHeadlessModal(),
              },
            ]);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setHeadlessStatus(message, true);
            log(message, 'err');
          }
        },
      },
      {
        label: 'Use popup instead',
        onClick: () => {
          closeHeadlessModal();
          checkoutMode = 'popup';
          if (els.modeSelect) els.modeSelect.value = 'popup';
          refreshBadges();
          renderShop();
          void buyItem(item);
        },
      },
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setHeadlessStatus(message, true);
    log(message, 'err');
  }
}

async function loadFreighterApi() {
  try {
    // Optional dynamic import — fails gracefully if package not served in this harness.
    // @ts-expect-error optional
    const mod = await import('https://esm.sh/@stellar/freighter-api@3');
    return mod;
  } catch {
    // Fallback: global injected by extension in some environments
    // @ts-expect-error window freighter
    if (window.freighterApi) return window.freighterApi;
    return null;
  }
}

function openHeadlessModal(item) {
  if (!els.headlessModal || !els.headlessBody) return;
  els.headlessModal.hidden = false;
  els.headlessBody.innerHTML = `
    <h2>Custom checkout · ${item.name}</h2>
    <p class="muted">Headless SDK: <code>createNftCheckoutClient</code> against <code>${ZEXVRO_CONFIG.apiBase}</code></p>
    <p id="headless-status" class="status">…</p>
    <div id="headless-actions" class="actions"></div>
  `;
}

function setHeadlessStatus(text, isError = false) {
  const el = document.getElementById('headless-status');
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'status err' : 'status';
}

/**
 * @param {Array<{ label: string, primary?: boolean, onClick: () => void }>} actions
 */
function setHeadlessActions(actions) {
  const wrap = document.getElementById('headless-actions');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    if (action.primary) btn.className = 'primary';
    btn.addEventListener('click', () => void action.onClick());
    wrap.appendChild(btn);
  }
}

function closeHeadlessModal() {
  if (els.headlessModal) els.headlessModal.hidden = true;
  buyingItemId = null;
}

function atomicToUsdc(value) {
  try {
    const atomic = BigInt(value);
    const whole = atomic / 10_000_000n;
    const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  } catch {
    return value;
  }
}

async function probeCollection() {
  const live = collectionForItem(unlockItemId);
  if (!client || !live) {
    renderCollectionMeta();
    return;
  }
  try {
    const bundle = await client.getCollection(live.collectionId);
    const sale = bundle.collection?.primarySale;
    collectionInfo = {
      name: bundle.collection?.name,
      coverImageUri: bundle.collection?.coverImageUri,
      priceLabel: sale
        ? `${atomicToUsdc(sale.priceAtomic)} USDC`
        : live.priceLabel || ZEXVRO_CONFIG.priceLabel,
      mintedCount: bundle.inventory?.mintedCount ?? 0,
      saleReady: Boolean(sale),
    };
    renderCollectionMeta();
    log(
      `API OK · ${bundle.collection?.name || 'collection'} · unlocks Oak Shield · minted ${bundle.inventory?.mintedCount ?? 0}` +
        (sale ? ` · sale ${collectionInfo.priceLabel}` : ' · no primary sale yet'),
      sale ? 'ok' : 'err',
    );
    if (!sale) {
      log('Configure primary sale in NFT Studio before live purchases work.', 'err');
    }
  } catch (error) {
    log(
      `Cannot reach collection: ${error instanceof Error ? error.message : String(error)}`,
      'err',
    );
    collectionInfo = {
      name: 'Unreachable',
      saleReady: false,
      mintedCount: 0,
    };
    renderCollectionMeta();
  }
}

// --- simple top-down map ---
const map = [];
for (let y = 0; y < ROWS; y += 1) {
  const row = [];
  for (let x = 0; x < COLS; x += 1) {
    const edge = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
    const rock = (x + y) % 11 === 0 && x > 2 && y > 2 && x < COLS - 2 && y < ROWS - 2;
    row.push(edge || rock ? 1 : 0);
  }
  map.push(row);
}
// clear spawn
map[4][4] = 0;
map[4][5] = 0;
map[5][4] = 0;

function walkable(tx, ty) {
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return false;
  return map[ty][tx] === 0;
}

function tryMove(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!walkable(nx, ny)) return;
  player.x = nx;
  player.y = ny;
  if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
  if (has('mana-potion')) {
    trail.push({ x: player.x, y: player.y, t: performance.now() });
    if (trail.length > 12) trail.shift();
  }
}

function speedMs() {
  return has('swift-boots') ? 90 : 140;
}

function draw() {
  if (!ctx) return;
  // grass
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const wall = map[y][x] === 1;
      ctx.fillStyle = wall ? '#1e293b' : (x + y) % 2 === 0 ? '#14532d' : '#166534';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (wall) {
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
      }
    }
  }

  // mana trail
  const now = performance.now();
  trail = trail.filter((p) => now - p.t < 800);
  for (const p of trail) {
    const a = 1 - (now - p.t) / 800;
    ctx.fillStyle = `rgba(56, 189, 248, ${a * 0.45})`;
    ctx.beginPath();
    ctx.arc(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // player
  const px = player.x * TILE;
  const py = player.y * TILE;
  ctx.fillStyle = has('star-crystal') ? '#fbbf24' : player.color;
  ctx.fillRect(px + 8, py + 6, 16, 20);
  // crown
  if (has('star-crystal')) {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(px + 10, py + 2, 12, 4);
  }
  // shield
  if (has('oak-shield') && blocking) {
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(px + (player.facing > 0 ? 22 : -2), py + 10, 6, 14);
  } else if (has('oak-shield')) {
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(px + (player.facing > 0 ? 22 : -2), py + 12, 5, 10);
  }
  // sword slash
  if (has('iron-sword') && now < slashUntil) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const sx = px + TILE / 2;
    const sy = py + TILE / 2;
    ctx.arc(
      sx,
      sy,
      16,
      player.facing > 0 ? -0.8 : Math.PI - 0.8,
      player.facing > 0 ? 0.8 : Math.PI + 0.8,
    );
    ctx.stroke();
  }

  // boots hint
  if (has('swift-boots')) {
    ctx.fillStyle = '#34d399';
    ctx.fillRect(px + 8, py + 24, 6, 4);
    ctx.fillRect(px + 18, py + 24, 6, 4);
  }
}

function loop(t) {
  const interval = speedMs();
  if (t - lastMove > interval) {
    let moved = false;
    if (keys.has('ArrowUp') || keys.has('w')) {
      tryMove(0, -1);
      moved = true;
    } else if (keys.has('ArrowDown') || keys.has('s')) {
      tryMove(0, 1);
      moved = true;
    } else if (keys.has('ArrowLeft') || keys.has('a')) {
      tryMove(-1, 0);
      moved = true;
    } else if (keys.has('ArrowRight') || keys.has('d')) {
      tryMove(1, 0);
      moved = true;
    }
    if (moved) lastMove = t;
  }
  blocking = keys.has(' ') && has('oak-shield');
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.key);
  if (e.key === 'j' || e.key === 'J') {
    if (has('iron-sword')) slashUntil = performance.now() + 180;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key));

els.modeSelect?.addEventListener('change', () => {
  const value = els.modeSelect?.value;
  if (value === 'popup' || value === 'headless' || value === 'offline') {
    checkoutMode = value;
    refreshBadges();
    renderShop();
    log(`Checkout mode → ${checkoutMode}`, 'info');
  }
});

els.headlessClose?.addEventListener('click', () => closeHeadlessModal());

// boot
if (els.modeSelect) els.modeSelect.value = checkoutMode;
refreshBadges();
renderCollectionMeta();
renderShop();
updateEquip();
const bootLive = collectionForItem(unlockItemId);
log(
  isLive()
    ? checkoutMode === 'headless'
      ? 'Headless mode: createNftCheckoutClient + Freighter'
      : 'Live mode: Oak Shield → openCheckout popup (Studio SDK sample)'
    : 'Demo mode: unlocks are localStorage only',
  'info',
);
log(
  `Oak Shield collection ${bootLive?.collectionId || '(none)'} · checkoutOrigin ${bootLive?.checkoutOrigin || ZEXVRO_CONFIG.checkoutOrigin}`,
  'info',
);
void probeCollection();
requestAnimationFrame(loop);
