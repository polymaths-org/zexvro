import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Gamepad2,
  Image,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NftCollection } from '../../types';
import { loadCollections } from './collectionStore';

interface CollectionDashboardProps {
  workspaceId: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export default function CollectionDashboard({ workspaceId }: CollectionDashboardProps) {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<NftCollection[]>([]);

  useEffect(() => {
    setCollections(loadCollections(workspaceId));
  }, [workspaceId]);

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
            Prepare game asset collections for Stellar. Drafts stay in this browser until contract deployment is connected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/services/nft/collections/new')}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          New collection
        </button>
      </header>

      {collections.length === 0 ? (
        <section className="border-y border-zinc-200 py-16 text-center dark:border-zinc-900 sm:py-24">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-blue dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <Boxes className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">No collections yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Create a local collection draft with its identity, cover artwork, and royalty preference. Nothing will be sent on-chain.
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
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Workspace collections</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{collections.length} local draft{collections.length === 1 ? '' : 's'}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Browser storage only
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Collection</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Royalty</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {collections.map((collection) => (
                  <tr key={collection.id} className="transition hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40">
                          <Image className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-950 dark:text-white">{collection.name}</span>
                          <span className="mt-0.5 block font-mono text-xs text-zinc-500 dark:text-zinc-400">{collection.symbol}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-300">{collection.itemCount}</td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <CircleDollarSign className="h-3.5 w-3.5 text-zinc-400" />
                        {(collection.royaltyBps / 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Draft
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400">
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
    </div>
  );
}
