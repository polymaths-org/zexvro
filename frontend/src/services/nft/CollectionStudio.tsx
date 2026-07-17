import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CircleAlert,
  Code2,
  Copy,
  ExternalLink,
  Image,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  archiveNftCollection,
  deleteNftCollection,
  getNftCollection,
  getNftCollectionStatus,
  getNftServiceHealth,
  listCollectionItems,
  prepareNftMint,
  prepareNftSaleConfig,
  retryNftCollectionDeployment,
  submitNftMint,
  submitNftSaleConfig,
  unarchiveNftCollection,
  type ApiNftCollection,
  type NftMintedItem,
  type NftServiceHealth,
  type PreparedNftTransaction,
} from './nftApi';
import { formatWalletError, getPublicKey, isWalletAvailable, signTransaction } from './stellarWallet';
import NftLaunchCinema from '../../components/NftLaunchCinema';
import SectionSkeleton from '../../components/ui/SectionSkeleton';
import NftSdkPanel from './NftSdkPanel';

interface CollectionStudioProps {
  workspaceId: string;
  accessToken: string;
  collectionId: string;
  onBack: () => void;
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-7)}` : value;
}

function errorMessage(error: unknown) {
  const wallet = formatWalletError(error);
  if (wallet && wallet !== 'Wallet action failed.') return wallet;
  if (error instanceof Error && error.message) return error.message;
  return 'NFT API unavailable';
}

function atomicToUsdc(value: string) {
  const atomic = BigInt(value);
  const whole = atomic / 10_000_000n;
  const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function usdcToAtomic(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,7})?$/.test(trimmed)) return undefined;
  const [whole, fraction = ''] = trimmed.split('.');
  const atomic = BigInt(whole) * 10_000_000n + BigInt((fraction + '0000000').slice(0, 7));
  return atomic > 0n ? atomic.toString() : undefined;
}

const STATUS_STYLE = {
  deploying: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  live: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  archived: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

export default function CollectionStudio({
  workspaceId,
  accessToken,
  collectionId,
  onBack,
}: CollectionStudioProps) {
  const [collection, setCollection] = useState<ApiNftCollection | null>(null);
  const [items, setItems] = useState<NftMintedItem[]>([]);
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [salePrice, setSalePrice] = useState('1');
  const [saleIntent, setSaleIntent] = useState<PreparedNftTransaction | null>(null);
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintIntent, setMintIntent] = useState<PreparedNftTransaction | null>(null);
  const [showSdk, setShowSdk] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [tab, setTab] = useState<'overview' | 'sale' | 'mint' | 'ledger' | 'integrate'>(() => {
    try {
      const saved = sessionStorage.getItem(`zexvro.nft.studioTab.${collectionId}`);
      if (
        saved === 'sale'
        || saved === 'mint'
        || saved === 'ledger'
        || saved === 'integrate'
      ) {
        sessionStorage.removeItem(`zexvro.nft.studioTab.${collectionId}`);
        return saved;
      }
    } catch {
      // ignore
    }
    return 'overview';
  });

  const dashboardUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/nft/collections/${collectionId}`;
    return `${window.location.origin}/nft/collections/${collectionId}`;
  }, [collectionId]);

  const load = useCallback(async (signal?: AbortSignal, soft = false) => {
    if (!soft) setLoading(true);
    setError('');
    try {
      const [healthResult, found] = await Promise.all([
        getNftServiceHealth(signal),
        getNftCollection(collectionId, accessToken, signal),
      ]);
      if (signal?.aborted) return;
      setHealth(healthResult);
      setCollection(found);
      try {
        const inventory = await listCollectionItems({
          collectionId: found.id,
          accessToken,
          signal,
        });
        if (!signal?.aborted) setItems(inventory.items);
      } catch {
        if (!signal?.aborted) setItems([]);
      }
      try {
        const saleWarning = sessionStorage.getItem(`zexvro.nft.saleWarning.${found.id}`);
        if (saleWarning) {
          setError(saleWarning);
          sessionStorage.removeItem(`zexvro.nft.saleWarning.${found.id}`);
          setTab('sale');
        }
      } catch {
        // ignore
      }
    } catch (err) {
      if (!signal?.aborted) setError(errorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accessToken, collectionId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Poll while contract deploy is in flight.
  useEffect(() => {
    if (!collection || collection.status !== 'deploying') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await getNftCollectionStatus(collection.id, accessToken);
        if (cancelled) return;
        if (status.status !== 'deploying') {
          await load(undefined, true);
        }
      } catch {
        // keep polling until user leaves
      }
    };
    const id = window.setInterval(() => {
      void tick();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [accessToken, collection, load]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(value);
    }
  };

  const retryDeploy = async () => {
    if (!collection) return;
    setBusy(true);
    setLaunchOpen(true);
    setError('');
    setMessage('');
    try {
      await retryNftCollectionDeployment(collection.id, accessToken);
      setMessage('Redeploy started.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLaunchOpen(false);
      setBusy(false);
    }
  };

  const removeFailed = async () => {
    if (!collection) return;
    const ok = window.confirm(
      collection.status === 'live'
        ? `Delete the API record for “${collection.name}”? The Stellar contract stays on-chain and cannot be destroyed from the dashboard.`
        : `Delete “${collection.name}” from this workspace?`,
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await deleteNftCollection(collection.id, accessToken);
      onBack();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    if (!collection) return;
    setBusy(true);
    setError('');
    try {
      if (collection.status === 'archived') {
        await unarchiveNftCollection({ collectionId: collection.id, accessToken });
        setMessage('Collection unarchived.');
      } else {
        await archiveNftCollection({ collectionId: collection.id, accessToken });
        setMessage('Collection archived.');
      }
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const prepareSale = async () => {
    if (!collection) return;
    setBusy(true);
    setError('');
    setMessage('');
    setSaleIntent(null);
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Connect Freighter (Testnet) as the collection owner.');
      }
      const ownerAddress = await getPublicKey();
      const priceAtomic = usdcToAtomic(salePrice);
      if (!priceAtomic) throw new Error('Enter a valid XLM price.');
      const intent = await prepareNftSaleConfig({
        collectionId: collection.id,
        ownerAddress,
        priceAtomic,
        accessToken,
      });
      if (intent.autoSubmitted?.transactionHash) {
        setMessage('Primary sale activated on-chain (auto-submitted).');
        setSaleIntent(null);
        await load();
        return;
      }
      setSaleIntent(intent);
      setMessage(
        intent.requiredSigners?.length
          ? 'Sale config prepared — sign with Freighter to go live.'
          : 'Sale config prepared — confirm to activate.',
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSale = async () => {
    if (!collection || !saleIntent) return;
    setBusy(true);
    setError('');
    try {
      const priceAtomic = usdcToAtomic(salePrice);
      if (!priceAtomic) throw new Error('Enter a valid XLM price.');
      if (saleIntent.autoSubmitted?.transactionHash) {
        setSaleIntent(null);
        setMessage('Primary sale already activated on-chain.');
        await load();
        return;
      }
      const signedTransaction =
        saleIntent.requiredSigners?.length
          ? await signTransaction(saleIntent.serializedTransaction)
          : saleIntent.serializedTransaction;
      await submitNftSaleConfig({
        collectionId: collection.id,
        preparedTransaction: saleIntent.serializedTransaction,
        signedTransaction,
        priceAtomic,
        accessToken,
      });
      setSaleIntent(null);
      setMessage('Primary sale is live.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const prepareMint = async () => {
    if (!collection) return;
    setBusy(true);
    setError('');
    setMintIntent(null);
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Connect Freighter (Testnet) as the minter.');
      }
      const operatorAddress = await getPublicKey();
      const recipient = mintRecipient.trim() || operatorAddress;
      const intent = await prepareNftMint({
        collectionId: collection.id,
        operatorAddress,
        recipientAddress: recipient,
        accessToken,
      });
      setMintIntent(intent);
      setMessage('Mint prepared — sign to mint.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitMint = async () => {
    if (!collection || !mintIntent) return;
    setBusy(true);
    setError('');
    try {
      const operatorAddress = await getPublicKey();
      const recipient = mintRecipient.trim() || operatorAddress;
      const signedTransaction = await signTransaction(mintIntent.serializedTransaction);
      await submitNftMint({
        collectionId: collection.id,
        preparedTransaction: mintIntent.serializedTransaction,
        signedTransaction,
        ...(mintIntent.tokenId === undefined ? {} : { tokenId: mintIntent.tokenId }),
        ownerAddress: recipient,
        accessToken,
      });
      setMintIntent(null);
      setMessage('Mint confirmed.');
      await load(undefined, true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unitPrice = collection?.primarySale
    ? Number(atomicToUsdc(collection.primarySale.priceAtomic))
    : 0;
  const revenueUsdc = unitPrice * items.length;

  const mintBySource = useMemo(() => {
    const mint = items.filter((i) => i.source === 'mint').length;
    const purchase = items.filter((i) => i.source === 'purchase').length;
    return [
      { name: 'Creator mint', value: mint, color: '#3B82F6' },
      { name: 'Purchase', value: purchase, color: '#22C55E' },
    ].filter((row) => row.value > 0);
  }, [items]);

  const mintTimeline = useMemo(() => {
    if (items.length === 0) {
      return [
        { day: '—', mints: 0, revenue: 0 },
      ];
    }
    const buckets = new Map<string, { mints: number; revenue: number }>();
    for (const item of items) {
      const day = (item.mintedAt || '').slice(0, 10) || 'unknown';
      const prev = buckets.get(day) || { mints: 0, revenue: 0 };
      prev.mints += 1;
      prev.revenue += unitPrice;
      buckets.set(day, prev);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, stats]) => ({
        day: day.slice(5) || day,
        mints: stats.mints,
        revenue: Number(stats.revenue.toFixed(4)),
      }));
  }, [items, unitPrice]);

  if (loading) {
    return <SectionSkeleton rows={5} label="Loading collection" />;
  }

  if (!collection) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-950 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Collection not found in this workspace.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <NftLaunchCinema open={launchOpen} stage="assemble" label="Redeploying collection…" />
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All collections
      </button>

      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {collection.coverImageUri.startsWith('http') ? (
            <img
              src={collection.coverImageUri}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-200 object-cover dark:border-zinc-800"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
              <Image className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold text-zinc-950 dark:text-white">{collection.name}</h1>
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[collection.status]}`}>
                {collection.status}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-500">{collection.symbol} · {collection.id}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{collection.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-800"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="/docs"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800"
          >
            <BookOpen className="h-4 w-4" /> Docs
          </a>
          <button
            type="button"
            onClick={() => setShowSdk(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800"
          >
            <Code2 className="h-4 w-4" /> Integrate
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeFailed()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/30 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/20"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            <ExternalLink className="h-4 w-4" /> Public page
          </a>
        </div>
      </header>

      {(error || message) && (
        <div className={`flex gap-2 rounded-md border px-3 py-2.5 text-sm ${
          error
            ? 'border-red-500/25 bg-red-500/5 text-red-600 dark:text-red-400'
            : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        }`}>
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || message}</span>
        </div>
      )}

      <section className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-4">
        {[
          ['Minted', String(items.length)],
          ['Primary sale', collection.primarySale ? `${atomicToUsdc(collection.primarySale.priceAtomic)} XLM` : 'Not live'],
          ['Est. revenue', collection.primarySale ? `${revenueUsdc.toFixed(2)} XLM` : '—'],
          ['API', health ? 'Connected' : 'Checking'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 dark:bg-[#050506]">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#0A0A0B]">
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 p-2 dark:border-zinc-800">
          {([
            ['overview', 'Overview'],
            ['sale', 'Sale'],
            ['mint', 'Mint'],
            ['ledger', 'Ledger'],
            ['integrate', 'Integrate'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 lg:col-span-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Mints over time</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mintTimeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="overviewMintFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="mints" stroke="#3B82F6" fill="url(#overviewMintFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Source mix</p>
                  <div className="h-40">
                    {mintBySource.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">No mints yet</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mintBySource} dataKey="value" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={3}>
                            {mintBySource.map((row) => (
                              <Cell key={row.name} fill={row.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Collection controls</h2>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-1.5 rounded-md border border-zinc-200 px-3 py-2.5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="shrink-0 text-zinc-500">Dashboard URL</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300" title={dashboardUrl}>
                      {dashboardUrl}
                    </code>
                    <button type="button" onClick={() => void copy('Dashboard URL', dashboardUrl)} className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-blue">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 rounded-md border border-zinc-200 px-3 py-2.5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="shrink-0 text-zinc-500">Public buy URL</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300" title={publicUrl}>
                      {publicUrl}
                    </code>
                    <button type="button" onClick={() => void copy('Public URL', publicUrl)} className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-blue">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 text-brand-blue" title="Open">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                {collection.contractId && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${collection.contractId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span className="text-zinc-500">Contract</span>
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-brand-blue">
                      {shortAddress(collection.contractId)} <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {collection.status === 'failed' && (
                  <button type="button" disabled={busy} onClick={() => void retryDeploy()} className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
                    <RotateCcw className="h-4 w-4" /> Retry deploy
                  </button>
                )}
                {(collection.status === 'live' || collection.status === 'archived') && (
                  <button type="button" disabled={busy} onClick={() => void toggleArchive()} className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
                    <Archive className="h-4 w-4" />
                    {collection.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                <button type="button" onClick={() => setTab('sale')} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-950">
                  <ShoppingCart className="h-4 w-4" /> Manage sale
                </button>
                <a href="/docs" className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
                  <BookOpen className="h-4 w-4" /> Docs
                </a>
                <button type="button" disabled={busy} onClick={() => void removeFailed()} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/30 px-3 text-sm text-red-600 dark:text-red-400">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>

              <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-xs dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
                <div className="flex items-center gap-2 bg-white px-3 py-2.5 dark:bg-[#050506]">
                  <RadioTower className={`h-4 w-4 ${health ? 'text-emerald-500' : 'text-zinc-400'}`} />
                  API {health ? 'ready' : '…'}
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2.5 dark:bg-[#050506]">
                  <ShieldCheck className={`h-4 w-4 ${health?.capabilities?.stellarConfigured ? 'text-emerald-500' : 'text-zinc-400'}`} />
                  Stellar testnet
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2.5 dark:bg-[#050506]">
                  Storage {health?.capabilities?.storageMode || '—'}
                </div>
              </div>
            </div>
          )}

          {tab === 'sale' && (
            <div className="mx-auto max-w-lg space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Primary sale (XLM)</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Activate the fixed XLM price so checkout “Prepare purchase” is enabled. Buyers pay with native XLM (no USDC trustline). Use Freighter as the owner wallet when signing is required.
              </p>
              {collection.primarySale && (
                <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Live at {atomicToUsdc(collection.primarySale.priceAtomic)} XLM
                </p>
              )}
              <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Price (XLM)
                <input
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#050506]"
                />
              </label>
              {!saleIntent ? (
                <button
                  type="button"
                  disabled={busy || collection.status !== 'live'}
                  onClick={() => void prepareSale()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {collection.primarySale ? 'Update sale config' : 'Prepare sale config'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitSale()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-medium text-white disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Sign & activate sale
                </button>
              )}
            </div>
          )}

          {tab === 'mint' && (
            <div className="mx-auto max-w-lg space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Creator mint</h2>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Recipient (optional — defaults to connected wallet)
                <input
                  value={mintRecipient}
                  onChange={(event) => setMintRecipient(event.target.value.toUpperCase().trim())}
                  placeholder="G..."
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-[#050506]"
                />
              </label>
              {!mintIntent ? (
                <button
                  type="button"
                  disabled={busy || collection.status !== 'live'}
                  onClick={() => void prepareMint()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 text-sm dark:border-zinc-800"
                >
                  <Sparkles className="h-4 w-4" />
                  Prepare mint
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitMint()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
                >
                  Sign & mint
                </button>
              )}
            </div>
          )}

          {tab === 'ledger' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Ledger & analytics</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">Mint volume, source mix, and estimated primary-sale revenue.</p>
                </div>
                <span className="text-xs text-zinc-500">{items.length} items</span>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 lg:col-span-2">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Mints over time</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mintTimeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mintFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="mints" stroke="#3B82F6" fill="url(#mintFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">By source</p>
                  <div className="h-48">
                    {mintBySource.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">No mints yet</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mintBySource} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={3}>
                            {mintBySource.map((row) => (
                              <Cell key={row.name} fill={row.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="mt-1 space-y-1 text-[11px] text-zinc-500">
                    {mintBySource.map((row) => (
                      <div key={row.name} className="flex justify-between">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                          {row.name}
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Est. revenue by day {collection.primarySale ? `(${unitPrice} XLM / NFT)` : '(set primary sale to estimate)'}
                </p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mintTimeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-zinc-500">No mints yet — use the Mint tab or public checkout.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <span className="font-medium tabular-nums">#{item.tokenId}</span>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] uppercase text-zinc-500 dark:border-zinc-800">
                        {item.source}
                      </span>
                      <span className="truncate font-mono text-xs text-zinc-500">{shortAddress(item.ownerAddress)}</span>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${item.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'integrate' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Game / SDK integration</h2>
              <p className="text-sm text-zinc-500">
                Copy checkout snippets, public branding URL, and embed links for your game.
              </p>
              <button
                type="button"
                onClick={() => setShowSdk(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
              >
                <Code2 className="h-4 w-4" /> Open SDK panel
              </button>
              <div className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                Public collection API: <code className="break-all">/v1/public/collections/{collection.id}</code>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSdk && (
        <NftSdkPanel
          collectionId={collection.id}
          collectionName={collection.name}
          onClose={() => setShowSdk(false)}
        />
      )}
    </div>
  );
}
