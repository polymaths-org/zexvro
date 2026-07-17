import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ApiNftCollection } from './nftApi';
import { deleteNftCollection } from './nftApi';

type CollectionCreatedModalProps = {
  collection: ApiNftCollection;
  accessToken: string;
  unitPriceXlm?: string;
  saleWarning?: string;
  onGoDashboard: () => void;
  onClose: () => void;
  onManage: (section: 'sale' | 'mint' | 'ledger' | 'integrate') => void;
  onDeleted: () => void;
};

function short(value?: string) {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export default function CollectionCreatedModal({
  collection,
  accessToken,
  unitPriceXlm,
  saleWarning,
  onGoDashboard,
  onClose,
  onManage,
  onDeleted,
}: CollectionCreatedModalProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/nft/collections/${collection.id}`;
    return `${window.location.origin}/nft/collections/${collection.id}`;
  }, [collection.id]);

  const salePrice =
    unitPriceXlm
    || (collection.primarySale
      ? `${(Number(collection.primarySale.priceAtomic) / 10_000_000).toString()} XLM`
      : 'Not set');

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      collection.status === 'live'
        ? `Delete the API record for “${collection.name}”? Live Stellar contracts cannot be destroyed from the dashboard.`
        : `Delete “${collection.name}” from this workspace?`,
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await deleteNftCollection(collection.id, accessToken);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0B0B0C]"
        role="dialog"
        aria-labelledby="nft-created-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-zinc-100 px-5 pb-4 pt-5 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            {collection.coverImageUri ? (
              <img
                src={collection.coverImageUri}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-7 w-7" />
              </span>
            )}
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                NFT created
              </p>
              <h2 id="nft-created-title" className="mt-0.5 truncate text-lg font-semibold text-zinc-950 dark:text-white">
                {collection.name}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {collection.symbol} · {collection.status}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          {saleWarning ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {saleWarning}
            </div>
          ) : null}

          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-zinc-500">Unit price</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {typeof salePrice === 'string' && salePrice.includes('XLM') ? salePrice : `${salePrice} XLM`}
              </dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-zinc-500">Contract</dt>
              <dd className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{short(collection.contractId)}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-zinc-500">Deploy tx</dt>
              <dd className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{short(collection.deploymentTxHash)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-zinc-500">Public page</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{publicUrl.replace(/^https?:\/\//, '')}</span>
                <button type="button" onClick={() => void copy('link', publicUrl)} className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-white" title="Copy">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-white" title="Open">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </dd>
            </div>
          </dl>
          {copied ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Copied {copied}.</p> : null}
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="space-y-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onGoDashboard}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            More options
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Close
          </button>

          {moreOpen ? (
            <div className="mt-1 space-y-1 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Manage</p>
              {[
                { id: 'sale' as const, label: 'Primary sale & pricing', icon: ShoppingCart },
                { id: 'mint' as const, label: 'Mint / inventory', icon: Sparkles },
                { id: 'ledger' as const, label: 'Ledger & analytics', icon: BarChart3 },
                { id: 'integrate' as const, label: 'SDK / game integrate', icon: Code2 },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onManage(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <item.icon className="h-3.5 w-3.5 text-zinc-400" />
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onManage('sale')}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <Archive className="h-3.5 w-3.5 text-zinc-400" />
                Archive / settings
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete collection record
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
