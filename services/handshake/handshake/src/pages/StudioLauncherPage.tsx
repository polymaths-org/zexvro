import React, { useState } from 'react';
import {
  Code2,
  Plus,
  FileCode,
  Upload,
  Layers,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StudioProject, ChainType } from '../types';
import { CHAINS, getChain } from '../data/chains';

export const StudioLauncherPage: React.FC = () => {
  const { navigate, studioProjects = [], setStudioProjects, setActiveStudioProject } = useApp();
  const [importContractId, setImportContractId] = useState('');
  const [importChain, setImportChain] = useState<ChainType>('stellar');
  const importMeta = getChain(importChain);
  const importIsEvm = importMeta?.family === 'evm';

  const createBlankProject = () => {
    const newProj: StudioProject = {
      id: `proj-${Date.now()}`,
      name: 'my-soroban-contract',
      chain: 'stellar',
      network: 'testnet',
      language: 'Rust (Soroban)',
      files: [
        {
          path: 'src/lib.rs',
          name: 'lib.rs',
          content: `#![no_std]\nuse soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};\n\n#[contract]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {\n    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {\n        vec![&env, symbol_short!("Hello"), to]\n    }\n}\n`,
          language: 'rust',
        },
        {
          path: 'Cargo.toml',
          name: 'Cargo.toml',
          content: `[package]\nname = "my-soroban-contract"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nsoroban-sdk = "22.0.0"\n`,
          language: 'toml',
        },
      ],
      activeFilePath: 'src/lib.rs',
      openTabs: ['src/lib.rs'],
      compilerStatus: 'idle',
      lastSaved: 'Just now',
    };

    setStudioProjects([newProj, ...(studioProjects || [])]);
    setActiveStudioProject(newProj);
    navigate({ page: 'studio-workspace', projectId: newProj.id });
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importContractId.trim()) return;

    const newProj: StudioProject = {
      id: `proj-import-${Date.now()}`,
      name: `imported-${importContractId.slice(0, 8)}`,
      chain: importChain,
      network: 'pubnet',
      language: importMeta?.defaultLanguage ?? 'Solidity',
      files: [
        {
          path: importIsEvm ? 'contracts/Contract.sol' : 'src/lib.rs',
          name: importIsEvm ? 'Contract.sol' : 'lib.rs',
          content: `// Decompiled source for ${importContractId}\n// Chain: ${importChain}\n`,
          language: importIsEvm ? 'solidity' : 'rust',
        },
      ],
      activeFilePath: importIsEvm ? 'contracts/Contract.sol' : 'src/lib.rs',
      openTabs: [importIsEvm ? 'contracts/Contract.sol' : 'src/lib.rs'],
      compilerStatus: 'idle',
      lastSaved: 'Just now',
    };

    setStudioProjects([newProj, ...(studioProjects || [])]);
    setActiveStudioProject(newProj);
    navigate({ page: 'studio-workspace', projectId: newProj.id });
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-10">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[9999px] bg-[#111113] border border-[#27272A] text-xs font-mono text-[#A1A1AA]">
          <Code2 className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Browser-Native Contract Studio</span>
        </div>

        <h1 className="text-3xl font-extrabold text-[#FAFAFA] tracking-tight">
          Handshake Contract Studio
        </h1>

        <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
          The lightweight web IDE for smart contracts. Read ASTs, run cargo tests, inspect CPU gas limits, and deploy to testnets in 1 click without local toolchain setup.
        </p>
      </div>

      {/* Launcher Grid: 3 entry points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Option 1: Blank Project */}
        <div
          onClick={createBlankProject}
          className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#3B82F6] hover:bg-[#111113] cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-[6px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA] group-hover:text-[#3B82F6] transition-colors">
              New Blank Project
            </h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Start with a minimal Soroban Rust contract with boilerplate test harness and Cargo manifest.
            </p>
          </div>
          <div className="pt-4 text-xs font-mono text-[#3B82F6] flex items-center gap-1">
            <span>Create project</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Option 2: Import from Chain ID */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-[6px] bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA]">
              Import from Chain ID
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Pull verified bytecode & ABI directly from any deployed contract address.
            </p>
          </div>

          <form onSubmit={handleImport} className="space-y-2 pt-1 font-mono text-xs">
            <div className="flex gap-1 text-[11px]">
              <select
                value={importChain}
                onChange={(e) => setImportChain(e.target.value as any)}
                className="bg-[#111113] border border-[#27272A] rounded px-1.5 py-1 text-[#FAFAFA] max-w-full"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={importContractId}
              onChange={(e) => setImportContractId(e.target.value)}
              placeholder="C... or 0x..."
              className="w-full px-2.5 py-1.5 rounded bg-[#111113] border border-[#27272A] text-xs text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#22C55E]"
            />
            <button
              type="submit"
              className="w-full py-1.5 rounded bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium border border-[#27272A] transition-colors"
            >
              Import Contract
            </button>
          </form>
        </div>

        {/* Option 3: Open Local File */}
        <div
          onClick={createBlankProject}
          className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] hover:border-[#F59E0B] hover:bg-[#111113] cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-[6px] bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA] group-hover:text-[#F59E0B] transition-colors">
              Upload Files / ZIP
            </h3>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Drag-and-drop local `.rs` or `.sol` files, or an existing Rust cargo contract repository.
            </p>
          </div>
          <div className="pt-4 text-xs font-mono text-[#F59E0B] flex items-center gap-1">
            <span>Upload file</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>

      {/* Recent Studio Projects */}
      {studioProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#FAFAFA] flex items-center gap-2 font-mono">
            <FolderOpen className="w-4 h-4 text-[#3B82F6]" />
            Your Studio Projects ({studioProjects.length})
          </h2>

          <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden text-xs font-mono">
            {studioProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setActiveStudioProject(p);
                  navigate({ page: 'studio-workspace', projectId: p.id });
                }}
                className="p-3.5 flex items-center justify-between hover:bg-[#111113] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-[#3B82F6]" />
                  <div>
                    <span className="font-semibold text-[#FAFAFA]">{p.name}</span>
                    <div className="text-[11px] text-[#71717A] mt-0.5">
                      {p.chain}:{p.network} • {p.files.length} files • Last modified {p.lastSaved}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[#3B82F6]">
                  <span>Open workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
