import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Search, Code, FileText, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChainBadge } from '../common/ChainBadge';

/**
 * Quick-find floating palette. First stop for search: live contract +
 * function matches, click to open directly. Enter jumps to the full
 * `#/search` results screen with the query attached.
 */
export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setIsCommandPaletteOpen, contracts, navigateToContract, navigateToFunction, navigate } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isCommandPaletteOpen]);

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return {
        contracts: contracts.slice(0, 3),
        functions: contracts[0]?.functions.slice(0, 3) || [],
      };
    }
    const q = query.toLowerCase();

    const matchedContracts = contracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contractId.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );

    const matchedFunctions: Array<{ contract: typeof contracts[0]; fn: typeof contracts[0]['functions'][0] }> = [];
    contracts.forEach((c) => {
      c.functions.forEach((f) => {
        if (f.name.toLowerCase().includes(q) || f.signature.toLowerCase().includes(q)) {
          matchedFunctions.push({ contract: c, fn: f });
        }
      });
    });

    return {
      contracts: matchedContracts,
      functions: matchedFunctions.slice(0, 6),
    };
  }, [query, contracts]);

  const goToResults = () => {
    const q = query.trim();
    setIsCommandPaletteOpen(false);
    navigate({ page: 'search', searchQuery: q ? q : undefined });
  };

  const close = () => setIsCommandPaletteOpen(false);

  // Mounted conditionally by <AnimatePresence> in App — enter/exit below.
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
      onClick={close}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div className="flex items-start justify-center pt-20 px-4 h-full">
        <motion.div
          className="w-full max-w-2xl origin-top rounded-[8px] border border-[#3F3F46] bg-[#0A0A0B] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.97, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -8 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#27272A] bg-[#111113]">
          <Search className="w-4 h-4 text-[#A1A1AA] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goToResults();
            }}
            placeholder="Search contracts (e.g. soroban-amm), functions (e.g. swap), or contract IDs (C... / 0x...)"
            className="w-full bg-transparent text-sm text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none font-mono"
          />
          <kbd
            onClick={() => setIsCommandPaletteOpen(false)}
            className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[10px] font-mono text-[#A1A1AA] cursor-pointer hover:bg-[#27272A]"
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {/* Contracts Section */}
          {searchResults.contracts.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
                Contracts ({searchResults.contracts.length})
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.contracts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setIsCommandPaletteOpen(false);
                      navigateToContract(c.chain, c.contractId);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-[6px] hover:bg-[#18181B] group text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#3B82F6] shrink-0" />
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#A1A1AA]">{c.owner}/</span>
                          <span className="text-xs font-semibold text-[#FAFAFA]">{c.name}</span>
                        </div>
                        <div className="text-[11px] text-[#71717A] truncate font-mono">
                          {c.tagline}
                        </div>
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
                      <CornerDownLeft className="w-3.5 h-3.5 text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Functions Section */}
          {searchResults.functions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
                Functions
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.functions.map((item, idx) => {
                  const fn = 'fn' in item ? item.fn : item;
                  const contract = 'contract' in item ? item.contract : contracts[0];
                  return (
                    <button
                      key={fn.id + idx}
                      type="button"
                      onClick={() => {
                        setIsCommandPaletteOpen(false);
                        navigateToFunction(contract.chain, contract.contractId, fn.name);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-[6px] hover:bg-[#18181B] group text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Code className="w-4 h-4 text-[#3B82F6] shrink-0" />
                        <div className="truncate">
                          <div className="text-xs font-medium text-[#FAFAFA] truncate">
                            {fn.signature}
                          </div>
                          <div className="text-[11px] text-[#71717A] truncate">
                            in <span className="text-[#A1A1AA]">{contract.name}</span> • {fn.docExcerpt}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {searchResults.contracts.length === 0 && searchResults.functions.length === 0 && (
            <div className="py-8 text-center text-xs text-[#71717A]">
              No quick matches for &ldquo;{query}&rdquo; — hit Enter for the full results screen.
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <button
          type="button"
          onClick={goToResults}
          className="w-full flex items-center justify-between px-4 py-2 border-t border-[#27272A] bg-[#050505] text-[11px] text-[#71717A] font-mono hover:text-[#FAFAFA] transition-colors"
        >
          <span>
            Press <kbd className="px-1 bg-[#18181B] border border-[#27272A] rounded">Enter</kbd> for full results
          </span>
          <span>Handshake Code-First Search</span>
        </button>
        </motion.div>
      </div>
    </motion.div>
  );
};
