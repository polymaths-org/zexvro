import React from 'react';
import { GitFork, Star, ArrowUpRight, Code2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';
import { ChainBadge } from '../components/common/ChainBadge';

interface ContractForksPageProps {
  contract: SmartContract;
}

export const ContractForksPage: React.FC<ContractForksPageProps> = ({ contract }) => {
  const { navigateToContract, forkContractToStudio } = useApp();

  const mockForks = [
    {
      id: 'fork-1',
      owner: 'defi-labs-hq',
      name: 'concentrated-amm-soroban',
      contractId: 'C888B5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X99',
      chain: contract.chain,
      network: contract.network,
      stars: 94,
      forks: 18,
      changesSummary: '+ Added tick index arithmetic and Uniswap v3 style fee tiers (0.05%, 0.3%, 1%).',
      updatedAt: '2 days ago',
    },
    {
      id: 'fork-2',
      owner: 'anchors-network',
      name: 'stable-swap-soroban',
      contractId: 'CB99B5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X77',
      chain: contract.chain,
      network: contract.network,
      stars: 48,
      forks: 6,
      changesSummary: '+ Replaced constant product (x*y=k) with Curve StableSwap invariant for 1:1 pegged assets.',
      updatedAt: '1 week ago',
    },
    {
      id: 'fork-3',
      owner: 'soroban-auditors',
      name: 'soroban-amm-formal-verified',
      contractId: 'CA33B5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X12',
      chain: contract.chain,
      network: contract.network,
      stars: 120,
      forks: 31,
      changesSummary: '+ Formally verified arithmetic overflows with Kani Rust verifier; added safety assertions.',
      updatedAt: '2 weeks ago',
    },
  ];

  return (
    <ContractRepoLayout contract={contract} activeTab="forks">
      <div className="space-y-6">
        
        {/* Banner */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#FAFAFA] flex items-center gap-2">
              <GitFork className="w-5 h-5 text-[#3B82F6]" />
              Remix & Fork Network ({contract.forksCount})
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Forks created by developers who built on top of this contract&rsquo;s audited core.
            </p>
          </div>

          <button
            type="button"
            onClick={() => forkContractToStudio(contract)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all shadow-sm active:scale-95"
          >
            <GitFork className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Fork to Studio</span>
          </button>
        </div>

        {/* Forks List */}
        <div className="space-y-3">
          {mockForks.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#3F3F46] transition-colors space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-[#A1A1AA]" />
                  <span
                    onClick={() => navigateToContract(f.chain, f.contractId)}
                    className="text-sm font-semibold font-mono text-[#FAFAFA] hover:text-[#3B82F6] cursor-pointer"
                  >
                    {f.owner}/{f.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs text-[#71717A]">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-[#F59E0B]" />
                    {f.stars}
                  </span>
                  <span>{f.forks} forks</span>
                  <span>{f.updatedAt}</span>
                </div>
              </div>

              {/* Chain Badge */}
              <div>
                <ChainBadge
                  chain={f.chain}
                  network={f.network}
                  contractId={f.contractId}
                  truncateId={true}
                  showCopy={true}
                />
              </div>

              {/* Changes Summary */}
              <div className="p-2.5 rounded bg-[#111113] border border-[#27272A] text-xs font-mono text-[#A1A1AA]">
                {f.changesSummary}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => forkContractToStudio(contract, f.name)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] border border-[#27272A]"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Open Fork in Studio</span>
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </ContractRepoLayout>
  );
};
