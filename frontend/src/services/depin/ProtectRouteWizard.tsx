import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Download,
  FileJson,
  Route,
  Shield,
} from 'lucide-react';
import { copyText } from '../../lib/clipboard';
import {
  DEFAULT_FACILITATOR_URL,
  EMPTY_PROVIDER_DRAFT,
  OZ_CHANNELS_TESTNET,
  buildGatewayConfig,
  formatConfigJson,
  hostedDeployInstructions,
  loadProviderDrafts,
  localDeployInstructions,
  sanitizeProviderDraft,
  saveProviderDrafts,
  validateProviderDraft,
  type DepinHttpMethod,
  type DepinProviderDraft,
} from './depinConfig';

export interface ProtectRouteWizardProps {
  onBack: () => void;
  onSaved?: (provider: DepinProviderDraft) => void;
  existingProviders?: Array<{ route: string; method: string }>;
  initial?: Partial<DepinProviderDraft>;
}

const STEPS = [
  { id: 'route', label: 'Route' },
  { id: 'payment', label: 'Payment' },
  { id: 'export', label: 'Export' },
] as const;

function fieldClass() {
  return 'mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-100 dark:focus:border-zinc-600';
}

function labelClass() {
  return 'text-xs font-medium text-zinc-600 dark:text-zinc-300';
}

export default function ProtectRouteWizard({
  onBack,
  onSaved,
  existingProviders = [],
  initial,
}: ProtectRouteWizardProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DepinProviderDraft>({
    ...EMPTY_PROVIDER_DRAFT,
    ...initial,
  });
  const [facilitatorUrl, setFacilitatorUrl] = useState(DEFAULT_FACILITATOR_URL);
  const [copied, setCopied] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const errors = useMemo(() => validateProviderDraft(draft), [draft]);
  const normalizedRoute = useMemo(() => {
    const trimmed = draft.route.trim();
    if (!trimmed) return '';
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
  }, [draft.route]);
  const duplicate = existingProviders.some(
    (p) => p.method === draft.method && p.route === normalizedRoute,
  );

  const fullConfig = useMemo(() => {
    const sanitized = sanitizeProviderDraft(draft);
    const drafts = loadProviderDrafts().filter(
      (p) => !(p.method === sanitized.method && p.route === sanitized.route),
    );
    return buildGatewayConfig([...drafts, sanitized], { facilitatorUrl });
  }, [draft, facilitatorUrl]);

  const providerJson = useMemo(
    () => JSON.stringify(sanitizeProviderDraft(draft), null, 2),
    [draft],
  );
  const configJson = useMemo(() => formatConfigJson(fullConfig), [fullConfig]);

  const update = <K extends keyof DepinProviderDraft>(key: K, value: DepinProviderDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const copy = async (label: string, value: string) => {
    const ok = await copyText(value);
    setCopied(ok ? label : 'failed');
    window.setTimeout(() => setCopied((c) => (c === label || c === 'failed' ? '' : c)), 1800);
  };

  const download = () => {
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'depin.config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const persistDraft = () => {
    if (errors.length) return;
    const sanitized = sanitizeProviderDraft(draft);
    const others = loadProviderDrafts().filter(
      (p) => !(p.method === sanitized.method && p.route === sanitized.route),
    );
    saveProviderDrafts([...others, sanitized]);
    setSavedNote('Saved to browser drafts. Still must apply config to the gateway (export step).');
    onSaved?.(sanitized);
  };

  const canNext = step === 0
    ? draft.route.trim().length > 1 && draft.upstreamUrl.trim().length > 0 && draft.description.trim().length > 0
    : step === 1
      ? errors.length === 0
      : true;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-950 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to gateway
      </button>

      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Shield className="h-4 w-4 text-brand-blue" />
          Access Shield
        </div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Protect a route</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Build a provider entry for exact per-request Stellar testnet USDC. The gateway loads config at boot —
          export JSON, apply it, restart, then Probe 402. This wizard does not create a live route by itself.
        </p>
      </header>

      <nav className="grid grid-cols-3 border-b border-zinc-200 dark:border-zinc-800" aria-label="Wizard steps">
        {STEPS.map((item, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <div
              key={item.id}
              className={`border-b-2 px-2 py-3 text-center text-xs font-medium ${
                active
                  ? 'border-brand-blue text-zinc-950 dark:text-white'
                  : done
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-zinc-400'
              }`}
            >
              {index + 1}. {item.label}
            </div>
          );
        })}
      </nav>

      {step === 0 && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <span className={labelClass()}>Method</span>
              <select
                value={draft.method}
                onChange={(e) => update('method', e.target.value as DepinHttpMethod)}
                className={fieldClass()}
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </label>
            <label className="block sm:col-span-1">
              <span className={labelClass()}>Route path</span>
              <input
                value={draft.route}
                onChange={(e) => update('route', e.target.value)}
                placeholder="/v1/weather"
                className={`font-mono ${fieldClass()}`}
              />
            </label>
          </div>
          <label className="block">
            <span className={labelClass()}>Upstream URL</span>
            <input
              value={draft.upstreamUrl}
              onChange={(e) => update('upstreamUrl', e.target.value)}
              placeholder="https://api.example.com/resource"
              className={`font-mono ${fieldClass()}`}
            />
            <span className="mt-1 block text-[11px] text-zinc-400">
              Gateway calls this after payment verify. Never put secrets in the URL.
            </span>
          </label>
          <label className="block">
            <span className={labelClass()}>Description</span>
            <input
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={240}
              className={fieldClass()}
            />
          </label>
          <label className="block">
            <span className={labelClass()}>Timeout (ms)</span>
            <input
              type="number"
              min={100}
              max={60000}
              value={draft.timeoutMs}
              onChange={(e) => update('timeoutMs', Number(e.target.value) || 5000)}
              className={fieldClass()}
            />
          </label>
          <label className="block">
            <span className={labelClass()}>Upstream secret env name (optional)</span>
            <input
              value={draft.upstreamSecretRef || ''}
              onChange={(e) => update('upstreamSecretRef', e.target.value.toUpperCase() || undefined)}
              placeholder="UPSTREAM_API_TOKEN"
              className={`font-mono ${fieldClass()}`}
            />
            <span className="mt-1 block text-[11px] text-zinc-400">
              Name only — set the real value in process env. Injected as Authorization: Bearer.
            </span>
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <label className="block">
            <span className={labelClass()}>Price (USD display)</span>
            <input
              value={draft.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="$0.001"
              className={fieldClass()}
            />
          </label>
          <label className="block">
            <span className={labelClass()}>Recipient (Stellar G-address)</span>
            <input
              value={draft.recipient}
              onChange={(e) => update('recipient', e.target.value.trim())}
              placeholder="G..."
              className={`font-mono ${fieldClass()}`}
            />
            <span className="mt-1 block text-[11px] text-zinc-400">
              Must be a classic account with USDC trustline. Do not use the USDC SAC C-address.
            </span>
          </label>
          <label className="block">
            <span className={labelClass()}>Facilitator URL (full config)</span>
            <select
              value={facilitatorUrl}
              onChange={(e) => setFacilitatorUrl(e.target.value)}
              className={fieldClass()}
            >
              <option value={DEFAULT_FACILITATOR_URL}>x402.org (unpaid probes OK)</option>
              <option value={OZ_CHANNELS_TESTNET}>OpenZeppelin Channels testnet (paid settle)</option>
            </select>
          </label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            Network is fixed to <code className="text-[11px]">stellar:testnet</code> for this MVP.
            Paid settle with Channels also needs <code className="text-[11px]">OZ_API_KEY</code> in the gateway env.
          </div>
          {errors.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200" role="alert">
              {errors.map((error) => (
                <p key={error} className="flex items-start gap-1.5">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              ))}
            </div>
          )}
          {duplicate && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              This method+route already appears on the live gateway. Export still works if you are replacing config.
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
            <p className="font-medium">Config ready — apply offline, then refresh</p>
            <p className="mt-1 text-xs leading-5 opacity-90">
              The dashboard will only show this route after the gateway restarts with the new JSON.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <FileJson className="h-3.5 w-3.5" />
                Provider object
              </span>
              <button
                type="button"
                onClick={() => void copy('provider', providerJson)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium dark:border-zinc-800 dark:bg-[#0A0A0B]"
              >
                {copied === 'provider' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
            </div>
            <pre className="max-h-40 overflow-auto bg-[#0B0B0C] p-3 font-mono text-[11px] text-zinc-200">{providerJson}</pre>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <Route className="h-3.5 w-3.5" />
                Full depin.config.json
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copy('config', configJson)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium dark:border-zinc-800 dark:bg-[#0A0A0B]"
                >
                  {copied === 'config' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium dark:border-zinc-800 dark:bg-[#0A0A0B]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
            <pre className="max-h-56 overflow-auto bg-[#0B0B0C] p-3 font-mono text-[11px] text-zinc-200">{configJson}</pre>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">Local</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {localDeployInstructions()}
              </pre>
              <button
                type="button"
                onClick={() => void copy('local', localDeployInstructions())}
                className="mt-2 text-xs font-medium text-brand-blue underline-offset-2 hover:underline"
              >
                Copy local steps
              </button>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">Hosted App Runner</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {hostedDeployInstructions()}
              </pre>
              <button
                type="button"
                onClick={() => void copy('hosted', hostedDeployInstructions())}
                className="mt-2 text-xs font-medium text-brand-blue underline-offset-2 hover:underline"
              >
                Copy hosted steps
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={persistDraft}
              disabled={errors.length > 0}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Save draft in browser
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            >
              Done — open gateway
            </button>
          </div>
          {savedNote && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">{savedNote}</p>
          )}
        </section>
      )}

      <footer className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-900">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext || (step === 1 && errors.length > 0)}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-950"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </footer>
    </div>
  );
}
