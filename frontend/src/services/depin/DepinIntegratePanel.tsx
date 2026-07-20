import { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileJson,
  Server,
  Shield,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { copyText } from '../../lib/clipboard';
import { getDepinApiBaseUrl } from './depinApi';
import {
  DEFAULT_FACILITATOR_URL,
  OZ_CHANNELS_TESTNET,
  paidDemoCommand,
  probeCurl,
  type DepinHttpMethod,
} from './depinConfig';

export type DepinIntegrateTab = 'probe' | 'pay' | 'config' | 'env';

export interface DepinIntegratePanelProps {
  route?: string;
  method?: DepinHttpMethod;
  recipient?: string;
  facilitatorUrl?: string;
  onClose?: () => void;
  modal?: boolean;
}

function CopyIconButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
    >
      {active ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const TABS: Array<{
  id: DepinIntegrateTab;
  label: string;
  hint: string;
  icon: typeof Zap;
  language: string;
}> = [
  { id: 'probe', label: 'Probe 402', hint: 'Unpaid curl', icon: Zap, language: 'bash' },
  { id: 'pay', label: 'Pay & fetch', hint: 'Buyer demo', icon: Terminal, language: 'bash' },
  { id: 'config', label: 'Config', hint: 'Provider JSON', icon: FileJson, language: 'json' },
  { id: 'env', label: 'Env', hint: 'Process vars', icon: Server, language: 'bash' },
];

const TAB_HELP: Record<DepinIntegrateTab, string> = {
  probe: 'Unpaid clients must receive HTTP 402 and a PAYMENT-REQUIRED header before any origin call.',
  pay: 'Buyer signs exact USDC auth entries; gateway verifies, calls upstream once, settles, then releases the body.',
  config: 'Boot-time provider document. There is no live create-route API — restart the gateway after edits.',
  env: 'Facilitator auth and state backend. OZ_API_KEY is required for OpenZeppelin Channels settle.',
};

function buildSnippets(input: {
  apiBase: string;
  route: string;
  method: DepinHttpMethod;
  recipient: string;
  facilitatorUrl: string;
}) {
  const { apiBase, route, method, recipient, facilitatorUrl } = input;
  const probe = [
    '# Unpaid probe — expect 402 + PAYMENT-REQUIRED',
    probeCurl(apiBase, route, method),
    '',
    '# Decode challenge (Linux/macOS)',
    `curl -si '${apiBase.replace(/\/$/, '')}${route}' | awk '/^PAYMENT-REQUIRED:/ {print $2}' | base64 -d | jq .`,
  ].join('\n');

  const pay = [
    '# Paid settle smoke (Stellar testnet buyer)',
    '# 1) Prefer OpenZeppelin Channels facilitator + OZ_API_KEY for real settle',
    `# 2) Fund buyer with testnet USDC; payTo must be G-address: ${recipient || 'G...'}`,
    '',
    paidDemoCommand(apiBase, recipient),
    '',
    '# Manual flow for agents/SDKs:',
    '# GET route → parse PAYMENT-REQUIRED → sign exact USDC → retry with PAYMENT-SIGNATURE',
  ].join('\n');

  const config = JSON.stringify(
    {
      route,
      method,
      upstreamUrl: 'https://your-origin.example/resource',
      description: 'Protected resource behind Access Shield',
      price: '$0.001',
      recipient: recipient || 'G...PROVIDER_WITH_USDC_TRUSTLINE',
      network: 'stellar:testnet',
      timeoutMs: 5000,
    },
    null,
    2,
  );

  const env = [
    `VITE_DEPIN_API_URL=${apiBase}`,
    'DEPIN_CONFIG_PATH=services/depin/depin.config.json',
    '# or DEPIN_CONFIG_JSON / Secrets Manager zexvro/depin/config-json',
    `FACILITATOR_IN_CONFIG=${facilitatorUrl || DEFAULT_FACILITATOR_URL}`,
    `# Paid settle (OZ Channels): facilitatorUrl=${OZ_CHANNELS_TESTNET}`,
    'OZ_API_KEY=oz_...   # from channels.openzeppelin.com/testnet/gen',
    'DEPIN_STATE_BACKEND=file',
    'DEPIN_STATE_PATH=.data/depin-state.json',
    'CORS_ALLOWED_ORIGINS=http://localhost:3000,https://console.zexvro.in',
  ].join('\n');

  return { probe, pay, config, env, apiBase };
}

export default function DepinIntegratePanel({
  route = '/v1/weather',
  method = 'GET',
  recipient = '',
  facilitatorUrl = DEFAULT_FACILITATOR_URL,
  onClose,
  modal,
}: DepinIntegratePanelProps) {
  const [tab, setTab] = useState<DepinIntegrateTab>('probe');
  const [copied, setCopied] = useState('');
  const apiBase = getDepinApiBaseUrl();

  const snippets = useMemo(
    () => buildSnippets({ apiBase, route, method, recipient, facilitatorUrl }),
    [apiBase, route, method, recipient, facilitatorUrl],
  );

  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];
  const activeCode = snippets[tab];

  const copy = async (label: string, value: string) => {
    const ok = await copyText(value);
    setCopied(ok ? label : 'failed');
    window.setTimeout(() => setCopied((current) => (current === label || current === 'failed' ? '' : current)), 1800);
  };

  const body = (
    <section
      role="dialog"
      aria-modal={modal ?? Boolean(onClose)}
      aria-labelledby="depin-integrate-title"
      className="flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
            <Code2 className="h-3.5 w-3.5 text-brand-blue" />
            Agent / client integration
          </div>
          <h2 id="depin-integrate-title" className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
            Access Shield integrate
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-500 dark:text-zinc-400">
            Copy-ready probe, pay, config, and env snippets for exact per-request USDC (x402).
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close integrate guide"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-3.5 py-2 dark:border-zinc-800">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">
              Connection values
            </p>
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="border-b border-zinc-200 p-3.5 sm:border-b-0 sm:border-r dark:border-zinc-800">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Gateway base</span>
                <CopyIconButton active={copied === 'apiBase'} label="Copy gateway base" onClick={() => void copy('apiBase', apiBase)} />
              </div>
              <input
                readOnly
                value={apiBase}
                className="w-full truncate rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-200"
              />
            </div>
            <div className="p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Example route</span>
                <CopyIconButton active={copied === 'route'} label="Copy route" onClick={() => void copy('route', `${method} ${route}`)} />
              </div>
              <input
                readOnly
                value={`${method} ${route}`}
                className="w-full truncate rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-200"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-3.5 py-2.5 dark:border-zinc-800">
            <a
              href="/docs"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <BookOpen className="h-3 w-3" />
              Docs
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <Shield className="h-3 w-3" />
              exact · stellar:testnet
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-4">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition ${
                  active
                    ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
                <span className={`text-[10px] ${active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{TAB_HELP[tab]}</p>

        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
              {activeTab.language}
            </span>
            <button
              type="button"
              onClick={() => void copy('code', activeCode)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-200"
            >
              {copied === 'code' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              Copy code
            </button>
          </div>
          <pre className="max-h-[min(38vh,320px)] overflow-auto bg-[#0B0B0C] p-3 font-mono text-[11.5px] leading-relaxed text-zinc-200">
            {activeCode}
          </pre>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">Before go-live</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <li>• Gateway Connected and Scheme exact on the dashboard readiness strip</li>
            <li>• Unpaid Probe 402 returns PAYMENT-REQUIRED (never origin body)</li>
            <li>• Recipient is a G-address with testnet USDC trustline (not C-contract)</li>
            <li>• Paid settle: OpenZeppelin Channels facilitator + OZ_API_KEY when using Channels</li>
            <li>• Prefer DEPIN_STATE_BACKEND=file for production single-instance</li>
          </ul>
        </div>
      </div>
    </section>
  );

  if (modal ?? Boolean(onClose)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        {body}
      </div>
    );
  }

  return body;
}
