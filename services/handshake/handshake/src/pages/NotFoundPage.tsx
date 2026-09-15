import React from 'react';
import { Search, Plus, House } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotFoundPage: React.FC = () => {
  const { navigate } = useApp();
  const tried = typeof window !== 'undefined' ? window.location.hash || window.location.pathname : '';

  return (
    <div className="max-w-md mx-auto px-4 pt-20 pb-20 text-center">
      <div className="font-display font-extrabold text-6xl text-[#FAFAFA] tracking-tight">
        404
      </div>
      <div className="mt-2 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-[#3B82F6]/60 to-transparent" />
      <p className="text-sm text-[#FAFAFA] font-medium mt-5">Lost in the chain</p>
      <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1.5">
        Nothing is indexed at this address. The contract may have moved, or the link is wrong.
      </p>
      {tried && tried !== '#/' && tried !== '#/home' && (
        <p className="mt-3 px-3 py-1.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-[11px] font-mono text-[#71717A] truncate">
          {tried}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <button
          type="button"
          onClick={() => navigate({ page: 'home' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all"
        >
          <House className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Go home</span>
        </button>
        <button
          type="button"
          onClick={() => navigate({ page: 'search' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium border border-[#27272A] transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
        <button
          type="button"
          onClick={() => navigate({ page: 'publish' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium border border-[#27272A] transition-colors"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Publish</span>
        </button>
      </div>
    </div>
  );
};
