import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createGateSite,
  fetchGateAgents,
  fetchGateStatus,
  gateApiBase,
  gateSdkUrl,
  listGateSites,
  registerGateAgent,
  rotateGateSiteSecret,
  updateGateSite,
  type GateAgentRow,
  type GateSite,
  type GateStatus,
} from '../../services/agent-auth/agentAuthApi'
import { ensureValidAccessToken, readStoredSession } from '../../auth/cognito'
import { KeyRound, ShieldCheck, Bot, UserRound, ScrollText, Copy, Plus, Globe } from 'lucide-react'
import GateProtect from '../gate/GateProtect'

type TabId = 'overview' | 'sites' | 'captcha' | 'integrate' | 'agents'

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

function buildIntegrateSnippet(apiBase: string, siteKey: string) {
  return `<!-- ZEXVRO Gate — human captcha -->
<script type="module">
  import { protectWithCaptcha, CAPABILITY_HEADER } from '${apiBase}/v1/sdk/captcha.js'

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
    body: JSON.stringify({ /* your payload */ }),
  })
</script>

// Server (Node) — never put secretKey in the browser
const verify = await fetch('${apiBase}/v1/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    capability: req.headers['x-zexvro-capability'],
    siteSecret: process.env.GATE_SECRET_KEY,
    action: 'checkout.submit',
    minClass: 'human',
    expectedOrigin: process.env.APP_ORIGIN,
  }),
})
`
}

export default function AgentAuth() {
  const [tab, setTab] = useState<TabId>('overview')
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [sites, setSites] = useState<GateSite[]>([])
  const [sitesError, setSitesError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freshSecret, setFreshSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newName, setNewName] = useState('My website')
  const [newOrigins, setNewOrigins] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com',
  )
  const [editOrigins, setEditOrigins] = useState('')
  const [copied, setCopied] = useState(false)

  const [agents, setAgents] = useState<GateAgentRow[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('partner-agent')
  const [agentPub, setAgentPub] = useState('')

  const apiBase = useMemo(() => {
    const base = gateApiBase()
    if (base.startsWith('http')) return base
    if (typeof window !== 'undefined') return `${window.location.origin}${base}`
    return 'https://api.zexvro.in/gate'
  }, [gateStatus])

  const selected = sites.find((s) => s.siteId === selectedId) || sites[0] || null

  const refresh = useCallback(async () => {
    try {
      const status = await fetchGateStatus()
      setGateStatus(status)
      setGateError(null)
    } catch (err: unknown) {
      setGateStatus(null)
      setGateError(err instanceof Error ? err.message : 'Gate API unreachable')
    }
    try {
      const auth = await getAuthHeader()
      const list = await listGateSites(auth)
      setSites(list)
      setSitesError(null)
      if (list.length && !selectedId) setSelectedId(list[0]!.siteId)
    } catch (err: unknown) {
      setSites([])
      setSitesError(err instanceof Error ? err.message : 'Could not list sites (sign in required)')
    }
  }, [selectedId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (selected) setEditOrigins(selected.allowedOrigins.join('\n'))
  }, [selected?.siteId])

  useEffect(() => {
    if (!selected?.siteKey) return
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
          setAgentsError(err instanceof Error ? err.message : 'agents unavailable')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected?.siteKey])

  const onCreateSite = async () => {
    setBusy(true)
    setFreshSecret(null)
    try {
      const auth = await getAuthHeader()
      const origins = newOrigins
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const created = await createGateSite({ name: newName.trim() || 'My website', allowedOrigins: origins }, auth)
      setFreshSecret(created.secretKey || null)
      setSelectedId(created.siteId)
      await refresh()
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'create failed')
    } finally {
      setBusy(false)
    }
  }

  const onSaveOrigins = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const auth = await getAuthHeader()
      const origins = editOrigins
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      await updateGateSite(selected.siteId, { allowedOrigins: origins }, auth)
      setFreshSecret(null)
      await refresh()
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'update failed')
    } finally {
      setBusy(false)
    }
  }

  const onRotate = async () => {
    if (!selected) return
    if (!window.confirm('Rotate secret? The old secret stops working immediately.')) return
    setBusy(true)
    try {
      const auth = await getAuthHeader()
      const rotated = await rotateGateSiteSecret(selected.siteId, auth)
      setFreshSecret(rotated.secretKey)
    } catch (err: unknown) {
      setSitesError(err instanceof Error ? err.message : 'rotate failed')
    } finally {
      setBusy(false)
    }
  }

  const onRegisterAgent = async () => {
    if (!selected) return
    if (agentPub.trim().length < 8) {
      setAgentsError('publicKey must be Ed25519 base64url (or G… key)')
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
      setAgentsError(err instanceof Error ? err.message : 'register failed')
    } finally {
      setBusy(false)
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'overview' as const, label: 'Overview', icon: ShieldCheck },
        { id: 'sites' as const, label: 'Sites', icon: Globe },
        { id: 'integrate' as const, label: 'Integrate', icon: KeyRound },
        { id: 'captcha' as const, label: 'Try captcha', icon: UserRound },
        { id: 'agents' as const, label: 'Agents', icon: Bot },
      ] as const,
    [],
  )

  const integrateSnippet = selected
    ? buildIntegrateSnippet(apiBase.replace(/\/$/, ''), selected.siteKey)
    : ''

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">ZEXVRO Gate</h1>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Live · dual-channel
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Protect any website action: humans solve captcha, agents use keys. Create a site key,
          allowlist origins, embed the SDK, verify on your server.
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">
          API: {apiBase} · SDK: {gateSdkUrl()}
        </p>
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
              value: gateStatus ? 'online' : gateError ? 'offline' : '…',
              hint: gateStatus
                ? `${gateStatus.issuer} · ${sites.length} site(s)`
                : gateError || 'Connecting…',
            },
            {
              label: 'Channels',
              value: 'human + agent',
              hint: 'Captcha for humans · Ed25519 + PoP for agents',
            },
            {
              label: 'Security',
              value: gateStatus?.securityProfile?.isProd ? 'production' : 'dev profile',
              hint: 'Demo routes off in prod · captcha = mid friction',
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {c.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{c.value}</div>
              <div className="mt-1 text-xs text-zinc-500 break-all">{c.hint}</div>
            </div>
          ))}
          <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <strong>Stranger site path:</strong> Sites → create site + origins → Integrate snippet on
            their frontend → verify with <code className="font-mono">secretKey</code> on their backend.
            Full guide: <code className="font-mono">docs/gate_integrator.md</code>
          </div>
        </div>
      )}

      {tab === 'sites' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Create site</h2>
            {sitesError && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {sitesError}
              </p>
            )}
            <label className="block text-xs text-zinc-500">
              Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Allowed origins (one per line)
              <textarea
                value={newOrigins}
                onChange={(e) => setNewOrigins(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreateSite()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" /> Create site
            </button>
            {freshSecret && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <div className="font-semibold text-amber-800 dark:text-amber-200">
                  Secret (copy now — not shown again)
                </div>
                <code className="mt-1 block break-all font-mono text-[11px]">{freshSecret}</code>
                <button
                  type="button"
                  className="mt-2 text-[11px] font-semibold underline"
                  onClick={() => void copyText(freshSecret)}
                >
                  {copied ? 'Copied' : 'Copy secret'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Your sites</h2>
            {sites.length === 0 ? (
              <p className="text-xs text-zinc-500">No sites yet. Create one to integrate a partner site.</p>
            ) : (
              <ul className="space-y-2">
                {sites.map((s) => (
                  <li key={s.siteId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.siteId)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                        selected?.siteId === s.siteId
                          ? 'border-zinc-900 dark:border-white'
                          : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="font-semibold text-zinc-900 dark:text-white">{s.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{s.siteKey}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selected && (
              <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="text-xs">
                  <span className="text-zinc-500">siteKey</span>
                  <div className="font-mono text-[11px] break-all">{selected.siteKey}</div>
                </div>
                <label className="block text-xs text-zinc-500">
                  Allowed origins
                  <textarea
                    value={editOrigins}
                    onChange={(e) => setEditOrigins(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onSaveOrigins()}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
                  >
                    Save origins
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRotate()}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
                  >
                    Rotate secret
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(selected.siteKey)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
                  >
                    <Copy className="h-3 w-3" /> Copy siteKey
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'integrate' && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          {!selected ? (
            <p className="text-sm text-zinc-500">Create a site first.</p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Drop this on any site origin in the allowlist. Server must hold{' '}
                <code className="font-mono text-xs">secretKey</code>.
              </p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-100">
                {integrateSnippet}
              </pre>
              <button
                type="button"
                onClick={() => void copyText(integrateSnippet)}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy integrate snippet'}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'captcha' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          {selected ? (
            <GateProtect
              apiBase={apiBase}
              siteKey={selected.siteKey}
              action="checkout.submit"
            />
          ) : (
            <p className="text-sm text-zinc-500">Create a site whose allowlist includes this console origin, then try captcha here.</p>
          )}
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          {!selected ? (
            <p className="text-sm text-zinc-500">Create a site first.</p>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                Agents never use captcha. Register Ed25519 public keys for this siteKey.
              </p>
              {agentsError && <p className="text-xs text-amber-600">{agentsError}</p>}
              <div className="flex flex-wrap gap-2">
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="name"
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  value={agentPub}
                  onChange={(e) => setAgentPub(e.target.value)}
                  placeholder="publicKey (base64url)"
                  className="min-w-[240px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRegisterAgent()}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
                >
                  Register
                </button>
              </div>
              <ul className="space-y-2 text-xs">
                {agents.map((a) => (
                  <li
                    key={a.agentId}
                    className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                  >
                    <div className="font-semibold">{a.name}</div>
                    <div className="font-mono text-[10px] text-zinc-500 break-all">{a.publicKey}</div>
                  </li>
                ))}
                {agents.length === 0 && <li className="text-zinc-500">No agents registered.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
