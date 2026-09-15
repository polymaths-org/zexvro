import React, { useState, useMemo } from 'react';
import { 
  File, 
  Folder, 
  Plus, 
  X, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  Sparkles, 
  Rocket, 
  Download, 
  Share2, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Database,
  RefreshCw,
  Copy,
  Check,
  Code2,
  Network,
  Split,
  Sliders,
  Maximize2,
  Minimize2,
  Activity,
  Flame,
  ArrowRight,
  CornerDownRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StudioProject, SmartContract, ContractFunction } from '../types';
import { ContractGraphCanvas } from '../components/common/ContractGraphCanvas';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface StudioWorkspacePageProps {
  projectId: string;
}

export const StudioWorkspacePage: React.FC<StudioWorkspacePageProps> = ({ projectId }) => {
  const { studioProjects = [], activeStudioProject, setActiveStudioProject, navigate, contracts, openDryRun, openAiExplain } = useApp();

  const project = activeStudioProject || (studioProjects && studioProjects.find((p) => p.id === projectId)) || studioProjects?.[0];

  const [activeFile, setActiveFile] = useState<string>(project?.activeFilePath || 'src/lib.rs');
  const [openTabs, setOpenTabs] = useState<string[]>(project?.openTabs || ['src/lib.rs']);
  const [fileContents, setFileContents] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    project?.files?.forEach((f) => {
      initial[f.path] = f.content;
    });
    return initial;
  });

  // Studio Primary View Mode
  const [studioView, setStudioView] = useState<'editor' | 'graph' | 'split' | 'sandbox'>('split');

  // Bottom Terminal Panel
  const [bottomPanelTab, setBottomPanelTab] = useState<'build' | 'test' | 'dryrun'>('build');
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState<string[]>([
    'Compiled successfully with cargo soroban-sdk v22.0.0 in 1.2s. 0 errors, 0 warnings.',
    'WASM output: target/wasm32-unknown-unknown/release/contract.wasm (34.2 KB)',
  ]);
  const [testLog, setTestLog] = useState<string[]>([
    'running 3 tests',
    'test test_amm::test_deposit_and_swap ... ok',
    'test test_amm::test_zero_slippage_reverts ... ok',
    'test test_amm::test_constant_product_invariant ... ok',
    'test result: ok. 3 passed; 0 failed; finished in 0.42s',
  ]);

  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedContractId, setDeployedContractId] = useState<string | null>(null);

  // Inspector / Selected Function
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('swap');

  // Graph Options in Studio
  const [graphFocusMode, setGraphFocusMode] = useState<'flow' | 'storage' | 'gas'>('flow');
  const [particleSpeed, setParticleSpeed] = useState<'normal' | 'fast' | 'off'>('normal');
  const [graphDetailLevel, setGraphDetailLevel] = useState<'standard' | 'deep'>('standard');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'storage' | 'auth'>('all');

  // AI Assist input
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Derive or construct the SmartContract model representing the Studio project
  const studioContract: SmartContract = useMemo(() => {
    const matched = contracts.find(
      (c) => c.id === project?.id || c.name.toLowerCase() === project?.name?.toLowerCase()
    );

    if (matched) return matched;

    return {
      id: project?.id || 'studio-project',
      name: project?.name || 'soroban-contract',
      version: '1.0.0',
      license: 'Apache-2.0',
      author: 'studio-developer',
      authorAddress: 'G...DEV',
      verified: true,
      chain: project?.chain || 'stellar',
      network: project?.network || 'testnet',
      contractId: project?.contractIdMock || 'CA3D5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X1Z',
      likes: 8,
      forks: 2,
      stars: 14,
      description: 'Active contract workspace in Handshake Studio.',
      readme: '# Studio Contract\n\nInteractive workspace with graph AST inspection.',
      stats: {
        functionsCount: 4,
        linesOfCode: 142,
        storageSlots: 3,
        gasAvg: 14200,
        compilesCount: 12,
        invocationsCount: 29,
      },
      tags: ['soroban', 'studio', 'amm'],
      files: project?.files || [],
      functions: [
        {
          id: 'fn-swap',
          name: 'swap',
          visibility: 'public',
          signature: 'swap(env: Env, sender: Address, token_in: Address, amount_in: i128, min_out: i128) -> i128',
          isStateChanging: true,
          requiresAuth: true,
          gasEstimate: 14200,
          gasRating: 'A+',
          storageWrites: 2,
          storageReads: 4,
          eventsEmitted: ['swap'],
          docExcerpt: 'Executes constant-product token swap between reserves with slippage checks.',
          fullDocs: 'Transfers token_in from sender, applies fee, calculates output and enforces min_out.',
          sourceLines: [15, 23],
          sourceSlice: 'pub fn swap(...)',
          arguments: [
            { name: 'sender', type: 'Address', description: 'Transaction initiator requiring signature' },
            { name: 'token_in', type: 'Address', description: 'Address of input token contract' },
            { name: 'amount_in', type: 'i128', description: 'Input token quantity' },
            { name: 'min_out', type: 'i128', description: 'Minimum acceptable output amount' },
          ],
          returns: 'i128',
          errors: [],
          stateAccess: [],
          securityNotes: ['sender.require_auth() enforces caller validation.'],
        },
        {
          id: 'fn-initialize',
          name: 'initialize',
          visibility: 'public',
          signature: 'initialize(env: Env, admin: Address, token_a: Address, token_b: Address, fee_bps: u32)',
          isStateChanging: true,
          requiresAuth: true,
          gasEstimate: 9800,
          gasRating: 'A+',
          storageWrites: 4,
          storageReads: 1,
          eventsEmitted: ['init'],
          docExcerpt: 'Bootstraps contract instance state, admin address, and liquidity fee rate.',
          fullDocs: 'Initializes pool configuration with admin authorization check.',
          sourceLines: [7, 14],
          sourceSlice: 'pub fn initialize(...)',
          arguments: [
            { name: 'admin', type: 'Address', description: 'Contract administrator' },
            { name: 'token_a', type: 'Address', description: 'Token A contract' },
            { name: 'token_b', type: 'Address', description: 'Token B contract' },
            { name: 'fee_bps', type: 'u32', description: 'Trading fee in basis points' },
          ],
          returns: '()',
          errors: [],
          stateAccess: [],
          securityNotes: ['admin.require_auth() prevents unauthorized initialization.'],
        },
        {
          id: 'fn-deposit',
          name: 'deposit',
          visibility: 'public',
          signature: 'deposit(env: Env, sender: Address, amount_a: i128, amount_b: i128) -> i128',
          isStateChanging: true,
          requiresAuth: true,
          gasEstimate: 21500,
          gasRating: 'A',
          storageWrites: 3,
          storageReads: 3,
          eventsEmitted: ['deposit'],
          docExcerpt: 'Deposits liquidity pair and mints pool share tokens to provider.',
          fullDocs: 'Calculates shares according to pool ratio and deposits token pair.',
          sourceLines: [25, 42],
          sourceSlice: 'pub fn deposit(...)',
          arguments: [
            { name: 'sender', type: 'Address', description: 'Liquidity provider' },
            { name: 'amount_a', type: 'i128', description: 'Amount of Token A' },
            { name: 'amount_b', type: 'i128', description: 'Amount of Token B' },
          ],
          returns: 'i128',
          errors: [],
          stateAccess: [],
          securityNotes: ['sender.require_auth() ensures caller deposits their own funds.'],
        },
        {
          id: 'fn-get-reserves',
          name: 'get_reserves',
          visibility: 'public',
          signature: 'get_reserves(env: Env) -> (i128, i128)',
          isStateChanging: false,
          requiresAuth: false,
          gasEstimate: 3200,
          gasRating: 'A+',
          storageWrites: 0,
          storageReads: 2,
          eventsEmitted: [],
          docExcerpt: 'Read-only query returning current pool balances.',
          fullDocs: 'Reads instance storage for token reserve pair.',
          sourceLines: [44, 48],
          sourceSlice: 'pub fn get_reserves(...)',
          arguments: [],
          returns: '(i128, i128)',
          errors: [],
          stateAccess: [],
          securityNotes: [],
        },
      ],
    };
  }, [contracts, project]);

  const currentContent = fileContents[activeFile] || '// Empty file';

  const handleContentChange = (newVal: string) => {
    setFileContents((prev) => ({ ...prev, [activeFile]: newVal }));
  };

  const closeTab = (tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== tabPath);
    setOpenTabs(nextTabs);
    if (activeFile === tabPath && nextTabs.length > 0) {
      setActiveFile(nextTabs[0]);
    }
  };

  const openFile = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs([...openTabs, path]);
    }
    setActiveFile(path);
  };

  const triggerBuild = () => {
    setIsCompiling(true);
    setCompileLog(['Compiling with cargo-soroban 22.0.0...', 'Checking target wasm32-unknown-unknown...']);
    setIsBottomPanelOpen(true);
    setBottomPanelTab('build');

    setTimeout(() => {
      setIsCompiling(false);
      setCompileLog([
        'Compiling with cargo-soroban 22.0.0...',
        'Finished release [optimized] target(s) in 1.34s',
        'WASM binary generated: target/wasm32-unknown-unknown/release/contract.wasm (34.2 KB)',
        'Built with zero compiler errors. Memory layout validated.',
      ]);
    }, 1000);
  };

  const triggerTests = () => {
    setIsCompiling(true);
    setIsBottomPanelOpen(true);
    setBottomPanelTab('test');
    setTestLog(['Compiling test harness...', 'Executing host simulation environment...']);

    setTimeout(() => {
      setIsCompiling(false);
      setTestLog([
        'running 3 tests',
        'test test_amm::test_deposit_and_swap ... ok',
        'test test_amm::test_zero_slippage_reverts ... ok',
        'test test_amm::test_constant_product_invariant ... ok',
        'test result: ok. 3 passed; 0 failed; finished in 0.38s',
      ]);
    }, 900);
  };

  const triggerDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      const generatedId = `C${Math.random().toString(36).substring(2, 12).toUpperCase()}89K7L12`;
      setDeployedContractId(generatedId);
      setCompileLog((prev) => [
        ...prev,
        `[DEPLOY] Broadcasted to Stellar Testnet!`,
        `Contract ID: ${generatedId}`,
        `Transaction Hash: 7b88...2a19`,
      ]);
    }, 1500);
  };

  const handleAiAssist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);

    setTimeout(() => {
      setIsAiGenerating(false);
      if (aiPrompt.toLowerCase().includes('test')) {
        const testCodeSnippet = `\n#[test]\nfn test_reentrancy_guard() {\n    let env = Env::default();\n    let contract_id = env.register_contract(None, HelloContract);\n    // Simulated invariant check\n    assert!(true);\n}\n`;
        setFileContents((prev) => ({
          ...prev,
          [activeFile]: (prev[activeFile] || '') + testCodeSnippet,
        }));
      } else {
        const authSnippet = `\n    // Added cryptographic caller verification\n    user.require_auth();\n`;
        setFileContents((prev) => ({
          ...prev,
          [activeFile]: (prev[activeFile] || '').replace('pub fn swap', `pub fn swap${authSnippet}`),
        }));
      }
      setAiPrompt('');
    }, 1100);
  };

  // Jump from Graph to Code
  const handleJumpToCode = (fnName: string) => {
    setSelectedFunctionName(fnName);
    setStudioView('editor');
    // Open main rust file if not open
    if (!openTabs.includes('src/lib.rs')) {
      setOpenTabs((prev) => [...prev, 'src/lib.rs']);
    }
    setActiveFile('src/lib.rs');
  };

  const selectedFn = studioContract.functions.find((f) => f.name === selectedFunctionName) || studioContract.functions[0];

  const lines = currentContent.split('\n');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gradient-to-b from-[#0E1017] via-[#090A0E] to-[#07080C] text-xs font-mono overflow-hidden select-none">
      
      {/* Studio Top Control Header with Rich Graphite Gradient */}
      <div className="h-11 border-b border-[#232838] bg-gradient-to-r from-[#141724] via-[#0F111A] to-[#141724] px-4 flex items-center justify-between gap-3 shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
        
        {/* Left: Project Badge & Chain */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white shadow-xs">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-[#FAFAFA] text-sm tracking-tight">{project?.name}</span>
          <span className="text-[#525A6C]">/</span>
          <span className="px-2 py-0.5 rounded bg-[#181C28] border border-[#2B3144] text-[#9BA2B0] text-[10px] shadow-xs">
            {project?.chain}:{project?.network}
          </span>
        </div>

        {/* Center: Primary View Mode Selector (Editor | Split | Interactive Graph | Sandbox) */}
        <div className="flex items-center p-0.5 rounded-[6px] bg-[#0A0C12] border border-[#232838] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={() => setStudioView('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
              studioView === 'editor'
                ? 'bg-gradient-to-b from-[#242938] to-[#171A24] text-[#FAFAFA] border border-[#3A435A] shadow-xs'
                : 'text-[#7C8497] hover:text-[#FAFAFA]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioView('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
              studioView === 'split'
                ? 'bg-gradient-to-b from-[#242938] to-[#171A24] text-[#FAFAFA] border border-[#3A435A] shadow-xs'
                : 'text-[#7C8497] hover:text-[#FAFAFA]'
            }`}
          >
            <Split className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Split (Code + Graph)</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioView('graph')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
              studioView === 'graph'
                ? 'bg-gradient-to-b from-[#242938] to-[#171A24] text-[#FAFAFA] border border-[#3A435A] shadow-xs'
                : 'text-[#7C8497] hover:text-[#FAFAFA]'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>Architecture Graph</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioView('sandbox')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
              studioView === 'sandbox'
                ? 'bg-gradient-to-b from-[#242938] to-[#171A24] text-[#FAFAFA] border border-[#3A435A] shadow-xs'
                : 'text-[#7C8497] hover:text-[#FAFAFA]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Simulation Sandbox</span>
          </button>
        </div>

        {/* Right: Build, Test & Deploy Buttons using Button component */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={triggerBuild}
            disabled={isCompiling}
            className="gap-1.5"
          >
            {isCompiling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current text-[#3B82F6]" />}
            <span>cargo build</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={triggerTests}
            disabled={isCompiling}
            className="gap-1.5"
          >
            <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
            <span>cargo test</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={triggerDeploy}
            disabled={isDeploying}
            className="gap-1.5 font-semibold"
          >
            {isDeploying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3 stroke-[2.5]" />}
            <span>Deploy</span>
          </Button>
        </div>

      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column: File Tree & Function AST Outline */}
        <div className="w-56 border-r border-[#232838] bg-gradient-to-b from-[#121520] via-[#0E1018] to-[#0A0C13] flex flex-col shrink-0">
          <div className="p-2.5 border-b border-[#232838] flex items-center justify-between text-[11px] text-[#7C8497] font-semibold uppercase tracking-wider">
            <span>Explorer ({project?.files?.length || 0})</span>
            <button type="button" className="hover:text-[#FAFAFA] cursor-pointer p-0.5 rounded hover:bg-[#1A1E2B]">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 space-y-0.5 overflow-y-auto max-h-44 border-b border-[#232838]">
            {project?.files?.map((file) => {
              const isActive = activeFile === file.path;
              return (
                <div
                  key={file.path}
                  onClick={() => openFile(file.path)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-gradient-to-b from-[#222736] to-[#171A24] text-[#FAFAFA] font-medium border border-[#343D54] shadow-xs' 
                      : 'text-[#9BA2B0] hover:bg-[#151824] hover:text-[#FAFAFA]'
                  }`}
                >
                  <File className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="truncate">{file.name}</span>
                </div>
              );
            })}
          </div>

          {/* AST Functions Outline */}
          <div className="flex-1 p-2.5 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#7C8497] font-semibold uppercase tracking-wider px-1 py-1">
              <span>AST Functions</span>
              <span className="text-[#3B82F6]">{studioContract.functions.length} nodes</span>
            </div>

            {studioContract.functions.map((fn) => {
              const isSelected = selectedFunctionName === fn.name;
              return (
                <div
                  key={fn.id}
                  onClick={() => {
                    setSelectedFunctionName(fn.name);
                    if (studioView === 'editor') {
                      setActiveFile('src/lib.rs');
                    }
                  }}
                  className={`px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#1E293B] to-[#121A28] text-[#93C5FD] border border-[#3B82F6]/40 shadow-xs'
                      : 'text-[#9BA2B0] hover:bg-[#151824] hover:text-[#FAFAFA]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    <span className="truncate font-mono">fn {fn.name}()</span>
                  </div>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    fn.gasRating === 'A+' || fn.gasRating === 'A' ? 'text-[#22C55E] bg-[#22C55E]/10' : 'text-[#F59E0B] bg-[#F59E0B]/10'
                  }`}>
                    {fn.gasRating}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Stats footer in sidebar */}
          <div className="p-2.5 border-t border-[#232838] bg-[#0A0C13] text-[10px] text-[#6C7487] space-y-1">
            <div className="flex justify-between">
              <span>Host Target:</span>
              <span className="text-[#9BA2B0]">wasm32</span>
            </div>
            <div className="flex justify-between">
              <span>Soroban SDK:</span>
              <span className="text-[#9BA2B0]">v22.0.0</span>
            </div>
          </div>
        </div>

        {/* Center Workspace Content Area based on studioView */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#080A0E]">
          
          {/* VIEW: Editor Mode OR Split Mode */}
          {(studioView === 'editor' || studioView === 'split') && (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              
              {/* File Tabs Bar */}
              <div className="h-9 border-b border-[#232838] bg-gradient-to-r from-[#121522] to-[#0D0F17] flex items-center overflow-x-auto no-scrollbar shrink-0">
                {openTabs.map((tab) => {
                  const isActive = tab === activeFile;
                  const fileName = tab.split('/').pop();
                  return (
                    <div
                      key={tab}
                      onClick={() => setActiveFile(tab)}
                      className={`flex items-center gap-2 px-3 py-1.5 h-full border-r border-[#232838] cursor-pointer text-xs transition-all ${
                        isActive 
                          ? 'bg-[#080A0E] text-[#FAFAFA] font-medium border-t-2 border-t-[#3B82F6]' 
                          : 'text-[#7C8497] hover:bg-[#141724]'
                      }`}
                    >
                      <File className="w-3 h-3 text-[#3B82F6]" />
                      <span>{fileName}</span>
                      <button
                        type="button"
                        onClick={(e) => closeTab(tab, e)}
                        className="p-0.5 hover:text-[#FAFAFA] rounded hover:bg-[#232838] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Editor + Split Container */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Code Editor */}
                <div className={`flex flex-col overflow-hidden bg-gradient-to-b from-[#090B10] to-[#06070B] ${studioView === 'split' ? 'w-1/2 border-r border-[#232838]' : 'w-full'}`}>
                  <div className="flex-1 flex overflow-hidden">
                    {/* Line numbers */}
                    <div className="w-12 py-3 bg-[#0A0C13] border-r border-[#1C202E] text-right pr-3 select-none text-[#4D5566] leading-6 shrink-0 font-mono">
                      {lines.map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Code TextArea */}
                    <textarea
                      value={currentContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="flex-1 p-3 bg-transparent text-[#E2E8F0] font-mono leading-6 focus:outline-none resize-none select-text whitespace-pre overflow-auto"
                      spellCheck={false}
                    />
                  </div>
                </div>

                {/* Split Graph Right Panel */}
                {studioView === 'split' && (
                  <div className="w-1/2 flex flex-col bg-[#07090E] overflow-hidden">
                    {/* Graph Mini-Header & Options */}
                    <div className="h-8 border-b border-[#232838] bg-gradient-to-r from-[#141724] to-[#0E1017] px-3 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#FAFAFA]">
                        <Network className="w-3.5 h-3.5 text-[#3B82F6]" />
                        <span className="font-semibold">Live Contract Topology</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setStudioView('graph')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#9BA2B0] hover:text-[#FAFAFA] hover:bg-[#1C202E] transition-colors cursor-pointer"
                          title="Expand to Full Graph"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Fullscreen Graph</span>
                        </button>
                      </div>
                    </div>

                    {/* Canvas Embedded in Split View */}
                    <div className="flex-1 relative overflow-hidden">
                      <ContractGraphCanvas
                        contract={studioContract}
                        initialSelectedFn={selectedFunctionName}
                        onSelectFunction={(fn) => setSelectedFunctionName(fn)}
                        height="100%"
                        allowExpand={false}
                      />
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* VIEW: Dedicated Fullscreen Architecture & AST Graph Mode */}
          {studioView === 'graph' && (
            <div className="flex-1 flex flex-col bg-[#07090E] overflow-hidden">
              
              {/* Comprehensive Graph & Stuff Options Toolbar */}
              <div className="h-10 border-b border-[#232838] bg-gradient-to-r from-[#131622] via-[#0E1017] to-[#131622] px-4 flex items-center justify-between gap-4 shrink-0 shadow-xs">
                
                {/* Graph Projection Filters */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#7C8497] uppercase font-bold tracking-wider mr-1">
                    Graph Mode:
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setGraphFocusMode('flow')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer ${
                      graphFocusMode === 'flow'
                        ? 'bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white shadow-xs'
                        : 'bg-[#151824] hover:bg-[#1E2232] text-[#9BA2B0] border border-[#2B3144]'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Call Graph & AST</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGraphFocusMode('storage')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer ${
                      graphFocusMode === 'storage'
                        ? 'bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white shadow-xs'
                        : 'bg-[#151824] hover:bg-[#1E2232] text-[#9BA2B0] border border-[#2B3144]'
                    }`}
                  >
                    <Database className="w-3 h-3 text-[#3B82F6]" />
                    <span>Storage Topology</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGraphFocusMode('gas')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer ${
                      graphFocusMode === 'gas'
                        ? 'bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white shadow-xs'
                        : 'bg-[#151824] hover:bg-[#1E2232] text-[#9BA2B0] border border-[#2B3144]'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-[#F59E0B]" />
                    <span>Gas Intensity Heatmap</span>
                  </button>
                </div>

                {/* "Stuff Options" Controls (Speed, Jump to Code, Export) */}
                <div className="flex items-center gap-2">
                  
                  {/* Particle Flow Speed Control */}
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#10131B] border border-[#232838] text-[10px] text-[#7C8497]">
                    <span>Particles:</span>
                    {(['normal', 'fast', 'off'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setParticleSpeed(s)}
                        className={`px-1.5 py-0.5 rounded capitalize cursor-pointer ${
                          particleSpeed === s ? 'bg-[#2563EB] text-white font-bold' : 'hover:text-[#FAFAFA]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Quick Action: Jump to Selected Function in Code */}
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleJumpToCode(selectedFunctionName)}
                    className="gap-1 text-[11px]"
                  >
                    <Code2 className="w-3 h-3 text-[#3B82F6]" />
                    <span>Jump to fn {selectedFunctionName}() in Code</span>
                  </Button>

                  {/* Return to Split */}
                  <Button
                    variant="graphite"
                    size="xs"
                    onClick={() => setStudioView('split')}
                    className="gap-1"
                  >
                    <Split className="w-3 h-3" />
                    <span>Split View</span>
                  </Button>
                </div>

              </div>

              {/* Full Interactive Canvas Graph Component */}
              <div className="flex-1 relative overflow-hidden">
                <ContractGraphCanvas
                  contract={studioContract}
                  initialSelectedFn={selectedFunctionName}
                  onSelectFunction={(fn) => setSelectedFunctionName(fn)}
                  height="100%"
                  allowExpand={false}
                />
              </div>

            </div>
          )}

          {/* VIEW: Dedicated Sandbox & Simulation Runner */}
          {studioView === 'sandbox' && (
            <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0E1017] to-[#07090E] p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full space-y-4">
                
                <div className="flex items-center justify-between border-b border-[#232838] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#FAFAFA] font-mono flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#22C55E]" />
                      Host Invocation Sandbox
                    </h3>
                    <p className="text-xs text-[#7C8497] mt-0.5">
                      Directly execute compiled Soroban WASM functions with simulated host environment.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openDryRun(studioContract, selectedFn)}
                    className="gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch Dry-Run Modal</span>
                  </Button>
                </div>

                <Card variant="raised" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7C8497]">Target Function:</span>
                    <span className="font-bold text-[#3B82F6]">fn {selectedFn.name}()</span>
                  </div>

                  <div className="p-3 rounded bg-[#090B10] border border-[#232838] font-mono text-[11px] text-[#A1A1AA] break-all">
                    {selectedFn.signature}
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] text-[#7C8497] uppercase font-bold">Simulated Parameters</span>
                    {(selectedFn.arguments || []).map((param) => (
                      <div key={param.name} className="flex items-center gap-3">
                        <span className="w-28 text-[#9BA2B0] truncate">{param.name} ({param.type}):</span>
                        <input
                          type="text"
                          defaultValue={param.type === 'Address' ? 'GD...TESTNET_USER' : param.type.includes('128') ? '1000000' : '30'}
                          className="flex-1 px-2.5 py-1.5 rounded bg-[#10131B] border border-[#2B3144] text-[#FAFAFA] font-mono text-xs focus:outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-[#232838] flex items-center justify-between">
                    <div className="text-[11px] text-[#22C55E] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Cryptographic Auth: env.mock_all_auths() enabled</span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setIsCompiling(true);
                        setTimeout(() => {
                          setIsCompiling(false);
                          setCompileLog((prev) => [
                            ...prev,
                            `[SANDBOX] Invoked ${selectedFn.name}() -> Return value: Ok(997000)`,
                            `[SANDBOX] CPU Instructions: ~13,840 | RAM: 18.2 KB`,
                          ]);
                          setIsBottomPanelOpen(true);
                          setBottomPanelTab('build');
                        }, 600);
                      }}
                    >
                      <span>Simulate Execute</span>
                    </Button>
                  </div>
                </Card>

              </div>
            </div>
          )}

          {/* Bottom Panel (Build Logs, Test Results, Dry Run) */}
          {(studioView === 'editor' || studioView === 'split') && (
            <div className="border-t border-[#232838] bg-gradient-to-b from-[#121522] to-[#0A0C13] flex flex-col shrink-0">
              {/* Panel Tabs Header */}
              <div className="h-8 px-3 border-b border-[#232838] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBottomPanelTab('build');
                      setIsBottomPanelOpen(true);
                    }}
                    className={`px-2.5 py-0.5 rounded-[4px] text-xs font-mono transition-all cursor-pointer ${
                      bottomPanelTab === 'build' && isBottomPanelOpen
                        ? 'bg-gradient-to-b from-[#222736] to-[#171A24] text-[#FAFAFA] border border-[#343D54] shadow-xs'
                        : 'text-[#7C8497] hover:text-[#FAFAFA]'
                    }`}
                  >
                    Build Logs
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBottomPanelTab('test');
                      setIsBottomPanelOpen(true);
                    }}
                    className={`px-2.5 py-0.5 rounded-[4px] text-xs font-mono transition-all cursor-pointer ${
                      bottomPanelTab === 'test' && isBottomPanelOpen
                        ? 'bg-gradient-to-b from-[#222736] to-[#171A24] text-[#FAFAFA] border border-[#343D54] shadow-xs'
                        : 'text-[#7C8497] hover:text-[#FAFAFA]'
                    }`}
                  >
                    Test Results
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                  className="p-1 text-[#7C8497] hover:text-[#FAFAFA] cursor-pointer"
                >
                  {isBottomPanelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Panel Content */}
              {isBottomPanelOpen && (
                <div className="h-28 p-3 overflow-y-auto font-mono text-[11px] leading-5 bg-[#080A0E]">
                  {bottomPanelTab === 'build' && (
                    <div className="space-y-0.5">
                      {compileLog.map((log, i) => (
                        <div
                          key={i}
                          className={log.includes('error') ? 'text-[#EF4444]' : log.includes('DEPLOY') || log.includes('WASM') ? 'text-[#22C55E] font-medium' : 'text-[#9BA2B0]'}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                  {bottomPanelTab === 'test' && (
                    <div className="space-y-0.5">
                      {testLog.map((log, i) => (
                        <div
                          key={i}
                          className={log.includes('ok') ? 'text-[#22C55E]' : 'text-[#9BA2B0]'}
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Node Inspector & Lens + AI Assistant with Graphite Gradients */}
        <div className="w-72 border-l border-[#232838] bg-gradient-to-b from-[#121520] via-[#0E1018] to-[#0A0C13] flex flex-col justify-between shrink-0 p-3 space-y-3 overflow-y-auto">
          
          <div className="space-y-3">
            {/* Inspector Header */}
            <div>
              <span className="text-[10px] text-[#7C8497] uppercase font-bold tracking-wider block">
                AST Node Inspector
              </span>
              <div className="flex items-center justify-between mt-1">
                <h4 className="text-sm font-bold text-[#FAFAFA] font-mono truncate">
                  fn {selectedFn.name}()
                </h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#3B82F6]/15 text-[#93C5FD] border border-[#3B82F6]/30 font-mono">
                  {selectedFn.visibility}
                </span>
              </div>
            </div>

            {/* Performance & Security Metrics in Graphite Card */}
            <Card variant="raised" className="space-y-2 p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Gas Instruction:</span>
                <span className="text-[#22C55E] font-bold">~{selectedFn.gasEstimate?.toLocaleString() || '14.2k'} CPU</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Storage Footprint:</span>
                <span className="text-[#F59E0B] font-semibold">Instance + Persistent</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#7C8497]">Auth Gatekeeper:</span>
                <span className={selectedFn.requiresAuth ? 'text-[#60A5FA] font-medium' : 'text-[#7C8497]'}>
                  {selectedFn.requiresAuth ? 'require_auth()' : 'None'}
                </span>
              </div>
            </Card>

            {/* Actions for Selected Function */}
            <div className="space-y-1.5">
              <Button
                variant="graphite"
                size="sm"
                onClick={() => handleJumpToCode(selectedFn.name)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Jump to Source Code</span>
                </span>
                <ArrowRight className="w-3 h-3 text-[#7C8497]" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => openDryRun(studioContract, selectedFn)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Interactive Dry-Run</span>
                </span>
                <ArrowRight className="w-3 h-3 text-[#7C8497]" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => openAiExplain(studioContract, selectedFn)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>AI Explain Logic</span>
                </span>
                <ArrowRight className="w-3 h-3 text-[#7C8497]" />
              </Button>
            </div>

            {/* Deployed Notification Card */}
            {deployedContractId && (
              <Card variant="glow" className="p-2.5 space-y-1">
                <span className="text-[10px] text-[#22C55E] uppercase font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deployed to Testnet!
                </span>
                <code className="text-xs text-[#FAFAFA] break-all block font-mono">
                  {deployedContractId}
                </code>
              </Card>
            )}
          </div>

          {/* AI Code Assistant Dock at Bottom */}
          <div className="pt-2 border-t border-[#232838] space-y-2">
            <span className="text-[10px] text-[#3B82F6] uppercase font-bold tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#3B82F6]" />
              AI Code Assistant
            </span>

            <form onSubmit={handleAiAssist} className="space-y-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Add slippage check or invariant test..."
                className="w-full px-2.5 py-1.5 rounded-[5px] bg-[#10131B] border border-[#2B3144] text-xs text-[#FAFAFA] placeholder:text-[#525A6C] focus:outline-none focus:border-[#3B82F6] font-mono shadow-inner"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isAiGenerating}
                className="w-full"
              >
                {isAiGenerating ? 'Generating...' : 'Apply Code Edit'}
              </Button>
            </form>
          </div>

        </div>

      </div>

      {/* Status Bar at Bottom */}
      <div className="h-6 border-t border-[#232838] bg-gradient-to-r from-[#0F111A] via-[#0A0C13] to-[#0F111A] px-3 flex items-center justify-between text-[10px] text-[#6C7487] shrink-0 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#22C55E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            Soroban Runtime Host OK
          </span>
          <span>WASM: 34.2 KB</span>
          <span>Gas Budget: ~14.2k / 100M</span>
          <span className="text-[#3B82F6]">Active View: {studioView.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Stellar Testnet RPC</span>
          <span>UTF-8</span>
          <span>Rust 2021</span>
        </div>
      </div>

    </div>
  );
};
