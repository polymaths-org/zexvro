import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  CircleAlert,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import {
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

function reportCheckoutError(error: unknown, setCheckoutError: (message: string) => void) {
  const message = errorMessage(error);
  // Help local debugging when Freighter/signing fails outside the network tab.
  console.error('[nft/checkout]', message, error);
  setCheckoutError(message);
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-7)}` : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function atomicToUsdc(value: string) {
  const atomic = BigInt(value);
  const whole = atomic / 10_000_000n;
  const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
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
  const [confirmedHash, setConfirmedHash] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getPublicNftCollection(collectionId, controller.signal)
      .then((result) => {
        setCollection(result.collection);
        if (result.inventory) {
          setInventory(result.inventory);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [collectionId]);

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href.split('?')[0] || window.location.href;
  }, []);


  const connectBuyerWallet = async () => {
    setCheckoutError('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Freighter is not available in this browser. Unlock Freighter, allow this site, or paste a buyer address manually.');
      }
      const address = await getPublicKey();
      setBuyerAddress(address);
      setCopied('Wallet connected.');
    } catch (error) {
      reportCheckoutError(error, setCheckoutError);
    }
  };

  const signAndSubmitCheckout = async () => {
    if (!checkoutIntent) return;
    setSubmitting(true);
    setCheckoutError('');
    setConfirmedHash('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Freighter is not available in this browser. Unlock Freighter, allow this site on Testnet, then try again.');
      }
      const walletAddress = await getPublicKey();
      if (walletAddress !== checkoutIntent.buyerAddress) {
        setCheckoutError(`Connected wallet must match buyer address ${checkoutIntent.buyerAddress}.`);
        return;
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
      setCopied('Purchase confirmed on Stellar testnet.');
    } catch (error) {
      reportCheckoutError(error, setCheckoutError);
    } finally {
      setSubmitting(false);
    }
  };

  const prepareCheckout = async () => {
    if (!collection || !collectionId) return;
    setCheckoutError('');
    setCheckoutIntent(null);
    setCopied('');
    if (!STELLAR_ADDRESS.test(buyerAddress.trim())) {
      setCheckoutError('Enter a valid Stellar buyer wallet address.');
      return;
    }

    setPreparing(true);
    try {
      // API allocates the next free token ID automatically.
      const intent = await createPublicCheckoutIntent({
        collectionId,
        buyerAddress: buyerAddress.trim(),
      });
      setCheckoutIntent(intent);
      setCopied(`Token #${intent.tokenId} reserved for checkout.`);
    } catch (error) {
      setCheckoutError(errorMessage(error));
    } finally {
      setPreparing(false);
    }
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied.`);
    } catch {
      setCopied(value);
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
      <div className="mx-auto grid min-h-dvh max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:py-12">
        <section className="min-w-0">
          <a href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            ZEXVRO
          </a>
          <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] md:items-start">
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {collection.coverImageUri.startsWith('http') ? (
                <img src={collection.coverImageUri} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-zinc-600">
                  <Gamepad2 className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-blue">
                <Gamepad2 className="h-4 w-4" />
                {collection.symbol}
              </div>
              <h1 className="text-balance text-4xl font-semibold text-white">{collection.name}</h1>
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-zinc-400">{collection.description}</p>

              <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800">
                <div className="bg-[#080809] p-4">
                  <span className="text-xs text-zinc-500">Royalty</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums text-white">
                    <CircleDollarSign className="h-4 w-4 shrink-0 text-zinc-500" />
                    {(collection.royaltyBps / 100).toFixed(2)}%
                  </span>
                </div>
                <div className="bg-[#080809] p-4">
                  <span className="text-xs text-zinc-500">Minted items</span>
                  <span className="mt-1 block text-sm font-medium tabular-nums text-white">
                    {inventory?.mintedCount ?? 0}
                  </span>
                </div>
                <div className="bg-[#080809] p-4">
                  <span className="text-xs text-zinc-500">Created</span>
                  <span className="mt-1 block text-sm font-medium text-white">{formatDate(collection.createdAt)}</span>
                </div>
                <div className="bg-[#080809] p-4">
                  <span className="text-xs text-zinc-500">Primary sale</span>
                  <span className="mt-1 block text-sm font-medium tabular-nums text-white">
                    {collection.primarySale ? `${atomicToUsdc(collection.primarySale.priceAtomic)} USDC` : 'Not configured'}
                  </span>
                </div>
                <div className="col-span-2 bg-[#080809] p-4">
                  <span className="text-xs text-zinc-500">Contract</span>
                  {collection.contractId ? (
                    <a
                      href={`https://stellar.expert/explorer/testnet/contract/${collection.contractId}`}
                      target="_blank"
                      rel="noreferrer"
                      title={collection.contractId}
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 font-mono text-sm text-brand-blue hover:underline"
                    >
                      <span className="truncate">{shortAddress(collection.contractId)}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="mt-1 block text-sm text-zinc-500">Pending</span>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyText('Collection URL', publicUrl)}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Copy URL
                </button>
                <a
                  href={collection.collectionMetadataUri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Metadata
                </a>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-w-0 rounded-lg border border-zinc-800 bg-[#080809] p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-brand-blue">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white">Buy item</h2>
              <p className="mt-1 text-pretty text-sm leading-6 text-zinc-400">
                Prepare the Stellar checkout for your wallet signature.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-zinc-200">
              Buyer wallet
              <input
                value={buyerAddress}
                onChange={event => setBuyerAddress(event.target.value.trim().toUpperCase())}
                placeholder="G..."
                spellCheck={false}
                className="mt-2 w-full rounded-md border border-zinc-800 bg-[#050506] px-3 py-2.5 font-mono text-xs text-white outline-none transition focus:border-brand-blue sm:text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void connectBuyerWallet()}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Connect wallet
            </button>
            <div className="rounded-md border border-zinc-800 bg-[#050506] p-3 text-sm text-zinc-400">
              Token ID is assigned automatically at checkout.
              {inventory && (
                <p className="mt-1 tabular-nums text-zinc-500">
                  {inventory.mintedCount} minted · next free suggestion #{inventory.nextTokenId}
                </p>
              )}
              {checkoutIntent && (
                <p className="mt-1 font-medium tabular-nums text-zinc-100">
                  Reserved for this purchase: #{checkoutIntent.tokenId}
                </p>
              )}
            </div>

            {checkoutError && (
              <div className="flex gap-2 rounded-md border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{checkoutError}</span>
              </div>
            )}
            {copied && (
              <div className="flex gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{copied}</span>
              </div>
            )}

            <button
              type="button"
              disabled={preparing || !collection.primarySale}
              onClick={() => void prepareCheckout()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Prepare checkout
            </button>
          </div>

          {checkoutIntent && (
            <div className="mt-5 min-w-0 space-y-3 border-t border-zinc-800 pt-5">
              <div className="grid grid-cols-1 gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500">Required signer</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <code
                      title={checkoutIntent.requiredSigners.join(', ')}
                      className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300"
                    >
                      {checkoutIntent.requiredSigners.map(shortAddress).join(', ')}
                    </code>
                    <button
                      type="button"
                      aria-label="Copy required signer"
                      onClick={() => void copyText('Required signer', checkoutIntent.requiredSigners.join(', '))}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Expires</div>
                  <div className="mt-1 text-sm tabular-nums text-zinc-300">
                    {formatDateTime(checkoutIntent.expiresAt)}
                  </div>
                </div>
              </div>
              <textarea
                readOnly
                value={checkoutIntent.serializedTransaction}
                rows={4}
                className="w-full resize-none break-all rounded-md border border-zinc-800 bg-[#050506] p-3 font-mono text-[11px] leading-4 text-zinc-400 outline-none"
              />
              <button
                type="button"
                onClick={() => void copyText('Prepared transaction', checkoutIntent.serializedTransaction)}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              >
                <Copy className="h-4 w-4" />
                Copy transaction
              </button>
              {checkoutIntent.status !== 'confirmed' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void signAndSubmitCheckout()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex max-w-full items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">Confirmed {shortAddress(confirmedHash)}</span>
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
