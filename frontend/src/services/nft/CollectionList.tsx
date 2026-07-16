import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CircleAlert,
  Image,
  Plus,
  RefreshCw,
} from 'lucide-react';
import SectionSkeleton from '../../components/ui/SectionSkeleton';
import {
  getNftServiceHealth,
  listNftCollections,
  type ApiNftCollection,
  type NftServiceHealth,
} from './nftApi';

interface CollectionListProps {
  workspaceId: string;
  accessToken: string;
  onCreate: () => void;
  onOpenDashboard: (collectionId: string) => void;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    // Surface real API/auth failures; avoid bare "200" looking like success.
    return error.message;
  }
  return 'NFT API unavailable';
}

const STATUS_STYLE = {
  deploying: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  live: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  archived: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

export default function CollectionList({
  workspaceId,
  accessToken,
  onCreate,
  onOpenDashboard,
}: CollectionListProps) {
  const [collections, setCollections] = useState<ApiNftCollection[]>([]);
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');

  const load = useCallback(async (signal?: AbortSignal, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');
    try {
      const [healthResult, listResult] = await Promise.all([
        getNftServiceHealth(signal),
        listNftCollections(workspaceId, accessToken, signal),
      ]);
      if (signal?.aborted) return;
      setHealth(healthResult);
      setCollections(listResult);
    } catch (error) {
      if (!signal?.aborted) {
        setCollections([]);
        setApiError(errorMessage(error));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">NFT Collections</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Create a collection, then open its dashboard for deploy, sales, mints, and integration links.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Refresh"
            disabled={refreshing}
            onClick={() => void load(undefined, true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            <Plus className="h-4 w-4" />
            New collection
          </button>
        </div>
      </header>

      {apiError && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {apiError}
          <button type="button" onClick={() => void load(undefined, true)} className="ml-auto text-xs underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <SectionSkeleton rows={4} label="Loading collections" />
      ) : collections.length === 0 ? (
        <section className="border-y border-zinc-200 py-16 text-center dark:border-zinc-900">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 text-brand-blue dark:border-zinc-800">
            <Boxes className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">No collections yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Add name, logo, and price — then manage everything from the collection dashboard.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            Create collection <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {collections.map((collection) => (
            <li key={collection.id}>
              <button
                type="button"
                onClick={() => onOpenDashboard(collection.id)}
                className="flex w-full flex-col gap-4 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {collection.coverImageUri.startsWith('http') ? (
                    <img
                      src={collection.coverImageUri}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 dark:border-zinc-800">
                      <Image className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-zinc-950 dark:text-white">{collection.name}</p>
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[collection.status]}`}>
                        {collection.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{collection.symbol} · {collection.id}</p>
                  </div>
                </div>
                <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950">
                  NFT Dashboard
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {health && (
        <p className="text-xs text-zinc-500">
          API connected · Stellar {health?.capabilities?.stellarConfigured ? 'ready' : 'not configured'} · storage {health?.capabilities?.storageMode || '—'}
        </p>
      )}
    </div>
  );
}
