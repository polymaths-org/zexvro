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
import { useEffect, useRef, useState } from 'preact/hooks'
import type { GameMode, ScoreRow } from '../shared/game'
import { PlatformerGame, SKINS, type SkinId } from '../shared/platformer'

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

function Header() {
  const auth = useAuth()
  const label = auth.displayName
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] tracking-[0.25em] text-cyan-400/80">ZEXVRO ARCADE</p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Neon Run</h1>
        <p className="mt-1 text-sm text-neutral-500">Platformer · collect coins · reach the flag</p>
      </div>
      <div className="flex items-center gap-2">
        {auth.isLoading ? (
          <span className="text-xs text-neutral-500">…</span>
        ) : auth.isGuest ? (
          <SignInWithGoogle className="border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-cyan-400 hover:text-white" />
        ) : (
          <>
            <span className="max-w-[8rem] truncate text-xs text-neutral-400">{label}</span>
            <button className="text-xs text-neutral-500 hover:text-white" type="button" onClick={() => signOut()}>
              Out
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PlatformerCanvas({
  skin,
  onSnapshot,
}: {
  skin: SkinId
  onSnapshot: (score: number, won: boolean) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<PlatformerGame | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const fit = () => {
      const parent = canvas.parentElement
      const cssW = Math.min(960, parent?.clientWidth || 960)
      const cssH = 420
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
    }
    fit()

    const game = new PlatformerGame(canvas)
    gameRef.current = game
    game.setSkin(skin)
    game.attachInput()
    game.setOnEnd((snap) => onSnapshot(snap.score, snap.won))
    game.start()

    const onResize = () => fit()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      game.destroy()
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; skin via effect below
  }, [])

  useEffect(() => {
    gameRef.current?.setSkin(skin)
  }, [skin])

  function restart() {
    const g = gameRef.current
    if (!g) return
    g.reset()
    g.setSkin(skin)
    g.start()
  }

  function hold(key: string) {
    return {
      onPointerDown: (e: { preventDefault(): void }) => {
        e.preventDefault()
        gameRef.current?.press(key)
      },
      onPointerUp: () => gameRef.current?.release(key),
      onPointerLeave: () => gameRef.current?.release(key),
      onPointerCancel: () => gameRef.current?.release(key),
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_80px_-24px_rgba(34,211,238,0.45)]">
        <canvas ref={ref} className="block w-full touch-none" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => restart()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-100"
        >
          Restart level
        </button>
        <p className="text-xs text-neutral-500">
          Keyboard: <span className="text-neutral-300">A/D</span> or arrows move ·{' '}
          <span className="text-neutral-300">W / ↑ / Space</span> jump · stomp enemies
        </p>
      </div>
      {/* Mobile controls */}
      <div className="mt-3 flex justify-between gap-3 sm:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            className="h-14 w-14 rounded-xl border border-neutral-700 bg-neutral-900 text-lg text-white active:bg-neutral-700"
            {...hold('a')}
          >
            ←
          </button>
          <button
            type="button"
            className="h-14 w-14 rounded-xl border border-neutral-700 bg-neutral-900 text-lg text-white active:bg-neutral-700"
            {...hold('d')}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="h-14 min-w-[5.5rem] rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-sm font-semibold text-cyan-300 active:bg-cyan-500/20"
          {...hold(' ')}
        >
          JUMP
        </button>
      </div>
    </div>
  )
}

function PlayPage() {
  const config = useQuery<GameConfig>('gameConfig')
  const ensure = useMutation<[], void>('ensureDefaults')
  const submitScore = useMutation<[player: string, score: number], void>('submitScore')
  const top = useQuery<ScoreRow[]>('topScores')
  const [skin, setSkin] = useState<SkinId>('default')
  const [name, setName] = useState('player')
  const [lastScore, setLastScore] = useState(0)
  const [msg, setMsg] = useState('')
  const [tip, setTip] = useState('')

  useEffect(() => {
    void ensure()
  }, [ensure])

  const mode = config?.mode ?? 'web2'

  async function onSubmitScore() {
    setMsg('')
    try {
      if (config?.features.captchaOnScore) {
        setMsg('Web3 mode: Morph should wire Gate captcha before submit. (Hook pending in baseline.)')
      }
      if (lastScore <= 0) {
        setMsg('Finish a run (flag or game over) to submit a score.')
        return
      }
      await submitScore(name, lastScore)
      setMsg(`Score ${lastScore} submitted as ${name}.`)
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
      <div
        className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${modeBadge}`}
      >
        Mode: {mode.toUpperCase()}
        {mode === 'web2' ? ' · Morph migrates this live' : ' · ZEXVRO services active'}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <PlatformerCanvas
            skin={skin}
            onSnapshot={(score, won) => {
              setLastScore(score)
              setMsg(won ? `Level clear! Score ${score}` : `Run ended · score ${score}`)
            }}
          />
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
                    onClick={() => setSkin(id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      skin === id ? 'border-white' : 'border-neutral-800'
                    } ${locked ? 'opacity-40' : 'hover:border-neutral-500'}`}
                  >
                    <span style={{ color: s.palette.body }}>{s.label}</span>
                    <span className="text-xs text-neutral-500">
                      {locked ? 'NFT unlock (Web3)' : skin === id ? 'equipped' : 'select'}
                    </span>
                  </button>
                )
              })}
            </div>
            {mode === 'web2' ? (
              <p className="mt-3 text-xs text-neutral-500">
                Neon / Gold unlock after Morph wires ZEXVRO NFT mint on testnet.
              </p>
            ) : (
              <p className="mt-3 text-xs text-lime-400/80">Web3: skins gated by NFT ownership.</p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Submit score
            </h2>
            <p className="mb-2 font-mono text-2xl text-cyan-300">{lastScore || '—'}</p>
            <input
              className="mb-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              value={name}
              onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
              placeholder="player name"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onSubmitScore()}
                disabled={lastScore <= 0}
                className="rounded-lg border border-neutral-600 px-3 py-2 text-sm text-neutral-200 hover:border-white disabled:opacity-40"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => void loadTip()}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:text-white"
              >
                Tip
              </button>
            </div>
            {msg ? <p className="mt-2 text-sm text-neutral-300">{msg}</p> : null}
            {tip ? <p className="mt-2 font-mono text-xs text-neutral-500">{tip}</p> : null}
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
      <h2 className="text-2xl font-bold text-white">Neon Run · Morph demo</h2>
      <p className="text-sm text-neutral-400">
        Original canvas platformer (no third-party engine) so it runs cleanly on Lakebed and Morph can
        patch it. Coins, enemies, spikes, flag goal — score feeds the leaderboard Morph will protect
        with Gate and unlock skins with NFT.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Play Web2 Neon Run on the shared Lakebed URL.</li>
        <li>Morph scans this capsule and plans ZEXVRO services.</li>
        <li>Morph patches Gate / NFT / optional De-pin.</li>
        <li>
          <code className="text-cyan-300">npx lakebed deploy</code> updates the same URL for everyone.
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
        <div className="mx-auto max-w-6xl">
          <Header />
          <nav className="mb-6 flex gap-4 text-sm text-neutral-500">
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
