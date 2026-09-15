import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface CollectionsPageProps {
  initialSlug?: string;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = () => {
  const { navigate } = useApp();

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#FAFAFA] flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#3B82F6]" />
          Curated Contract Collections
        </h1>
        <p className="text-xs text-[#A1A1AA] font-mono mt-1">
          Hand-picked contract architectures, security audited standards, and canonical implementations
        </p>
      </div>

      {/* Empty state: no collections until the registry API lands */}
      <div className="p-10 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-3">
        <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
          <BookOpen className="w-5 h-5" />
        </div>
        <p className="text-sm text-[#FAFAFA] font-medium">No collections yet</p>
        <p className="text-xs text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
          Collections appear here once contracts are published to the registry.
          Publish the first contract to start a collection like "AMM patterns" or "Stellar Auth patterns".
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate({ page: 'publish' })}
            className="px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all"
          >
            Publish a contract
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'browse' })}
            className="px-4 py-2 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium border border-[#27272A] transition-colors flex items-center gap-1.5"
          >
            <span>Browse contracts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
