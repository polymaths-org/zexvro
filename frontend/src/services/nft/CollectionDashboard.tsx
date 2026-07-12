import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  CloudUpload,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Gamepad2,
  Image,
  LoaderCircle,
  Plus,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { NftCollection } from '../../types';
import { loadCollections } from './collectionStore';
import {
  deleteNftCollection,
  getNftServiceHealth,
  listNftCollections,
  prepareNftMint,
  prepareNftSaleConfig,
  retryNftCollectionDeployment,
  submitNftMint,
  submitNftSaleConfig,
  updateNftCollection,
  type ApiNftCollection,
  type NftServiceHealth,
  type PreparedNftTransaction,
} from './nftApi';
import { formatWalletError, getPublicKey, isWalletAvailable, signTransaction } from './stellarWallet';

interface CollectionDashboardProps {
  workspaceId: string;
  accessToken: string;
  onCreate: () => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-7)}` : value;
}

function errorMessage(error: unknown) {
  const wallet = formatWalletError(error);
  if (wallet && wallet !== 'Wallet action failed.') return wallet;
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const code = String((error as { code?: unknown }).code || '');
    const message = String((error as { message?: unknown }).message || '');
    if (code === 'token_already_minted') return message || 'Token is already minted.';
    if (code === 'minter_authorization_missing') return message || 'Selected minter authorization is missing.';
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'NFT API unavailable';
}

function collectionPublicPath(collectionId: string) {
  return `/nft/collections/${collectionId}`;
}

function collectionPublicUrl(collectionId: string) {
  if (typeof window === 'undefined') return collectionPublicPath(collectionId);
  return `${window.location.origin}${collectionPublicPath(collectionId)}`;
}

function usdcToAtomic(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,7})?$/.test(trimmed)) return undefined;
  const [whole, fraction = ''] = trimmed.split('.');
  const atomic = BigInt(whole) * 10_000_000n + BigInt((fraction + '0000000').slice(0, 7));
  return atomic > 0n ? atomic.toString() : undefined;
}

function atomicToUsdc(value: string) {
  const atomic = BigInt(value);
  const whole = atomic / 10_000_000n;
  const fraction = (atomic % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

const STATUS_STYLE = {
  deploying: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  live: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function CollectionDashboard({ workspaceId, accessToken, onCreate }: CollectionDashboardProps) {
  const [collections, setCollections] = useState<ApiNftCollection[]>([]);
  const [browserDrafts, setBrowserDrafts] = useState<NftCollection[]>([]);
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyCollectionId, setBusyCollectionId] = useState('');
  const [editingCollection, setEditingCollection] = useState<ApiNftCollection | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    symbol: '',
    description: '',
    royaltyBps: 0,
  });
  const [saleCollection, setSaleCollection] = useState<ApiNftCollection | null>(null);
  const [salePrice, setSalePrice] = useState('0.25');
  const [saleIntent, setSaleIntent] = useState<PreparedNftTransaction | null>(null);
  const [mintCollection, setMintCollection] = useState<ApiNftCollection | null>(null);
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTokenId, setMintTokenId] = useState('1');
  const [mintOperator, setMintOperator] = useState('');
  const [mintIntent, setMintIntent] = useState<PreparedNftTransaction | null>(null);
  const [lastMintTxHash, setLastMintTxHash] = useState('');

  const loadRemoteData = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');
    setActionError('');

    const [healthResult, collectionResult] = await Promise.allSettled([
      getNftServiceHealth(signal),
      listNftCollections(workspaceId, accessToken, signal),
    ]);

    if (signal?.aborted) return;
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    else setHealth(null);

    if (collectionResult.status === 'fulfilled') {
      setCollections(collectionResult.value);
    } else {
      setCollections([]);
      setApiError(errorMessage(collectionResult.reason));
    }
    setLoading(false);
    setRefreshing(false);
  }, [accessToken, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    setBrowserDrafts(loadCollections(workspaceId));
    void loadRemoteData(controller.signal);
    return () => controller.abort();
  }, [loadRemoteData, workspaceId]);

  const hasAnyCollections = collections.length > 0 || browserDrafts.length > 0;

  const refreshCollections = () => {
    setBrowserDrafts(loadCollections(workspaceId));
    void loadRemoteData(undefined, true);
  };

  const retryCollection = async (collection: ApiNftCollection) => {
    setBusyCollectionId(collection.id);
    setActionError('');
    setActionMessage('');
    try {
      await retryNftCollectionDeployment(collection.id, accessToken);
      setActionMessage(`${collection.name} deployment was retried.`);
      await loadRemoteData(undefined, true);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const deleteCollection = async (collection: ApiNftCollection) => {
    const confirmed = window.confirm(`Delete the failed API record for ${collection.name}? Live contracts cannot be deleted from Stellar.`);
    if (!confirmed) return;
    setBusyCollectionId(collection.id);
    setActionError('');
    setActionMessage('');
    try {
      await deleteNftCollection(collection.id, accessToken);
      setCollections(previous => previous.filter(item => item.id !== collection.id));
      setActionMessage(`${collection.name} was removed.`);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const copyPublicUrl = async (collection: ApiNftCollection) => {
    const url = collectionPublicUrl(collection.id);
    try {
      await navigator.clipboard.writeText(url);
      setActionMessage('Public collection URL copied.');
      setActionError('');
    } catch {
      setActionError(url);
    }
  };

  const openEdit = (collection: ApiNftCollection) => {
    setEditingCollection(collection);
    setEditDraft({
      name: collection.name,
      symbol: collection.symbol,
      description: collection.description,
      royaltyBps: collection.royaltyBps,
    });
    setActionError('');
    setActionMessage('');
  };

  const openSaleSetup = (collection: ApiNftCollection) => {
    setSaleCollection(collection);
    setSalePrice(collection.primarySale ? atomicToUsdc(collection.primarySale.priceAtomic) : '0.25');
    setSaleIntent(null);
    setActionError('');
    setActionMessage('');
  };

  const openMintSetup = (collection: ApiNftCollection) => {
    setMintCollection(collection);
    setMintRecipient(collection.ownerAddress);
    setMintOperator(collection.ownerAddress);
    setMintTokenId('1');
    setMintIntent(null);
    setLastMintTxHash('');
    setActionError('');
    setActionMessage('');
  };

  const prepareMint = async () => {
    if (!mintCollection) return;
    const tokenId = Number(mintTokenId);
    if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 4_294_967_295) {
      setActionError('Token ID must be an integer between 0 and 4294967295.');
      return;
    }
    const recipientAddress = mintRecipient.trim();
    const operatorAddress = mintOperator.trim() || mintCollection.ownerAddress;
    if (!/^G[A-Z0-9]{55}$/.test(recipientAddress)) {
      setActionError('Enter a valid Stellar recipient address (G...).');
      return;
    }
    if (!/^G[A-Z0-9]{55}$/.test(operatorAddress)) {
      setActionError('Enter a valid Stellar minter/operator address (G...).');
      return;
    }
    setBusyCollectionId(mintCollection.id);
    setActionError('');
    setActionMessage('');
    setLastMintTxHash('');
    try {
      const intent = await prepareNftMint({
        collectionId: mintCollection.id,
        operatorAddress,
        recipientAddress,
        tokenId,
        accessToken,
      });
      setMintIntent(intent);
      if (intent.autoSubmitted) {
        setLastMintTxHash(intent.autoSubmitted.transactionHash);
        setActionMessage(`Token ${tokenId} minted on Stellar testnet.`);
      } else {
        setActionMessage('Mint transaction prepared. Sign with the minter wallet to submit.');
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const signAndSubmitMint = async () => {
    if (!mintCollection || !mintIntent || mintIntent.autoSubmitted) return;
    setBusyCollectionId(mintCollection.id);
    setActionError('');
    setActionMessage('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Freighter is not available in this browser. Unlock Freighter, allow this site, and use Testnet.');
      }
      const walletAddress = await getPublicKey();
      const operatorAddress = mintOperator.trim() || mintCollection.ownerAddress;
      if (
        walletAddress !== operatorAddress
        && !mintIntent.requiredSigners.includes(walletAddress)
      ) {
        setActionMessage(`Connected wallet ${walletAddress.slice(0, 6)}... differs from required minter. Continue only if this key is authorized.`);
      }
      const signedTransaction = await signTransaction(mintIntent.serializedTransaction);
      const transaction = await submitNftMint({
        collectionId: mintCollection.id,
        preparedTransaction: mintIntent.serializedTransaction,
        signedTransaction,
        accessToken,
      });
      setLastMintTxHash(transaction.transactionHash);
      setMintIntent({
        ...mintIntent,
        autoSubmitted: {
          transactionHash: transaction.transactionHash,
          status: 'confirmed',
        },
      });
      setActionMessage(`Token ${mintTokenId} signed and minted on Stellar testnet.`);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const prepareSaleConfig = async () => {
    if (!saleCollection) return;
    const priceAtomic = usdcToAtomic(salePrice);
    if (priceAtomic === undefined) {
      setActionError('Enter a USDC price greater than 0 with up to 7 decimals.');
      return;
    }
    setBusyCollectionId(saleCollection.id);
    setActionError('');
    setActionMessage('');
    try {
      const intent = await prepareNftSaleConfig({
        collectionId: saleCollection.id,
        ownerAddress: saleCollection.ownerAddress,
        priceAtomic,
        accessToken,
      });
      setSaleIntent(intent);
      if (intent.autoSubmitted) {
        const configuredSale = {
          paymentTokenAddress: '',
          priceAtomic,
          transactionHash: intent.autoSubmitted.transactionHash,
          configuredAt: new Date().toISOString(),
        };
        setSaleCollection(previous => previous ? { ...previous, primarySale: configuredSale } : previous);
        setCollections(previous => previous.map(collection =>
          collection.id === saleCollection.id
            ? { ...collection, primarySale: configuredSale }
            : collection,
        ));
        setActionMessage('Sale configuration is live on Stellar testnet.');
        await loadRemoteData(undefined, true);
      } else {
        setActionMessage('Sale configuration transaction prepared.');
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const signAndSubmitSaleConfig = async () => {
    if (!saleCollection || !saleIntent || saleIntent.autoSubmitted) return;
    setBusyCollectionId(saleCollection.id);
    setActionError('');
    setActionMessage('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Freighter is not available in this browser. Unlock Freighter, allow this site, use Testnet, or rely on the local sponsor auto-submit path.');
      }
      const walletAddress = await getPublicKey();
      if (
        saleCollection.ownerAddress &&
        walletAddress !== saleCollection.ownerAddress &&
        !saleIntent.requiredSigners.includes(walletAddress)
      ) {
        setActionMessage(`Connected wallet ${walletAddress.slice(0, 6)}... differs from required signers. Continue only if this key is authorized.`);
      }
      const signedTransaction = await signTransaction(saleIntent.serializedTransaction);
      const result = await submitNftSaleConfig({
        collectionId: saleCollection.id,
        preparedTransaction: saleIntent.serializedTransaction,
        signedTransaction,
        accessToken,
      });
      const configuredSale = {
        paymentTokenAddress: '',
        priceAtomic: usdcToAtomic(salePrice) || '0',
        transactionHash: result.transaction.transactionHash,
        configuredAt: new Date().toISOString(),
      };
      setSaleCollection(previous => previous ? {
        ...previous,
        primarySale: result.collection?.primarySale || configuredSale,
      } : previous);
      setCollections(previous => previous.map(collection =>
        collection.id === saleCollection.id
          ? { ...collection, primarySale: result.collection?.primarySale || configuredSale }
          : collection,
      ));
      setSaleIntent({
        ...saleIntent,
        autoSubmitted: {
          transactionHash: result.transaction.transactionHash,
          status: 'confirmed',
        },
      });
      setActionMessage('Sale configuration signed and confirmed on Stellar testnet.');
      await loadRemoteData(undefined, true);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  const saveEdit = async () => {
    if (!editingCollection) return;
    setBusyCollectionId(editingCollection.id);
    setActionError('');
    setActionMessage('');
    try {
      await updateNftCollection(editingCollection.id, {
        name: editDraft.name.trim(),
        symbol: editDraft.symbol.trim().toUpperCase(),
        description: editDraft.description.trim(),
        royaltyBps: editDraft.royaltyBps,
      }, accessToken);
      setEditingCollection(null);
      setActionMessage('Failed collection record updated.');
      await loadRemoteData(undefined, true);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyCollectionId('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Gamepad2 className="h-4 w-4 text-brand-blue" />
            NFT Service
          </div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Collections</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Deploy and inspect creator-controlled game asset collections on Stellar testnet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Refresh collections"
            title="Refresh collections"
            disabled={refreshing}
            onClick={() => {
              refreshCollections();
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            New collection
          </button>
        </div>
      </header>

      <section className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3" aria-label="NFT service readiness">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <RadioTower className={`h-4 w-4 ${health ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">API</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{health ? 'Connected' : 'Unavailable'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ShieldCheck className={`h-4 w-4 ${health?.capabilities.stellarConfigured ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Stellar</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{health?.capabilities.stellarConfigured ? 'Testnet ready' : 'Not configured'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <CloudUpload className={`h-4 w-4 ${health?.capabilities.pinningConfigured ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Storage</span>
          <span className="ml-auto font-medium capitalize text-zinc-800 dark:text-zinc-200">{health?.capabilities.storageMode || 'Unavailable'}</span>
        </div>
      </section>

      {apiError && (
        <div className="flex items-center gap-2.5 border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>{apiError}</span>
          <button
            type="button"
            onClick={() => void loadRemoteData(undefined, true)}
            className="ml-auto text-xs font-semibold underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      )}

      {(actionError || actionMessage) && (
        <div className={`flex items-center gap-2.5 border px-3 py-2.5 text-sm ${
          actionError
            ? 'border-red-500/25 bg-red-500/5 text-red-600 dark:text-red-400'
            : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        }`} role="status">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>{actionError || actionMessage}</span>
        </div>
      )}

      {loading ? (
        <section className="flex min-h-56 items-center justify-center border-y border-zinc-200 dark:border-zinc-900" aria-label="Loading collections">
          <LoaderCircle className="h-5 w-5 animate-spin text-zinc-400" />
        </section>
      ) : !hasAnyCollections ? (
        <section className="border-y border-zinc-200 py-16 text-center dark:border-zinc-900 sm:py-24">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-blue dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <Boxes className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">No collections yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            The collection flow uploads its media and deploys a collection contract to Stellar testnet through the NFT API.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Create collection
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <>
          {collections.length > 0 && (
            <section className="border-y border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col gap-2 border-b border-zinc-200 px-1 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Deployed collections</h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{collections.length} API record{collections.length === 1 ? '' : 's'} in this workspace</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Cognito-scoped
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-3 font-medium">Collection</th>
                      <th className="px-3 py-3 font-medium">Items</th>
                      <th className="px-3 py-3 font-medium">Royalty</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Contract</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {collections.map(collection => (
                      <tr key={collection.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            {collection.coverImageUri.startsWith('http') ? (
                              <img src={collection.coverImageUri} alt="" className="h-9 w-9 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-800" />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
                                <Image className="h-4 w-4" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block max-w-56 truncate font-medium text-zinc-950 dark:text-white">{collection.name}</span>
                              <span className="mt-0.5 block font-mono text-xs text-zinc-500 dark:text-zinc-400">{collection.symbol}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-zinc-600 dark:text-zinc-300">0</td>
                        <td className="px-3 py-3.5 text-zinc-600 dark:text-zinc-300">
                          <span className="inline-flex items-center gap-1.5">
                            <CircleDollarSign className="h-3.5 w-3.5 text-zinc-400" />
                            {(collection.royaltyBps / 100).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLE[collection.status]}`}>
                            {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
                          </span>
                          {collection.failureReason && <span className="mt-1 block max-w-48 text-xs text-red-500">{collection.failureReason}</span>}
                        </td>
                        <td className="px-3 py-3.5">
                          {collection.contractId ? (
                            <a
                              href={`https://stellar.expert/explorer/testnet/contract/${collection.contractId}`}
                              target="_blank"
                              rel="noreferrer"
                              title={collection.contractId}
                              className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-blue hover:underline"
                            >
                              {shortAddress(collection.contractId)}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400">Pending</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(collection.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {collection.status === 'live' ? (
                              <>
                                <a
                                  href={collectionPublicPath(collection.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="View public page"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                                <a
                                  href={`${collectionPublicPath(collection.id)}?buy=1`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open buyer page"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void copyPublicUrl(collection)}
                                  title="Copy public URL"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openSaleSetup(collection)}
                                  title={collection.primarySale ? 'Update primary sale' : 'Configure primary sale'}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                                    collection.primarySale
                                      ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white'
                                  }`}
                                >
                                  <CircleDollarSign className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openMintSetup(collection)}
                                  title="Mint token"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void retryCollection(collection)}
                                  disabled={busyCollectionId === collection.id}
                                  title="Retry deployment"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <RotateCcw className={`h-4 w-4 ${busyCollectionId === collection.id ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(collection)}
                                  disabled={busyCollectionId === collection.id}
                                  title="Edit failed record"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteCollection(collection)}
                                  disabled={busyCollectionId === collection.id}
                                  title="Delete failed record"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {browserDrafts.length > 0 && (
            <section className="border-y border-zinc-200 dark:border-zinc-800">
              <div className="border-b border-zinc-200 px-1 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Earlier browser drafts</h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">These records predate API deployment and remain only in this browser.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-3 font-medium">Collection</th>
                      <th className="px-3 py-3 font-medium">Royalty</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {browserDrafts.map(collection => (
                      <tr key={collection.id}>
                        <td className="px-3 py-3.5">
                          <span className="block font-medium text-zinc-950 dark:text-white">{collection.name}</span>
                          <span className="mt-0.5 block font-mono text-xs text-zinc-500 dark:text-zinc-400">{collection.symbol}</span>
                        </td>
                        <td className="px-3 py-3.5 text-zinc-600 dark:text-zinc-300">{(collection.royaltyBps / 100).toFixed(2)}%</td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">Browser draft</span>
                        </td>
                        <td className="px-3 py-3.5 text-zinc-500 dark:text-zinc-400">{formatDate(collection.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {editingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Edit failed collection</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Changes apply to the next deployment retry.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                aria-label="Close editor"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:text-zinc-950 dark:border-zinc-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Name
                <input
                  value={editDraft.name}
                  onChange={event => setEditDraft(previous => ({ ...previous, name: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Symbol
                <input
                  value={editDraft.symbol}
                  onChange={event => setEditDraft(previous => ({
                    ...previous,
                    symbol: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
                  }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 font-mono text-sm text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Description
                <textarea
                  value={editDraft.description}
                  onChange={event => setEditDraft(previous => ({ ...previous, description: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Royalty preference
                <div className="mt-2 flex items-center rounded-md border border-zinc-200 bg-white pr-3 dark:border-zinc-800 dark:bg-[#050506]">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.25}
                    value={editDraft.royaltyBps / 100}
                    onChange={event => setEditDraft(previous => ({
                      ...previous,
                      royaltyBps: Math.round(Number(event.target.value) * 100),
                    }))}
                    className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-zinc-950 outline-none dark:text-white"
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyCollectionId === editingCollection.id}
                onClick={() => void saveEdit()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {busyCollectionId === editingCollection.id && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </section>
        </div>
      )}

      {saleCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                  {saleCollection.primarySale ? 'Primary sale configured' : 'Primary sale setup'}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {saleCollection.primarySale
                    ? 'This collection has an active primary USDC sale. Update the price only if you want to change the on-chain sale configuration.'
                    : 'Prepare the owner-signed USDC sale configuration.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaleCollection(null)}
                aria-label="Close sale setup"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:text-zinc-950 dark:border-zinc-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_160px]">
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Owner signer
                <input
                  readOnly
                  value={saleCollection.ownerAddress}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-600 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-300"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Price
                <div className="mt-2 flex items-center rounded-md border border-zinc-200 bg-white pr-3 dark:border-zinc-800 dark:bg-[#050506]">
                  <input
                    value={salePrice}
                    onChange={event => setSalePrice(event.target.value)}
                    className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-zinc-950 outline-none dark:text-white"
                  />
                  <span className="text-sm text-zinc-500">USDC</span>
                </div>
              </label>
            </div>

            {saleIntent && (
              <div className="mt-5 space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Required signer</span>
                  <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {saleIntent.autoSubmitted ? 'Submitted by local sponsor' : saleIntent.requiredSigners.join(', ')}
                  </p>
                </div>
                {saleIntent.autoSubmitted && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Transaction</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${saleIntent.autoSubmitted.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-brand-blue hover:underline"
                    >
                      {shortAddress(saleIntent.autoSubmitted.transactionHash)}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                <textarea
                  readOnly
                  value={saleIntent.serializedTransaction}
                  rows={5}
                  className="w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-300"
                />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(saleIntent.serializedTransaction)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <Copy className="h-4 w-4" />
                  Copy transaction
                </button>
                {!saleIntent.autoSubmitted && (
                  <button
                    type="button"
                    disabled={busyCollectionId === saleCollection.id}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    onClick={() => void signAndSubmitSaleConfig()}
                  >
                    {busyCollectionId === saleCollection.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Sign with wallet
                  </button>
                )}
              </div>
            )}

            {saleCollection.primarySale && !saleIntent && (
              <div className="mt-5 space-y-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Current sale</span>
                <p className="text-sm font-medium text-zinc-950 dark:text-white">
                  {atomicToUsdc(saleCollection.primarySale.priceAtomic)} USDC
                </p>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${saleCollection.primarySale.transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-blue hover:underline"
                >
                  {shortAddress(saleCollection.primarySale.transactionHash)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaleCollection(null)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busyCollectionId === saleCollection.id || Boolean(saleIntent?.autoSubmitted)}
                onClick={() => void prepareSaleConfig()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {busyCollectionId === saleCollection.id && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saleIntent?.autoSubmitted ? 'Sale configured' : saleCollection.primarySale ? 'Update sale' : 'Prepare sale'}
              </button>
            </div>
          </section>
        </div>
      )}

      {mintCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Mint token</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Prepare a creator mint for {mintCollection.name}. The minter wallet signs authorization; ZEXVRO sponsors the envelope fee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMintCollection(null)}
                aria-label="Close mint setup"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:text-zinc-950 dark:border-zinc-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Minter / operator
                <input
                  value={mintOperator}
                  onChange={event => setMintOperator(event.target.value.trim())}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Recipient
                <input
                  value={mintRecipient}
                  onChange={event => setMintRecipient(event.target.value.trim())}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Token ID
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={mintTokenId}
                  onChange={event => setMintTokenId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
            </div>

            {mintIntent && (
              <div className="mt-5 space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Required signer</span>
                  <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {mintIntent.autoSubmitted ? 'Submitted by local sponsor' : mintIntent.requiredSigners.join(', ')}
                  </p>
                </div>
                {(mintIntent.autoSubmitted || lastMintTxHash) && (
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Transaction</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${mintIntent.autoSubmitted?.transactionHash || lastMintTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-brand-blue hover:underline"
                    >
                      {shortAddress(mintIntent.autoSubmitted?.transactionHash || lastMintTxHash)}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                <textarea
                  readOnly
                  value={mintIntent.serializedTransaction}
                  rows={5}
                  className="w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-300"
                />
                {!mintIntent.autoSubmitted && (
                  <button
                    type="button"
                    disabled={busyCollectionId === mintCollection.id}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    onClick={() => void signAndSubmitMint()}
                  >
                    {busyCollectionId === mintCollection.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Sign with wallet
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMintCollection(null)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busyCollectionId === mintCollection.id || Boolean(mintIntent?.autoSubmitted)}
                onClick={() => void prepareMint()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {busyCollectionId === mintCollection.id && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {mintIntent?.autoSubmitted ? 'Minted' : 'Prepare mint'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
