import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  Play, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  Code,
  Filter,
  Eye
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract, ContractFunction } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';
import { GasStorageLens } from '../components/common/GasStorageLens';

interface FunctionsIndexPageProps {
  contract: SmartContract;
}

export const FunctionsIndexPage: React.FC<FunctionsIndexPageProps> = ({ contract }) => {
  const { navigateToFunction, openDryRun, openAiExplain } = useApp();
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'view' | 'internal'>('all');
  const [authOnly, setAuthOnly] = useState(false);
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  const filteredFunctions = useMemo(() => {
    return contract.functions.filter((fn) => {
      if (visibilityFilter !== 'all' && fn.visibility !== visibilityFilter) return false;
      if (authOnly && !fn.requiresAuth) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        fn.name.toLowerCase().includes(q) ||
        fn.signature.toLowerCase().includes(q) ||
        fn.docExcerpt.toLowerCase().includes(q)
      );
    });
  }, [contract.functions, visibilityFilter, authOnly, search]);

  const copySignature = (sig: string, id: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedSig(id);
    setTimeout(() => setCopiedSig(null), 1800);
  };

  return (
    <ContractRepoLayout contract={contract} activeTab="functions">
      <div className="space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#FAFAFA] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#3B82F6]" />
              Contract Functions & AST Interface
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1">
              {contract.functions.length} entry points parsed from source code and compiled ABI
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full md:w-72 relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search function by name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-xs text-[#FAFAFA] font-mono placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#71717A]">Visibility:</span>
            {(['all', 'public', 'view', 'internal'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibilityFilter(v)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  visibilityFilter === v
                    ? 'bg-[#27272A] text-[#FAFAFA] font-semibold'
                    : 'bg-[#111113] text-[#71717A] hover:text-[#FAFAFA]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={authOnly}
              onChange={(e) => setAuthOnly(e.target.checked)}
              className="rounded bg-[#111113] border-[#27272A] text-[#3B82F6] focus:ring-0"
            />
            <span className="text-[#FAFAFA] flex items-center gap-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
              Requires Authorization only
            </span>
          </label>
        </div>

        {/* Functions Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredFunctions.map((fn) => (
            <div
              key={fn.id}
              className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#3F3F46] p-4 space-y-3 transition-all"
            >
              {/* Function Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                    {fn.visibility}
                  </span>
                  <span
                    onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                    className="text-sm font-mono font-bold text-[#FAFAFA] hover:text-[#3B82F6] cursor-pointer"
                  >
                    fn {fn.name}()
                  </span>
                  <span className="text-[11px] text-[#71717A] font-mono">
                    lines {fn.sourceLines[0]}–{fn.sourceLines[1]}
                  </span>
                </div>

                {/* Badges: Gas + Storage + Auth */}
                <GasStorageLens fn={fn} compact={false} />
              </div>

              {/* Signature Block */}
              <div className="relative group">
                <pre className="p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-xs font-mono text-[#93C5FD] overflow-x-auto whitespace-pre">
                  {fn.signature}
                </pre>
                <button
                  type="button"
                  onClick={() => copySignature(fn.signature, fn.id)}
                  className="absolute top-2 right-2 p-1 rounded bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy signature"
                >
                  {copiedSig === fn.id ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Documentation */}
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {fn.docExcerpt}
              </p>

              {/* Arguments Table if any */}
              {fn.arguments.length > 0 && (
                <div className="text-xs font-mono rounded bg-[#111113] border border-[#27272A] overflow-hidden">
                  <div className="px-3 py-1.5 bg-[#18181B] border-b border-[#27272A] text-[10px] text-[#71717A] uppercase">
                    Parameters ({fn.arguments.length})
                  </div>
                  <div className="divide-y divide-[#18181B]">
                    {fn.arguments.map((arg) => (
                      <div key={arg.name} className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-semibold text-[#FAFAFA]">{arg.name}: </span>
                          <span className="text-[#3B82F6]">{arg.type}</span>
                        </div>
                        <span className="text-[#71717A] text-[10px] truncate max-w-xs">{arg.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#18181B] text-xs">
                <button
                  type="button"
                  onClick={() => openAiExplain(contract, fn)}
                  className="flex items-center gap-1.5 text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explain with AI</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openDryRun(contract, fn)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] border border-[#27272A] transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-[#22C55E] fill-current" />
                    <span>Dry-Run Invoke</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold transition-all shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Deep Read</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredFunctions.length === 0 && (
            <div className="py-12 text-center text-xs text-[#71717A] font-mono border border-[#27272A] rounded-[8px]">
              No functions matched your search query.
            </div>
          )}
        </div>

      </div>
    </ContractRepoLayout>
  );
};
