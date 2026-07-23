export type GameMode = 'web2' | 'web3'

export type ScoreRow = {
  id: string
  player: string
  /** Lakebed v0 stores scalars as string|boolean — score is decimal string */
  score: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export type SkinId = 'default' | 'neon' | 'gold'

export function cleanPlayerName(value: string): string {
  return value.trim().slice(0, 24) || 'anon'
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1_000_000, Math.floor(n)))
}
