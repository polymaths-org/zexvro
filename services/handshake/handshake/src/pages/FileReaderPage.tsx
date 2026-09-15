import React, { useState } from 'react';
import { 
  File, 
  Copy, 
  Check, 
  Download, 
  Code2, 
  ChevronRight, 
  Terminal, 
  ListOrdered,
  Sparkles,
  Zap,
  Play
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SmartContract, FileItem } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';
import { GasStorageLens } from '../components/common/GasStorageLens';

interface FileReaderPageProps {
  contract: SmartContract;
  filePath?: string;
  branch?: string;
}

export const FileReaderPage: React.FC<FileReaderPageProps> = ({
  contract,
  filePath = 'src/lib.rs',
  branch = 'pubnet/v2.1',
}) => {
  const { navigate, forkContractToStudio, navigateToFunction, openAiExplain, openDryRun } = useApp();
  const [copied, setCopied] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Find file or fallback — handle empty / single-file contracts without blowing up.
  const file = contract.files.find((f) => f.path === filePath) || contract.files[0] || null;
  const fileContent = file?.content ?? (contract as any).source ?? '// Source empty — publish with code to see it here.';
  const lines = fileContent.split('\n');
  const displayFileName = file?.name ?? filePath.split('/').pop() ?? 'lib.rs';

  // Breadcrumbs
  const pathParts = filePath.split('/');

  const copyRawCode = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <ContractRepoLayout contract={contract} activeTab="code">
      <div className="space-y-4">
        
        {/* Breadcrumbs & File Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          {/* Breadcrumbs */}
          <div className="flex items-center flex-wrap gap-1 text-[#A1A1AA]">
            <span
              onClick={() => navigate({ page: 'contract-overview', chain: contract.chain, contractId: contract.contractId })}
              className="hover:text-[#FAFAFA] cursor-pointer text-[#3B82F6]"
            >
              {contract.name}
            </span>
            <ChevronRight className="w-3 h-3 text-[#71717A]" />
            <span className="text-[#71717A]">{branch}</span>
            <ChevronRight className="w-3 h-3 text-[#71717A]" />
            {pathParts.map((part, index) => (
              <React.Fragment key={part}>
                {index === pathParts.length - 1 ? (
                  <span className="font-semibold text-[#FAFAFA]">{part}</span>
                ) : (
                  <>
                    <span className="text-[#A1A1AA]">{part}</span>
                    <ChevronRight className="w-3 h-3 text-[#71717A]" />
                  </>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Quick File Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyRawCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#111113] hover:bg-[#18181B] border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Raw'}</span>
            </button>

            <button
              type="button"
              onClick={() => forkContractToStudio(contract)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold transition-all active:scale-95"
            >
              <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Edit in Studio</span>
            </button>
          </div>
        </div>

        {/* Main Code View with Line Numbers & Function Outline Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Left 3 Cols: Code Buffer */}
          <div className="lg:col-span-3 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] overflow-hidden">
            {/* Top Toolbar inside box */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#111113] border-b border-[#27272A] text-xs font-mono text-[#71717A]">
              <div className="flex items-center gap-3">
                <File className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span className="text-[#FAFAFA]">{displayFileName}</span>
                <span>•</span>
                <span>{lines.length} lines</span>
                <span>•</span>
                <span>{Math.round(fileContent.length / 1024)} KB</span>
              </div>
              <div className="text-[11px] text-[#71717A]">
                UTF-8 • {contract.language}
              </div>
            </div>

            {/* Code lines */}
            <div className="overflow-x-auto p-2 font-mono text-xs leading-6 select-text">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((lineText, idx) => {
                    const lineNum = idx + 1;
                    const isTarget = highlightedLine === lineNum;
                    return (
                      <tr
                        key={lineNum}
                        id={`L${lineNum}`}
                        className={`hover:bg-[#18181B]/80 transition-colors ${
                          isTarget ? 'bg-[#3B82F6]/15 text-white' : ''
                        }`}
                      >
                        {/* Line number */}
                        <td
                          onClick={() => setHighlightedLine(lineNum)}
                          className="w-12 text-right pr-4 select-none text-[#52525B] hover:text-[#A1A1AA] cursor-pointer align-top py-0.5"
                        >
                          {lineNum}
                        </td>
                        {/* Code line content */}
                        <td className="pl-2 pr-4 text-[#D4D4D8] whitespace-pre py-0.5">
                          {lineText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Functions in this file / AST Outline */}
          <div className="space-y-4">
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-4 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5 uppercase text-[11px]">
                  <ListOrdered className="w-3.5 h-3.5 text-[#3B82F6]" />
                  Functions in File ({contract.functions.length})
                </span>
              </div>

              <div className="space-y-2">
                {contract.functions.map((fn) => (
                  <div
                    key={fn.id}
                    className="p-2.5 rounded bg-[#111113] hover:bg-[#18181B] border border-[#27272A] space-y-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        onClick={() => {
                          setHighlightedLine(fn.sourceLines[0]);
                          const el = document.getElementById(`L${fn.sourceLines[0]}`);
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="font-semibold text-[#60A5FA] hover:underline cursor-pointer"
                      >
                        fn {fn.name}()
                      </span>
                      <span className="text-[10px] text-[#71717A]">
                        L{fn.sourceLines[0]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#18181B]">
                      <GasStorageLens fn={fn} compact={true} />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDryRun(contract, fn)}
                          className="p-1 rounded text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A]"
                          title="Dry-Run Invoke"
                        >
                          <Play className="w-3 h-3 text-[#22C55E]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openAiExplain(contract, fn)}
                          className="p-1 rounded text-[#A1A1AA] hover:text-[#3B82F6] hover:bg-[#27272A]"
                          title="Explain with AI"
                        >
                          <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other Files in Project */}
            <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] p-3 text-xs font-mono space-y-2">
              <span className="text-[10px] text-[#71717A] uppercase block">Other files in repository:</span>
              <div className="space-y-1">
                {contract.files.map((f) => (
                  <div
                    key={f.path}
                    onClick={() => navigate({ page: 'file-reader', chain: contract.chain, contractId: contract.contractId, branch, filePath: f.path })}
                    className={`p-1.5 rounded cursor-pointer truncate transition-colors ${
                      f.path === filePath
                        ? 'bg-[#18181B] text-[#FAFAFA] font-semibold'
                        : 'text-[#71717A] hover:text-[#FAFAFA]'
                    }`}
                  >
                    {f.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </ContractRepoLayout>
  );
};
