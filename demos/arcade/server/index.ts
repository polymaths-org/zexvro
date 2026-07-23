import { capsule, endpoint, json, mutation, query, string, table, text } from 'lakebed/server'
import { clampScore, cleanPlayerName, type GameMode } from '../shared/game'

/**
 * Web2 baseline arcade (Lakebed capsule).
 * Morph migrates toward Web3: Gate on scores, NFT skins, optional De-pin tips.
 * Scores stored as strings (Lakebed v0 scalar types: string | boolean only).
 */
export default capsule({
  name: 'ZEXVRO Arcade',

  schema: {
    scores: table({
      player: string(),
      score: string(),
      ownerId: string(),
    }).index('by_owner', ['ownerId']),
    config: table({
      key: string(),
      value: string(),
    }).index('by_key', ['key']),
  },

  queries: {
    topScores: query(async (ctx) => {
      const rows = await ctx.db.scores.withIndex('by_creation').order('desc').take(40)
      return rows
        .map((r) => ({ ...r, scoreNum: Number(r.score) || 0 }))
        .sort((a, b) => b.scoreNum - a.scoreNum)
        .slice(0, 10)
        .map(({ scoreNum: _s, ...row }) => row)
    }),

    gameConfig: query(async (ctx) => {
      const rows = await ctx.db.config.withIndex('by_key', (q) => q.eq('key', 'mode')).collect()
      const mode = (rows[0]?.value as GameMode | undefined) || 'web2'
      return {
        mode,
        gateSiteKey: '',
        gateApiUrl: 'https://api.zexvro.in/gate',
        nftApiUrl: 'https://iyk6idmup6.us-east-1.awsapprunner.com',
        depinApiUrl: 'https://sr9k3xpmbj.us-east-1.awsapprunner.com',
        features: {
          captchaOnScore: mode === 'web3',
          nftSkins: mode === 'web3',
          paidTips: false,
        },
      }
    }),
  },

  mutations: {
    ensureDefaults: mutation(async (ctx) => {
      const existing = await ctx.db.config.withIndex('by_key', (q) => q.eq('key', 'mode')).collect()
      if (existing.length === 0) {
        await ctx.db.config.insert({ key: 'mode', value: 'web2' })
      }
    }),

    setGameMode: mutation(async (ctx, mode: string) => {
      if (mode !== 'web2' && mode !== 'web3') return
      const existing = await ctx.db.config.withIndex('by_key', (q) => q.eq('key', 'mode')).collect()
      if (existing[0]) {
        await ctx.db.config.update(existing[0].id, { value: mode })
      } else {
        await ctx.db.config.insert({ key: 'mode', value: mode })
      }
    }),

    submitScore: mutation(async (ctx, player: string, score: number) => {
      const name = cleanPlayerName(player)
      const value = String(clampScore(score))
      await ctx.db.scores.insert({
        player: name,
        score: value,
        ownerId: ctx.auth.userId,
      })
    }),
  },

  endpoints: {
    status: endpoint({ method: 'GET', path: '/api/status' }, () =>
      json({
        ok: true,
        product: 'zexvro-arcade',
      }),
    ),

    tip: endpoint({ method: 'GET', path: '/api/tip' }, () =>
      text('Web2 tip: click faster. Morph will wire paid De-pin tips in Web3 mode.', {
        status: 200,
      }),
    ),
  },
})
