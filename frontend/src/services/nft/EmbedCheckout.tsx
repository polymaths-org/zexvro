import {
  useEffect, useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import {
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import BrandLoader from '../../components/BrandLoader';
import {
  collectionLogo,
  createPublicCheckoutIntent,
  formatPrimarySalePrice,
  getNftServiceHealth,
  getPublicNftCollection,
  NftApiError,
  submitPublicCheckoutIntent,
  type NftCheckoutIntent,
  type NftServiceHealth,
  type PublicNftCollection,
  nftExplorerBase,
  nftNetworkLabel,
  nftNetworkPassphrase,
} from './nftApi';
import {
  NFT_CHECKOUT_WALLETS,
  connectCheckoutWallet,
  formatWalletError,
  getPublicKey,
  readWalletSession,
  signTransaction,
  type NftCheckoutWalletId,
} from './stellarWallet';

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function errorMessage(error: unknown) {
  if (error instanceof NftApiError && error.message) return error.message;
  const wallet = formatWalletError(error);
  if (wallet && wallet !== 'Wallet action failed.') return wallet;
  if (error instanceof Error && error.message) return error.message;
  return 'Checkout could not complete.';
}

function resolveOpenerTargetOrigin(openerOriginParam?: string) {
  // Prefer explicit opener origin from the SDK (cross-origin game embeds).
  if (openerOriginParam) {
    try {
      return new URL(openerOriginParam).origin;
    } catch {
      // fall through
    }
  }
  // Same-origin embeds (Studio itself) can target this origin.
  return window.location.origin;
}

function postToOpener(
  type: 'success' | 'error' | 'close',
  payload?: Record<string, unknown>,
  openerOriginParam?: string,
) {
  if (typeof window === 'undefined' || !window.opener) return;
  // Prefer explicit openerOrigin from SDK; fall back to '*' so game embeds
  // (localhost/itch.io) still receive success when openerOrigin is missing.
  // Payload is a non-secret purchase receipt; the parent still validates event.origin.
  const targetOrigin = openerOriginParam
    ? resolveOpenerTargetOrigin(openerOriginParam)
    : '*';
  window.opener.postMessage(
    { source: 'zexvro-nft-checkout', type, payload },
    targetOrigin,
  );
}

/**
 * Hosted embed/popup checkout for third-party web games.
 * Route: /nft/embed/checkout?collectionId=...
 */
export default function EmbedCheckout() {
  const search = useSearch({ strict: false }) as {
    collectionId?: string;
    openerOrigin?: string;
    workspaceId?: string;
    zcrAmount?: string;
    packId?: string;
  };
  const collectionId = search.collectionId || '';
  const openerOrigin = search.openerOrigin || '';
  const creditWorkspaceId = (search.workspaceId || '').trim();
  const creditZcrAmount = Number(search.zcrAmount || 0) || undefined;
  const creditPackId = (search.packId || '').trim() || undefined;
  const isCreditPack = Boolean(creditWorkspaceId && creditZcrAmount && creditZcrAmount > 0);

  const [collection, setCollection] = useState<PublicNftCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [intent, setIntent] = useState<NftCheckoutIntent | null>(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirmedHash, setConfirmedHash] = useState('');
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [walletProvider, setWalletProvider] = useState<NftCheckoutWalletId>(
    () => readWalletSession()?.provider || 'freighter',
  );

  const priceLabel = useMemo(
    () => formatPrimarySalePrice(collection?.primarySale, health),
    [collection, health],
  );

  const logo = useMemo(
    () => (collection ? collectionLogo(collection) : ''),
    [collection],
  );

  useEffect(() => {
    if (!collectionId) {
      setLoadError('collectionId query parameter is required.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      getPublicNftCollection(collectionId, controller.signal),
      getNftServiceHealth(controller.signal).catch(() => null),
    ])
      .then(([result, nextHealth]) => {
        setCollection(result.collection);
        if (nextHealth) setHealth(nextHealth);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collectionId]);

  const close = () => {
    postToOpener('close', undefined, openerOrigin);
    window.close();
  };

  const connectWallet = async (provider: NftCheckoutWalletId = walletProvider) => {
    setError('');
    setConnecting(true);
    setWalletProvider(provider);
    try {
      const session = await connectCheckoutWallet(provider, nftNetworkPassphrase(health));
      setBuyerAddress(session.address);
      setWalletProvider(session.provider);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      postToOpener('error', { message }, openerOrigin);
    } finally {
      setConnecting(false);
    }
  };

  const prepare = async () => {
    if (!collectionId) return;
    setError('');
    setIntent(null);
    let address = buyerAddress.trim();
    if (!STELLAR_ADDRESS.test(address)) {
      try {
        address = await getPublicKey();
        setBuyerAddress(address);
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        postToOpener('error', { message }, openerOrigin);
        return;
      }
    }
    setPreparing(true);
    try {
      const next = await createPublicCheckoutIntent({
        collectionId,
        buyerAddress: address,
        ...(isCreditPack
          ? {
              creditWorkspaceId,
              creditZcrAmount,
              creditPackId,
            }
          : {}),
      });
      setIntent(next);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      postToOpener('error', { message }, openerOrigin);
    } finally {
      setPreparing(false);
    }
  };

  const signAndSubmit = async () => {
    if (!intent) return;
    setSubmitting(true);
    setError('');
    try {
      const walletAddress = await getPublicKey();
      if (walletAddress !== intent.buyerAddress) {
        throw new Error('Connected wallet must match the buyer address used to prepare checkout.');
      }
      const signedTransaction = await signTransaction(intent.serializedTransaction, nftNetworkPassphrase(health));
      const result = await submitPublicCheckoutIntent({
        intentId: intent.id,
        signedTransaction,
      });
      const hash = result.transaction?.transactionHash || result.intent.transactionHash || '';
      if (!hash || (result.intent.status !== 'confirmed' && result.transaction?.status !== 'confirmed')) {
        throw new Error(result.intent.failureReason || 'Checkout was not confirmed.');
      }
      setConfirmedHash(hash);
      setIntent({ ...result.intent, status: 'confirmed', transactionHash: hash });
      postToOpener(
        'success',
        {
          collectionId,
          ...(isCreditPack
            ? {
                creditWorkspaceId,
                creditZcrAmount,
                creditPackId,
              }
            : {}),
          tokenId: result.intent.tokenId,
          transactionHash: hash,
          buyerAddress: result.intent.buyerAddress,
        },
        openerOrigin,
      );
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      postToOpener('error', { message }, openerOrigin);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#141416] text-white">
        <BrandLoader size="lg" />
      </main>
    );
  }

  if (loadError || !collection) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050506] p-6 text-white">
        <section className="w-full max-w-sm rounded-lg border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-300">
          <CircleAlert className="mb-3 h-5 w-5" />
          {loadError || 'Collection not found.'}
          <button type="button" onClick={close} className="mt-4 block text-xs text-zinc-400 underline">
            Close
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col p-5">
        <header className="flex items-center justify-between gap-3">
          <img
            src="/brand/wordmark-transparent.png"
            alt="ZEXVRO"
            className="h-6 w-auto max-w-[150px] object-contain opacity-90"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = '/brand/typo-logo.png';
            }}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close checkout"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700/80 ring-1 ring-zinc-600/50">
            <img src="/brand/logo-transparent.png" alt="" className="h-8 w-8 object-contain" />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0A0A0B]">
          <div className="flex items-center gap-4 border-b border-zinc-800 p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
              {logo.startsWith('http') || logo.startsWith('/') ? (
                <img src={logo} alt={collection.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">NFT</div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white">
                {isCreditPack ? 'Buy Zexvro credits' : collection.name}
              </h1>
              {isCreditPack ? (
                <p className="mt-1 text-sm text-emerald-400">
                  +{creditZcrAmount} ZCR
                  {creditPackId ? ` · ${creditPackId}` : ''}
                </p>
              ) : null}
              {priceLabel && (
                <p className="mt-1 text-sm tabular-nums text-zinc-300">{priceLabel}</p>
              )}
              <p className="mt-0.5 text-xs text-zinc-500">{nftNetworkLabel(health)} · sponsored fees</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <label className="block text-sm font-medium text-zinc-200">
              Buyer wallet
              <input
                value={buyerAddress}
                onChange={(event) => setBuyerAddress(event.target.value.trim().toUpperCase())}
                placeholder="G..."
                spellCheck={false}
                className="mt-2 w-full rounded-md border border-zinc-800 bg-[#050506] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-brand-blue"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NFT_CHECKOUT_WALLETS.map((wallet) => (
                <button
                  key={wallet.id}
                  type="button"
                  disabled={connecting}
                  onClick={() => void connectWallet(wallet.id)}
                  className={`inline-flex h-10 flex-col items-center justify-center rounded-md border px-2 text-center disabled:opacity-60 ${
                    walletProvider === wallet.id && buyerAddress
                      ? 'border-white/40 bg-white/10 text-white'
                      : 'border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-medium">
                    {connecting && walletProvider === wallet.id ? 'Connecting…' : wallet.label}
                  </span>
                  <span className="text-[10px] text-zinc-500">{wallet.hint}</span>
                </button>
              ))}
            </div>

            {intent && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
                Reserved token #{intent.tokenId}
              </div>
            )}

            {error && (
              <div className="flex gap-2 rounded-md border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!intent && !collection.primarySale && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">
                Primary sale is not live yet. Owner must activate sale from the NFT dashboard.
              </div>
            )}

            {!intent && (
              <button
                type="button"
                disabled={preparing || !collection.primarySale || !buyerAddress}
                onClick={() => void prepare()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              >
                {preparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {!collection.primarySale
                  ? 'Sale not live yet'
                  : !buyerAddress
                    ? 'Connect wallet to continue'
                    : 'Prepare purchase'}
              </button>
            )}

            {intent && intent.status !== 'confirmed' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void signAndSubmit()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Sign & submit
              </button>
            )}

            {confirmedHash && (
              <a
                href={`${nftExplorerBase(health)}/tx/${confirmedHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-300"
              >
                <ExternalLink className="h-4 w-4" />
                Purchase confirmed
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
