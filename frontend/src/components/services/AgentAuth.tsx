import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createGateSite,
  fetchGateAgents,
  fetchGateStatus,
  gateApiBase,
  listGateSites,
  registerGateAgent,
  rotateGateSiteSecret,
  updateGateSite,
  type GateAgentRow,
  type GateSite,
  type GateStatus,
} from '../../services/agent-auth/agentAuthApi'
import { ensureValidAccessToken, readStoredSession } from '../../auth/cognito'
import {
  KeyRound,
  ShieldCheck,
  Bot,
  Play,
  Copy,
  Plus,
  Globe,
  CheckCircle2,
  Circle,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Server,
  Code2,
  Settings2,
} from 'lucide-react'
import GateProtect from '../gate/GateProtect'

type TabId = 'setup' | 'website' | 'install' | 'test' | 'advanced'

async function getAuthHeader(): Promise<string | undefined> {
  const session = readStoredSession()
  if (!session?.token) return undefined
  try {
    const token = await ensureValidAccessToken(session)
    return `Bearer ${token}`
  } catch {
    return `Bearer ${session.token}`
  }
}

function normalizeOriginInput(raw: string): string {
  const t = raw.trim().replace(/\/$/, '')
  if (!t) return ''
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return t
  }
}

function buildBrowserSnippet(apiBase: string, siteKey: string, action: string) {
  return `<script type="module">
  import { protectWithCaptcha, CAPABILITY_HEADER } from '${apiBase}/v1/sdk/captcha.js'

  // Call this when the user tries a sensitive action (checkout, delete, etc.)
  async function protectThenContinue() {
    const { capability } = await protectWithCaptcha({
      apiBase: '${apiBase}',
      siteKey: '${siteKey}',
      action: '${action}',
      origin: location.origin,
      mode: 'modal',
    })

    // Send the capability to YOUR backend with the request
    await fetch('/api/your-protected-route', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CAPABILITY_HEADER]: capability,
      },
      body: JSON.stringify({ /* your data */ }),
    })
  }

  document.getElementById('protected-button')?.addEventListener('click', () => {
    protectThenContinue().catch(console.error)
  })
</script>`
}

function buildServerSnippet(apiBase: string, action: string) {
  return `// Node / Express example — keep the secret key on the server only
const gateVerify = await fetch('${apiBase}/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: req.headers['x-zexvro-capability'],
    siteSecret: process.env.GATE_SECRET_KEY, // sk_live_… from this dashboard
    action: '${action}',
    minClass: 'human',
    expectedOrigin: process.env.APP_ORIGIN, // e.g. https://yoursite.com
  }),
})

if (!gateVerify.ok) {
  return res.status(401).json({ error: 'Human verification required' })
}
// OK — continue with checkout / sensitive action`
}

function buildEnvSnippet(siteKey: string, secretKey: string | null, apiBase: string) {
  return [
    `# Public — safe in frontend`,
    `GATE_SITE_KEY=${siteKey}`,
    `GATE_API_BASE=${apiBase}`,
    ``,
    `# Secret — server only, never in the browser`,
    secretKey
      ? `GATE_SECRET_KEY=${secretKey}`
      : `# GATE_SECRET_KEY=sk_live_…  (shown once when you create the site; rotate if lost)`,
    `APP_ORIGIN=https://yoursite.com`,
  ].join('\n')
}

export default function AgentAuth() {
  const [tab, setTab] = useState<TabId>('setup')
  const [loaded, setLoaded] = useState(false)
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [sites, setSites] = useState<GateSite[]>([])
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freshSecret, setFreshSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [siteName, setSiteName] = useState('My website')
  const [websiteUrl, setWebsiteUrl] = useState('https://')
  const [editOrigins, setEditOrigins] = useState('')
  const [actionName, setActionName] = useState('checkout.submit')

  const [agents, setAgents] = useState<GateAgentRow[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('my-agent')
  const [agentPub, setAgentPub] = useState('')

  const apiBase = useMemo(() => {
    const base = gateApiBase()
    if (base.startsWith('http')) return base.replace(/\/$/, '')
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`.replace(/\/$/, '')
    }
    return 'https://api.zexvro.in/gate'
  }, [gateStatus])

  const selected = sites.find((s) => s.siteId === selectedId) || sites[0] || null
  const isFirstTime = loaded && sites.length === 0 && !sitesError
  const serviceOnline = Boolean(gateStatus)

  const steps = useMemo(() => {
    const hasSite = Boolean(selected)
    const hasOrigins = Boolean(selected && selected.allowedOrigins.length > 0)
    const hasSecretOnce = Boolean(freshSecret) || hasSite
    return [
      {
        id: 'create',
        title: 'Register your website',
        done: hasSite,
        hint: 'Name + domain where Gate will run',
      },
      {
        id: 'keys',
        title: 'Save your keys',
        done: hasSecretOnce && hasSite,
        hint: 'Public site key + server secret',
      },
      {
        id: 'install',
        title: 'Add code to your site',
        done: hasSite && hasOrigins,
        hint: 'Frontend captcha + backend check',
      },
      {
        id: 'test',
        title: 'Test the captcha',
        done: false,
        hint: 'Confirm it works before going live',
      },
    ]
  }, [selected, freshSecret])

  const refresh = useCallback(async () => {
    try {
      const status = await fetchGateStatus()
      setGateStatus(status)
      setGateError(null)
    } catch (err: unknown) {
      setGateStatus(null)
      setGateError(err instanceof Error ? err.message : 'Protection service unreachable')
    }
    try {
      const auth = await getAuthHeader()
      const list = await listGateSites(auth)
      // Hide leftover demo tenants from product UI
      const productSites = list.filter((s) => !s.siteKey.startsWith('zk_test_'))
      setSites(productSites)
      setSitesError(null)
      if (productSites.length && !selectedId) {
        setSelectedId(productSites[0]!.siteId)
        setTab('website')
      } else if (productSites.length === 0) {
        setTab('setup')
      }
    } catch (err: unknown) {
      setSites([])
      setSitesError(
        err instanceof Error
          ? err.message
          : 'Could not load websites. Make sure you are signed in.',
      )
    } finally {
      setLoaded(true)
    }
  }, [selectedId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (selected) setEditOrigins(selected.allowedOrigins.join('\n'))
  }, [selected?.siteId])

  useEffect(() => {
    if (!selected?.siteKey || tab !== 'advanced') return
    let cancelled = false
    ;(async () => {
      try {
        const auth = await getAuthHeader()
        const list = await fetchGateAgents(selected.siteKey, auth)
        if (!cancelled) {
          setAgents(list)
          setAgentsError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setAgents([])
          setAgentsError(err instanceof Error ? err.message : 'Could not load agents')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected?.siteKey, tab])

  const onCreateSite = async () => {
    setBusy(true)
    setFreshSecret(null)
    setSitesError(null)
    try {
      const auth = await getAuthHeader()
      const origin = normalizeOriginInput(websiteUrl)
      if (!origin || origin === 'https://') {
        setSitesError('Enter your website address, e.g. https://shop.example.com')
        setBusy(false)
        return
      }
      // Always allow console for in-dashboard testing
      const origins = Array.from(
        new Set([origin, typeof window !== 'undefined' ? window.location.origin : ''].filter(Boolean)),
      )
      const created = await createGateSite(
        {
          name: siteName.trim() || 'My website',
          allowedOrigins: origins,
        },
        auth,
      )
      setFreshSecret(created.secretKey || null)
      setSelectedId(created.siteId)
      setTab('website')
      await refresh()
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'Could not create website')
    } finally {
      setBusy(false)
    }
  }

  const onSaveOrigins = async () => {
    if (!selected) return
    setBusy(true)
    setSitesError(null)
    try {
      const auth = await getAuthHeader()
      const origins = editOrigins
        .split(/[\n,]+/)
        .map((s) => normalizeOriginInput(s))
        .filter(Boolean)
      if (!origins.length) {
        setSitesError('Add at least one website domain (e.g. https://yoursite.com)')
        setBusy(false)
        return
      }
      await updateGateSite(selected.siteId, { allowedOrigins: origins, name: selected.name }, auth)
      await refresh()
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'Could not save domains')
    } finally {
      setBusy(false)
    }
  }

  const onRotate = async () => {
    if (!selected) return
    if (!window.confirm('Create a new secret key? Your old secret stops working immediately.')) return
    setBusy(true)
    try {
      const auth = await getAuthHeader()
      const rotated = await rotateGateSiteSecret(selected.siteId, auth)
      setFreshSecret(rotated.secretKey)
      setTab('website')
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'Could not rotate secret')
    } finally {
      setBusy(false)
    }
  }

  const onRegisterAgent = async () => {
    if (!selected) return
    if (agentPub.trim().length < 8) {
      setAgentsError('Paste a valid agent public key')
      return
    }
    setBusy(true)
    try {
      const auth = await getAuthHeader()
      await registerGateAgent({
        siteKey: selected.siteKey,
        publicKey: agentPub.trim(),
        name: agentName.trim() || 'agent',
        authHeader: auth,
      })
      setAgentPub('')
      const list = await fetchGateAgents(selected.siteKey, auth)
      setAgents(list)
      setAgentsError(null)
    } catch (err: unknown) {
      setAgentsError(err instanceof Error ? err.message : 'Could not register agent')
    } finally {
      setBusy(false)
    }
  }

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }

  const tabs = useMemo(() => {
    const base: Array<{ id: TabId; label: string; icon: typeof ShieldCheck }> = [
      { id: 'setup', label: 'Get started', icon: ShieldCheck },
      { id: 'website', label: 'My website', icon: Globe },
      { id: 'install', label: 'Install', icon: Code2 },
      { id: 'test', label: 'Test', icon: Play },
      { id: 'advanced', label: 'Advanced', icon: Settings2 },
    ]
    return base
  }, [])

  const browserSnippet = selected
    ? buildBrowserSnippet(apiBase, selected.siteKey, actionName.trim() || 'checkout.submit')
    : ''
  const serverSnippet = selected
    ? buildServerSnippet(apiBase, actionName.trim() || 'checkout.submit')
    : ''
  const envSnippet = selected
    ? buildEnvSnippet(selected.siteKey, freshSecret, apiBase)
    : ''

  if (!loaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-zinc-500">
        Loading Agent Auth…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header — customer language */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Agent Auth
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                serviceOnline
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {serviceOnline ? 'Ready' : 'Unavailable'}
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Stop bots and scripts from abusing sensitive actions on your website—checkouts, signups,
            deletes, and more. Humans pass a quick check; your server verifies a short-lived pass.
          </p>
        </div>
      </div>

      {gateError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Protection service is offline</div>
            <div className="mt-0.5 text-xs opacity-90">{gateError}</div>
          </div>
        </div>
      )}

      {sitesError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {sitesError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          const disabled = t.id !== 'setup' && !selected && t.id !== 'advanced'
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled && t.id !== 'setup'}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
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

      {/* ——— GET STARTED ——— */}
      {tab === 'setup' && (
        <div className="space-y-6">
          {isFirstTime ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
              <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Protect your website in a few minutes
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  No security jargon required. You will get two keys, drop a small script on your site,
                  and check the pass on your server.
                </p>
              </div>

              <div className="grid gap-0 md:grid-cols-3">
                {[
                  {
                    step: '1',
                    title: 'Your domain',
                    body: 'Tell us which website should be protected (e.g. https://shop.com).',
                    icon: Globe,
                  },
                  {
                    step: '2',
                    title: 'Your keys',
                    body: 'Public key goes in the browser. Secret key stays on your server only.',
                    icon: KeyRound,
                  },
                  {
                    step: '3',
                    title: 'Install & test',
                    body: 'Copy the snippets, then try the captcha here before going live.',
                    icon: Play,
                  },
                ].map((c) => (
                  <div
                    key={c.step}
                    className="border-t border-zinc-100 p-5 md:border-t-0 md:border-l md:first:border-l-0 dark:border-zinc-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900">
                      {c.step}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                      <c.icon className="h-4 w-4 text-zinc-400" />
                      {c.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{c.body}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4 border-t border-zinc-100 px-6 py-5 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Register your website
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-zinc-500">
                    Display name
                    <input
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Acme Shop"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-500">
                    Website address
                    <input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yoursite.com"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    />
                    <span className="mt-1 block text-[11px] font-normal text-zinc-400">
                      Use the full origin (https://…), no path. You can add more domains later.
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || !serviceOnline}
                  onClick={() => void onCreateSite()}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  <Plus className="h-4 w-4" />
                  {busy ? 'Creating…' : 'Create website protection'}
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Setup checklist</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {selected
                    ? `Active website: ${selected.name}`
                    : 'Pick or create a website to continue.'}
                </p>
                <ul className="mt-4 space-y-3">
                  {steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-3">
                      {s.done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                      )}
                      <div>
                        <div
                          className={`text-sm font-medium ${s.done ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}
                        >
                          {s.title}
                        </div>
                        <div className="text-xs text-zinc-400">{s.hint}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab('website')}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
                  >
                    Manage website
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('install')}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                  >
                    Install code
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('test')}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                  >
                    Test captcha
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: 'What visitors see',
                    body: 'A short challenge (captcha) before sensitive actions—not a full login page.',
                  },
                  {
                    title: 'What your server checks',
                    body: 'A short-lived pass (capability) proving the challenge was completed.',
                  },
                  {
                    title: 'Honest limits',
                    body: 'Stops casual bots and scripts. Not a guarantee against paid captcha farms.',
                  },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
                  >
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">{c.title}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ——— MY WEBSITE ——— */}
      {tab === 'website' && (
        <div className="space-y-5">
          {freshSecret && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Copy your secret key now
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
                    We only show this once. Put it in your server environment—never in frontend code or
                    public repos.
                  </p>
                  <code className="mt-2 block break-all rounded-lg bg-black/5 px-3 py-2 font-mono text-[11px] dark:bg-black/30">
                    {freshSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText('secret', freshSecret)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 underline dark:text-amber-100"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === 'secret' ? 'Copied' : 'Copy secret key'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Your websites
              </div>
              {sites.map((s) => (
                <button
                  key={s.siteId}
                  type="button"
                  onClick={() => setSelectedId(s.siteId)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                    selected?.siteId === s.siteId
                      ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                  }`}
                >
                  <div className="font-semibold text-zinc-900 dark:text-white">{s.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-zinc-400">
                    {s.allowedOrigins[0] || 'No domain yet'}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setTab('setup')
                  setWebsiteUrl('https://')
                  setSiteName('My website')
                }}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" /> Add website
              </button>
            </div>

            {selected ? (
              <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{selected.name}</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">Keys and allowed domains for this site</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Site key (public)
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText('siteKey', selected.siteKey)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                      >
                        <Copy className="h-3 w-3" />
                        {copied === 'siteKey' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <code className="mt-2 block break-all font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
                      {selected.siteKey}
                    </code>
                    <p className="mt-2 text-[11px] text-zinc-400">Safe to use in your frontend.</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Secret key (server)
                      </span>
                      <button
                        type="button"
                        onClick={() => void onRotate()}
                        className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                      >
                        Rotate
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                      Only shown when you create or rotate. Used by your backend to verify visitors
                      completed the check.
                    </p>
                  </div>
                </div>

                <label className="block text-xs font-medium text-zinc-500">
                  Allowed domains
                  <span className="mt-0.5 block font-normal text-zinc-400">
                    Exact origins only—one per line. Example: https://shop.com
                  </span>
                  <textarea
                    value={editOrigins}
                    onChange={(e) => setEditOrigins(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSaveOrigins()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  {busy ? 'Saving…' : 'Save domains'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-10 text-sm text-zinc-500 dark:border-zinc-800">
                Create a website under Get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ——— INSTALL ——— */}
      {tab === 'install' && selected && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                <Code2 className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Install on {selected.name}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Two pieces: a small browser script for visitors, and a server check before you accept
                  the action.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-xs font-medium text-zinc-500">
              Action name (what you are protecting)
              <input
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
                placeholder="checkout.submit"
                className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
              <span className="mt-1 block text-[11px] font-normal text-zinc-400">
                Use the same string in the browser and on your server (e.g. signup, withdraw, delete).
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Globe className="h-4 w-4 text-zinc-400" />
                1. Frontend — show the check
              </div>
              <button
                type="button"
                onClick={() => void copyText('browser', browserSnippet)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-zinc-700"
              >
                <Copy className="h-3 w-3" />
                {copied === 'browser' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {browserSnippet}
            </pre>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Server className="h-4 w-4 text-zinc-400" />
                2. Backend — verify before accepting
              </div>
              <button
                type="button"
                onClick={() => void copyText('server', serverSnippet)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-zinc-700"
              >
                <Copy className="h-3 w-3" />
                {copied === 'server' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {serverSnippet}
            </pre>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <KeyRound className="h-4 w-4 text-zinc-400" />
                3. Environment variables
              </div>
              <button
                type="button"
                onClick={() => void copyText('env', envSnippet)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-zinc-700"
              >
                <Copy className="h-3 w-3" />
                {copied === 'env' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {envSnippet}
            </pre>
          </div>

          <a
            href="https://api.zexvro.in/gate/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Service status <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {tab === 'install' && !selected && (
        <EmptyNeedSite onSetup={() => setTab('setup')} />
      )}

      {/* ——— TEST ——— */}
      {tab === 'test' && selected && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Try it yourself</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Runs a real human check against <strong className="font-medium text-zinc-700 dark:text-zinc-300">{selected.name}</strong>.
              This console address must be listed under allowed domains (we add it automatically when
              you create a site from here).
            </p>
            <div className="mt-4">
              <GateProtect
                apiBase={apiBase}
                siteKey={selected.siteKey}
                action={actionName.trim() || 'checkout.submit'}
                label="Run verification"
              />
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            <strong className="text-zinc-700 dark:text-zinc-300">Tip:</strong> If verification fails with
            “origin not allowed”, open <em>My website</em> and add{' '}
            <code className="font-mono text-[11px]">{typeof window !== 'undefined' ? window.location.origin : 'this origin'}</code>{' '}
            to allowed domains.
          </div>
        </div>
      )}

      {tab === 'test' && !selected && <EmptyNeedSite onSetup={() => setTab('setup')} />}

      {/* ——— ADVANCED ——— */}
      {tab === 'advanced' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Agents (optional)
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Machine clients do not solve captchas. Register their public keys so they can prove
              identity with cryptography instead. Most websites only need the human captcha path.
            </p>
            {!selected ? (
              <p className="mt-4 text-xs text-zinc-400">Create a website first.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {agentsError && <p className="text-xs text-amber-600">{agentsError}</p>}
                <div className="flex flex-wrap gap-2">
                  <input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Name"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <input
                    value={agentPub}
                    onChange={(e) => setAgentPub(e.target.value)}
                    placeholder="Public key"
                    className="min-w-[220px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRegisterAgent()}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
                  >
                    Register agent
                  </button>
                </div>
                <ul className="space-y-2">
                  {agents.map((a) => (
                    <li
                      key={a.agentId}
                      className="rounded-lg border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
                    >
                      <div className="font-semibold text-zinc-900 dark:text-white">{a.name}</div>
                      <div className="mt-0.5 break-all font-mono text-[10px] text-zinc-400">
                        {a.publicKey}
                      </div>
                    </li>
                  ))}
                  {agents.length === 0 && (
                    <li className="text-xs text-zinc-400">No agents registered yet.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="font-semibold text-zinc-700 dark:text-zinc-300">Technical details</div>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>API base: {apiBase}</li>
              <li>Pass header: X-Zexvro-Capability</li>
              <li>Captcha is mid-level friction—not farm-proof</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyNeedSite({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-zinc-200 p-8 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">Register a website first so we know which domain to protect.</p>
      <button
        type="button"
        onClick={onSetup}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
      >
        Get started
      </button>
    </div>
  )
}
