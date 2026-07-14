import { useEffect, useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import {
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import {
  createPublicCheckoutIntent,
  getPublicNftCollection,
  NftApiError,
  submitPublicCheckoutIntent,
  type NftCheckoutIntent,
  type PublicNftCollection,
} from './nftApi';
import { formatWalletError, getPublicKey, isWalletAvailable, signTransaction } from './stellarWallet';

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

function errorMessage(error: unknown) {
  if (error instanceof NftApiError && error.message) return error.message;
  const wallet = formatWalletError(error);
  if (wallet && wallet !== 'Wallet action failed.') return wallet;
  if (error instanceof Error && error.message) return error.message;
  return 'Checkout could not complete.';
}

function postToOpener(type: 'success' | 'error' | 'close', payload?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.opener) return;
  window.opener.postMessage(
    { source: 'zexvro-nft-checkout', type, payload },
    window.location.origin,
  );
}

function atomicToUsdc(value: string) {
  const atomic = BigInt(value);
  const whole = atomic / 10_000_000n;
  const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

/**
 * Hosted embed/popup checkout for third-party web games.
 * Route: /nft/embed/checkout?collectionId=...
 */
export default function EmbedCheckout() {
  const search = useSearch({ strict: false }) as { collectionId?: string };
  const collectionId = search.collectionId || '';

  const [collection, setCollection] = useState<PublicNftCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [intent, setIntent] = useState<NftCheckoutIntent | null>(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedHash, setConfirmedHash] = useState('');

  const priceLabel = useMemo(() => {
    if (!collection?.primarySale) return null;
    return `${atomicToUsdc(collection.primarySale.priceAtomic)} USDC`;
  }, [collection]);

  useEffect(() => {
    if (!collectionId) {
      setLoadError('collectionId query parameter is required.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    getPublicNftCollection(collectionId, controller.signal)
      .then((result) => setCollection(result.collection))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collectionId]);

  const close = () => {
    postToOpener('close');
    window.close();
  };

  const connectWallet = async () => {
    setError('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Install and unlock Freighter (Testnet), then allow this site.');
      }
      setBuyerAddress(await getPublicKey());
    } catch (err) {
      setError(errorMessage(err));
      postToOpener('error', { message: errorMessage(err) });
    }
  };

  const prepare = async () => {
    if (!collectionId) return;
    setError('');
    setIntent(null);
    if (!STELLAR_ADDRESS.test(buyerAddress.trim())) {
      setError('Connect Freighter or enter a valid Stellar buyer address.');
      return;
    }
    setPreparing(true);
    try {
      const next = await createPublicCheckoutIntent({
        collectionId,
        buyerAddress: buyerAddress.trim(),
      });
      setIntent(next);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      postToOpener('error', { message });
    } finally {
      setPreparing(false);
    }
  };

  const signAndSubmit = async () => {
    if (!intent) return;
    setSubmitting(true);
    setError('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Freighter is required to sign the purchase authorization.');
      }
      const walletAddress = await getPublicKey();
      if (walletAddress !== intent.buyerAddress) {
        throw new Error('Connected wallet must match the buyer address used to prepare checkout.');
      }
      const signedTransaction = await signTransaction(intent.serializedTransaction);
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
      postToOpener('success', {
        collectionId,
        tokenId: result.intent.tokenId,
        transactionHash: hash,
        buyerAddress: result.intent.buyerAddress,
      });
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      postToOpener('error', { message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050506] text-white">
        <LoaderCircle className="h-6 w-6 animate-spin text-zinc-500" />
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
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">ZEXVRO Checkout</p>
            <h1 className="mt-1 text-lg font-semibold text-white">{collection.name}</h1>
            {priceLabel && (
              <p className="mt-1 text-sm tabular-nums text-zinc-400">{priceLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close checkout"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-6 flex-1 space-y-4">
          <p className="text-sm text-zinc-400">
            Token ID is assigned automatically. You sign purchase authorization only; network fees are sponsored.
          </p>

          <label className="block text-sm font-medium text-zinc-200">
            Buyer wallet
            <input
              value={buyerAddress}
              onChange={(event) => setBuyerAddress(event.target.value.trim().toUpperCase())}
              placeholder="G..."
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-zinc-800 bg-[#0A0A0B] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-brand-blue"
            />
          </label>
          <button
            type="button"
            onClick={() => void connectWallet()}
            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-800 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            Connect Freighter
          </button>

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

          {!intent && (
            <button
              type="button"
              disabled={preparing || !collection.primarySale}
              onClick={() => void prepare()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
            >
              {preparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Prepare purchase
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
              href={`https://stellar.expert/explorer/testnet/tx/${confirmedHash}`}
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
    </main>
  );
}
