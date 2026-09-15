import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  ShieldCheck, 
  ArrowUpDown, 
  Layers,
  Code,
  Star,
  GitFork,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContractCard } from '../components/common/ContractCard';
import { ChainBadge } from '../components/common/ChainBadge';
import { LanguageBadge } from '../components/common/LanguageBadge';
import { CHAINS } from '../data/chains';
import { LANGUAGES } from '../data/languages';
import { SmartContract } from '../types';

export const BrowsePage: React.FC = () => {
  const { contracts, navigateToContract } = useApp();

  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'stars' | 'forks' | 'recent' | 'name'>('stars');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    contracts.forEach((c) => c.tags.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts
      .filter((c) => {
        if (chainFilter !== 'all' && c.chain !== chainFilter) return false;
        if (networkFilter !== 'all' && c.network !== networkFilter) return false;
        if (languageFilter !== 'all' && !c.language.toLowerCase().includes(languageFilter.toLowerCase())) return false;
        if (verifiedOnly && !c.verified) return false;
        if (selectedTag !== 'all' && !c.tags.includes(selectedTag)) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.contractId.toLowerCase().includes(q) ||
          c.owner.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'stars') return b.stars - a.stars;
        if (sortBy === 'forks') return b.forksCount - a.forksCount;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0; // default order
      });
  }, [contracts, chainFilter, networkFilter, languageFilter, verifiedOnly, selectedTag, sortBy, search]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-6 pb-20 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#FAFAFA] flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#3B82F6]" />
            Smart Contract Directory
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1 font-mono">
            Showing {filteredContracts.length} verified and indexed contracts across Web3
          </p>
        </div>

        {/* View toggle & Sort */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-[6px] border border-[#27272A] bg-[#111113] p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-[#27272A] text-[#FAFAFA]' : 'text-[#71717A] hover:text-[#FAFAFA]'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-[#27272A] text-[#FAFAFA]' : 'text-[#71717A] hover:text-[#FAFAFA]'
              }`}
              title="Dense list view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#71717A]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#111113] border border-[#27272A] rounded-[6px] px-2.5 py-1.5 text-[#FAFAFA] focus:outline-none"
            >
              <option value="stars">Most Starred</option>
              <option value="forks">Most Forked</option>
              <option value="recent">Recently Updated</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Filters + Right Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Filter Rail */}
        <div className="lg:col-span-1 space-y-5 text-xs">
          
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block">
              Search Catalog
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#71717A]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-[6px] bg-[#0E0E10] border border-[#27272A] text-xs text-[#FAFAFA] font-mono placeholder:text-[#52525B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>
          </div>

          {/* Chain Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block">
              Chain Platform
            </label>
            <div className="space-y-1 font-mono max-h-72 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => setChainFilter('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
                  chainFilter === 'all'
                    ? 'bg-[#18181B] text-[#FAFAFA] font-semibold border border-[#3F3F46]'
                    : 'text-[#A1A1AA] hover:bg-[#111113] hover:text-[#FAFAFA]'
                }`}
              >
                <span>All Chains</span>
                {chainFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
              </button>
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChainFilter(c.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
                    chainFilter === c.id
                      ? 'bg-[#18181B] text-[#FAFAFA] font-semibold border border-[#3F3F46]'
                      : 'text-[#A1A1AA] hover:bg-[#111113] hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <img
                      src={c.logo}
                      alt={`${c.name} logo`}
                      className="w-4 h-4 rounded-full object-cover bg-[#0A0A0B] shrink-0"
                      loading="lazy"
                    />
                    <span className="truncate">{c.name}</span>
                  </span>
                  {chainFilter === c.id && <Check className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Network Tier */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block">
              Network
            </label>
            <div className="flex gap-1.5 font-mono">
              {['all', 'pubnet', 'testnet'].map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetworkFilter(net)}
                  className={`flex-1 py-1 rounded capitalize transition-colors text-center ${
                    networkFilter === net
                      ? 'bg-[#27272A] text-[#FAFAFA] font-medium'
                      : 'bg-[#111113] text-[#71717A] hover:text-[#FAFAFA]'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block">
              Smart Contract Language
            </label>
            <div className="space-y-1 font-mono max-h-72 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => setLanguageFilter('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
                  languageFilter === 'all'
                    ? 'bg-[#18181B] text-[#FAFAFA] font-semibold border border-[#3F3F46]'
                    : 'text-[#A1A1AA] hover:bg-[#111113] hover:text-[#FAFAFA]'
                }`}
              >
                <span>All Languages</span>
                {languageFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
              </button>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguageFilter(lang.filterKey)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] transition-colors ${
                    languageFilter === lang.filterKey
                      ? 'bg-[#18181B] text-[#FAFAFA] font-semibold border border-[#3F3F46]'
                      : 'text-[#A1A1AA] hover:bg-[#111113] hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <LanguageBadge language={lang.id} size="xs" showLabel={false} />
                    <span className="truncate">{lang.id}</span>
                  </span>
                  {languageFilter === lang.filterKey && <Check className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Verified Toggle */}
          <div className="pt-2 border-t border-[#27272A]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded bg-[#111113] border-[#27272A] text-[#22C55E] focus:ring-0"
              />
              <span className="text-xs text-[#FAFAFA] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                Verified contracts only
              </span>
            </label>
          </div>

          {/* Tags */}
          <div className="pt-2 border-t border-[#27272A] space-y-1.5">
            <label className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider block">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 font-mono">
              <button
                type="button"
                onClick={() => setSelectedTag('all')}
                className={`px-2 py-0.5 rounded-[9999px] text-[11px] ${
                  selectedTag === 'all'
                    ? 'bg-[#FAFAFA] text-[#050505] font-semibold'
                    : 'bg-[#111113] text-[#71717A] border border-[#27272A]'
                }`}
              >
                all
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2 py-0.5 rounded-[9999px] text-[11px] ${
                    selectedTag === tag
                      ? 'bg-[#3B82F6] text-[#FAFAFA] font-semibold'
                      : 'bg-[#111113] text-[#71717A] border border-[#27272A] hover:text-[#FAFAFA]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Catalog View */}
        <div className="lg:col-span-3">
          {filteredContracts.length === 0 ? (
            <div className="p-12 text-center rounded-[8px] bg-[#0A0A0B] border border-[#27272A] space-y-3">
              <Layers className="w-8 h-8 text-[#71717A] mx-auto opacity-50" />
              <p className="text-sm font-semibold text-[#FAFAFA]">No smart contracts found</p>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                No indexed contracts matched your filter criteria. Try resetting chain or tag filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setChainFilter('all');
                  setNetworkFilter('all');
                  setLanguageFilter('all');
                  setVerifiedOnly(false);
                  setSelectedTag('all');
                }}
                className="px-3 py-1.5 rounded-[6px] bg-[#18181B] text-xs font-mono text-[#FAFAFA] hover:bg-[#27272A]"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            </div>
          ) : (
            /* Dense Table List View */
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111113] border-b border-[#27272A] text-[#71717A]">
                  <tr>
                    <th className="py-2.5 px-3">Contract</th>
                    <th className="py-2.5 px-3">Chain & ID</th>
                    <th className="py-2.5 px-3">Language</th>
                    <th className="py-2.5 px-3 text-right">Stars</th>
                    <th className="py-2.5 px-3 text-right">Forks</th>
                    <th className="py-2.5 px-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {filteredContracts.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigateToContract(c.chain, c.contractId)}
                      className="hover:bg-[#18181B] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#FAFAFA] hover:text-[#3B82F6]">
                          {c.owner}/{c.name}
                        </div>
                        <div className="text-[11px] text-[#71717A] truncate max-w-xs font-sans">
                          {c.tagline}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <ChainBadge
                          chain={c.chain}
                          network={c.network}
                          contractId={c.contractId}
                          truncateId={true}
                          showCopy={false}
                        />
                      </td>
                      <td className="py-3 px-3 text-[#A1A1AA]">{c.language}</td>
                      <td className="py-3 px-3 text-right font-medium text-[#FAFAFA]">
                        ★ {c.stars}
                      </td>
                      <td className="py-3 px-3 text-right text-[#A1A1AA]">
                        {c.forksCount}
                      </td>
                      <td className="py-3 px-3 text-right text-[#71717A]">{c.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
