import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CircleAlert,
  Edit3,
  Image,
  Plus,
  RefreshCw,
  Settings,
  X,
  LoaderCircle,
} from 'lucide-react';
import SectionSkeleton from '../../components/ui/SectionSkeleton';
import { useProjectStore } from '../../stores/project';
import {
  getNftServiceHealth,
  listNftCollections,
  updateNftCollection,
  type ApiNftCollection,
  type NftServiceHealth,
  nftNetworkLabel,
  getNftNetworkPreference,
  setNftNetworkPreference,
} from './nftApi';

interface CollectionListProps {
  workspaceId: string;
  accessToken: string;
  onCreate: () => void;
  onOpenDashboard: (collectionId: string) => void;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
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
  const projects = useProjectStore(s => s.projects);
  const [collections, setCollections] = useState<ApiNftCollection[]>([]);
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nftNetPref, setNftNetPref] = useState<'testnet' | 'mainnet'>(() => getNftNetworkPreference());
  const [settingsMsg, setSettingsMsg] = useState('');
  const [editing, setEditing] = useState<ApiNftCollection | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', symbol: '', description: '', royaltyBps: 0 });
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  useEffect(() => {
    // Hydrate Freighter pref from any project under this workspace scope
    const wsId = workspaceId.includes(':') ? workspaceId.split(':')[0] : workspaceId;
    const project = projects.find(p => p.workspaceId === wsId && (p.enabledServices || []).includes('srv-nft'))
      || projects.find(p => p.workspaceId === wsId);
    const pref = project?.serviceNetworks?.nfto
      || (String(project?.network || '').toLowerCase().includes('main') ? 'mainnet' : undefined);
    if (pref === 'mainnet' || pref === 'testnet') {
      setNftNetworkPreference(pref);
      setNftNetPref(pref);
    }
  }, [projects, workspaceId]);

  const applyNetworkPref = (env: 'testnet' | 'mainnet') => {
    setNftNetworkPreference(env);
    setNftNetPref(env);
    const wsId = workspaceId.includes(':') ? workspaceId.split(':')[0] : workspaceId;
    const project = projects.find(p => p.workspaceId === wsId && (p.enabledServices || []).includes('srv-nft'))
      || projects.find(p => p.workspaceId === wsId);
    if (project) {
      useProjectStore.getState().updateProject(project.id, {
        serviceNetworks: {
          ...(project.serviceNetworks || {}),
          nfto: env,
        },
      });
    }
    setSettingsMsg(
      `Freighter preference → ${env === 'mainnet' ? 'Mainnet' : 'Testnet'}. Hosted API: ${nftNetworkLabel(health)}.`,
    );
  };

  const openEdit = (collection: ApiNftCollection) => {
    setEditing(collection);
    setEditDraft({
      name: collection.name,
      symbol: collection.symbol,
      description: collection.description || '',
      royaltyBps: collection.royaltyBps ?? 0,
    });
    setSaveError('');
    setSettingsOpen(false);
  };

  const saveEdit = async () => {
    if (!editing || !editDraft.name.trim()) return;
    setSaveBusy(true);
    setSaveError('');
    try {
      await updateNftCollection(editing.id, {
        name: editDraft.name.trim(),
        symbol: editDraft.symbol.trim().toUpperCase(),
        description: editDraft.description.trim(),
        royaltyBps: editDraft.royaltyBps,
      }, accessToken);
      setEditing(null);
      setSettingsMsg('Collection metadata saved.');
      await load(undefined, true);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">NFTo</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Create a collection, then open its dashboard for deploy, sales, mints, and integration links.
            Network: {nftNetworkLabel(health)} API · Freighter {nftNetPref === 'mainnet' ? 'Mainnet' : 'Testnet'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSettingsMsg('');
              setSettingsOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
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

      {settingsMsg ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{settingsMsg}</p>
      ) : null}

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
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              Create collection <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {collections.map((collection) => (
            <li key={collection.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => onOpenDashboard(collection.id)}
                className="flex min-w-0 flex-1 flex-col gap-4 text-left transition hover:opacity-90 sm:flex-row sm:items-center"
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
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(collection)}
                  title="Rename / edit metadata"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDashboard(collection.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
                >
                  NFT Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {health && (
        <p className="text-xs text-zinc-500">
          API connected · Stellar {health?.capabilities?.stellarConfigured ? nftNetworkLabel(health) : 'not configured'} · storage {health?.capabilities?.storageMode || '—'}
        </p>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">NFTo settings</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Switch Freighter network, check service status, rename collections.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Freighter network</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Used when signing mint / sale. Hosted API rail:{' '}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{nftNetworkLabel(health)}</span>.
                </p>
                <div className="mt-3 inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
                  {(['testnet', 'mainnet'] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => applyNetworkPref(env)}
                      className={`rounded px-3 py-1.5 text-[11px] font-semibold transition ${
                        nftNetPref === env
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      {env === 'mainnet' ? 'Mainnet' : 'Testnet'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Service</p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">API</dt>
                    <dd className="font-medium text-zinc-800 dark:text-zinc-200">{health ? 'Connected' : 'Unavailable'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Stellar rail</dt>
                    <dd className="font-medium text-zinc-800 dark:text-zinc-200">
                      {health?.capabilities?.stellarConfigured ? nftNetworkLabel(health) : 'Not configured'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Storage</dt>
                    <dd className="font-medium capitalize text-zinc-800 dark:text-zinc-200">
                      {health?.capabilities?.storageMode || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Rename collection</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Update name, symbol, description, and royalty display metadata.
                </p>
                {collections.length === 0 ? (
                  <p className="mt-3 text-xs text-zinc-500">No collections yet.</p>
                ) : (
                  <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
                    {collections.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 text-left text-xs transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-900 dark:text-white">{c.name}</span>
                            <span className="font-mono text-[10px] text-zinc-400">{c.symbol} · {c.status}</span>
                          </span>
                          <Edit3 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <section className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Collection settings</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {editing.status === 'live'
                    ? 'Rename dashboard metadata. On-chain contract name stays fixed after deploy.'
                    : 'Update collection metadata.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Name
                <input
                  value={editDraft.name}
                  onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Symbol
                <input
                  value={editDraft.symbol}
                  disabled={editing.status === 'live'}
                  onChange={e => setEditDraft(d => ({
                    ...d,
                    symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
                  }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 font-mono text-sm outline-none disabled:opacity-60 dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Description
                <textarea
                  value={editDraft.description}
                  onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Royalty %
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  value={editDraft.royaltyBps / 100}
                  onChange={e => setEditDraft(d => ({
                    ...d,
                    royaltyBps: Math.round(Number(e.target.value) * 100),
                  }))}
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-white"
                />
              </label>
              {saveError ? <p className="text-xs text-red-500">{saveError}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 rounded-md border border-zinc-200 px-4 text-sm dark:border-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveBusy || !editDraft.name.trim()}
                onClick={() => void saveEdit()}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                {saveBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
