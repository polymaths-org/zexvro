import { useCallback, useEffect, useState } from 'react';
import {
  CircleAlert,
  CircleDollarSign,
  KeyRound,
  LoaderCircle,
  RadioTower,
  ReceiptText,
  RefreshCw,
  Route,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react';
import {
  getDepinHealth,
  getDepinStatus,
  probeDepinProvider,
  type DepinHealth,
  type DepinProbeResult,
  type DepinProvider,
  type DepinStatus,
} from '../../services/depin/depinApi';

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

export default function DepinService() {
  const [health, setHealth] = useState<DepinHealth | null>(null);
  const [status, setStatus] = useState<DepinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [probingRoute, setProbingRoute] = useState('');
  const [probeResult, setProbeResult] = useState<DepinProbeResult | null>(null);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <RadioTower className="h-4 w-4 text-brand-blue" />
            De-pin
          </div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">x402 Gateway</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Protect configured HTTP resources with exact per-request Stellar testnet USDC payments.
          </p>
        </div>
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
      </header>

      <section className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3" aria-label="De-pin gateway readiness">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <RadioTower className={`h-4 w-4 ${health ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Gateway</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{health ? 'Connected' : 'Unavailable'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ReceiptText className={`h-4 w-4 ${status ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Scheme</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{status ? status.capabilities.scheme : 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ShieldCheck className={`h-4 w-4 ${status ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Settlement</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{status ? 'Sponsored fees' : 'Unknown'}</span>
        </div>
      </section>

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

      {loading ? (
        <section className="flex min-h-56 items-center justify-center border-y border-zinc-200 dark:border-zinc-900" aria-label="Loading De-pin gateway">
          <LoaderCircle className="h-5 w-5 animate-spin text-zinc-400" />
        </section>
      ) : providers.length === 0 ? (
        <section className="border-y border-zinc-200 py-16 text-center dark:border-zinc-900 sm:py-24">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-blue dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <Route className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">No protected routes configured</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Add a local gateway config before using this project screen.
          </p>
        </section>
      ) : (
        <section className="border-y border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-2 border-b border-zinc-200 px-1 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Protected resources</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {providers.length} configured route{providers.length === 1 ? '' : 's'} on {status?.capabilities.network}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <KeyRound className="h-3.5 w-3.5" />
              Exact x402
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-3 font-medium">Route</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Recipient</th>
                  <th className="px-3 py-3 font-medium">Upstream</th>
                  <th className="px-3 py-3 font-medium">Policy</th>
                  <th className="px-3 py-3 font-medium">Test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {providers.map(provider => (
                  <tr key={`${provider.method} ${provider.route}`} className="transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-brand-blue dark:border-zinc-800 dark:bg-zinc-900/40">
                          <Route className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-mono text-xs font-semibold text-zinc-950 dark:text-white">{provider.method} {provider.route}</span>
                          <span className="mt-0.5 block max-w-80 truncate text-xs text-zinc-500 dark:text-zinc-400">{provider.description}</span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  );
}
