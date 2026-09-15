import React, { useState } from 'react';
import { 
  History, 
  GitCommit, 
  Sliders, 
  ArrowRight, 
  ChevronRight, 
  Check, 
  Layers, 
  Calendar,
  Zap,
  Code
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract, CommitHistoryItem } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';

interface ContractHistoryPageProps {
  contract: SmartContract;
}

export const ContractHistoryPage: React.FC<ContractHistoryPageProps> = ({ contract }) => {
  const [selectedCommitIdx, setSelectedCommitIdx] = useState(0);
  const [diffMode, setDiffMode] = useState<'split' | 'inline'>('split');
  const [selectedFunctionDiff, setSelectedFunctionDiff] = useState<'swap' | 'deposit'>('swap');

  // History may be empty (new publish) or have only 1 entry — guard honestly.
  const history = contract.history && contract.history.length > 0 ? contract.history : [];
  const selectedCommit = history[selectedCommitIdx] || history[0] || null;
  if (!selectedCommit || history.length === 0) {
    return (
      <ContractRepoLayout contract={contract} activeTab="history">
        <div className="p-8 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] text-center space-y-3">
          <History className="w-8 h-8 mx-auto text-[#52525B]" />
          <h2 className="text-sm font-bold text-[#FAFAFA]">No history yet</h2>
          <p className="text-xs text-[#71717A] font-mono max-w-md mx-auto">
            This contract was just published — history is the publish commit. Future re-publishes over the same
            chain · network · address will appear here as a timeline.
          </p>
          <p className="text-[11px] text-[#52525B] font-mono">Initial commit: #{history[0]?.hash ?? contract.id.slice(-6)} · by {contract.owner}</p>
        </div>
      </ContractRepoLayout>
    );
  }

  // Function diff mock data
  const swapDiffBefore = `pub fn swap(
    e: Env,
    user: Address,
    amount_in: i128,
    min_amount_out: i128,
) -> i128 {
    user.require_auth();
    // V1 naive balance read
    let reserve_a: i128 = e.storage().instance().get(&DataKey::ReserveA).unwrap();
    let reserve_b: i128 = e.storage().instance().get(&DataKey::ReserveB).unwrap();
    let amount_out = (amount_in * 997 * reserve_b) / (reserve_a * 1000 + amount_in * 997);
    if amount_out < min_amount_out {
        panic!("Slippage exceeded");
    }
    amount_out
}`;

  const swapDiffAfter = `pub fn swap(
    e: Env,
    user: Address,
    amount_in: i128,
    min_amount_out: i128,
) -> i128 {
    user.require_auth();
    // V2: Single-pass storage read + fee check
    let (reserve_a, reserve_b) = Self::get_reserves_cached(&e);
    let fee_numerator = 997;
    let fee_denominator = 1000;
    let amount_out = (amount_in * fee_numerator * reserve_b) / (reserve_a * fee_denominator + amount_in * fee_numerator);
    assert!(amount_out >= min_amount_out, "Error: Slippage tolerance exceeded");
    Self::update_reserves_atomic(&e, reserve_a + amount_in, reserve_b - amount_out);
    e.events().publish((symbol_short!("swap"), user), amount_out);
    amount_out
}`;

  return (
    <ContractRepoLayout contract={contract} activeTab="history">
      <div className="space-y-6">
        
        {/* Header and Time-Travel Slider */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#3B82F6]" />
              <h2 className="text-sm font-bold text-[#FAFAFA] uppercase tracking-wider font-mono">
                Time-Travel History Slider
              </h2>
            </div>
            <span className="text-xs font-mono text-[#A1A1AA]">
              Scrub backward through contract upgrades & state modifications
            </span>
          </div>

          {/* Scrub Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={contract.history.length - 1}
              step={1}
              value={selectedCommitIdx}
              onChange={(e) => setSelectedCommitIdx(Number(e.target.value))}
              className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
            />
            <div className="flex items-center justify-between text-xs font-mono text-[#71717A]">
              <span>v2.1 (Latest)</span>
              <span>v2.0 (Gas optimization)</span>
              <span>v1.0 (Genesis)</span>
            </div>
          </div>

          {/* Current Commit Box — honest fields, no dummy gasDelta */}
          <div className="p-3 rounded bg-[#111113] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <GitCommit className="w-4 h-4 text-[#3B82F6] shrink-0" />
              <div>
                <div className="font-semibold text-[#FAFAFA]">{selectedCommit.message}</div>
                <div className="text-[11px] text-[#71717A]">
                  Commit <span className="text-[#3B82F6]">{selectedCommit.hash}</span> by {selectedCommit.author} • {(selectedCommit as any).timestamp ?? (selectedCommit as any).date ?? contract.updatedAt}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-[#71717A] max-w-[220px] truncate" title={(selectedCommit as any).changesSummary ?? selectedCommit.diffSnippet}>
                {(selectedCommit as any).changesSummary ?? selectedCommit.diffSnippet.slice(0, 80)}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                {(selectedCommit as any).functionsChanged?.length ?? contract.functions.length} functions
              </span>
            </div>
          </div>
        </div>

        {/* Function-Level Diff Viewer (Novel Deep-Think Feature #1) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-sm font-semibold text-[#FAFAFA]">
                Function AST Diff: fn {selectedFunctionDiff}()
              </h3>
            </div>

            {/* Toggle Split vs Inline Diff */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="flex rounded border border-[#27272A] bg-[#111113] p-0.5">
                <button
                  type="button"
                  onClick={() => setDiffMode('split')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    diffMode === 'split' ? 'bg-[#27272A] text-[#FAFAFA]' : 'text-[#71717A]'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMode('inline')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    diffMode === 'inline' ? 'bg-[#27272A] text-[#FAFAFA]' : 'text-[#71717A]'
                  }`}
                >
                  Unified
                </button>
              </div>
            </div>
          </div>

          {/* Diff comparison table */}
          {diffMode === 'split' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              {/* Previous Version */}
              <div className="rounded-[8px] border border-[#EF4444]/30 bg-[#0A0A0B] overflow-hidden">
                <div className="px-3.5 py-2 bg-[#EF4444]/10 border-b border-[#EF4444]/20 text-[#EF4444] font-semibold flex items-center justify-between">
                  <span>- Previous Implementation (Commit #3c2a11)</span>
                  <span>14.2k Gas</span>
                </div>
                <pre className="p-3 text-[#A1A1AA] overflow-x-auto whitespace-pre leading-5 text-[11px] bg-[#050505]">
                  {swapDiffBefore}
                </pre>
              </div>

              {/* Upgraded Version */}
              <div className="rounded-[8px] border border-[#22C55E]/30 bg-[#0A0A0B] overflow-hidden">
                <div className="px-3.5 py-2 bg-[#22C55E]/10 border-b border-[#22C55E]/20 text-[#22C55E] font-semibold flex items-center justify-between">
                  <span>+ Upgraded Implementation (Current)</span>
                  <span>11.6k Gas (-18%)</span>
                </div>
                <pre className="p-3 text-[#FAFAFA] overflow-x-auto whitespace-pre leading-5 text-[11px] bg-[#050505]">
                  {swapDiffAfter}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden text-xs font-mono">
              <div className="px-4 py-2 bg-[#111113] border-b border-[#27272A] text-[#71717A]">
                Unified Diff for fn {selectedFunctionDiff}()
              </div>
              <div className="p-3 space-y-1 bg-[#050505] text-[11px] overflow-x-auto">
                <div className="text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
                  - let reserve_a: i128 = e.storage().instance().get(&DataKey::ReserveA).unwrap();
                </div>
                <div className="text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
                  - let reserve_b: i128 = e.storage().instance().get(&DataKey::ReserveB).unwrap();
                </div>
                <div className="text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                  + let (reserve_a, reserve_b) = Self::get_reserves_cached(&e);
                </div>
                <div className="text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                  + Self::update_reserves_atomic(&e, reserve_a + amount_in, reserve_b - amount_out);
                </div>
                <div className="text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                  + e.events().publish((symbol_short!("swap"), user), amount_out);
                </div>
              </div>
            </div>
          )}
        </div>

        {/* All Commits List */}
        <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden text-xs font-mono">
          <div className="px-4 py-2.5 bg-[#111113] border-b border-[#27272A] text-[#FAFAFA] font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#A1A1AA]" />
              Full Commit History ({contract.history.length})
            </span>
          </div>

          <div className="divide-y divide-[#18181B]">
            {history.map((commit: any, idx: number) => (
              <div
                key={commit.hash}
                onClick={() => setSelectedCommitIdx(idx)}
                className={`p-3.5 flex items-center justify-between hover:bg-[#111113] cursor-pointer transition-colors ${
                  selectedCommitIdx === idx ? 'bg-[#18181B]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <GitCommit className="w-4 h-4 text-[#3B82F6]" />
                  <div>
                    <div className="font-semibold text-[#FAFAFA]">{commit.message}</div>
                    <div className="text-[11px] text-[#71717A]">
                      {commit.author} committed on {commit.timestamp ?? commit.date ?? contract.updatedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#3B82F6] font-semibold">{commit.hash}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ContractRepoLayout>
  );
};
