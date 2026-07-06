import React, { useState, useEffect } from 'react';
import { 
  Bot, Send, ShieldCheck, Play, ArrowRight, Loader2, 
  Sparkles, ShieldAlert, Cpu, Lock, HelpCircle, FileCode, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  approvalCard?: {
    actionName: string;
    description: string;
    approved?: boolean;
    declined?: boolean;
  };
  scanResults?: {
    totalFiles: number;
    vulnerableCount: number;
    riskScore: 'High' | 'Medium' | 'Low';
    tree: Array<{ path: string; risk: 'vulnerable' | 'secure'; desc?: string }>;
  };
}

export default function AgentStudio() {
  const [activeMode, setActiveMode] = useState<'transform' | 'deploy' | 'explain' | 'security'>('transform');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      text: 'Hi Paris. I am the ZEXVRO workspace assistant. I can inspect provided context, draft setup steps, and prepare approval cards. I cannot run backend actions until integrations exist.',
      timestamp: '21:40'
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: 'Review the current frontend prototype and tell me what should be checked before merging it into the main app.',
      timestamp: '21:42'
    },
    {
      id: 'msg-3',
      sender: 'agent',
      text: 'Prototype review prepared. The UI needs local branding, honest setup placeholders, accessible spacing, and agent-readable comments before it should be treated as a platform baseline.',
      timestamp: '21:43',
      scanResults: {
        totalFiles: 14,
        vulnerableCount: 1,
        riskScore: 'Medium',
        tree: [
          { path: 'src/App.tsx', risk: 'vulnerable', desc: 'Generated shell copy needs product-safe language' },
          { path: 'src/components/dashboard/Overview.tsx', risk: 'vulnerable', desc: 'Overview should focus on setup flow, not fake production metrics' },
          { path: 'src/data/mock.ts', risk: 'vulnerable', desc: 'Dummy data should become MVP placeholders' },
          { path: 'src/index.css', risk: 'secure' }
        ]
      },
      approvalCard: {
        actionName: 'Apply UI cleanup patch',
        description: 'Replace generated demo claims with local branding, setup placeholders, and approval-first copy.'
      }
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [executingToolName, setExecutingToolName] = useState('');
  const [toolProgress, setToolProgress] = useState(0);

  // Switch modes and set initial messages
  const handleModeChange = (mode: 'transform' | 'deploy' | 'explain' | 'security') => {
    setActiveMode(mode);
    let initialMessage = '';
    let userMsg = '';
    let responseMsg = '';

    if (mode === 'transform') {
      initialMessage = "Ready to plan codebase transformation. I can draft refactor steps and identify files to inspect before a developer approves changes.";
    } else if (mode === 'deploy') {
      initialMessage = "Ready to prepare deployment. No provider is connected yet, so I will only create a deployment checklist and approval card.";
    } else if (mode === 'explain') {
      initialMessage = "Architecture mode ready. Ask me to map product flows, service ownership, UI sections, or future API boundaries.";
    } else if (mode === 'security') {
      initialMessage = "Security review mode ready. I can prepare API key, secrets, auth, and human/agent policy checklists.";
    }

    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: initialMessage,
        timestamp: 'Just now'
      }
    ]);
  };

  // Submit new chat
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputValue,
      timestamp: 'Just now'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsThinking(true);

    // Simulate agent response
    setTimeout(() => {
      let agentMessageText = '';
      let hasApproval = false;
      let approvalAction = '';
      let approvalDesc = '';

      if (activeMode === 'transform') {
        agentMessageText = "I prepared a transformation plan. It changes UI copy, spacing, data placeholders, and branding. Please approve before applying code edits.";
        hasApproval = true;
        approvalAction = "Apply frontend cleanup changes";
        approvalDesc = "Updates local UI files only. No backend, wallet, deployment, or blockchain action will run.";
      } else if (activeMode === 'deploy') {
        agentMessageText = "Deployment checklist prepared. The app still needs dependency install, type check, visual review, and final owner approval.";
        hasApproval = true;
        approvalAction = "Create deployment checklist";
        approvalDesc = "Adds a local checklist only. It does not deploy or modify infrastructure.";
      } else if (activeMode === 'explain') {
        agentMessageText = "The platform flow is: Workspace → Projects → Services → Agent Studio → Memory → Security. Services should stay setup-focused until APIs and backend contracts exist.";
      } else {
        agentMessageText = "Security placeholder review complete. API keys, secrets, auth, and human/agent policy are not connected yet, so the UI should label them as drafts.";
      }

      const agentMessage: Message = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: agentMessageText,
        timestamp: 'Just now',
        approvalCard: hasApproval ? {
          actionName: approvalAction,
          description: approvalDesc
        } : undefined
      };

      setMessages(prev => [...prev, agentMessage]);
      setIsThinking(false);
    }, 1500);
  };

  // Handle Approval Click
  const handleApproveAction = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.approvalCard) {
        return {
          ...m,
          approvalCard: { ...m.approvalCard, approved: true }
        };
      }
      return m;
    }));

    // Trigger tool execution animation
    const msg = messages.find(m => m.id === msgId);
    if (msg?.approvalCard) {
      setExecutingToolName(msg.approvalCard.actionName);
      setIsExecutingTool(true);
      setToolProgress(0);
    }
  };

  // Tool execution timer simulation
  useEffect(() => {
    if (!isExecutingTool) return;

    const interval = setInterval(() => {
      setToolProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExecutingTool(false);
            // Append success message from agent
            setMessages(m => [
              ...m,
              {
                id: `sys-${Date.now()}`,
                sender: 'agent',
                text: `Approval recorded for \`${executingToolName}\`. In this prototype, actions stop at UI state changes until backend integrations are added.`,
                timestamp: 'Just now'
              }
            ]);
          }, 600);
          return 100;
        }
        return prev + 20;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isExecutingTool, executingToolName]);

  const handleDeclineAction = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.approvalCard) {
        return {
          ...m,
          approvalCard: { ...m.approvalCard, declined: true }
        };
      }
      return m;
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <Bot className="h-5 w-5 text-brand-blue" />
          Agent Studio
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Draft transformations, review context, and require approval before sensitive actions
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[560px] relative overflow-hidden">
        
        {/* Panel 1: Agent Modes Selection (Left Panel) */}
        <div className="xl:col-span-1 p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] flex flex-col justify-between h-full">
          <div className="space-y-4">
            <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Agent Modes</span>
            <div className="space-y-2">
              {[
                { id: 'transform', label: 'Transform Codebase', desc: 'Plan safe code changes', icon: FileCode },
                { id: 'deploy', label: 'Deploy Project', desc: 'Prepare deployment checklist', icon: Cpu },
                { id: 'explain', label: 'Explain Architecture', desc: 'Map product and API flows', icon: HelpCircle },
                { id: 'security', label: 'Review Security', desc: 'Draft auth and secret checks', icon: Lock }
              ].map((mode) => {
                const isSelected = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id as any)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <mode.icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-brand-blue' : 'text-zinc-500'}`} />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{mode.label}</span>
                    </div>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-normal">{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <div className="p-3.5 rounded bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-mono text-zinc-500">Agent mode: prototype only</span>
            </div>
          </div>
        </div>

        {/* Panel 2 & 3: Chat Interface (Center & Main chat) */}
        <div className="xl:col-span-2 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] flex flex-col justify-between h-full overflow-hidden">
          
          {/* Chat Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[460px]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.sender === 'user' 
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs' 
                    : 'border border-zinc-100 dark:border-[#27272A] bg-zinc-50/30 dark:bg-[#0E0E10] text-xs text-zinc-800 dark:text-zinc-200'
                }`}>
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                  
                  {/* Mock scan result display if available */}
                  {msg.scanResults && (
                    <div className="mt-3.5 p-3 rounded border border-red-500/15 bg-red-500/5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-red-500/10 pb-2">
                        <span className="text-[10px] font-mono font-bold text-red-500 flex items-center gap-1.5 uppercase">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Security Scan Results
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-500 text-white text-[9px] font-mono font-bold">{msg.scanResults.riskScore} Risk</span>
                      </div>
                      
                      <div className="font-mono text-[10px] space-y-1 text-zinc-400">
                        {msg.scanResults.tree.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between gap-2 border-b border-zinc-800/10 last:border-0 pb-1">
                            <span className="truncate flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 text-zinc-500" />
                              {file.path}
                            </span>
                            <span className={file.risk === 'vulnerable' ? 'text-red-500 font-bold' : 'text-emerald-500'}>
                              {file.risk === 'vulnerable' ? 'Vulnerable' : 'Secure'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render approval card if available */}
                  {msg.approvalCard && (
                    <div className="mt-3.5 p-3 rounded border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-3">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0 animate-bounce" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase font-mono">Sensitive Action Pending</span>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{msg.approvalCard.actionName}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-mono italic bg-zinc-50 dark:bg-zinc-900 p-2 rounded">{msg.approvalCard.description}</p>
                      
                      {msg.approvalCard.approved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                          <CheckCircle2 className="h-3.5 w-3.5" /> APPROVED
                        </span>
                      ) : msg.approvalCard.declined ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">
                          ✕ DECLINED
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <button
                            onClick={() => handleApproveAction(msg.id)}
                            className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineAction(msg.id)}
                            className="px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-400 cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="block text-[8px] font-mono text-zinc-400 text-right mt-1">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="p-3.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/10 dark:bg-[#0E0E10] flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-brand-blue animate-spin" />
                  <span className="text-xs font-mono text-zinc-400">Agent preparing an approval-safe response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-[#0A0A0B] flex items-center gap-2">
            <input
              type="text"
              required
              disabled={isThinking}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask for a setup plan, code review, or architecture explanation..."
              className="flex-1 px-3 py-2 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Panel 4: Context/Approval Executing status (Right Panel) */}
        <div className="xl:col-span-1 p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] h-full flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Agent Memory & Context</span>
            
            {/* Live active tool runner overlay inside sidebar */}
            {isExecutingTool ? (
              <div className="p-3 rounded-lg border border-brand-blue/30 bg-brand-blue/5 space-y-2">
                <span className="text-[10px] font-mono font-bold text-brand-blue flex items-center gap-1.5 uppercase animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Executing Safe Action
                </span>
                <p className="text-[11px] font-mono text-zinc-800 dark:text-zinc-200 truncate">{executingToolName}</p>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1">
                  <div className="bg-brand-blue h-1 rounded-full transition-all duration-300" style={{ width: `${toolProgress}%` }}></div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded border border-emerald-500/25 bg-emerald-500/5 text-xs flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300">Prototype assistant is idle. No backend action is connected.</span>
              </div>
            )}

            {/* Context details list */}
            <div className="space-y-2 text-[10px] font-mono">
              <div className="p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 block uppercase">Workspace Memory</span>
                <p className="text-zinc-600 dark:text-zinc-300 mt-1">README, context, memory, design docs available</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 block uppercase">Safe Actions Enabled</span>
                <p className="text-zinc-600 dark:text-zinc-300 mt-1">Draft plans • Summarize memory • Prepare approval cards</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 block uppercase">Pending Approvals</span>
                <p className="text-zinc-600 dark:text-zinc-300 mt-1">0 sensitive operations awaiting human signature</p>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 text-[9px] font-mono text-zinc-400 text-center">
            All sensitive actions require explicit human approval before backend integration.
          </div>
        </div>
      </div>
    </div>
  );
}
