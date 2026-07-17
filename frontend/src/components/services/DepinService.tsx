import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CircleAlert,
  CircleDollarSign,
  Code2,
  KeyRound,
  LoaderCircle,
  Plus,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Route,
  Shield,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react';
import {
  getDepinApiBaseUrl,
  getDepinHealth,
  getDepinStatus,
  probeDepinProvider,
  type DepinHealth,
  type DepinProbeResult,
  type DepinProvider,
  type DepinStatus,
} from '../../services/depin/depinApi';
import DepinIntegratePanel from '../../services/depin/DepinIntegratePanel';
import ProtectRouteWizard from '../../services/depin/ProtectRouteWizard';
import { loadProviderDrafts, type DepinProviderDraft } from '../../services/depin/depinConfig';
import SectionSkeleton from '../ui/SectionSkeleton';

type DepinTab = 'overview' | 'routes' | 'protect' | 'integrate';

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-7)}` : value;
}

function formatDuration(ms: number) {
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} min`;
  if (ms >= 1_000) return `${Math.round(ms / 1_000)} sec`;
  return `${ms} ms`;
}

function formatAtomicUsdc(amount?: string) {
  if (!amount || !/^\d+$/.test(amount)) return amount || 'Unknown';
  const value = Number(amount) / 10_000_000;
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: 7,
  })} USDC`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'De-pin gateway unavailable';
}

function ProviderStatus({ provider }: { provider: DepinProvider }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="h-3.5 w-3.5" />
      {provider.network}
    </span>
  );
}

const HOW_IT_WORKS = [
  {
    title: 'Unpaid request',
    body: 'Client hits a protected route without payment. Gateway rate-limits unpaid probes and returns HTTP 402 with PAYMENT-REQUIRED (never the origin body).',
  },
  {
    title: 'Client pays exact USDC',
    body: 'Buyer builds an x402 exact payment on stellar:testnet for the challenge amount and payTo G-address, then retries with PAYMENT-SIGNATURE.',
  },
  {
    title: 'Verify → upstream once',
    body: 'Facilitator verifies the payment. Gateway claims a replay fingerprint, calls upstream with timeout, and buffers a successful response.',
  },
  {
    title: 'Settle then release',
    body: 'Only after settlement succeeds does the gateway release the body + PAYMENT-RESPONSE. Upstream or settle failure withholds the resource (fail closed).',
  },
];

export default function DepinService() {
  const [tab, setTab] = useState<DepinTab>('overview');
  const [health, setHealth] = useState<DepinHealth | null>(null);
  const [status, setStatus] = useState<DepinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [probingRoute, setProbingRoute] = useState('');
  const [probeResult, setProbeResult] = useState<DepinProbeResult | null>(null);
  const [integrateOpen, setIntegrateOpen] = useState(false);
  const [integrateRoute, setIntegrateRoute] = useState<DepinProvider | null>(null);
  const [drafts, setDrafts] = useState<DepinProviderDraft[]>([]);

  const loadGateway = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    const [healthResult, statusResult] = await Promise.allSettled([
      getDepinHealth(signal),
      getDepinStatus(signal),
    ]);

    if (signal?.aborted) return;
    setHealth(healthResult.status === 'fulfilled' ? healthResult.value : null);

    if (statusResult.status === 'fulfilled') {
      setStatus(statusResult.value);
    } else {
      setStatus(null);
      setError(errorMessage(statusResult.reason));
    }

    setDrafts(loadProviderDrafts());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadGateway(controller.signal);
    return () => controller.abort();
  }, [loadGateway]);

  const handleProbe = async (provider: DepinProvider) => {
    setProbingRoute(provider.route);
    setProbeResult(null);
    setError('');
    setTab('routes');

    try {
      const result = await probeDepinProvider(provider);
      setProbeResult(result);
    } catch (probeError) {
      setError(errorMessage(probeError));
    } finally {
      setProbingRoute('');
    }
  };

  const challenge = probeResult?.paymentRequired?.accepts?.[0];
  const providers = status?.providers ?? [];
  const exampleProvider = providers[0];

  const tabs = useMemo(
    () => [
      { id: 'overview' as const, label: 'Overview' },
      { id: 'routes' as const, label: 'Routes', count: providers.length },
      { id: 'protect' as const, label: 'Protect route' },
      { id: 'integrate' as const, label: 'Integrate' },
    ],
    [providers.length],
  );

  if (tab === 'protect') {
    return (
      <ProtectRouteWizard
        onBack={() => {
          setDrafts(loadProviderDrafts());
          setTab('routes');
        }}
        onSaved={() => setDrafts(loadProviderDrafts())}
        existingProviders={providers}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <RadioTower className="h-4 w-4 text-brand-blue" />
            De-pin · Access Shield
          </div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">x402 Gateway</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Protect HTTP resources with exact per-request Stellar testnet USDC. Unpaid traffic gets 402;
            paid traffic is verified, proxied once, settled, then released. Build route config here, apply at boot, then probe.
          </p>
          <p className="mt-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            API {getDepinApiBaseUrl()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/docs"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </a>
          <button
            type="button"
            onClick={() => {
              setIntegrateRoute(exampleProvider ?? null);
              setIntegrateOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Code2 className="h-4 w-4" />
            Integrate
          </button>
          <button
            type="button"
            onClick={() => setTab('protect')}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
          >
            <Plus className="h-4 w-4" />
            Protect route
          </button>
          <button
            type="button"
            aria-label="Refresh De-pin gateway"
            title="Refresh De-pin gateway"
            disabled={refreshing}
            onClick={() => void loadGateway(undefined, true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4" aria-label="De-pin gateway readiness">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <RadioTower className={`h-4 w-4 ${health ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Gateway</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{health ? 'Connected' : 'Unavailable'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ReceiptText className={`h-4 w-4 ${status ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Scheme</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{status?.capabilities?.scheme || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ShieldCheck className={`h-4 w-4 ${status?.capabilities?.settleReady !== false ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Settle</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">
            {status
              ? status.capabilities?.settleReady === false
                ? 'Needs OZ key'
                : 'Ready'
              : 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <KeyRound className={`h-4 w-4 ${status?.multiInstanceSafe ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">State</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">
            {status?.stateBackend
              ? status.multiInstanceSafe
                ? `${status.stateBackend} · multi-ok`
                : `${status.stateBackend} · single`
              : 'Unknown'}
          </span>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 p-2 dark:border-zinc-800">
          {tabs.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
              >
                {item.label}
                {item.count !== undefined ? (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/15' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-5 p-5">
          {status && status.capabilities?.settleReady === false && (
            <div className="flex items-start gap-2.5 border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300" role="status">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Facilitator requires auth for paid settle (OpenZeppelin Channels). Set{' '}
                <code className="text-xs">OZ_API_KEY</code> in root <code className="text-xs">.env</code> and restart{' '}
                <code className="text-xs">npm run dev:all</code>. Unpaid 402 probes still work.
              </span>
            </div>
          )}

          {status && status.multiInstanceSafe === false && (
            <div className="flex items-start gap-2.5 border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400" role="status">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                State backend is <code className="text-xs">{status.stateBackend || 'memory'}</code> (single-instance).
                App Runner scale-out needs a shared store; for one instance use{' '}
                <code className="text-xs">DEPIN_STATE_BACKEND=file</code>. Shared multi-ok requires{' '}
                <code className="text-xs">DEPIN_SHARED_STATE=1</code> on a shared volume.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadGateway(undefined, true)}
                className="ml-auto text-xs font-semibold underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">How Access Shield works</h2>
                <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                  Economic edge for APIs and agent tool-loops: free-capacity farming becomes uneconomic because every call has a price.
                </p>
                <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                  {HOW_IT_WORKS.map((item, index) => (
                    <li
                      key={item.title}
                      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        {index + 1}
                      </span>
                      <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.body}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <Shield className="h-5 w-5 text-brand-blue" />
                  <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">Protect</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Build a provider JSON (route, price, recipient, upstream). Apply via depin.config.json or Secrets Manager.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('protect')}
                    className="mt-3 text-xs font-semibold text-brand-blue underline-offset-2 hover:underline"
                  >
                    Open protect wizard
                  </button>
                </div>
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <Zap className="h-5 w-5 text-brand-blue" />
                  <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">Probe</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    After restart, live routes appear under Routes. Probe 402 to confirm PAYMENT-REQUIRED without spending USDC.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('routes')}
                    className="mt-3 text-xs font-semibold text-brand-blue underline-offset-2 hover:underline"
                  >
                    View routes
                  </button>
                </div>
                <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <Code2 className="h-5 w-5 text-brand-blue" />
                  <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">Integrate</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Copy curl, paid demo, config, and env snippets for agents and backends — same idea as NFT SDK integrate.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIntegrateRoute(exampleProvider ?? null);
                      setIntegrateOpen(true);
                    }}
                    className="mt-3 text-xs font-semibold text-brand-blue underline-offset-2 hover:underline"
                  >
                    Open integrate panel
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-zinc-500">Live snapshot</h3>
                <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-zinc-400">Protected routes</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{providers.length}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Config source</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {status?.configSource
                        ? `${status.configSource.type}:${status.configSource.detail}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Facilitator</dt>
                    <dd className="mt-0.5 truncate font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                      {status?.capabilities?.facilitatorUrl || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Browser drafts</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{drafts.length}</dd>
                  </div>
                </dl>
              </section>
            </div>
          )}

          {tab === 'routes' && (
            <div className="space-y-4">
              {loading ? (
                <SectionSkeleton rows={5} label="Loading De-pin gateway" />
              ) : providers.length === 0 ? (
                <section className="border-y border-zinc-200 py-16 text-center dark:border-zinc-900 sm:py-20">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-blue dark:border-zinc-800 dark:bg-[#0A0A0B]">
                    <Route className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">No protected routes on the live gateway</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {status?.configSource
                      ? `Config source is ${status.configSource.type}:${status.configSource.detail}, but it defines zero providers.`
                      : 'Build a route config, apply it to the gateway, restart, then refresh.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('protect')}
                    className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
                  >
                    Protect a route
                    <Plus className="h-4 w-4" />
                  </button>
                </section>
              ) : (
                <section>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Protected resources</h2>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {providers.length} live route{providers.length === 1 ? '' : 's'} on {status?.capabilities?.network || 'stellar:testnet'}
                        {status?.configSource ? ` · config ${status.configSource.type}:${status.configSource.detail}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab('protect')}
                      className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add route config
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-3 font-medium">Route</th>
                          <th className="px-3 py-3 font-medium">Price</th>
                          <th className="px-3 py-3 font-medium">Recipient</th>
                          <th className="px-3 py-3 font-medium">Upstream</th>
                          <th className="px-3 py-3 font-medium">Policy</th>
                          <th className="px-3 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                        {providers.map((provider) => (
                          <tr key={`${provider.method} ${provider.route}`} className="transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                            <td className="px-3 py-3.5">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-brand-blue dark:border-zinc-800 dark:bg-zinc-900/40">
                                  <Route className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block font-mono text-xs font-semibold text-zinc-950 dark:text-white">
                                    {provider.method} {provider.route}
                                  </span>
                                  <span className="mt-0.5 block max-w-80 truncate text-xs text-zinc-500 dark:text-zinc-400">
                                    {provider.description}
                                  </span>
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-zinc-600 dark:text-zinc-300">
                              <span className="inline-flex items-center gap-1.5">
                                <CircleDollarSign className="h-3.5 w-3.5 text-zinc-400" />
                                {provider.price}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                              {shortAddress(provider.recipient)}
                            </td>
                            <td className="px-3 py-3.5 text-xs text-zinc-600 dark:text-zinc-300">
                              <span className="font-mono">{provider.upstreamOrigin}</span>
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <ProviderStatus provider={provider} />
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-300">
                                  <Timer className="h-3.5 w-3.5 text-zinc-400" />
                                  {formatDuration(provider.timeoutMs)}
                                </span>
                                {provider.upstreamSecretRequired && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                                    <KeyRound className="h-3.5 w-3.5" />
                                    Secret
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={probingRoute === provider.route}
                                  onClick={() => void handleProbe(provider)}
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                                >
                                  {probingRoute === provider.route ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Zap className="h-3.5 w-3.5" />
                                  )}
                                  Probe 402
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIntegrateRoute(provider);
                                    setIntegrateOpen(true);
                                  }}
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-800"
                                >
                                  Integrate
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {drafts.length > 0 && (
                <section className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 dark:border-zinc-700">
                  <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Browser drafts (not live until applied)
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {drafts.map((d) => (
                      <li key={`${d.method} ${d.route}`} className="font-mono">
                        {d.method} {d.route} · {d.price}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {probeResult && (
                <section className="border-y border-zinc-200 py-4 dark:border-zinc-800" aria-label="De-pin probe result">
                  <div className="grid gap-px bg-zinc-200 dark:bg-zinc-800 sm:grid-cols-4">
                    <div className="bg-white px-3 py-3 text-xs dark:bg-[#050506]">
                      <span className="block text-zinc-500 dark:text-zinc-400">HTTP</span>
                      <span className="mt-1 block font-semibold text-zinc-950 dark:text-white">{probeResult.httpStatus}</span>
                    </div>
                    <div className="bg-white px-3 py-3 text-xs dark:bg-[#050506]">
                      <span className="block text-zinc-500 dark:text-zinc-400">Header</span>
                      <span className="mt-1 block font-semibold text-zinc-950 dark:text-white">
                        {probeResult.hasPaymentRequiredHeader ? 'PAYMENT-REQUIRED' : 'Missing'}
                      </span>
                    </div>
                    <div className="bg-white px-3 py-3 text-xs dark:bg-[#050506]">
                      <span className="block text-zinc-500 dark:text-zinc-400">Network</span>
                      <span className="mt-1 block font-semibold text-zinc-950 dark:text-white">{challenge?.network || 'Unknown'}</span>
                    </div>
                    <div className="bg-white px-3 py-3 text-xs dark:bg-[#050506]">
                      <span className="block text-zinc-500 dark:text-zinc-400">Payment</span>
                      <span className="mt-1 block font-semibold text-zinc-950 dark:text-white">{formatAtomicUsdc(challenge?.amount)}</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'integrate' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Same integrate surface as NFT SDK: copy-ready snippets for agents, backends, and ops.
                Open the full panel for tabs (Probe / Pay / Config / Env).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIntegrateRoute(exampleProvider ?? null);
                    setIntegrateOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
                >
                  <Code2 className="h-4 w-4" />
                  Open integrate panel
                </button>
                <a
                  href="/docs"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium dark:border-zinc-800"
                >
                  <BookOpen className="h-4 w-4" />
                  Access Shield docs
                </a>
              </div>
              <ul className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
                <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">curl unpaid probe → 402 + PAYMENT-REQUIRED</li>
                <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">demo:client paid settle smoke</li>
                <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">Provider + full depin.config.json templates</li>
                <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">OZ_API_KEY / state / CORS env checklist</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {integrateOpen && (
        <DepinIntegratePanel
          route={integrateRoute?.route}
          method={integrateRoute?.method}
          recipient={integrateRoute?.recipient}
          facilitatorUrl={status?.capabilities?.facilitatorUrl}
          onClose={() => setIntegrateOpen(false)}
        />
      )}
    </div>
  );
}
