import React from 'react';
import {
  ArrowRight,
  Flame,
  Eye,
  User,
  Activity,
  GitFork,
  Compass,
  Plus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { prettyName } from '../utils/avatar';
import { ContractCard } from '../components/common/ContractCard';
import { ChainBadge } from '../components/common/ChainBadge';
import { GasStorageLens } from '../components/common/GasStorageLens';

export const HomePage: React.FC = () => {
  const {
    contracts,
    likedContractIds,
    navigate,
    navigateToFunction,
    notifications,
    sessionUser
  } = useApp();

  const me = sessionUser || 'alex-dev';
  const myContracts = contracts.filter((c) => c.owner === me);
  const watchedContracts = contracts.filter((c) => likedContractIds.includes(c.id));
  const trendingContracts = [...contracts]
    .sort((a, b) => b.stars + b.forksCount - (a.stars + a.forksCount))
    .slice(0, 3);

  const trendingFunctions = trendingContracts.map((contract) => ({
    contract,
    fn: contract.functions[0]
  })).filter((t) => t.fn);

  const recentActivity = notifications.slice(0, 4);

  const topRemix = [...contracts].sort((a, b) => b.forksCount - a.forksCount)[0];

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-10">
      {/* Header */}
      <section className="space-y-1.5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
          Home
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FAFAFA] tracking-tight">
          Welcome back, {prettyName(me).split(' ')[0]}.
        </h1>
        <p className="text-sm text-[#A1A1AA]">
          Your contracts, watched repos, and what's trending across the hub.
        </p>
      </section>

      {/* My Contracts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">My Contracts</h2>
            <span className="text-xs text-[#71717A] font-mono">({myContracts.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'publish' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold transition-colors shadow-[0_1px_6px_rgba(59,130,246,0.45)] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New contract</span>
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'profile', username: me })}
              className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {myContracts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-2">
            <p className="text-sm text-[#FAFAFA] font-medium">No contracts published yet</p>
            <p className="text-xs text-[#A1A1AA]">Publish your first contract to see it here.</p>
            <button
              type="button"
              onClick={() => navigate({ page: 'publish' })}
              className="mt-1 px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all"
            >
              Publish a contract
            </button>
          </div>
        )}
      </section>

      {/* Watched Contracts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">Watched Contracts</h2>
            <span className="text-xs text-[#71717A] font-mono">({watchedContracts.length})</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'browse' })}
            className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-medium"
          >
            <span>Browse all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {watchedContracts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchedContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-2">
            <p className="text-sm text-[#FAFAFA] font-medium">Nothing watched yet</p>
            <p className="text-xs text-[#A1A1AA]">Like a contract anywhere to watch it from Home.</p>
          </div>
        )}
      </section>

      {/* Trending Contracts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">Trending Contracts</h2>
            <span className="text-xs text-[#71717A] font-mono">Most starred + forked</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-medium"
          >
            <span>Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingContracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      </section>

      {/* Trending functions + Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trending functions */}
        <div className="p-5 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#F59E0B]" />
              <h2 className="text-sm font-semibold text-[#FAFAFA]">Trending Functions</h2>
            </div>
            <span className="text-[11px] text-[#71717A]">Most studied this week</span>
          </div>
          <div className="space-y-2">
            {trendingFunctions.map(({ contract, fn }) => (
              <div
                key={contract.id + fn.id}
                onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                className="p-3 rounded-[6px] bg-[#111113] border border-[#27272A] hover:border-[#3B82F6]/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-xs truncate">
                    <span className="text-[#A1A1AA] truncate">{contract.name}</span>
                    <span className="text-[#71717A]">::</span>
                    <span className="text-[#FAFAFA] font-semibold">{fn.name}()</span>
                  </div>
                  <ChainBadge
                    chain={contract.chain}
                    network={contract.network}
                    contractId={contract.contractId}
                    truncateId={true}
                    showCopy={false}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
                  <GasStorageLens fn={fn} compact={true} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity + remixes */}
        <div className="space-y-4">
          <div className="p-5 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3B82F6]" />
                <h2 className="text-sm font-semibold text-[#FAFAFA]">Recent Activity</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate({ page: 'notifications' })}
                className="text-[11px] text-[#3B82F6] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-[#71717A] p-2.5">No activity yet — forks, stars, and mentions will show up here.</p>
              ) : (
                recentActivity.map((n) => (
                <div
                  key={n.id}
                  onClick={() => navigate({ page: 'notifications' })}
                  className="p-2.5 rounded-[6px] hover:bg-[#18181B] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[#71717A] text-[10px] font-mono mb-0.5">
                    <span className="uppercase text-[#A1A1AA]">{n.type}</span>
                    <span>{n.time}</span>
                  </div>
                  <p className="text-xs font-medium text-[#FAFAFA] line-clamp-1">{n.title}</p>
                  <p className="text-[#A1A1AA] text-[11px] line-clamp-1">{n.description}</p>
                </div>
              ))
              )}
            </div>
          </div>

          <div className="p-5 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] space-y-3">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-[#3B82F6]" />
              <h2 className="text-sm font-semibold text-[#FAFAFA]">Top Remix Stream</h2>
            </div>
            {topRemix ? (
              <div
                onClick={() => navigate({ page: 'explore' })}
                className="p-3 rounded bg-[#111113] border border-[#27272A] hover:border-[#3B82F6]/40 cursor-pointer transition-colors"
              >
                <div className="text-[10px] text-[#71717A] uppercase mb-1">Most forked this week</div>
                <div className="text-xs font-semibold text-[#FAFAFA] truncate">{topRemix.owner} / {topRemix.name}</div>
                <div className="text-[11px] text-[#22C55E] mt-1">{topRemix.forksCount} active forks</div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A]">No remixes yet — fork a published contract to start a stream.</p>
            )}
            <button
              type="button"
              onClick={() => navigate({ page: 'explore' })}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              Discover more contracts
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
