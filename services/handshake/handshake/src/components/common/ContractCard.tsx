import React from 'react';
import { Star, GitFork, Heart, ArrowUpRight } from 'lucide-react';
import { SmartContract } from '../../types';
import { ChainBadge } from './ChainBadge';
import { LanguageBadge } from './LanguageBadge';
import { getChain } from '../../data/chains';
import { useApp } from '../../context/AppContext';

interface ContractCardProps {
  contract: SmartContract;
}

export const ContractCard: React.FC<ContractCardProps> = ({ contract }) => {
  const { navigateToContract, likedContractIds, toggleLikeContract, starredContractIds, toggleStarContract, forkContractToStudio } = useApp();

  const isLiked = likedContractIds.includes(contract.id);
  const isStarred = starredContractIds.includes(contract.id);
  const accent = getChain(contract.chain)?.accent ?? '#3B82F6';

  return (
    <div
      onClick={() => navigateToContract(contract.chain, contract.contractId)}
      className="group relative flex flex-col justify-between rounded-[8px] border border-[#232838] bg-[#0A0A0B] hover:border-[#3B82F6]/60 hover:bg-[#0D0D10] transition-all cursor-pointer overflow-hidden p-4 pt-4.5 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
    >
      {/* 2px Chain Color Strip (registry accent) */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: accent }} />

      <div>
        {/* Top meta row: owner/name */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={contract.ownerAvatar}
              alt={contract.owner}
              className="w-5 h-5 rounded-full object-cover border border-[#2B3144]"
            />
            <div className="truncate">
              <span className="text-xs text-[#8C93A3] hover:text-[#FAFAFA] mr-1">
                {contract.owner}/
              </span>
              <span className="text-[15px] font-semibold text-[#FAFAFA] group-hover:text-[#3B82F6] transition-colors">
                {contract.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#7C8497] opacity-0 group-hover:opacity-100 group-hover:text-[#3B82F6] transition-all" />
          </div>
        </div>

        {/* Chain + Contract ID Badge (Never show a bare ID) */}
        <div className="mb-2.5">
          <ChainBadge
            chain={contract.chain}
            network={contract.network}
            contractId={contract.contractId}
            truncateId={true}
            showCopy={true}
          />
        </div>

        {/* 2-line description */}
        <p className="text-xs text-[#9BA2B0] line-clamp-2 leading-relaxed mb-3">
          {contract.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {contract.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-[#9BA2B0] px-2 py-0.5 rounded-[9999px] border border-[#2B3144] bg-[#18181B]"
              >
              {tag}
            </span>
          ))}
          {contract.tags.length > 3 && (
            <span className="text-[10px] text-[#7C8497] self-center">
              +{contract.tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Stats row: clean metrics */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#232838] text-xs text-[#7C8497]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeContract(contract.id);
            }}
            className={`flex items-center gap-1 hover:text-[#FAFAFA] transition-colors ${
              isLiked ? 'text-[#EF4444]' : ''
            }`}
            title="Like contract"
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{contract.likes + (isLiked ? 1 : 0)}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleStarContract(contract.id);
            }}
            className={`flex items-center gap-1 hover:text-[#FAFAFA] transition-colors ${
              isStarred ? 'text-[#F59E0B]' : ''
            }`}
            title="Star contract"
          >
            <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
            <span>{contract.stars + (isStarred ? 1 : 0)}</span>
          </button>

          <span className="flex items-center gap-1" title="Forks">
            <GitFork className="w-3.5 h-3.5" />
            <span>{contract.forksCount}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageBadge language={contract.language} size="xs" />
        </div>
      </div>
    </div>
  );
};
