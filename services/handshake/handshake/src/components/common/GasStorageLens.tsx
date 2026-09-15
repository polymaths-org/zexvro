import React from 'react';
import { Zap, Database, ShieldCheck, Radio } from 'lucide-react';
import { ContractFunction } from '../../types';

interface GasStorageLensProps {
  fn: ContractFunction;
  compact?: boolean;
  className?: string;
}

export const GasStorageLens: React.FC<GasStorageLensProps> = ({
  fn,
  compact = false,
  className = '',
}) => {
  const getGasBadgeColor = (rating: string) => {
    switch (rating) {
      case 'A+':
        return 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20';
      case 'A':
        return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20';
      case 'B':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
      default:
        return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 font-mono text-[11px] ${className}`}>
      {/* Gas Estimate */}
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[9999px] border ${getGasBadgeColor(
          fn.gasRating
        )}`}
        title={`Estimated CPU instructions / Gas: ${fn.gasEstimate.toLocaleString()}`}
      >
        <Zap className="w-3 h-3" />
        <span>~{fn.gasEstimate > 1000 ? `${(fn.gasEstimate / 1000).toFixed(1)}k` : fn.gasEstimate}</span>
        <span className="font-semibold text-[9px] opacity-75">{fn.gasRating}</span>
      </span>

      {/* Storage Delta */}
      {(fn.storageWrites > 0 || fn.storageReads > 0) && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[9999px] bg-[#18181B] text-[#A1A1AA] border border-[#27272A]"
          title={`${fn.storageWrites} writes, ${fn.storageReads} reads in contract storage`}
        >
          <Database className="w-3 h-3 text-[#F59E0B]" />
          <span>
            {fn.storageWrites > 0 && <span className="text-[#F59E0B]">+{fn.storageWrites}W</span>}
            {fn.storageWrites > 0 && fn.storageReads > 0 && <span>/</span>}
            {fn.storageReads > 0 && <span>{fn.storageReads}R</span>}
          </span>
        </span>
      )}

      {/* Auth Guard */}
      {fn.requiresAuth && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[9999px] bg-[#3B82F6]/10 text-[#93C5FD] border border-[#3B82F6]/25"
          title="Direct cryptographic authorization verified via require_auth()"
        >
          <ShieldCheck className="w-3 h-3 text-[#60A5FA]" />
          {!compact && <span>Auth Req</span>}
        </span>
      )}

      {/* Events Emitted */}
      {fn.eventsEmitted.length > 0 && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[9999px] bg-[#18181B] text-[#71717A] border border-[#27272A]"
          title={`Emits events: ${fn.eventsEmitted.join(', ')}`}
        >
          <Radio className="w-3 h-3 text-[#3B82F6]" />
          {!compact && <span>{fn.eventsEmitted.length} event{fn.eventsEmitted.length > 1 ? 's' : ''}</span>}
        </span>
      )}
    </div>
  );
};
