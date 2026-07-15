import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import {
  collectionLogo,
  createPublicCheckoutIntent,
  getPublicNftCollection,
  NftApiError,
  submitPublicCheckoutIntent,
  type NftInventorySummary,
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
  return 'The NFT service could not complete this request.';
}

function atomicToUsdc(value: string) {
  const atomic = BigInt(value);
  const whole = atomic / 10_000_000n;
  const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-7)}` : value;
}

export default function PublicCollection() {
  const { collectionId } = useParams({ strict: false });
  const [collection, setCollection] = useState<PublicNftCollection | null>(null);
  const [inventory, setInventory] = useState<NftInventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [checkoutIntent, setCheckoutIntent] = useState<NftCheckoutIntent | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirmedHash, setConfirmedHash] = useState('');
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getPublicNftCollection(collectionId, controller.signal)
      .then((result) => {
        setCollection(result.collection);
        if (result.inventory) setInventory(result.inventory);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collectionId]);

  const logo = useMemo(
    () => (collection ? collectionLogo(collection) : ''),
    [collection],
  );

  const priceLabel = useMemo(() => {
    if (!collection?.primarySale) return null;
    return `${atomicToUsdc(collection.primarySale.priceAtomic)} XLM`;
  }, [collection]);

  const connectBuyerWallet = async () => {
    setCheckoutError('');
    setConnecting(true);
    try {
      const available = await isWalletAvailable();
      if (!available) {
        throw new Error(
          'Freighter not detected. Install Freighter, unlock it, set network to Testnet, allow this site, then retry.',
        );
      }
      const address = await getPublicKey();
      setBuyerAddress(address);
      setStatusNote('Wallet connected.');
    } catch (error) {
      console.error('[nft/checkout] connect', error);
      setCheckoutError(errorMessage(error));
    } finally {
      setConnecting(false);
    }
  };

  const prepareCheckout = async () => {
    if (!collection || !collectionId) return;
    setCheckoutError('');
    setCheckoutIntent(null);
    setStatusNote('');
    let address = buyerAddress.trim();
    if (!STELLAR_ADDRESS.test(address)) {
      // Auto-connect if user skipped the connect button.
      try {
        address = await getPublicKey();
        setBuyerAddress(address);
      } catch (error) {
        setCheckoutError(errorMessage(error));
        return;
      }
    }

    setPreparing(true);
    try {
      const intent = await createPublicCheckoutIntent({
        collectionId,
        buyerAddress: address,
      });
      setCheckoutIntent(intent);
      setStatusNote(`Token #${intent.tokenId} reserved.`);
    } catch (error) {
      setCheckoutError(errorMessage(error));
    } finally {
      setPreparing(false);
    }
  };

  const signAndSubmitCheckout = async () => {
    if (!checkoutIntent) return;
    setSubmitting(true);
    setCheckoutError('');
    setConfirmedHash('');
    try {
      const walletAddress = await getPublicKey();
      if (walletAddress !== checkoutIntent.buyerAddress) {
        throw new Error(`Connected wallet must be ${checkoutIntent.buyerAddress}`);
      }
      const signedTransaction = await signTransaction(checkoutIntent.serializedTransaction);
      const result = await submitPublicCheckoutIntent({
        intentId: checkoutIntent.id,
        signedTransaction,
      });
      const hash = result.transaction?.transactionHash || result.intent.transactionHash || '';
      if (!hash || (result.intent.status !== 'confirmed' && result.transaction?.status !== 'confirmed')) {
        throw new Error(result.intent.failureReason || 'Checkout was submitted but not confirmed yet.');
      }
      setConfirmedHash(hash);
      setCheckoutIntent({ ...result.intent, status: 'confirmed', transactionHash: hash });
      setStatusNote('Purchase confirmed on Stellar testnet.');
    } catch (error) {
      console.error('[nft/checkout] sign', error);
      setCheckoutError(errorMessage(error));
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
        <section className="w-full max-w-md border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-300">
          <CircleAlert className="mb-3 h-5 w-5" />
          {loadError || 'Collection not found.'}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#050506] text-zinc-100">
      <div className="mx-auto max-w-lg px-5 py-8">
        <header className="mb-6 flex items-center justify-start">
          <img
            src="/brand/wordmark-transparent.png"
            alt="ZEXVRO"
            className="h-7 w-auto max-w-[160px] object-contain opacity-90"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = '/brand/typo-logo.png';
            }}
          />
        </header>

        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700/80 ring-1 ring-zinc-600/50">
            <img
              src="/brand/logo-transparent.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0A0A0B]">
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                {logo.startsWith('http') || logo.startsWith('/') ? (
                  <img src={logo} alt={collection.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">NFT</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Checkout</p>
                <h1 className="mt-1 truncate text-xl font-semibold text-white">{collection.name}</h1>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">{collection.symbol}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#050506] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500">Amount</span>
                <span className="font-semibold tabular-nums text-white">
                  {priceLabel || 'Sale not configured'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500">Minted</span>
                <span className="tabular-nums text-zinc-200">{inventory?.mintedCount ?? 0}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500">Network</span>
                <span className="text-zinc-200">Stellar testnet</span>
              </div>
              {collection.contractId && (
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-500">Contract</span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${collection.contractId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-brand-blue"
                  >
                    {shortAddress(collection.contractId)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <p className="text-sm leading-6 text-zinc-400">{collection.description}</p>

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

            <button
              type="button"
              disabled={connecting}
              onClick={() => void connectBuyerWallet()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
            >
              {connecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Connect Freighter
            </button>

            {checkoutError && (
              <div className="flex gap-2 rounded-md border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{checkoutError}</span>
              </div>
            )}
            {statusNote && (
              <div className="flex gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusNote}</span>
              </div>
            )}

            {!checkoutIntent && !collection.primarySale && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">
                Primary sale is not live yet. The collection owner must open the NFT dashboard and activate sale (or re-create and sign the sale step) before buyers can purchase.
              </div>
            )}

            {!checkoutIntent && (
              <button
                type="button"
                disabled={preparing || !collection.primarySale || !buyerAddress}
                onClick={() => void prepareCheckout()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {preparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {!collection.primarySale
                  ? 'Sale not live yet'
                  : !buyerAddress
                    ? 'Connect wallet to continue'
                    : 'Prepare purchase'}
              </button>
            )}

            {checkoutIntent && checkoutIntent.status !== 'confirmed' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void signAndSubmitCheckout()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Sign & buy token #{checkoutIntent.tokenId}
              </button>
            )}

            {confirmedHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${confirmedHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 text-sm text-emerald-300"
              >
                <ExternalLink className="h-4 w-4" />
                View confirmation
              </a>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          Powered by ZEXVRO · Freighter Testnet · sponsored network fees
        </p>
      </div>
    </main>
  );
}
