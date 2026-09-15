import React from 'react';
import { X, Sparkles, ShieldAlert, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AiExplainDrawer: React.FC = () => {
  const { isAiExplainOpen, setIsAiExplainOpen, activeExplainFunction, openDryRun } = useApp();

  if (!isAiExplainOpen || !activeExplainFunction) return null;

  const { contract, fn } = activeExplainFunction;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-y-0 right-0 max-w-lg w-full bg-[#0A0A0B] border-l border-[#27272A] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27272A] bg-[#111113]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[4px] bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#93C5FD]">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#FAFAFA]">Natural-Language Explain</h3>
              <p className="text-[11px] text-[#71717A]">AI Lens • Deep code analysis</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAiExplainOpen(false)}
            className="p-1 text-[#71717A] hover:text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Target signature */}
          <div className="p-3 rounded-[6px] bg-[#111113] border border-[#27272A]">
            <div className="text-[10px] text-[#71717A] uppercase mb-1">
              Analyzing Function in {contract.name}:
            </div>
            <div className="text-xs font-medium text-[#93C5FD] break-all">
              {fn.signature}
            </div>
          </div>

          {/* Section 1: Plain English Summary */}
          <div>
            <h4 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" /> Plain-English Summary
            </h4>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              This function <strong className="text-[#FAFAFA]">{fn.name}</strong> is designed to {fn.fullDocs || fn.docExcerpt}. It requires explicit cryptographic caller authorization and guarantees atomic state isolation: if any condition fails (such as slippage thresholds or negative amounts), the host runtime completely rolls back all intermediate writes.
            </p>
          </div>

          {/* Section 2: Authorization & Access Control */}
          <div className="p-3.5 rounded-[6px] bg-[#111113] border border-[#27272A] space-y-2">
            <h4 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" /> Authorization & Safety
            </h4>
            <ul className="text-xs text-[#A1A1AA] space-y-1.5 list-disc list-inside">
              <li>
                <span className="text-[#FAFAFA] font-medium">Caller Signature:</span> Validates sender authentication directly on-chain.
              </li>
              <li>
                <span className="text-[#FAFAFA] font-medium">Reentrancy Shield:</span> State is committed only upon clean function return, eliminating classic EVM read-only reentrancy attacks.
              </li>
              <li>
                <span className="text-[#FAFAFA] font-medium">Footprint Limits:</span> Memory allocation is bounded within Soroban limits (max 40KB stack).
              </li>
            </ul>
          </div>

          {/* Section 3: Storage & Gas Trade-offs */}
          <div>
            <h4 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" /> Gas & Storage Architecture
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-[#111113] border border-[#27272A]">
                <div className="text-[#71717A] text-[10px]">ESTIMATED GAS</div>
                <div className="text-[#FAFAFA] font-semibold text-sm mt-0.5">
                  {fn.gasEstimate.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#22C55E]">Grade {fn.gasRating} (High efficiency)</div>
              </div>
              <div className="p-2.5 rounded bg-[#111113] border border-[#27272A]">
                <div className="text-[#71717A] text-[10px]">STATE MODIFICATIONS</div>
                <div className="text-[#FAFAFA] font-semibold text-sm mt-0.5">
                  {fn.storageWrites} Writes / {fn.storageReads} Reads
                </div>
                <div className="text-[10px] text-[#A1A1AA]">Instance Storage</div>
              </div>
            </div>
          </div>

          {/* Section 4: Security Gotchas */}
          <div>
            <h4 className="text-xs font-semibold text-[#EF4444] uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" /> Security Gotchas & Watchouts
            </h4>
            <div className="space-y-2">
              <div className="p-2.5 rounded bg-[#EF4444]/5 border border-[#EF4444]/20 text-xs text-[#A1A1AA]">
                <strong className="text-[#FAFAFA]">Slippage Tolerance:</strong> Always provide a realistic <code className="text-[#93C5FD]">min_amount_out</code>; passing 0 allows MEV arbitrage bots to sandwich your trade.
              </div>
              <div className="p-2.5 rounded bg-[#EF4444]/5 border border-[#EF4444]/20 text-xs text-[#A1A1AA]">
                <strong className="text-[#FAFAFA]">Storage Rent:</strong> Persistent ledger entries on Stellar require TTL bump operations if not accessed within 30 days.
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Quick Action */}
        <div className="p-4 border-t border-[#27272A] bg-[#111113] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsAiExplainOpen(false);
              openDryRun(contract, fn);
            }}
            className="flex items-center gap-1.5 text-xs text-[#3B82F6] hover:underline font-mono"
          >
            <span>Try in Dry-Run Sandbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsAiExplainOpen(false)}
            className="px-3 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-xs text-[#FAFAFA] font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
