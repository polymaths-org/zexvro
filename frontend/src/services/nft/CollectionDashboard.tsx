import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  CloudUpload,
  ExternalLink,
  Gamepad2,
  Image,
  LoaderCircle,
  Plus,
  RadioTower,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NftCollection } from '../../types';
import { loadCollections } from './collectionStore';
import {
  getNftServiceHealth,
  listNftCollections,
  type ApiNftCollection,
  type NftServiceHealth,
} from './nftApi';

interface CollectionDashboardProps {
  workspaceId: string;
  accessToken: string;
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
  if (error instanceof Error && error.message) return error.message;
  return 'NFT API unavailable';
}

const STATUS_STYLE = {
  deploying: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  live: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function CollectionDashboard({ workspaceId, accessToken }: CollectionDashboardProps) {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<ApiNftCollection[]>([]);
  const [browserDrafts, setBrowserDrafts] = useState<NftCollection[]>([]);
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');

  const loadRemoteData = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');

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
              setBrowserDrafts(loadCollections(workspaceId));
              void loadRemoteData(undefined, true);
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/services/nft/collections/new')}
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
            onClick={() => navigate('/services/nft/collections/new')}
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
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-3 font-medium">Collection</th>
                      <th className="px-3 py-3 font-medium">Items</th>
                      <th className="px-3 py-3 font-medium">Royalty</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Contract</th>
                      <th className="px-3 py-3 font-medium">Created</th>
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
    </div>
  );
}
