/**
 * Shop catalog — each item maps 1:1 to an in-game unlockable NFT skin/gear.
 * Cover art is SVG under assets/items/ (also usable as collection cover uploads).
 */
export const CATALOG = [
  {
    id: 'iron-sword',
    name: 'Iron Sword',
    emoji: '⚔️',
    image: './assets/items/iron-sword.svg',
    description: 'A sturdy blade. Unlocks melee slash VFX.',
    stats: { atk: 4 },
    color: '#94a3b8',
  },
  {
    id: 'oak-shield',
    name: 'Oak Shield',
    emoji: '🛡️',
    image: './assets/items/oak-shield.svg',
    description: 'Wooden kite shield. Buy via ZEXVRO openCheckout popup · unlocks block (Space).',
    stats: { def: 3 },
    color: '#a78bfa',
  },
  {
    id: 'swift-boots',
    name: 'Swift Boots',
    emoji: '👢',
    image: './assets/items/swift-boots.svg',
    description: 'Light boots. Slightly faster walk speed.',
    stats: { spd: 1.25 },
    color: '#34d399',
  },
  {
    id: 'mana-potion',
    name: 'Mana Potion',
    emoji: '🧪',
    image: './assets/items/mana-potion.svg',
    description: 'Glowing flask. Unlocks blue trail aura.',
    stats: { mp: 10 },
    color: '#38bdf8',
  },
  {
    id: 'star-crystal',
    name: 'Star Crystal',
    emoji: '💎',
    image: './assets/items/star-crystal.svg',
    description: 'Rare crystal. Unlocks gold player crown.',
    stats: { luck: 5 },
    color: '#fbbf24',
  },
];
