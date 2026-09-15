import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  GitFork, 
  Layers, 
  Zap, 
  Plus, 
  ArrowRight, 
  TrendingUp, 
  Compass, 
  Flame, 
  Database,
  Terminal,
  ShieldCheck,
  Code
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContractCard } from '../components/common/ContractCard';
import { GasStorageLens } from '../components/common/GasStorageLens';
import { ChainBadge } from '../components/common/ChainBadge';

export const ExplorePage: React.FC = () => {
  const { contracts, navigate, navigateToContract, navigateToFunction, openAiExplain } = useApp();
  const [selectedChainFilter, setSelectedChainFilter] = useState<'all' | 'stellar' | 'evm'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContracts = contracts.filter((c) => {
    if (selectedChainFilter === 'stellar' && c.chain !== 'stellar') return false;
    if (selectedChainFilter === 'evm' && c.chain === 'stellar') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.contractId.toLowerCase().includes(q) ||
      c.owner.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Trending functions across indexed contracts (empty until the registry fills)
  const trendingFunctions = contracts
    .slice(0, 4)
    .map((contract) => ({ contract, fn: contract.functions[0] }))
    .filter((t) => t.fn);

  // Live registry stats — honest counts, no seed numbers
  const chainCount = new Set(contracts.map((c) => `${c.chain}:${c.network}`)).size;
  const functionCount = contracts.reduce((n, c) => n + c.functions.length, 0);
  const forkCount = contracts.reduce((n, c) => n + c.forksCount, 0);

  // Most-forked contracts drive the remix strip
  const topRemixed = [...contracts]
    .sort((a, b) => b.forksCount - a.forksCount)
    .slice(0, 3);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-12">
      {/* Hero Section: The GitHub for smart contracts */}
      <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        {/* Track pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[9999px] bg-[#111113] border border-[#27272A] text-xs text-[#A1A1AA]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span>Handshake • Code-first contract hub</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#FAFAFA] tracking-tight">
          The GitHub for smart contracts.
        </h1>

        <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed max-w-2xl mx-auto">
          Discover any contract by <span className="text-[#FAFAFA] font-medium">chain + network + contract ID</span>. Read source function-by-function, compare gas architectures, dry-run invokes, and publish code-first.
        </p>

        {/* Search Bar + Chain Filter Pills */}
        <div className="pt-2 max-w-xl mx-auto space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#71717A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts (e.g. soroban-amm, uniswap, C...)"
              className="w-full pl-10 pr-24 py-2.5 rounded-[8px] bg-[#0E0E10] border border-[#27272A] hover:border-[#3F3F46] focus:border-[#3B82F6] text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none transition-all shadow-inner"
            />
            <button
              type="button"
              onClick={() => navigate({ page: 'browse' })}
              className="absolute right-2 px-3 py-1 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-xs text-[#FAFAFA] border border-[#27272A] transition-colors"
            >
              Browse
            </button>
          </div>

          {/* Chain filter pills */}
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono">
            <span className="text-[#71717A] mr-1 text-[11px]">Filter:</span>
            {(['all', 'stellar', 'evm'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedChainFilter(filter)}
                className={`px-3 py-1 rounded-[9999px] transition-all capitalize ${
                  selectedChainFilter === filter
                    ? 'bg-[#FAFAFA] text-[#050505] font-semibold'
                    : 'bg-[#111113] text-[#A1A1AA] border border-[#27272A] hover:text-[#FAFAFA]'
                }`}
              >
                {filter === 'all' ? 'All Chains' : filter === 'stellar' ? 'Stellar (Soroban)' : 'EVM (Ethereum/Base)'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row (live registry counts) */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto font-mono text-center">
          <div className="p-3 rounded-[8px] bg-[#0A0A0B] border border-[#27272A]">
            <div className="text-xl sm:text-2xl font-bold text-[#FAFAFA]">{contracts.length.toLocaleString()}</div>
            <div className="text-[11px] text-[#71717A] mt-0.5">Contracts Indexed</div>
          </div>
          <div className="p-3 rounded-[8px] bg-[#0A0A0B] border border-[#27272A]">
            <div className="text-xl sm:text-2xl font-bold text-[#FAFAFA]">{chainCount}</div>
            <div className="text-[11px] text-[#71717A] mt-0.5">Chains & Networks</div>
          </div>
          <div className="p-3 rounded-[8px] bg-[#0A0A0B] border border-[#27272A]">
            <div className="text-xl sm:text-2xl font-bold text-[#FAFAFA]">{functionCount.toLocaleString()}</div>
            <div className="text-[11px] text-[#71717A] mt-0.5">Functions Parsed</div>
          </div>
          <div className="p-3 rounded-[8px] bg-[#0A0A0B] border border-[#27272A]">
            <div className="text-xl sm:text-2xl font-bold text-[#FAFAFA]">{forkCount.toLocaleString()}</div>
            <div className="text-[11px] text-[#71717A] mt-0.5">Forks & Remixes</div>
          </div>
        </div>
      </section>

      {/* Featured Contracts Section (Hugging Face Card Style) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">Featured Smart Contracts</h2>
            <span className="text-xs text-[#71717A] font-mono">({filteredContracts.length})</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'browse' })}
            className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-medium"
          >
            <span>View all contracts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="p-10 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-3">
            <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-sm text-[#FAFAFA] font-medium">No contracts yet — publish one</p>
            <p className="text-xs text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
              The registry is empty. Publish the first contract and it becomes discoverable here by chain + contract ID.
            </p>
            <button
              type="button"
              onClick={() => navigate({ page: 'publish' })}
              className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Publish Your Contract</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </section>

      {/* Novel Deep-Think Feature: Trending Functions Strip */}
      {trendingFunctions.length > 0 && (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">Trending Functions Strip</h2>
            <span className="text-xs text-[#71717A] font-mono">Code-First Inspection</span>
          </div>
          <span className="text-xs text-[#71717A]">Most studied this week</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {trendingFunctions.map(({ contract, fn }) => (
            <div
              key={contract.id + fn.id}
              onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
              className="p-3.5 rounded-[8px] bg-[#0E0E10] border border-[#27272A] hover:border-[#3F3F46] cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-[#A1A1AA]">{contract.name}</span>
                    <span className="text-[#71717A]">::</span>
                    <span className="text-[#FAFAFA] font-semibold group-hover:text-[#3B82F6] transition-colors">
                      {fn.name}()
                    </span>
                  </div>
                  <ChainBadge
                    chain={contract.chain}
                    network={contract.network}
                    contractId={contract.contractId}
                    truncateId={true}
                    showCopy={false}
                  />
                </div>

                <div className="p-2.5 rounded bg-[#0A0A0B] border border-[#27272A] text-xs text-[#93C5FD] truncate mb-2">
                  {fn.signature}
                </div>

                <p className="text-xs text-[#A1A1AA] line-clamp-1 mb-2">
                  {fn.docExcerpt}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
                <GasStorageLens fn={fn} compact={false} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAiExplain(contract, fn);
                  }}
                  className="text-[11px] text-[#A1A1AA] hover:text-[#3B82F6] flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                  <span>Explain</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Remix / Fork Strip (most-forked indexed contracts) */}
      {topRemixed.length > 0 && (
      <section className="p-5 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-base font-semibold text-[#FAFAFA]">Active Remix & Fork Streams</h2>
          </div>
          <span className="text-xs text-[#71717A]">Live provenance graph</span>
        </div>

        <p className="text-xs text-[#A1A1AA]">
          Smart contracts on Handshake are forked like open-source repositories. Trace how developers remix published contracts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {topRemixed.map((contract, i) => (
            <div
              key={contract.id}
              onClick={() => navigateToContract(contract.chain, contract.contractId, 'forks')}
              className="p-3 rounded bg-[#111113] border border-[#27272A] hover:border-[#3B82F6]/40 cursor-pointer transition-colors"
            >
              <div className="text-[10px] text-[#71717A] uppercase mb-1">
                {i === 0 ? 'Most Forked' : `Top Fork #${i + 1}`}
              </div>
              <div className="font-semibold text-[#FAFAFA] truncate">{contract.owner} / {contract.name}</div>
              <div className="text-[11px] text-[#22C55E] mt-1">{contract.forksCount} active forks</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Call to Action Banner */}
      <section className="p-6 sm:p-8 rounded-[8px] bg-[#0E0E10] border border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="space-y-1 max-w-xl">
          <h3 className="text-lg font-bold text-[#FAFAFA]">Have a contract deployed on Stellar or EVM?</h3>
          <p className="text-xs sm:text-sm text-[#A1A1AA]">
            Publish your contract code and verified bytecode to Handshake. Index functions, expose test suites, and invite developers to fork.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate({ page: 'publish' })}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Publish Your Contract</span>
        </button>
      </section>
    </div>
  );
};
