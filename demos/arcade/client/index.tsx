import {
  Link,
  Route,
  Router,
  Routes,
  SignInWithGoogle,
  signOut,
  useAuth,
  useMutation,
  useQuery,
} from 'lakebed/client'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { GameMode, ScoreRow, SkinId } from '../shared/game'

type GameConfig = {
  mode: GameMode
  gateSiteKey: string
  gateApiUrl: string
  nftApiUrl: string
  depinApiUrl: string
  features: {
    captchaOnScore: boolean
    nftSkins: boolean
    paidTips: boolean
  }
}

const SKINS: Record<SkinId, { label: string; color: string; lockedWeb2: boolean }> = {
  default: { label: 'Classic', color: '#22d3ee', lockedWeb2: false },
  neon: { label: 'Neon', color: '#a3e635', lockedWeb2: true },
  gold: { label: 'Gold', color: '#fbbf24', lockedWeb2: true },
}

function useGame() {
  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState(15)
  const [skin, setSkin] = useState<SkinId>('default')

  useEffect(() => {
    if (!running) return
    if (left <= 0) {
      setRunning(false)
      return
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [running, left])

  function start() {
    setScore(0)
    setLeft(15)
    setRunning(true)
  }

  function tap() {
    if (!running || left <= 0) return
    setScore((s) => s + 1)
  }

  return { score, running, left, skin, setSkin, start, tap }
}

function Header() {
  const auth = useAuth()
  const label = auth.displayName
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-cyan-400/80">ZEXVRO ARCADE</p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Click Rush</h1>
      </div>
      <div className="flex items-center gap-2">
        {auth.isLoading ? (
          <span className="text-xs text-neutral-500">…</span>
        ) : auth.isGuest ? (
          <SignInWithGoogle className="border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-cyan-400 hover:text-white" />
        ) : (
          <>
            <span className="max-w-[8rem] truncate text-xs text-neutral-400">{label}</span>
            <button
              className="text-xs text-neutral-500 hover:text-white"
              type="button"
              onClick={() => signOut()}
            >
              Out
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PlayPage() {
  const config = useQuery<GameConfig>('gameConfig')
  const ensure = useMutation<[], void>('ensureDefaults')
  const submitScore = useMutation<[player: string, score: number], void>('submitScore')
  const top = useQuery<ScoreRow[]>('topScores')
  const game = useGame()
  const [name, setName] = useState('player')
  const [msg, setMsg] = useState('')
  const [tip, setTip] = useState('')

  useEffect(() => {
    void ensure()
  }, [ensure])

  const mode = config?.mode ?? 'web2'
  const skinMeta = SKINS[game.skin]
  const boardColor = skinMeta.color

  async function onSubmitScore() {
    setMsg('')
    try {
      if (config?.features.captchaOnScore) {
        setMsg('Web3 mode: Morph should wire Gate captcha before submit. (Hook pending in this baseline.)')
      }
      await submitScore(name, game.score)
      setMsg(`Score ${game.score} submitted as ${name}.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'submit failed')
    }
  }

  async function loadTip() {
    const res = await fetch('api/tip')
    setTip(await res.text())
  }

  const modeBadge =
    mode === 'web3'
      ? 'border-lime-400/40 bg-lime-400/10 text-lime-300'
      : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'

  return (
    <section>
      <div className={`mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${modeBadge}`}>
        Mode: {mode.toUpperCase()}
        {mode === 'web2' ? ' · Morph will migrate this live' : ' · ZEXVRO services active'}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-[0_0_60px_-20px_rgba(34,211,238,0.35)]">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-sm text-neutral-400">Time left</p>
              <p className="font-mono text-4xl font-bold text-white">{game.left}s</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-400">Score</p>
              <p className="font-mono text-4xl font-bold" style={{ color: boardColor }}>
                {game.score}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!game.running}
            onClick={() => game.tap()}
            className="mb-4 flex h-48 w-full items-center justify-center rounded-xl border-2 border-dashed text-lg font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: boardColor,
              color: boardColor,
              boxShadow: game.running ? `inset 0 0 40px ${boardColor}22` : undefined,
            }}
          >
            {game.running ? 'TAP!' : 'Start a round to play'}
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => game.start()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-100"
            >
              {game.running ? 'Restart' : 'Start 15s round'}
            </button>
            <button
              type="button"
              onClick={() => void onSubmitScore()}
              disabled={game.running || game.score <= 0}
              className="rounded-lg border border-neutral-600 px-4 py-2 text-sm text-neutral-200 hover:border-white disabled:opacity-40"
            >
              Submit score
            </button>
            <button
              type="button"
              onClick={() => void loadTip()}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:text-white"
            >
              Get tip
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              value={name}
              onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
              placeholder="player name"
            />
          </div>

          {msg ? <p className="mt-3 text-sm text-neutral-300">{msg}</p> : null}
          {tip ? <p className="mt-2 font-mono text-xs text-neutral-500">{tip}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">Skins</h2>
            <div className="flex flex-col gap-2">
              {(Object.keys(SKINS) as SkinId[]).map((id) => {
                const s = SKINS[id]
                const locked = s.lockedWeb2 && mode === 'web2'
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={locked}
                    onClick={() => game.setSkin(id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      game.skin === id ? 'border-white' : 'border-neutral-800'
                    } ${locked ? 'opacity-40' : 'hover:border-neutral-500'}`}
                  >
                    <span style={{ color: s.color }}>{s.label}</span>
                    <span className="text-xs text-neutral-500">
                      {locked ? 'NFT unlock (Web3)' : game.skin === id ? 'equipped' : 'select'}
                    </span>
                  </button>
                )
              })}
            </div>
            {mode === 'web2' ? (
              <p className="mt-3 text-xs text-neutral-500">
                Neon/Gold unlock after Morph wires ZEXVRO NFT mint on testnet.
              </p>
            ) : (
              <p className="mt-3 text-xs text-lime-400/80">Web3: skins can be gated by NFT ownership.</p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Leaderboard
            </h2>
            <ul className="divide-y divide-neutral-900">
              {(top || []).slice(0, 8).map((row) => (
                <li key={row.id} className="flex justify-between py-2 text-sm">
                  <span className="text-neutral-300">{row.player}</span>
                  <span className="font-mono text-cyan-300">{String(row.score)}</span>
                </li>
              ))}
              {!top?.length ? <li className="py-2 text-sm text-neutral-600">No scores yet</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function AboutPage() {
  return (
    <section className="max-w-xl space-y-4 text-neutral-300">
      <h2 className="text-2xl font-bold text-white">Morph demo story</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Start as pure Web2 (scores + free tip).</li>
        <li>Morph scans this Lakebed capsule and plans ZEXVRO services.</li>
        <li>Morph patches code: Gate on submit, NFT skins, optional De-pin tips.</li>
        <li>
          <code className="text-cyan-300">npx lakebed deploy</code> updates the shared URL for everyone.
        </li>
      </ol>
      <Link className="text-sm text-cyan-400 hover:text-white" to="/">
        ← Back to game
      </Link>
    </section>
  )
}

export function App() {
  return (
    <Router>
      <main className="min-h-screen bg-[#05070a] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Header />
          <nav className="mb-8 flex gap-4 text-sm text-neutral-500">
            <Link className="hover:text-white" to="/">
              Play
            </Link>
            <Link className="hover:text-white" to="/about">
              About Morph
            </Link>
          </nav>
          <Routes>
            <Route path="/" element={<PlayPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="*"
              element={
                <section>
                  <h1 className="mb-4 text-3xl font-bold">Not found</h1>
                  <Link to="/">Home</Link>
                </section>
              }
            />
          </Routes>
        </div>
      </main>
    </Router>
  )
}
