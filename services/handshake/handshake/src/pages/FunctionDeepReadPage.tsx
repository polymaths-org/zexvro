import React, { useState } from 'react';
import { 
  ChevronRight, 
  Layers, 
  Copy, 
  Check, 
  Play, 
  Sparkles, 
  Network, 
  History, 
  ShieldCheck, 
  Cpu, 
  ExternalLink,
  Code2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract, ContractFunction } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';
import { GasStorageLens } from '../components/common/GasStorageLens';
import { ContractGraphCanvas } from '../components/common/ContractGraphCanvas';

interface FunctionDeepReadPageProps {
  contract: SmartContract;
  functionName: string;
}

export const FunctionDeepReadPage: React.FC<FunctionDeepReadPageProps> = ({
  contract,
  functionName,
}) => {
  const { navigate, openDryRun, openAiExplain, forkContractToStudio } = useApp();
  const [copiedCode, setCopiedCode] = useState(false);

  // Find function or fallback — guard against empty function list (new draft publish).
  const fn = contract.functions.find((f) => f.name === functionName) || contract.functions[0] || null;
  if (!fn) {
    return (
      <ContractRepoLayout contract={contract} activeTab="functions">
        <div className="p-8 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] text-center space-y-3">
          <Layers className="w-8 h-8 mx-auto text-[#52525B]" />
          <h2 className="text-sm font-bold text-[#FAFAFA]">No functions indexed yet</h2>
          <p className="text-xs text-[#71717A] font-mono">This contract has no parsed functions — the source may be empty or the language detector missed it. Check the Code tab for the raw source.</p>
          <button type="button" onClick={() => navigate({ page: 'contract-overview', chain: contract.chain, contractId: contract.contractId })} className="text-xs text-[#3B82F6] hover:underline font-mono">← Back to contract</button>
        </div>
      </ContractRepoLayout>
    );
  }
  const fnSource: string = (fn as any).sourceCode ?? (fn as any).sourceSlice ?? contract.files[0]?.content?.slice(0, 4000) ?? '// no source';
  const handleCopyCode = () => {
    navigator.clipboard.writeText(fnSource);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <ContractRepoLayout contract={contract} activeTab="functions">
      <div className="space-y-6">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#A1A1AA]">
          <span
            onClick={() => navigate({ page: 'contract-overview', chain: contract.chain, contractId: contract.contractId })}
            className="hover:text-[#FAFAFA] cursor-pointer text-[#3B82F6]"
          >
            {contract.name}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
          <span
            onClick={() => navigate({ page: 'functions-index', chain: contract.chain, contractId: contract.contractId })}
            className="hover:text-[#FAFAFA] cursor-pointer"
          >
            functions
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
          <span className="text-[#FAFAFA] font-semibold">fn {fn.name}()</span>
        </div>

        {/* Function Title Banner */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                {fn.visibility}
              </span>
              <h2 className="text-xl font-mono font-bold text-[#FAFAFA]">
                fn {fn.name}()
              </h2>
            </div>
            <p className="text-xs text-[#A1A1AA] font-mono">
              Defined in <span className="text-[#FAFAFA]">src/lib.rs</span> lines {fn.sourceLines[0]}–{fn.sourceLines[1]}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => openAiExplain(contract, fn)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#111113] hover:bg-[#18181B] border border-[#3B82F6]/40 text-[#93C5FD] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>AI Lens Explain</span>
            </button>

            <button
              type="button"
              onClick={() => openDryRun(contract, fn)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold transition-all shadow-sm active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Dry-Run Invoke</span>
            </button>
          </div>
        </div>

        {/* Two-Column Deep Read Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Source Code + Documentation + Arguments */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Isolated Source Code Block */}
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111113] border-b border-[#27272A] text-xs font-mono">
                <span className="text-[#A1A1AA]">
                  Isolated Function Source (Lines {fn.sourceLines[0]}–{fn.sourceLines[1]})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-[11px]"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => forkContractToStudio(contract)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-[11px]"
                  >
                    <Code2 className="w-3 h-3 text-[#3B82F6]" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 font-mono text-xs leading-6 text-[#D4D4D8] overflow-x-auto whitespace-pre bg-[#050505]">
                {fnSource}
              </pre>
            </div>

            {/* Comprehensive Documentation & Specification */}
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-5 space-y-4">
              <h3 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono border-b border-[#27272A] pb-2">
                Documentation & Invariants
              </h3>

              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {fn.fullDocs || fn.docExcerpt}
              </p>

              {/* Arguments list */}
              {fn.arguments.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-[#71717A] uppercase">
                    Parameter Signatures & Constraints:
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {fn.arguments.map((arg) => (
                      <div
                        key={arg.name}
                        className="p-2.5 rounded bg-[#111113] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#FAFAFA]">{arg.name}</span>
                          <span className="text-[#71717A]">:</span>
                          <span className="text-[#3B82F6]">{arg.type}</span>
                        </div>
                        <span className="text-[#71717A] text-[11px] font-sans">{arg.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Col: Performance Lens + Callers/Callees Graph + History */}
          <div className="space-y-6">
            
            {/* Performance Lens Card */}
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-4 space-y-3 font-mono text-xs">
              <h3 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider border-b border-[#27272A] pb-2">
                Gas & Storage Lens
              </h3>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">CPU Gas Rating:</span>
                  <span className="text-[#22C55E] font-bold">{fn.gasRating} ({fn.gasEstimate.toLocaleString()} units)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">Storage Footprint:</span>
                  <span className="text-[#FAFAFA]">{fn.storageWrites} writes, {fn.storageReads} reads</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">Auth Enforced:</span>
                  <span className={fn.requiresAuth ? 'text-[#60A5FA]' : 'text-[#71717A]'}>
                    {fn.requiresAuth ? 'Yes (require_auth)' : 'No (Public view)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717A]">Events Emitted:</span>
                  <span className="text-[#3B82F6]">{fn.eventsEmitted.length} event types</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => openDryRun(contract, fn)}
                  className="w-full py-2 rounded bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] font-medium transition-colors text-center"
                >
                  Test In Dry-Run Sandbox →
                </button>
              </div>
            </div>

            {/* Callers & Callees AST Mini-Map & Canvas */}
            <div className="rounded-[8px] border border-[#232732] bg-[#101217] p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#232732] pb-2">
                <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5 uppercase text-[11px]">
                  <Network className="w-3.5 h-3.5 text-[#3B82F6]" />
                  Call Graph & Neighbors
                </span>
                <span className="text-[10px] text-[#22C55E]">AST Focused</span>
              </div>

              {/* Mini Interactive Canvas */}
              <div className="rounded overflow-hidden border border-[#232732]">
                <ContractGraphCanvas
                  contract={contract}
                  selectedFunction={fn.name}
                  height={180}
                  allowExpand={false}
                  onSelectFunction={(selectedName) => {
                    navigate({
                      page: 'function-deep-read',
                      chain: contract.chain,
                      contractId: contract.contractId,
                      fnName: selectedName,
                      functionName: selectedName,
                    });
                  }}
                />
              </div>

              <div className="space-y-3 pt-1">
                {(() => {
                  // callees/callers are not in the persisted ContractFunction type — derive from callGraph instead.
                  const callees: string[] = (fn as any).callees ?? (() => {
                    const edges = contract.callGraph?.edges ?? [];
                    return edges.filter((e: any) => e.from === `fn-${fn.name}` || e.from === fn.name).map((e: any) => e.to.replace(/^fn-/, ''));
                  })();
                  const callers: string[] = (fn as any).callers ?? (() => {
                    const edges = contract.callGraph?.edges ?? [];
                    return edges.filter((e: any) => e.to === `fn-${fn.name}` || e.to === fn.name).map((e: any) => e.from.replace(/^fn-/, ''));
                  })();
                  return (
                    <>
                      <div>
                        <span className="text-[10px] text-[#6C7280] uppercase block mb-1">Direct Callees:</span>
                        <div className="space-y-1">
                          {callees.length === 0 ? (
                            <span className="text-[11px] text-[#52525B]">— none tracked</span>
                          ) : callees.map((callee: string) => (
                            <div
                              key={callee}
                              onClick={() => {
                                const targetFn = contract.functions.find(f => f.name === callee);
                                if (targetFn) navigate({ page: 'function-deep-read', chain: contract.chain, contractId: contract.contractId, fnName: callee, functionName: callee });
                              }}
                              className="p-1.5 rounded bg-[#16181F] border border-[#232732] text-[#9BA2B0] hover:text-[#FAFAFA] hover:border-[#333846] cursor-pointer transition-colors"
                            >
                              ↳ {callee}()
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#6C7280] uppercase block mb-1">Direct Callers:</span>
                        <div className="space-y-1">
                          {callers.length === 0 ? (
                            <span className="text-[11px] text-[#52525B]">— none tracked</span>
                          ) : callers.map((caller: string) => (
                            <div
                              key={caller}
                              onClick={() => {
                                const targetFn = contract.functions.find(f => f.name === caller);
                                if (targetFn) navigate({ page: 'function-deep-read', chain: contract.chain, contractId: contract.contractId, fnName: caller, functionName: caller });
                              }}
                              className="p-1.5 rounded bg-[#16181F] border border-[#232732] text-[#9BA2B0] hover:text-[#FAFAFA] hover:border-[#333846] cursor-pointer transition-colors"
                            >
                              ↰ {caller}()
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Function History */}
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5 uppercase text-[11px]">
                  <History className="w-3.5 h-3.5 text-[#A1A1AA]" />
                  Function Evolution
                </span>
              </div>

              <p className="text-[11px] text-[#71717A]">
                Last modified in commit <span className="text-[#3B82F6]">#7a1b9c</span> with gas optimization (-18% CPU instructions).
              </p>
            </div>

          </div>

        </div>

      </div>
    </ContractRepoLayout>
  );
};
