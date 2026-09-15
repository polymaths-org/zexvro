import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Code,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Tag,
  Compass,
  Plus,
  Layers,
  Users,
  Star,
  GitFork,
  Eye,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowUpDown,
  BarChart3
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContractCard } from '../components/common/ContractCard';
import { ChainBadge } from '../components/common/ChainBadge';
import { Dropdown } from '../components/ui/Dropdown';
import { CHAINS } from '../data/chains';
import { SmartContract } from '../types';

type Scope = 'all' | 'contracts' | 'functions' | 'publishers';
type Sort = 'relevant' | 'stars' | 'forks' | 'watched';

interface Publisher {
  name: string;
  avatar: string;
  contractCount: number;
  totalStars: number;
}

const SORTS: Array<{ id: Sort; label: string; hint: string }> = [
  { id: 'relevant', label: 'Relevant', hint: 'Best match first' },
  { id: 'stars', label: 'Stars', hint: 'Most starred first' },
  { id: 'forks', label: 'Forks', hint: 'Most forked first' },
  { id: 'watched', label: 'Watched', hint: 'Most watched first' },
];

const dropdownTriggerCls =
  'flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#111113] border border-[#27272A] hover:border-[#3F3F46] text-xs text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors font-mono';

export const SearchPage: React.FC = () => {
  const {
    route,
    navigate,
    contracts,
    navigateToContract,
    navigateToFunction,
  } = useApp();

  const [query, setQuery] = useState(route.searchQuery || '');
  const [chain, setChain] = useState(route.chain || 'all');
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<Sort>('relevant');
  const inputRef = useRef<HTMLInputElement>(null);

  // Pick up shared / back-button URLs (#/search?q=..&chain=..)
  useEffect(() => {
    setQuery(route.searchQuery || '');
    setChain(route.chain || 'all');
  }, [route.searchQuery, route.chain]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const syncUrl = (q: string, c: string) => {
    navigate(
      {
        page: 'search',
        searchQuery: q.trim() ? q.trim() : undefined,
        chain: c !== 'all' ? c : undefined,
      },
      { replace: true }
    );
  };

  const q = query.trim().toLowerCase();

  const chainFiltered = useMemo(
    () => (chain === 'all' ? contracts : contracts.filter((c) => c.chain === chain)),
    [contracts, chain]
  );

  const matchedContracts = useMemo(() => {
    if (!q) {
      // Browsing (no query): order by the active metric, relevance = traction.
      const list = [...chainFiltered];
      if (sort === 'stars') list.sort((a, b) => b.stars - a.stars);
      else if (sort === 'forks') list.sort((a, b) => b.forksCount - a.forksCount);
      else if (sort === 'watched') list.sort((a, b) => b.likes - a.likes);
      else list.sort((a, b) => b.stars + b.forksCount - (a.stars + a.forksCount));
      return list;
    }
    // Tiered relevance: exact > prefix > field-weight (name > id > tags > description).
    const scored = chainFiltered
      .map((c) => {
        let score = 0;
        const name = c.name.toLowerCase();
        if (name === q) score += 12;
        else if (name.startsWith(q)) score += 6;
        else if (name.includes(q)) score += 3;
        const cid = c.contractId.toLowerCase();
        if (cid === q) score += 10;
        else if (cid.includes(q)) score += 2;
        if (c.owner.toLowerCase().includes(q)) score += 1;
        if (c.tags.some((t) => t.toLowerCase().includes(q))) score += 1.5;
        if (c.tagline.toLowerCase().includes(q)) score += 0.5;
        if (c.description.toLowerCase().includes(q)) score += 1;
        return { c, score };
      })
      .filter((s) => s.score > 0);
    if (sort === 'stars') scored.sort((a, b) => b.c.stars - a.c.stars || b.score - a.score);
    else if (sort === 'forks') scored.sort((a, b) => b.c.forksCount - a.c.forksCount || b.score - a.score);
    else if (sort === 'watched') scored.sort((a, b) => b.c.likes - a.c.likes || b.score - a.score);
    else scored.sort((a, b) => b.score - a.score || b.c.stars - a.c.stars);
    return scored.map((s) => s.c);
  }, [chainFiltered, q, sort]);

  const matchedFunctions = useMemo(() => {
    if (!q) return [];
    const out: Array<{ contract: SmartContract; fn: SmartContract['functions'][number]; score: number }> = [];
    chainFiltered.forEach((c) => {
      c.functions.forEach((f) => {
        const fname = f.name.toLowerCase();
        let score = 0;
        if (fname === q) score += 8;
        else if (fname.startsWith(q)) score += 5;
        else if (fname.includes(q)) score += 3;
        if (f.signature.toLowerCase().includes(q)) score += 1.5;
        if (score > 0) out.push({ contract: c, fn: f, score });
      });
    });
    // Relevance first; the active metric re-orders (parent traction as proxy).
    if (sort === 'stars') out.sort((a, b) => b.contract.stars - a.contract.stars || b.score - a.score);
    else if (sort === 'forks') out.sort((a, b) => b.contract.forksCount - a.contract.forksCount || b.score - a.score);
    else if (sort === 'watched') out.sort((a, b) => b.contract.likes - a.contract.likes || b.score - a.score);
    else out.sort((a, b) => b.score - a.score || b.contract.stars - a.contract.stars);
    return out.slice(0, 12);
  }, [chainFiltered, q, sort]);

  const publishers = useMemo<Publisher[]>(() => {
    const map = new Map<string, Publisher>();
    chainFiltered.forEach((c) => {
      if (q && !c.owner.toLowerCase().includes(q)) return;
      const existing = map.get(c.owner);
      if (existing) {
        existing.contractCount += 1;
        existing.totalStars += c.stars;
      } else {
        map.set(c.owner, {
          name: c.owner,
          avatar: c.ownerAvatar,
          contractCount: 1,
          totalStars: c.stars,
        });
      }
    });
    return [...map.values()].sort((a, b) => b.totalStars - a.totalStars);
  }, [chainFiltered, q]);

  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    chainFiltered.forEach((c) => {
      c.tags.forEach((t) => {
        const tag = t.trim();
        if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [chainFiltered]);

  const trending = useMemo(
    () => [...chainFiltered].sort((a, b) => b.stars + b.forksCount - (a.stars + a.forksCount)).slice(0, 3),
    [chainFiltered]
  );

  const trendingFunctions = useMemo(
    () =>
      trending.flatMap((c) => c.functions.slice(0, 2).map((fn) => ({ contract: c, fn }))).slice(0, 5),
    [trending]
  );

  const chainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    contracts.forEach((c) => counts.set(c.chain, (counts.get(c.chain) || 0) + 1));
    return counts;
  }, [contracts]);

  const totalFunctions = useMemo(
    () => chainFiltered.reduce((n, c) => n + c.functions.length, 0),
    [chainFiltered]
  );

  const scopes: Array<{ id: Scope; label: string; count: number; icon: React.ElementType }> = [
    { id: 'all', label: 'All', count: matchedContracts.length + matchedFunctions.length + publishers.length, icon: Compass },
    { id: 'contracts', label: 'Contracts', count: matchedContracts.length, icon: Layers },
    { id: 'functions', label: 'Functions', count: matchedFunctions.length, icon: Code },
    { id: 'publishers', label: 'Publishers', count: publishers.length, icon: Users },
  ];

  const showContracts = scope === 'all' || scope === 'contracts';
  const showFunctions = scope === 'all' || scope === 'functions';
  const showPublishers = scope === 'all' || scope === 'publishers';

  // Right-rail feature: top result, or top trending on the discovery view.
  const featured: SmartContract | null = q ? matchedContracts[0] || null : trending[0] || null;

  const overviewLines = useMemo(() => {
    if (contracts.length === 0) return [];
    const chainsHit = new Set((q ? matchedContracts : chainFiltered).map((c) => c.chain));
    const topTags = popularTags.slice(0, 3).map(([t]) => `#${t}`);
    if (!q) {
      return [
        `${chainFiltered.length} contracts indexed across ${chainsHit.size || '…' } ${chainsHit.size === 1 ? 'chain' : 'chains'}.`,
        featured ? `Most traction right now: ${featured.owner}/${featured.name} (${featured.stars} stars).` : '',
        topTags.length > 0 ? `Active areas: ${topTags.join('  ')}.` : '',
      ].filter(Boolean);
    }
    if (matchedContracts.length === 0 && matchedFunctions.length === 0) {
      return [`Nothing indexed matches "${query.trim()}" in this scope yet.`];
    }
    return [
      `${matchedContracts.length} contract${matchedContracts.length === 1 ? '' : 's'} + ${matchedFunctions.length} function${matchedFunctions.length === 1 ? '' : 's'} match across ${chainsHit.size || 0} ${chainsHit.size === 1 ? 'chain' : 'chains'}.`,
      featured ? `Top match: ${featured.owner}/${featured.name} — ${featured.tagline}.` : '',
      topTags.length > 0 ? `Related tags: ${topTags.join('  ')}.` : '',
    ].filter(Boolean);
  }, [contracts.length, chainFiltered, matchedContracts, matchedFunctions, popularTags, featured, q, query]);

  const applyTag = (tag: string) => {
    setQuery(tag);
    syncUrl(tag, chain);
    inputRef.current?.focus();
  };

  const maxChainCount = Math.max(1, ...[...chainCounts.values()]);

  // Empty registry: honest state, no fake discovery.
  if (contracts.length === 0) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-16 pb-20">
        <div className="max-w-md mx-auto p-10 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-3">
          <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
            <Compass className="w-5 h-5" />
          </div>
          <p className="text-sm text-[#FAFAFA] font-medium">Nothing to search yet</p>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            The registry is empty. Publish a contract and it becomes searchable here.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate({ page: 'publish' })}
              className="px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all items-center gap-1.5 inline-flex"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Publish a contract</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-8">
      {/* Header + big search field */}
      <section className="space-y-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
          Search
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] focus-within:border-[#3B82F6]/60 transition-colors">
          <Search className="w-5 h-5 text-[#3B82F6] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') syncUrl(query, chain);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Search contracts, functions, publishers, tags, or paste a contract ID (C… / 0x…)…"
            className="w-full bg-transparent text-base text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                syncUrl('', chain);
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[10px] font-mono text-[#71717A] shrink-0">
            ⌘K
          </kbd>
        </div>

        {/* Scope tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {scopes.map((s) => {
            const Icon = s.icon;
            const active = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-[#FAFAFA] text-[#050505] border-[#FAFAFA]'
                    : 'bg-[#111113] text-[#A1A1AA] border-[#27272A] hover:text-[#FAFAFA] hover:border-[#3F3F46]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
                <span
                  className={`px-1.5 py-px rounded-full text-[10px] font-mono ${
                    active ? 'bg-[#050505]/10 text-[#050505]' : 'bg-[#18181B] text-[#71717A]'
                  }`}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chain + sort dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            ariaLabel="Filter by chain"
            triggerClassName={dropdownTriggerCls}
            panelClassName="w-64 max-h-80 overflow-y-auto p-1.5"
            trigger={
              <>
                {chain === 'all' ? (
                  <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                ) : (
                  <img
                    src={CHAINS.find((c) => c.id === chain)?.logo}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <span>{chain === 'all' ? 'All chains' : CHAINS.find((c) => c.id === chain)?.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" />
              </>
            }
          >
            {(close) => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setChain('all');
                    syncUrl(query, 'all');
                    close();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                    chain === 'all'
                      ? 'bg-[#18181B] text-[#FAFAFA] font-semibold'
                      : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#3B82F6]" />
                    <span>All chains</span>
                  </span>
                  {chain === 'all' && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                </button>
                {CHAINS.map((c) => {
                  const count = chainCounts.get(c.id) || 0;
                  const active = chain === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setChain(c.id);
                        syncUrl(query, c.id);
                        close();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                        active
                          ? 'bg-[#18181B] text-[#FAFAFA] font-semibold'
                          : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <img
                          src={c.logo}
                          alt={`${c.name} logo`}
                          loading="lazy"
                          className={`w-4 h-4 rounded-full object-cover shrink-0 ${count === 0 ? 'opacity-50 grayscale' : ''}`}
                        />
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-[#52525B] font-mono">{c.familyLabel}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-[#71717A]">
                        {count}
                        {active && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </Dropdown>

          <Dropdown
            ariaLabel="Change sort order"
            triggerClassName={dropdownTriggerCls}
            panelClassName="w-56 p-1.5"
            trigger={
              <>
                <ArrowUpDown className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Sort: {SORTS.find((s) => s.id === sort)?.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" />
              </>
            }
          >
            {(close) => (
              <>
                {SORTS.map((s) => {
                  const active = sort === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSort(s.id);
                        close();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs transition-colors ${
                        active
                          ? 'bg-[#18181B] text-[#FAFAFA] font-semibold'
                          : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]'
                      }`}
                    >
                      <span>
                        <span className="block">{s.label}</span>
                        <span className="block text-[10px] text-[#52525B] font-mono">{s.hint}</span>
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
          </Dropdown>

          {q && (
            <span className="text-[11px] font-mono text-[#52525B]">
              {matchedContracts.length + matchedFunctions.length + publishers.length} result
              {matchedContracts.length + matchedFunctions.length + publishers.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </section>

      {/* Results (left) + stats rail (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* LEFT — results / discovery */}
        <div className="space-y-10 min-w-0">
          {!q && (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#F59E0B]" />
                  <h2 className="text-base font-semibold text-[#FAFAFA]">Trending contracts</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trending.map((c) => (
                    <ContractCard key={c.id} contract={c} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-[#3B82F6]" />
                  <h2 className="text-base font-semibold text-[#FAFAFA]">Trending functions</h2>
                </div>
                <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden">
                  {trendingFunctions.map(({ contract, fn }) => (
                    <button
                      key={contract.id + fn.id}
                      type="button"
                      onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                      className="w-full flex items-center justify-between gap-3 p-3 hover:bg-[#111113] group text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-medium text-[#FAFAFA] truncate">
                          {fn.signature}
                        </div>
                        <div className="text-[11px] text-[#71717A] truncate mt-0.5">
                          in <span className="text-[#A1A1AA]">{contract.owner}/{contract.name}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#71717A] group-hover:text-[#3B82F6] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#7C3AED]" />
                  <h2 className="text-base font-semibold text-[#FAFAFA]">Popular tags</h2>
                </div>
                <div className="p-4 rounded-[8px] border border-[#27272A] bg-[#0A0A0B]">
                  {popularTags.length === 0 ? (
                    <p className="text-xs text-[#71717A] font-mono">No tags yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {popularTags.map(([tag, count]) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => applyTag(tag)}
                          className="px-2.5 py-1 rounded-full bg-[#18181B] border border-[#27272A] hover:border-[#3B82F6]/50 text-[11px] font-mono text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
                        >
                          #{tag} <span className="text-[#52525B]">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {q && (
            <>
              {showContracts && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-[#FAFAFA] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#3B82F6]" />
                    Contracts
                    <span className="text-xs text-[#71717A] font-mono">({matchedContracts.length})</span>
                  </h2>
                  {matchedContracts.length === 0 ? (
                    <p className="text-xs text-[#71717A] font-mono py-4 border border-dashed border-[#27272A] rounded-[8px] text-center">
                      No contracts match &ldquo;{query.trim()}&rdquo;.
                    </p>
                  ) : (
                    <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden">
                      {matchedContracts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => navigateToContract(c.chain, c.contractId)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-[#111113] group text-left transition-colors"
                        >
                          <img
                            src={c.ownerAvatar}
                            alt={c.owner}
                            className="w-9 h-9 rounded-full object-cover border border-[#27272A] shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">
                              <span className="text-[#8C93A3]">{c.owner}/</span>
                              <span className="font-semibold text-[#FAFAFA] group-hover:text-[#3B82F6] transition-colors">
                                {c.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#71717A] truncate mt-0.5">
                              {c.tagline}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 font-mono text-[11px] text-[#71717A]">
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3" /> {c.stars}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="w-3 h-3" /> {c.forksCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" /> {c.likes}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ChainBadge
                              chain={c.chain}
                              network={c.network}
                              contractId={c.contractId}
                              truncateId={true}
                              showCopy={false}
                            />
                            <ChevronRight className="w-4 h-4 text-[#52525B] group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showFunctions && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-[#FAFAFA] flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#3B82F6]" />
                    Functions
                    <span className="text-xs text-[#71717A] font-mono">({matchedFunctions.length})</span>
                  </h2>
                  {matchedFunctions.length === 0 ? (
                    <p className="text-xs text-[#71717A] font-mono py-4 border border-dashed border-[#27272A] rounded-[8px] text-center">
                      No functions match &ldquo;{query.trim()}&rdquo;.
                    </p>
                  ) : (
                    <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden">
                      {matchedFunctions.map(({ contract, fn }) => (
                        <button
                          key={contract.id + fn.id}
                          type="button"
                          onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                          className="w-full flex items-center justify-between gap-3 p-3 hover:bg-[#111113] group text-left transition-colors"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <Code className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-medium text-[#FAFAFA] truncate">
                                {fn.signature}
                              </div>
                              <div className="text-[11px] text-[#71717A] truncate mt-0.5">
                                in <span className="text-[#A1A1AA]">{contract.owner}/{contract.name}</span>
                                {fn.docExcerpt ? ` • ${fn.docExcerpt}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ChainBadge
                              chain={contract.chain}
                              network={contract.network}
                              contractId={contract.contractId}
                              truncateId={true}
                              showCopy={false}
                            />
                            <ArrowRight className="w-3.5 h-3.5 text-[#71717A] opacity-0 group-hover:opacity-100 group-hover:text-[#3B82F6] transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showPublishers && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-[#FAFAFA] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#3B82F6]" />
                    Publishers
                    <span className="text-xs text-[#71717A] font-mono">({publishers.length})</span>
                  </h2>
                  {publishers.length === 0 ? (
                    <p className="text-xs text-[#71717A] font-mono py-4 border border-dashed border-[#27272A] rounded-[8px] text-center">
                      No publishers match &ldquo;{query.trim()}&rdquo;.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {publishers.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => navigate({ page: 'profile', username: p.name })}
                          className="flex items-center justify-between gap-3 p-3 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#3F3F46] group text-left transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="w-9 h-9 rounded-full object-cover border border-[#27272A] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#FAFAFA] truncate">@{p.name}</div>
                              <div className="text-[11px] text-[#71717A] font-mono mt-0.5">
                                {p.contractCount} contract{p.contractCount === 1 ? '' : 's'} • {p.totalStars} stars
                              </div>
                            </div>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-[#71717A] group-hover:text-[#3B82F6] shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {matchedContracts.length === 0 && matchedFunctions.length === 0 && publishers.length === 0 && (
                <div className="py-12 text-center space-y-3 border border-[#27272A] rounded-[8px]">
                  <p className="text-sm text-[#FAFAFA] font-medium">
                    Nothing found for &ldquo;{query.trim()}&rdquo;
                  </p>
                  <p className="text-xs text-[#A1A1AA]">
                    Try a contract name, function, tag, or paste a full contract ID.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        syncUrl('', chain);
                      }}
                      className="px-3.5 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs border border-[#27272A] transition-colors"
                    >
                      Clear search
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'publish' })}
                      className="px-3.5 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-colors"
                    >
                      Publish it
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT — stats rail */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {/* Result stats */}
          <div className="p-4 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{q ? `Results for “${query.trim()}”` : 'Registry stats'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A]">
                <div className="text-lg font-bold text-[#FAFAFA]">{q ? matchedContracts.length : chainFiltered.length}</div>
                <div className="text-[10px] font-mono text-[#71717A] mt-0.5">contracts</div>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A]">
                <div className="text-lg font-bold text-[#FAFAFA]">{q ? matchedFunctions.length : totalFunctions}</div>
                <div className="text-[10px] font-mono text-[#71717A] mt-0.5">functions</div>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A]">
                <div className="text-lg font-bold text-[#FAFAFA]">{publishers.length}</div>
                <div className="text-[10px] font-mono text-[#71717A] mt-0.5">publishers</div>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              {CHAINS.map((c) => {
                const count = chainCounts.get(c.id) || 0;
                if (count === 0) return null;
                return (
                  <div key={c.id} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-16 shrink-0 text-[#A1A1AA] truncate">{c.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#18181B] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3B82F6]"
                        style={{ width: `${Math.max(4, (count / maxChainCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-[#71717A]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Featured contract */}
          {featured && (
            <div
              onClick={() => navigateToContract(featured.chain, featured.contractId)}
              className="p-4 rounded-[8px] border border-[#3B82F6]/25 bg-[#0A0A0B] hover:border-[#3B82F6]/60 transition-colors cursor-pointer space-y-3"
            >
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#3B82F6]">
                {q ? 'Top match' : 'Featured'}
              </div>
              <div className="text-sm truncate">
                <span className="text-[#8C93A3]">{featured.owner}/</span>
                <span className="font-bold text-[#FAFAFA]">{featured.name}</span>
              </div>
              <p className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-3">
                {featured.description}
              </p>
              <div className="flex items-center gap-4 pt-2 font-mono text-xs text-[#A1A1AA]">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-[#F59E0B]" /> {featured.stars}
                </span>
                <span className="flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-[#3B82F6]" /> {featured.forksCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#7C3AED]" /> {featured.likes}
                </span>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({ page: 'profile', username: featured.owner });
                  }}
                  className="flex items-center gap-2 text-[11px] font-mono text-[#71717A] hover:text-[#FAFAFA] transition-colors"
                >
                  <span>@{featured.owner}</span>
                  <img
                    src={featured.ownerAvatar}
                    alt={featured.owner}
                    className="w-6 h-6 rounded-full object-cover border border-[#3F3F46]"
                  />
                </button>
              </div>
            </div>
          )}

          {/* Overview */}
          {overviewLines.length > 0 && (
            <div className="p-4 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Overview</span>
                </div>
                <span className="text-[10px] font-mono text-[#52525B]">auto-generated</span>
              </div>
              {overviewLines.map((line, i) => (
                <p key={i} className="text-xs text-[#A1A1AA] leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
