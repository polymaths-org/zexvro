import React, { useState } from 'react';
import { 
  User, 
  Layers, 
  Heart, 
  Star, 
  GitFork, 
  Code2, 
  ExternalLink, 
  Copy, 
  Check,
  Calendar,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAvatarForUser } from '../utils/avatar';
import { ContractCard } from '../components/common/ContractCard';

interface UserProfilePageProps {
  username?: string;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ username = 'alex-dev' }) => {
  const { contracts, likedContractIds, starredContractIds, studioProjects = [], navigate } = useApp();
  const [activeTab, setActiveTab] = useState<'published' | 'liked' | 'starred' | 'studio'>('published');
  const [copiedWallet, setCopiedWallet] = useState(false);

  const publishedContracts = contracts.filter((c) => c.owner === username);
  const likedContracts = contracts.filter((c) => likedContractIds.includes(c.id));
  const starredContracts = contracts.filter((c) => starredContractIds.includes(c.id));

  const copyWallet = () => {
    navigator.clipboard.writeText('GAAXW4T3Y6W5M2Z23M8LKP0991V1K83L6PQQ901X1Z');
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 1800);
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-8">
      
      {/* Profile Header */}
      <div className="p-6 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <img
            src={getAvatarForUser(username)}
            alt={username}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#27272A]"
          />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#FAFAFA] flex items-center gap-2">
              <span>Alex Vance</span>
              <span className="text-xs text-[#71717A] font-mono">@{username}</span>
            </h1>
            <p className="text-xs text-[#A1A1AA] max-w-lg">
              Smart contract developer building low-overhead AMMs and passkey account abstraction on Stellar Soroban & Base.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-[#71717A] pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Joined Sept 2024
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> alexvance.eth
              </span>
            </div>
          </div>
        </div>

        {/* Public Key Pill */}
        <div className="flex items-center gap-2 p-2 rounded-[6px] bg-[#111113] border border-[#27272A] font-mono text-xs">
          <span className="text-[#71717A]">Stellar:</span>
          <span className="text-[#A1A1AA]">GAAX…01X1Z</span>
          <button
            type="button"
            onClick={copyWallet}
            className="p-1 rounded text-[#71717A] hover:text-[#FAFAFA]"
          >
            {copiedWallet ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#27272A] flex gap-2 font-mono text-xs">
        {[
          { id: 'published', label: 'Published Contracts', icon: Layers, count: publishedContracts.length },
          { id: 'starred', label: 'Starred', icon: Star, count: starredContracts.length },
          { id: 'liked', label: 'Liked', icon: Heart, count: likedContracts.length },
          { id: 'studio', label: 'Studio Drafts', icon: Code2, count: studioProjects.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
                isActive
                  ? 'border-[#3B82F6] text-[#FAFAFA] font-semibold'
                  : 'border-transparent text-[#71717A] hover:text-[#FAFAFA]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#18181B] text-[10px] text-[#A1A1AA]">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'published' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedContracts.map((c) => (
              <ContractCard key={c.id} contract={c} />
            ))}
          </div>
        )}

        {activeTab === 'starred' && (
          starredContracts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#71717A] font-mono border border-[#27272A] rounded-[8px]">
              No starred contracts yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {starredContracts.map((c) => (
                <ContractCard key={c.id} contract={c} />
              ))}
            </div>
          )
        )}

        {activeTab === 'liked' && (
          likedContracts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#71717A] font-mono border border-[#27272A] rounded-[8px]">
              No liked contracts yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {likedContracts.map((c) => (
                <ContractCard key={c.id} contract={c} />
              ))}
            </div>
          )
        )}

        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studioProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate({ page: 'studio-workspace', projectId: p.id })}
                className="p-4 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#3F3F46] cursor-pointer transition-colors space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FAFAFA]">{p.name}</span>
                  <span className="text-[10px] text-[#3B82F6]">{p.chain}:{p.network}</span>
                </div>
                <p className="text-[#71717A] text-[11px]">
                  {p.files.length} files • Language: {p.language} • Last modified {p.lastSaved}
                </p>
                <div className="pt-2 text-[#3B82F6] hover:underline flex items-center gap-1">
                  <span>Open workspace →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
