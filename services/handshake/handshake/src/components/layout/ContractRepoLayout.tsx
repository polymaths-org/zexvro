import React from 'react';
import { 
  Code2, 
  Layers, 
  GitFork, 
  History, 
  MessageSquare, 
  PlayCircle, 
  ShieldCheck, 
  Star, 
  Heart, 
  Share2, 
  ExternalLink,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SmartContract } from '../../types';
import { ChainBadge } from '../common/ChainBadge';

interface ContractRepoLayoutProps {
  contract: SmartContract;
  activeTab: 'code' | 'functions' | 'tests' | 'invokes' | 'forks' | 'discussions' | 'history' | 'settings';
  children: React.ReactNode;
}

export const ContractRepoLayout: React.FC<ContractRepoLayoutProps> = ({
  contract,
  activeTab,
  children,
}) => {
  const { 
    navigate, 
    likedContractIds, 
    toggleLikeContract, 
    starredContractIds, 
    toggleStarContract, 
    setEmbedContract, 
    setIsEmbedModalOpen, 
    forkContractToStudio,
    openDryRun
  } = useApp();

  const isLiked = likedContractIds.includes(contract.id);
  const isStarred = starredContractIds.includes(contract.id);

  const tabs = [
    { id: 'code', label: 'Code', icon: Code2, count: undefined },
    { id: 'functions', label: 'Functions', icon: Layers, count: contract.functions.length },
    { id: 'history', label: 'History', icon: History, count: contract.history.length },
    { id: 'invokes', label: 'Invokes (Dry-Run)', icon: PlayCircle, count: undefined },
    { id: 'forks', label: 'Forks', icon: GitFork, count: contract.forksCount },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare, count: contract.discussions.length },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'code') {
      navigate({ page: 'contract-overview', chain: contract.chain, contractId: contract.contractId });
    } else if (tabId === 'functions') {
      navigate({ page: 'functions-index', chain: contract.chain, contractId: contract.contractId });
    } else if (tabId === 'history') {
      navigate({ page: 'history', chain: contract.chain, contractId: contract.contractId });
    } else if (tabId === 'invokes') {
      openDryRun(contract, contract.functions[0]);
    } else if (tabId === 'forks') {
      navigate({ page: 'forks', chain: contract.chain, contractId: contract.contractId });
    } else if (tabId === 'discussions') {
      navigate({ page: 'discussions', chain: contract.chain, contractId: contract.contractId });
    }
  };

  return (
    <div className="w-full">
      {/* Top Contract Repo Header (Hugging Face + GitHub Fusion) */}
      <div className="border-b border-[#27272A] bg-[#0A0A0B] pt-5">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
          
          {/* Main Title & Action Buttons Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
            
            {/* Left: Avatar + Title + Visibility + Badges */}
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-2">
                <img
                  src={contract.ownerAvatar}
                  alt={contract.owner}
                  className="w-7 h-7 rounded-full object-cover border border-[#27272A]"
                />
                
                <h1 className="text-lg sm:text-xl font-bold text-[#FAFAFA] flex items-center gap-1 font-sans">
                  <span 
                    onClick={() => navigate({ page: 'profile', username: contract.owner })}
                    className="text-[#A1A1AA] hover:text-[#FAFAFA] cursor-pointer"
                  >
                    {contract.owner}
                  </span>
                  <span className="text-[#71717A]">/</span>
                  <span>{contract.name}</span>
                </h1>

                {/* Visibility Badge */}
                <span className="px-2 py-0.5 rounded-[9999px] text-[10px] font-mono uppercase bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                  {contract.visibility}
                </span>

                {/* Verified Badge */}
                {contract.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[9999px] text-[11px] font-mono text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Bytecode
                  </span>
                )}
              </div>

              {/* Chain:Network + Contract ID (Full mono, copyable, explorer link) */}
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <ChainBadge
                  chain={contract.chain}
                  network={contract.network}
                  contractId={contract.contractId}
                  truncateId={false}
                  showCopy={true}
                  showExplorer={true}
                  size="md"
                />
                <span className="text-[#71717A] text-[11px] font-mono hidden sm:inline">
                  WASM/Hash: {contract.bytecodeHash.slice(0, 16)}…
                </span>
              </div>
            </div>

            {/* Right: Actions (Like, Star, Fork, Open in Studio, Embed) */}
            <div className="flex items-center flex-wrap gap-2 font-mono text-xs">
              
              {/* Embed Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  setEmbedContract(contract);
                  setIsEmbedModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#111113] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] transition-colors"
                title="Embed contract badge or iframe"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Embed</span>
              </button>

              {/* Like toggle */}
              <button
                type="button"
                onClick={() => toggleLikeContract(contract.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#111113] hover:bg-[#18181B] border border-[#27272A] transition-colors ${
                  isLiked ? 'text-[#EF4444]' : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                }`}
                title="Like"
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{contract.likes + (isLiked ? 1 : 0)}</span>
              </button>

              {/* Star toggle */}
              <button
                type="button"
                onClick={() => toggleStarContract(contract.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#111113] hover:bg-[#18181B] border border-[#27272A] transition-colors ${
                  isStarred ? 'text-[#F59E0B]' : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                }`}
                title="Star"
              >
                <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
                <span>{contract.stars + (isStarred ? 1 : 0)}</span>
              </button>

              {/* Fork button */}
              <button
                type="button"
                onClick={() => forkContractToStudio(contract)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] border border-[#27272A] transition-colors font-medium"
                title="Fork to Contract Studio"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Fork</span>
                <span className="ml-0.5 text-[10px] text-[#A1A1AA] bg-[#27272A] px-1.5 rounded-full">
                  {contract.forksCount}
                </span>
              </button>

              {/* Open in Studio Button (Persistent Handshake requirement) */}
              <button
                type="button"
                onClick={() => forkContractToStudio(contract)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold transition-all shadow-sm active:scale-95"
              >
                <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Open in Studio</span>
              </button>

            </div>
          </div>

          {/* Sticky GitHub-style Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-[#27272A] pt-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#3B82F6] text-[#FAFAFA] font-semibold'
                      : 'border-transparent text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-[#3F3F46]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#3B82F6]' : 'text-[#71717A]'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-[#3B82F6]/20 text-[#93C5FD]'
                          : 'bg-[#18181B] text-[#71717A]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Main Page Area */}
      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 pb-20">
        {children}
      </main>
    </div>
  );
};
