import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CircleAlert,
  Code2,
  Copy,
  ExternalLink,
  Image,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  archiveNftCollection,
  deleteNftCollection,
  getNftServiceHealth,
  listCollectionItems,
  listNftCollections,
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

  const dashboardUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/nft/collections/${collectionId}`;
    return `${window.location.origin}/nft/collections/${collectionId}`;
  }, [collectionId]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [healthResult, listResult] = await Promise.all([
        getNftServiceHealth(signal),
        listNftCollections(workspaceId, accessToken, signal),
      ]);
      if (signal?.aborted) return;
      setHealth(healthResult);
      const found = listResult.find((entry) => entry.id === collectionId) || null;
      setCollection(found);
      if (found) {
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
      }
    } catch (err) {
      if (!signal?.aborted) setError(errorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accessToken, collectionId, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

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
    setError('');
    setMessage('');
    try {
      await retryNftCollectionDeployment(collection.id, accessToken);
      setMessage('Redeploy started.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeFailed = async () => {
    if (!collection) return;
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
      if (!priceAtomic) throw new Error('Enter a valid USDC price.');
      const intent = await prepareNftSaleConfig({
        collectionId: collection.id,
        ownerAddress,
        priceAtomic,
        accessToken,
      });
      setSaleIntent(intent);
      setMessage('Sale config prepared — sign with Freighter to go live.');
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
      const signedTransaction = await signTransaction(saleIntent.serializedTransaction);
      await submitNftSaleConfig({
        collectionId: collection.id,
        preparedTransaction: saleIntent.serializedTransaction,
        signedTransaction,
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
      const signedTransaction = await signTransaction(mintIntent.serializedTransaction);
      await submitNftMint({
        collectionId: collection.id,
        preparedTransaction: mintIntent.serializedTransaction,
        signedTransaction,
        accessToken,
      });
      setMintIntent(null);
      setMessage('Mint confirmed.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
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

  const revenueUsdc = collection.primarySale
    ? Number(atomicToUsdc(collection.primarySale.priceAtomic)) * items.length
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
          <button
            type="button"
            onClick={() => setShowSdk(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800"
          >
            <Code2 className="h-4 w-4" /> Integrate
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
          ['Primary sale', collection.primarySale ? `${atomicToUsdc(collection.primarySale.priceAtomic)} USDC` : 'Not live'],
          ['Est. revenue', collection.primarySale ? `${revenueUsdc.toFixed(2)} USDC` : '—'],
          ['API', health ? 'Connected' : 'Checking'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 dark:bg-[#050506]">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Go live & integrations</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="text-zinc-500">Dashboard URL</span>
              <button type="button" onClick={() => void copy('Dashboard URL', dashboardUrl)} className="inline-flex items-center gap-1 text-xs text-brand-blue">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="text-zinc-500">Public buy URL</span>
              <button type="button" onClick={() => void copy('Public URL', publicUrl)} className="inline-flex items-center gap-1 text-xs text-brand-blue">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
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

          {collection.status === 'failed' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void retryDeploy()} className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
                <RotateCcw className="h-4 w-4" /> Retry deploy
              </button>
              <button type="button" disabled={busy} onClick={() => void removeFailed()} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/30 px-3 text-sm text-red-600">
                <Trash2 className="h-4 w-4" /> Delete record
              </button>
            </div>
          )}

          {(collection.status === 'live' || collection.status === 'archived') && (
            <button type="button" disabled={busy} onClick={() => void toggleArchive()} className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
              <Archive className="h-4 w-4" />
              {collection.status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Primary sale (USDC)</h2>
          <p className="text-xs leading-5 text-zinc-500">
            Set the on-chain fixed USDC price buyers pay. Requires Freighter as the owner wallet.
          </p>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Price (USDC)
            <input
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#0A0A0B]"
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
              Prepare sale config
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
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Creator mint</h2>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Recipient (optional — defaults to connected wallet)
            <input
              value={mintRecipient}
              onChange={(event) => setMintRecipient(event.target.value.toUpperCase().trim())}
              placeholder="G..."
              className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-[#0A0A0B]"
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
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Mint ledger</h2>
            <span className="text-xs text-zinc-500">{items.length} items</span>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">No mints yet.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <span className="font-medium tabular-nums">#{item.tokenId}</span>
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
        </section>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-xs dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
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
      </section>

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
