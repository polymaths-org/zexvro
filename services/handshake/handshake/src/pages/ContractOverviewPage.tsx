import React, { useState } from 'react';
import {
  File,
  Folder,
  GitBranch,
  BookOpen,
  Layers,
  Code2,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';
import { GasStorageLens } from '../components/common/GasStorageLens';
import { LanguageBadge } from '../components/common/LanguageBadge';
import { getChain } from '../data/chains';
import { Button } from '../components/ui/Button';

interface ContractOverviewPageProps {
  contract: SmartContract;
}

export const ContractOverviewPage: React.FC<ContractOverviewPageProps> = ({ contract }) => {
  const { navigate, navigateToFunction, forkContractToStudio } = useApp();
  const [selectedBranch, setSelectedBranch] = useState(contract.primaryBranch);
  const [hasCopiedCli, setHasCopiedCli] = useState(false);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  const rootFiles = contract.files ?? [];
  // Code-first: primary file is the one the publish wizard writes as src/lib.rs, or the largest file.
  const primaryFile =
    rootFiles.find((f) => f.path === 'src/lib.rs') ||
    rootFiles.find((f) => f.type === 'file') ||
    null;
  const primaryContent: string =
    primaryFile?.content ?? (contract as any).source ?? '';
  const primaryLines = primaryContent ? primaryContent.split('\n') : [];
  const showCode = primaryContent.trim().length > 10;

  const copyCliCommand = () => {
    navigator.clipboard.writeText(
      `stellar contract invoke --id ${contract.contractId} --source-account <ACCOUNT> -- ${contract.functions[0]?.name || 'run'}`
    );
    setHasCopiedCli(true);
    setTimeout(() => setHasCopiedCli(false), 2000);
  };
  const copyCode = () => {
    if (!primaryContent) return;
    navigator.clipboard.writeText(primaryContent);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 1800);
  };

  // README: honest — render what was published, not a dummy template.
  // The wizard builds readme as `# name\n fullDescription`. If the contract has a real readme, show it.
  // Otherwise fall back to description. Never invent invariants.
  const rawReadme: string = (contract.readme && contract.readme.trim().length > 10)
    ? contract.readme
    : contract.description || '';
  const hasReadme = rawReadme.trim().length > 0;

  return (
    <ContractRepoLayout contract={contract} activeTab="code">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: CODE FIRST, then functions, then README, then file explorer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Branch & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#18181B] border border-[#2B3144] text-[#FAFAFA] shadow-xs">
                <GitBranch className="w-3.5 h-3.5 text-[#3B82F6]" />
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-transparent text-[#FAFAFA] font-mono focus:outline-none cursor-pointer text-xs"
                >
                  {contract.branches.map((b) => (
                    <option key={b} value={b} className="bg-[#11131C] text-[#FAFAFA]">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[#7C8497] text-[11px] hidden sm:inline">
                {contract.branches.length} branch{contract.branches.length !== 1 ? 'es' : ''} · {contract.language}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate({ page: 'file-browser', chain: contract.chain, contractId: contract.contractId, branch: selectedBranch })}
              >
                Browse all files
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => forkContractToStudio(contract)}
                className="gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Open in Studio</span>
              </Button>
            </div>
          </div>

          {/* 1) CODE FIRST — the real source, not a dummy */}
          {showCode ? (
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111113] border-b border-[#27272A] text-xs font-mono">
                <div className="flex items-center gap-2 text-[#A1A1AA]">
                  <File className="w-3.5 h-3.5" />
                  <span className="text-[#FAFAFA] font-semibold">{primaryFile?.path ?? 'src/lib.rs'}</span>
                  <span className="hidden sm:inline">· {primaryLines.length} lines · {Math.max(1, Math.round(primaryContent.length / 1024))} KB</span>
                  <span className="hidden md:inline text-[#52525B]">· {contract.language}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] transition-colors"
                  >
                    {hasCopiedCode ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{hasCopiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'file-reader', chain: contract.chain, contractId: contract.contractId, branch: selectedBranch, filePath: primaryFile?.path ?? 'src/lib.rs' })}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Open file</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[560px] overflow-y-auto p-2 font-mono text-xs leading-6 bg-[#050505]">
                <table className="w-full border-collapse">
                  <tbody>
                    {primaryLines.slice(0, 400).map((lineText, idx) => {
                      const lineNum = idx + 1;
                      return (
                        <tr key={lineNum} className="hover:bg-[#18181B]/60">
                          <td className="w-12 text-right pr-4 select-none text-[#52525B] align-top py-0.5">{lineNum}</td>
                          <td className="pl-2 pr-4 text-[#D4D4D8] whitespace-pre py-0.5">{lineText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {primaryLines.length > 400 && (
                  <div className="mt-2 text-center">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'file-reader', chain: contract.chain, contractId: contract.contractId, branch: selectedBranch, filePath: primaryFile?.path ?? 'src/lib.rs' })}
                      className="text-xs font-mono text-[#3B82F6] hover:underline"
                    >
                      Show full file ({primaryLines.length} lines) →
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#27272A] bg-[#0A0A0B] p-6 text-center space-y-2">
              <p className="text-xs font-mono text-[#71717A]">No source file published yet</p>
              <p className="text-xs text-[#52525B] max-w-md mx-auto">
                This entry is metadata-only. The author can re-publish over the same chain · network · address with source.
              </p>
              <button
                type="button"
                onClick={() => navigate({ page: 'file-browser', chain: contract.chain, contractId: contract.contractId })}
                className="text-xs text-[#3B82F6] hover:underline font-mono"
              >
                Browse files →
              </button>
            </div>
          )}

          {/* 2) FUNCTIONS — now the explicit "check all functions" step */}
          <div className="rounded-[8px] border border-[#232838] bg-[#0A0A0B] p-4 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-[#232838] pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono">
                  Functions {contract.functions.length > 0 ? `· ${contract.functions.length}` : ''}
                </h3>
              </div>
              {contract.functions.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate({ page: 'functions-index', chain: contract.chain, contractId: contract.contractId })}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-bold transition-colors"
                >
                  Check all functions
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{contract.functions.length}</span>
                </button>
              )}
            </div>

            {contract.functions.length === 0 ? (
              <p className="text-xs text-[#71717A] font-mono py-2">No functions parsed — add source with entry points to see them here.</p>
            ) : (
              <div className="divide-y divide-[#1C202E] text-xs font-mono">
                {contract.functions.slice(0, 5).map((fn) => (
                  <div
                    key={fn.id}
                    onClick={() => navigateToFunction(contract.chain, contract.contractId, fn.name)}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#181C2A] px-2 rounded cursor-pointer transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#FAFAFA] group-hover:text-[#3B82F6] transition-colors">
                          fn {fn.name}()
                        </span>
                        <span className="text-[10px] text-[#7C8497]">L{fn.sourceLines[0]}–{fn.sourceLines[1]}</span>
                      </div>
                      <div className="text-[11px] text-[#7C8497] truncate font-sans mt-0.5">{fn.docExcerpt}</div>
                    </div>
                    <GasStorageLens fn={fn} compact={true} />
                  </div>
                ))}
                {contract.functions.length > 5 && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'functions-index', chain: contract.chain, contractId: contract.contractId })}
                      className="text-xs font-mono text-[#3B82F6] hover:underline"
                    >
                      + {contract.functions.length - 5} more — view full index →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3) README — honest, from questionnaire, not dummy invariants */}
          <div className="rounded-[8px] border border-[#232838] bg-[#0A0A0B] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#111113] border-b border-[#232838] text-xs font-mono text-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#3B82F6]" />
                <span className="font-semibold">README.md</span>
                {hasReadme ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#86efac] border border-[#22C55E]/25">from publisher</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#202538] text-[#9BA2B0] border border-[#2E354C]">no readme yet</span>
                )}
              </div>
              <span className="text-[11px] text-[#7C8497] font-sans hidden sm:inline">
                {contract.verified ? 'Source hash on record' : 'Unverified — hash is audit trail only'}
              </span>
            </div>

            <div className="p-6 text-xs leading-relaxed space-y-5 font-sans">
              {!hasReadme ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#FAFAFA]">{contract.name}</p>
                  <p className="text-xs text-[#71717A] max-w-md mx-auto">
                    The publisher didn't add a README. The description below is all we have — ask them to re-publish with the questionnaire in step 2.
                  </p>
                  {contract.description && (
                    <p className="text-xs text-[#A1A1AA] bg-[#111113] border border-[#27272A] rounded p-3 text-left whitespace-pre-wrap">{contract.description}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Render readme as markdown-lite: headings + paragraphs + code fences */}
                  <div className="space-y-3 text-[#A1A1AA]">
                    {rawReadme.split('\n').map((line, i) => {
                      const t = line.trimEnd();
                      if (t.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-[#FAFAFA] tracking-tight border-b border-[#232838] pb-2">{t.slice(2)}</h2>;
                      if (t.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-[#FAFAFA] mt-4">{t.slice(3)}</h3>;
                      if (t.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-[#FAFAFA] uppercase tracking-wider mt-3">{t.slice(4)}</h4>;
                      if (t.startsWith('- ') || t.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-[#9BA2B0]">{t.slice(2)}</li>;
                      if (t.startsWith('```')) return <div key={i} className="h-px bg-[#232838] my-2" />;
                      if (t.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[#3B82F6]/40 pl-3 text-[#93C5FD] italic">{t.slice(2)}</blockquote>;
                      if (t.trim() === '') return <div key={i} className="h-2" />;
                      // inline code `...`
                      const parts = t.split(/(`[^`]+`)/g);
                      return (
                        <p key={i} className="text-xs leading-relaxed whitespace-pre-wrap">
                          {parts.map((p, j) =>
                            p.startsWith('`') ? (
                              <code key={j} className="px-1 py-0.5 rounded bg-[#141724] border border-[#2B3144] text-[#93C5FD] font-mono text-[11px]">{p.slice(1, -1)}</code>
                            ) : (
                              <span key={j}>{p}</span>
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
                </>
              )}

              {/* CLI snippet — always real, never dummy */}
              <div className="space-y-1.5 pt-4 border-t border-[#232838]">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#7C8497] uppercase">
                  <span>Invoke</span>
                  <button type="button" onClick={copyCliCommand} className="flex items-center gap-1 text-[#3B82F6] hover:text-[#60A5FA] cursor-pointer">
                    {hasCopiedCli ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                    <span>{hasCopiedCli ? 'Copied' : 'Copy command'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-[6px] bg-[#0A0C13] border border-[#232838] font-mono text-xs text-[#93C5FD] overflow-x-auto">
                  stellar contract invoke --id {contract.contractId} --source-account &lt;ACCOUNT&gt; -- {contract.functions[0]?.name || 'run'} ...
                </div>
              </div>

              {/* Audit trail — sourceHash is the integrity hash, not a fake audit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="p-3 rounded-[6px] bg-[#0F121C] border border-[#232838] space-y-1">
                  <div className="text-[#7C8497] text-[10px] uppercase font-bold">
                    {contract.verified ? 'Source SHA-256 · match proven' : 'Source SHA-256 · audit trail'}
                  </div>
                  <div className={`${contract.verified ? 'text-[#22C55E]' : 'text-[#9BA2B0]'} font-medium truncate`} title={(contract as any).sourceHash || 'No source hash recorded'}>
                    {(contract as any).sourceHash || contract.bytecodeHash || '—'}
                  </div>
                  {!contract.verified && <div className="text-[10px] text-[#7C8497] font-sans">Hash proves what was published — not that it runs at this address.</div>}
                </div>
                <div className="p-3 rounded-[6px] bg-[#0F121C] border border-[#232838] space-y-1">
                  <div className="text-[#7C8497] text-[10px] uppercase font-bold">Compiler Toolchain</div>
                  <div className="text-[#FAFAFA] font-medium truncate">{contract.compilerVersion || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 4) File explorer — last, because code is already shown above */}
          {rootFiles.length > 0 && (
            <div className="rounded-[8px] border border-[#232838] bg-[#0A0A0B] overflow-hidden text-xs font-mono">
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#121522] border-b border-[#232838] text-[#7C8497] text-[11px]">
                <span>Files · {rootFiles.length}</span>
                <span className="hidden sm:inline">Last commit</span>
                <span>Updated</span>
              </div>
              <div className="divide-y divide-[#1C202E]">
                {rootFiles.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => {
                      if (file.type === 'dir') {
                        navigate({ page: 'file-browser', chain: contract.chain, contractId: contract.contractId, branch: selectedBranch, filePath: file.path });
                      } else {
                        navigate({ page: 'file-reader', chain: contract.chain, contractId: contract.contractId, branch: selectedBranch, filePath: file.path });
                      }
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#181C2A] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type === 'dir' ? <Folder className="w-4 h-4 text-[#3B82F6] shrink-0 fill-[#3B82F6]/20" /> : <File className="w-4 h-4 text-[#7C8497] group-hover:text-[#FAFAFA] shrink-0" />}
                      <span className="text-[#FAFAFA] font-medium group-hover:underline truncate">{file.name}</span>
                    </div>
                    <span className="text-[#7C8497] truncate max-w-xs text-[11px] hidden sm:inline font-sans">{file.lastCommitMessage}</span>
                    <span className="text-[#7C8497] text-[11px] shrink-0">{file.lastCommitTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right rail — honest metadata only */}
        <div className="space-y-6">
          <div className="rounded-[8px] border border-[#232838] bg-[#0A0A0B] p-4 space-y-4 text-xs font-mono">
            <h3 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider border-b border-[#232838] pb-2">Contract Metadata</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Chain</span>
                <span className="flex items-center gap-1.5 text-[#FAFAFA] font-semibold">
                  {(() => {
                    const meta = getChain(contract.chain);
                    return meta?.logo ? <img src={meta.logo} alt={`${meta.name} logo`} className="w-4 h-4 rounded-full object-cover bg-[#0A0A0B]" /> : null;
                  })()}
                  <span className="capitalize">{getChain(contract.chain)?.name ?? contract.chain}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Network</span>
                <span className="text-[#9BA2B0] uppercase">{contract.network}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Language</span>
                <LanguageBadge language={contract.language} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">License</span>
                <span className="text-[#FAFAFA]">{contract.license || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Publisher</span>
                <span className="text-[#FAFAFA]">@{contract.owner}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Updated</span>
                <span className="text-[#FAFAFA]">{contract.updatedAt}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#232838]">
              <span className="text-[10px] text-[#7C8497] uppercase block mb-1.5 font-bold">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {contract.tags.length === 0 ? (
                  <span className="text-[11px] text-[#52525B]">No tags</span>
                ) : (
                  contract.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-[9999px] bg-[#18181B] border border-[#2B3144] text-[#9BA2B0]">
                      #{t}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Honest verification — no dummy audit */}
          <div className="rounded-[8px] border border-[#232838] bg-[#0A0A0B] p-4 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-[#232838] pb-2">
              <span className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${contract.verified ? 'text-[#22C55E]' : 'text-[#71717A]'}`} />
                Verification
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${contract.verified ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20' : 'text-[#71717A] bg-white/[0.03] border-[#27272A]'}`}>
                {contract.verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-[11px] text-[#7C8497] font-sans leading-relaxed">
              {contract.verified
                ? 'Source was imported from the chain indexer for this exact address and published unedited — source SHA matches the on-chain artifact link.'
                : 'Unverified means the source was pasted or edited — we still record the SHA-256 for audit, but it is not cryptographically tied to the address. Import from the address to earn Verified.'}
            </p>
            <div className="text-[11px] font-mono text-[#71717A] break-all">
              <span className="text-[#52525B]">contractId</span> <span className="text-[#FAFAFA]">{contract.contractId}</span>
            </div>
          </div>
        </div>
      </div>
    </ContractRepoLayout>
  );
};
