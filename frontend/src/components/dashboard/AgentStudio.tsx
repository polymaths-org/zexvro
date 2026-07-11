import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  Code2,
  Command,
  FileSearch,
  Loader2,
  MessageSquare,
  Rocket,
  Send,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  buildAgentChatPayload,
  loadAgentSettings,
  loadAgentSettingsFromAWS,
} from '../../agent/settings';
import { SYSTEM_PROMPT as STELLAR_SYSTEM_PROMPT } from '../../agent/stellarKb';

const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
}

interface AgentStudioProps {
  cliConnected?: boolean;
  cliLastActive?: number | null;
}

const SUGGESTED_PROMPTS = [
  { icon: FileSearch, label: 'Scan repository', prompt: 'Scan my repository structure and summarize the codebase architecture.' },
  { icon: Rocket, label: 'Migration steps', prompt: 'Explain the key steps for migrating a Web2 app to Web3 infrastructure.' },
  { icon: TerminalSquare, label: 'CLI status', prompt: 'Check the current CLI connection status and show what tools are available.' },
  { icon: Wrench, label: 'Service readiness', prompt: 'Review the readiness of all 6 MVP services and list next actions for each.' },
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function renderMessageContent(text: string) {
  // Simple markdown-like rendering: code blocks, inline code, bold
  const parts: React.ReactNode[] = [];
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  lines.forEach((line, lineIdx) => {
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        parts.push(
          <pre key={`code-${lineIdx}`} className="my-2 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-100 p-3 text-xs leading-5 dark:border-white/10 dark:bg-black/40">
            <code className="font-mono text-zinc-800 dark:text-zinc-200">{codeLines.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
        codeLang = '';
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Process inline formatting
    let processed: React.ReactNode = line;

    // Inline code
    if (line.includes('`')) {
      const segs = line.split(/`([^`]+)`/);
      processed = segs.map((seg, i) =>
        i % 2 === 1
          ? <code key={i} className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/10">{seg}</code>
          : <span key={i}>{seg}</span>
      );
    }

    // Bold
    if (typeof processed === 'string' && processed.includes('**')) {
      const segs = processed.split(/\*\*([^*]+)\*\*/);
      processed = segs.map((seg, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold">{seg}</strong>
          : <span key={i}>{seg}</span>
      );
    }

    parts.push(
      <span key={`line-${lineIdx}`} className="block">
        {processed || '\u00A0'}
      </span>
    );
  });

  // Flush unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    parts.push(
      <pre key="code-final" className="my-2 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-100 p-3 text-xs leading-5 dark:border-white/10 dark:bg-black/40">
        <code className="font-mono text-zinc-800 dark:text-zinc-200">{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return <>{parts}</>;
}

const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (IS_LOCAL_HOST
    ? 'http://localhost:8080'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');
const AGENT_CHAT_URL = IS_LOCAL_HOST ? '/api/agent/chat' : `${API_BASE_URL}/api/chat`;

export default function AgentStudio({ cliConnected = false, cliLastActive = null }: AgentStudioProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [agentSettings, setAgentSettings] = useState(() => loadAgentSettings());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMessages = messages.length > 0 || isThinking;

  useEffect(() => {
    let mounted = true;
    loadAgentSettingsFromAWS().then(settings => {
      if (!mounted) return;
      setAgentSettings(settings);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(t);
  }, [error]);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isThinking) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: prompt.trim(),
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setIsThinking(true);
    setError('');

    const systemPrompt = STELLAR_SYSTEM_PROMPT;

    try {
      const response = await fetch(AGENT_CHAT_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildAgentChatPayload(
          'Agentic Operations',
          [
            { role: 'system', content: systemPrompt },
            ...nextMessages.map((m) => ({
              role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.text,
            }))
          ],
          agentSettings,
        )),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || `Agent request failed with ${response.status}`);
      }

      const reply = data.choices?.[0]?.message?.content || data.text || 'No response returned.';

      setMessages((prev) => [...prev, {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: reply,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent request failed.';
      setError(message);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] max-h-[900px] min-h-[500px] gap-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.04] dark:border-white/[0.08] dark:bg-[#0A0A0B]">
      {/* Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 dark:from-violet-500/15 dark:to-blue-500/15">
              <img src={MORPH_LOGO} alt="" className="h-5 w-5 object-contain invert dark:invert-0" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">Morph</h1>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="truncate">{agentSettings.provider} / {agentSettings.model}</span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${cliConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {cliConnected ? 'CLI synced' : 'CLI offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setContextOpen(!contextOpen)}
              className="hidden items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04] lg:inline-flex"
            >
              <Command className="h-3 w-3" />
              Context
              <ChevronRight className={`h-3 w-3 transition-transform ${contextOpen ? 'rotate-90' : ''}`} />
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(''); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Welcome State */
            <div className="flex h-full flex-col items-center justify-center px-6 py-10">
              <div className="relative mb-6">
                <img src={MORPH_ILLUSTRATION} alt="" className="h-32 w-32 object-contain opacity-90 sm:h-40 sm:w-40" />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-500 dark:border-[#0A0A0B]">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                What can I help with?
              </h2>
              <p className="mt-2 max-w-md text-center text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Ask Morph about your workspace, plan migrations, check service readiness, or run operations.
              </p>

              {/* Suggested prompts */}
              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => sendMessage(item.prompt)}
                    className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-500 transition group-hover:bg-violet-500/15 dark:bg-violet-500/10 dark:text-violet-400">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{item.prompt.slice(0, 60)}...</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="mx-auto max-w-3xl space-y-1 px-4 py-5 sm:px-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 py-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'agent' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[0.06]">
                      <img src={MORPH_LOGO} alt="Morph" className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`max-w-[85%] min-w-0 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block rounded-xl px-4 py-2.5 text-sm leading-6 ${
                      msg.sender === 'user'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}>
                      {msg.sender === 'agent' ? renderMessageContent(msg.text) : <p>{msg.text}</p>}
                    </div>
                    <p className="mt-1 px-1 text-[10px] text-zinc-400">{relativeTime(msg.timestamp)}</p>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex gap-3 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[0.06]">
                    <img src={MORPH_LOGO} alt="Morph" className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl px-4 py-3">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                    </span>
                    <span className="text-xs text-zinc-400">Morph is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              {error}
            </div>
            <button onClick={() => setError('')} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-white/[0.08] sm:p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 shadow-sm transition-colors focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:focus-within:border-violet-500/40 dark:focus-within:ring-violet-500/5">
              <img src={MORPH_LOGO} alt="" className="h-4 w-4 shrink-0 object-contain opacity-40 invert dark:invert-0" />
              <input
                ref={inputRef}
                type="text"
                required
                disabled={isThinking}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Morph anything..."
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
              />
              <span className="hidden text-[10px] text-zinc-400 sm:block">⌘↵</span>
              <button
                type="submit"
                disabled={!inputValue.trim() || isThinking}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-600 dark:hover:bg-violet-500"
                title="Send"
              >
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-zinc-400">
              Morph can make mistakes. Review proposals before approval.
            </p>
          </form>
        </div>
      </div>

      {/* Context Sidebar */}
      {contextOpen && (
        <div className="hidden w-72 shrink-0 flex-col border-l border-zinc-200 dark:border-white/[0.08] lg:flex">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/[0.08]">
            <span className="text-xs font-semibold text-zinc-950 dark:text-white">Context</span>
            <button onClick={() => setContextOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-xs">
            {/* Workspace */}
            <div className="mb-5">
              <p className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ fontSize: '10px' }}>Workspace</p>
              <p className="text-zinc-700 dark:text-zinc-300">ZEXVRO Platform</p>
            </div>

            {/* Connection */}
            <div className="mb-5">
              <p className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ fontSize: '10px' }}>CLI Status</p>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cliConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                <span className={cliConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}>
                  {cliConnected
                    ? `Synced${cliLastActive ? ` · ${new Date(cliLastActive * 1000).toLocaleTimeString()}` : ''}`
                    : 'Not connected'}
                </span>
              </div>
            </div>

            {/* Provider */}
            <div className="mb-5">
              <p className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ fontSize: '10px' }}>Provider</p>
              <p className="text-zinc-700 dark:text-zinc-300">{agentSettings.provider}</p>
              <p className="mt-0.5 text-zinc-500">{agentSettings.model}</p>
            </div>

            {/* Available Tools */}
            <div className="mb-5">
              <p className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ fontSize: '10px' }}>Available Tools</p>
              <div className="space-y-1.5">
                {['read_file', 'write_file', 'list_dir', 'run_command', 'analyze_codebase'].map((tool) => (
                  <div key={tool} className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                    <Code2 className="h-3 w-3 text-zinc-400" />
                    <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{tool}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Info */}
            <div>
              <p className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500" style={{ fontSize: '10px' }}>Session</p>
              <p className="text-zinc-500">{messages.length} messages</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
