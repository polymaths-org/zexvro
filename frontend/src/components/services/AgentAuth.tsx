import { useEffect, useMemo, useState } from 'react'
import {
  fetchDemoKeys,
  fetchGateAgents,
  fetchGateStatus,
  gateApiBase,
  registerGateAgent,
  type DemoKeys,
  type GateAgentRow,
  type GateStatus,
} from '../../services/agent-auth/agentAuthApi'
import { KeyRound, ShieldCheck, Bot, UserRound, ScrollText, Copy } from 'lucide-react'
import GateProtect from '../gate/GateProtect'

type TabId = 'overview' | 'captcha' | 'keys' | 'policies' | 'agents' | 'events'

type PolicyMode = 'human_only' | 'agent_only' | 'either' | 'dual_path'

type GateEvent = {
  id: string
  action: string
  class: 'human' | 'agent' | 'unknown'
  result: 'passed' | 'challenged' | 'denied'
  reason?: string
  time: string
}

const DEMO_SITE_KEY = 'zk_test_demo_public'
const DEMO_SECRET_HINT = 'sk_test_… (shown once at create; use /v1/admin/demo-keys locally)'

const DEFAULT_POLICIES: Array<{ action: string; mode: PolicyMode; note: string }> = [
  { action: 'checkout.submit', mode: 'human_only', note: 'Irreversible commerce — humans only' },
  { action: 'search.query', mode: 'either', note: 'Browsers and registered agents' },
  { action: 'index.bulk', mode: 'agent_only', note: 'Machine pipelines only' },
  { action: 'trade.execute', mode: 'dual_path', note: 'Different scopes/TTL per class' },
]

function buildCaptchaSnippet(siteKey: string, apiBase: string) {
  return `import { protectWithCaptcha, CAPABILITY_HEADER } from '@zexvro/gate/captcha'

const { capability } = await protectWithCaptcha({
  apiBase: '${apiBase}',
  siteKey: '${siteKey}',
  action: 'checkout.submit',
  origin: location.origin,
  mode: 'modal',
})

await fetch('/api/checkout', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [CAPABILITY_HEADER]: capability,
  },
  body: JSON.stringify({ /* payload */ }),
})

// Server: gateMiddleware({ apiBase, siteSecret, action, minClass: 'human' })
`
}

const SNIPPET = `import { BrowserGate, CAPABILITY_HEADER } from '@zexvro/gate/browser'

const gate = new BrowserGate({
  siteKey: 'zk_test_demo_public',
  apiBase: 'http://localhost:4103', // or hosted Gate URL
})

const { capability } = await gate.protect({
  action: 'checkout.submit',
  origin: window.location.origin,
})

await fetch('/api/checkout', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [CAPABILITY_HEADER]: capability,
  },
  body: JSON.stringify({ /* your payload */ }),
})`

export default function AgentAuth() {
  const [tab, setTab] = useState<TabId>('overview')
  const [events] = useState<GateEvent[]>([
    {
      id: 'ev-1',
      action: 'search.query',
      class: 'agent',
      result: 'passed',
      time: '2 minutes ago',
    },
    {
      id: 'ev-2',
      action: 'checkout.submit',
      class: 'human',
      result: 'challenged',
      reason: 'soft presence step-up',
      time: '10 minutes ago',
    },
    {
      id: 'ev-3',
      action: 'index.bulk',
      class: 'human',
      result: 'denied',
      reason: 'policy_agent_only',
      time: '1 hour ago',
    },
  ])
  const [copied, setCopied] = useState(false)
  const [captchaCopied, setCaptchaCopied] = useState(false)
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [demoKeys, setDemoKeys] = useState<DemoKeys | null>(null)
  const [demoKeysError, setDemoKeysError] = useState<string | null>(null)
  const [secretRevealed, setSecretRevealed] = useState(false)
  const [keysCopied, setKeysCopied] = useState(false)
  const [agents, setAgents] = useState<GateAgentRow[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('local-agent')
  const [agentPub, setAgentPub] = useState('')
  const [agentBusy, setAgentBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchGateStatus()
      .then((s) => {
        if (!cancelled) {
          setGateStatus(s)
          setGateError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGateStatus(null)
          setGateError(err instanceof Error ? err.message : 'Gate API unreachable')
        }
      })
    fetchDemoKeys()
      .then(async (k) => {
        if (cancelled) return
        setDemoKeys(k)
        setDemoKeysError(null)
        try {
          const list = await fetchGateAgents(k.siteKey)
          if (!cancelled) {
            setAgents(list)
            setAgentsError(null)
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setAgents([])
            setAgentsError(err instanceof Error ? err.message : 'agents unavailable')
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDemoKeys(null)
          setDemoKeysError(err instanceof Error ? err.message : 'demo-keys unavailable')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshAgents = async () => {
    const siteKey = demoKeys?.siteKey || DEMO_SITE_KEY
    setAgentBusy(true)
    try {
      const list = await fetchGateAgents(siteKey)
      setAgents(list)
      setAgentsError(null)
    } catch (err: unknown) {
      setAgentsError(err instanceof Error ? err.message : 'agents unavailable')
    } finally {
      setAgentBusy(false)
    }
  }

  const onRegisterAgent = async () => {
    const siteKey = demoKeys?.siteKey || DEMO_SITE_KEY
    if (!agentPub.trim() || agentPub.trim().length < 8) {
      setAgentsError('publicKey must be at least 8 characters (Ed25519 base64url or G…)')
      return
    }
    setAgentBusy(true)
    try {
      await registerGateAgent({
        siteKey,
        publicKey: agentPub.trim(),
        name: agentName.trim() || 'local-agent',
      })
      setAgentPub('')
      await refreshAgents()
    } catch (err: unknown) {
      setAgentsError(err instanceof Error ? err.message : 'register failed')
      setAgentBusy(false)
    }
  }

  const copyEnvSnippet = async () => {
    const siteKey = demoKeys?.siteKey || DEMO_SITE_KEY
    const secret = demoKeys?.secretKey || 'sk_test_…'
    const base = gateApiBase()
    const env = [
      `GATE_SITE_KEY=${siteKey}`,
      `GATE_SECRET_KEY=${secret}`,
      `GATE_API_BASE=${base.startsWith('http') ? base : 'http://localhost:4103'}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(env)
      setKeysCopied(true)
      window.setTimeout(() => setKeysCopied(false), 1500)
    } catch {
      setKeysCopied(false)
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'overview' as const, label: 'Overview', icon: ShieldCheck },
        { id: 'captcha' as const, label: 'Captcha', icon: UserRound },
        { id: 'keys' as const, label: 'Keys', icon: KeyRound },
        { id: 'policies' as const, label: 'Policies', icon: ScrollText },
        { id: 'agents' as const, label: 'Agents', icon: Bot },
        { id: 'events' as const, label: 'Events', icon: UserRound },
      ] as const,
    [],
  )

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">ZEXVRO Gate</h1>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              MVP · dual-channel
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Dual-channel access gate for humans and agents. Issue short-lived capabilities, enforce
            per-action policy. Humans use captcha; agents use keys. Captcha is friction, not farm-proof.
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
          onClick={() =>
            alert(
              'Local docs:\n• docs/agent_auth_quickstart.md\n• docs/agent_auth_DEVELOPER_GUIDE.md\n• docs/agent_auth_PLAN_FINAL.md',
            )
          }
        >
          Local docs
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: 'Gate API',
              value: gateStatus ? 'reachable' : gateError ? 'offline' : '…',
              hint: gateStatus
                ? `${gateStatus.product} · ${gateStatus.sites} sites · ${gateStatus.agents} agents`
                : gateError || 'Start services/agent-auth on :4103',
            },
            {
              label: 'Channels',
              value: gateStatus?.capabilities.channels.join(' + ') || 'human + agent',
              hint: 'Separate ceremonies; non-transferable class',
            },
            {
              label: 'Capability header',
              value: gateStatus?.header || 'x-zexvro-capability',
              hint: 'Send on protected origin requests',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]"
            >
              <div className="text-[11px] uppercase tracking-wide text-zinc-450">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{card.hint}</div>
            </div>
          ))}
          {gateStatus?.securityProfile?.note && (
            <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Security profile · </span>
              {gateStatus.securityProfile.note}
              {gateStatus.securityProfile.popEnforcedOnVerify ? ' · PoP on' : ' · PoP off'}
            </div>
          )}
          {gateError && (
            <div className="md:col-span-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
              <div className="font-semibold">Gate API is not running</div>
              <p className="mt-1 text-xs opacity-90">
                Frontend alone is not enough. Captcha and keys need the Gate service on port 4103.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-100">{`npm run dev:frontend-gate
# starts frontend :3000 + Gate :4103

# or full stack:
npm run dev:stack-gate-lite`}</pre>
              <p className="mt-2 text-[11px] opacity-80">
                Demo captcha (API):{' '}
                <a className="underline" href="http://localhost:4103/demo/captcha" target="_blank" rel="noreferrer">
                  http://localhost:4103/demo/captcha
                </a>
              </p>
            </div>
          )}
          <div className="md:col-span-3">
            <GateProtect
              action="checkout.submit"
              mode="captcha"
              siteKey={demoKeys?.siteKey || DEMO_SITE_KEY}
              apiBase={gateApiBase()}
              onReady={(r) => {
                console.info('[gate] capability', r.class, r.securityNote)
              }}
            />
          </div>
          <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">How it works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Create a site key and define per-action policies.</li>
              <li>Browser SDK uses the <strong>human</strong> channel; agents sign a nonce on the <strong>agent</strong> channel.</li>
              <li>Server verifies <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">X-Zexvro-Capability</code> bound to action + class.</li>
              <li>Optional: compose with De-pin so paid routes also check Stellar payer allowlists.</li>
            </ol>
          </div>
        </div>
      )}

      
      {tab === 'captcha' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Human captcha setup</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Self-hosted multi-type captcha for humans. Agents use keys + PoP and never see this UI.
                Not farm-proof; casual-bot friction only.
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                <li>
                  Run Gate + dashboard:{' '}
                  <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-900">npm run dev:frontend-gate</code>
                </li>
                <li>Copy site key into the browser app; keep secret on the server only.</li>
                <li>
                  Wrap any button with <code className="text-[11px]">protectWithCaptcha</code>.
                </li>
                <li>
                  Verify with <code className="text-[11px]">minClass: &apos;human&apos;</code> on your API.
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="http://localhost:4103/demo/captcha"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
                >
                  Open live captcha demo
                </a>
                <button
                  type="button"
                  onClick={() => setTab('overview')}
                  className="inline-flex items-center rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Try protect widget
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Your keys (local)</h3>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <div className="text-[11px] uppercase text-zinc-450">siteKey</div>
                  <code className="mt-1 block break-all rounded-lg bg-zinc-50 px-3 py-2 font-mono dark:bg-zinc-900">
                    {demoKeys?.siteKey || DEMO_SITE_KEY}
                  </code>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-450">apiBase (Vite proxy)</div>
                  <code className="mt-1 block break-all rounded-lg bg-zinc-50 px-3 py-2 font-mono dark:bg-zinc-900">
                    {gateApiBase()}
                  </code>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-450">Allowed origins</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(demoKeys?.allowedOrigins || ['http://localhost:3000', 'http://localhost:5173']).map((o) => (
                      <span
                        key={o}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {gateError && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  Gate offline — start with <code className="text-[10px]">npm run dev:frontend-gate</code>
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Embed snippet</h2>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      buildCaptchaSnippet(demoKeys?.siteKey || DEMO_SITE_KEY, gateApiBase()),
                    )
                    setCaptchaCopied(true)
                    window.setTimeout(() => setCaptchaCopied(false), 1500)
                  } catch {
                    setCaptchaCopied(false)
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                <Copy className="h-3 w-3" />
                {captchaCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
              {buildCaptchaSnippet(demoKeys?.siteKey || DEMO_SITE_KEY, gateApiBase())}
            </pre>
            <p className="mt-3 text-[11px] text-zinc-500">
              Monorepo package: <code className="text-[10px]">packages/agent-auth-sdk/src/captcha.js</code>
            </p>
          </div>
        </div>
      )}

      {tab === 'keys' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Site keys</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Public site key goes in the browser. Secret stays on your server (verify / middleware).
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyEnvSnippet()}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                <Copy className="h-3 w-3" />
                {keysCopied ? 'Copied env' : 'Copy env'}
              </button>
            </div>
            {demoKeysError && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Live demo-keys: {demoKeysError}. Showing seeded defaults.
              </p>
            )}
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-zinc-450">Site key</div>
                <code className="mt-1 block rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs dark:bg-zinc-900">
                  {demoKeys?.siteKey || DEMO_SITE_KEY}
                </code>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase text-zinc-450">Secret key</div>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
                    onClick={() => setSecretRevealed((v) => !v)}
                  >
                    {secretRevealed ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <code className="mt-1 block rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs dark:bg-zinc-900">
                  {secretRevealed && demoKeys?.secretKey
                    ? demoKeys.secretKey
                    : DEMO_SECRET_HINT}
                </code>
              </div>
              {demoKeys?.allowedOrigins && (
                <div>
                  <div className="text-[11px] uppercase text-zinc-450">Allowed origins</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {demoKeys.allowedOrigins.map((o) => (
                      <span
                        key={o}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Quickstart</h2>
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
              {SNIPPET}
            </pre>
          </div>
        </div>
      )}

      {tab === 'policies' && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-850">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Action policies</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Mode decides who may pass. Class is never self-asserted — it comes from the ceremony channel.
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {DEFAULT_POLICIES.map((row) => (
              <div key={row.action} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">{row.action}</div>
                  <div className="text-xs text-zinc-500">{row.note}</div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {row.mode}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Registered agents</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Agents use a registered public key (Ed25519 / Stellar <code className="text-xs">G…</code>).
                  They cannot complete human ceremonies.
                </p>
              </div>
              <button
                type="button"
                disabled={agentBusy}
                onClick={() => void refreshAgents()}
                className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                Refresh
              </button>
            </div>
            {agentsError && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{agentsError}</p>
            )}
            <div className="mt-4 space-y-2">
              {agents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                  No agents yet. Register one below or run <code className="text-xs">npm run agent-auth:smoke</code>.
                </div>
              ) : (
                agents.map((a) => (
                  <div
                    key={a.agentId}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{a.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{a.agentId}</span>
                    </div>
                    <code className="mt-1 block break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {a.publicKey}
                    </code>
                    {a.payMode && (
                      <div className="mt-1 text-[11px] text-zinc-500">payMode={a.payMode}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Register agent (local)</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Paste an Ed25519 public key (base64url from <code className="text-[10px]">generateAgentKeyPair()</code>).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-zinc-500">Name</span>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="text-zinc-500">Public key</span>
                <input
                  value={agentPub}
                  onChange={(e) => setAgentPub(e.target.value)}
                  placeholder="base64url Ed25519 public key"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={agentBusy}
              onClick={() => void onRegisterAgent()}
              className="mt-3 inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
            >
              {agentBusy ? 'Working…' : 'Register agent'}
            </button>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent decisions</h2>
          <div className="mt-4 space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/40 px-3 py-3 dark:border-zinc-900 dark:bg-zinc-950/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">{ev.action}</span>
                    <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {ev.class}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {ev.time}
                    {ev.reason ? ` · ${ev.reason}` : ''}
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    ev.result === 'passed'
                      ? 'bg-green-500/10 text-green-600'
                      : ev.result === 'challenged'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  {ev.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
