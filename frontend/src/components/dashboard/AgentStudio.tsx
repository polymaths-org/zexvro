import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Code2,
  Command,
  CreditCard,
  FileSearch,
  FolderKanban,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  TerminalSquare,
  Trash2,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  buildAgentChatPayload,
  loadAgentSettings,
  loadAgentSettingsFromAWS,
} from '../../agent/settings';
import { MorphReply } from '../../agent/MorphReply';
import {
  extractMorphActions,
  mergeSuggestedActions,
  quickStartActions,
  type MorphAction,
} from '../../agent/morphActions';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useWorkspaceStore } from '../../stores/workspace';
import { useProjectStore } from '../../stores/project';
import type { MorphScope } from '../../agent/platformKb';

const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
  actions?: MorphAction[];
}

interface AgentStudioProps {
  cliConnected?: boolean;
  cliLastActive?: number | null;
}

type SuggestItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
};

const WORKSPACE_SUGGESTIONS: SuggestItem[] = [
  {
    icon: FolderKanban,
    label: 'Create a project',
    prompt: 'How do I create a project in this workspace and enable services?',
  },
  {
    icon: CreditCard,
    label: 'Buy ZCR credits',
    prompt: 'How do I check ZCR balance and buy or redeem credits for this workspace?',
  },
  {
    icon: Users,
    label: 'Invite the team',
    prompt: 'How do I invite teammates and set roles for this workspace?',
  },
  {
    icon: TerminalSquare,
    label: 'Morph CLI setup',
    prompt: 'How do I connect Morph CLI to this workspace with login, use, and bind?',
  },
];

const PROJECT_SUGGESTIONS: SuggestItem[] = [
  {
    icon: FileSearch,
    label: 'Add REQWID captcha',
    prompt: 'How do I protect checkout with REQWID captcha on this project?',
  },
  {
    icon: Rocket,
    label: 'NFT collection',
    prompt: 'How do I create an NFT collection and mint on NFTo in this project?',
  },
  {
    icon: Wrench,
    label: 'DEDSEC / De-pin',
    prompt: 'How do I set up DEDSEC paywalled APIs for this project?',
  },
  {
    icon: CheckCircle2,
    label: 'Project memory',
    prompt: 'What should I write to project shared memory for Morph handoffs?',
  },
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';
const AGENT_CHAT_URL = IS_LOCAL_HOST ? '/api/agent/chat' : `${API_BASE_URL}/api/chat`;

export default function AgentStudio({ cliConnected = false, cliLastActive = null }: AgentStudioProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { workspaceId?: string; projectId?: string };
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const projects = useProjectStore((s) => s.projects);

  // Route-driven scope: /w/:id/agent = workspace; /w/:id/p/:pid/agent = project
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const onProjectRoute = Boolean(params.projectId) || /\/p\/[^/]+\/agent/.test(path);
  const scope: MorphScope = onProjectRoute ? 'project' : 'workspace';

  const workspaceId = params.workspaceId || workspaces[0]?.id;
  // Only use project id on project Morph surface
  const projectId = scope === 'project' ? params.projectId : undefined;
  const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name;
  const workspaceProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === workspaceId),
    [projects, workspaceId],
  );
  const currentProject = workspaceProjects.find((p) => p.id === projectId);
  const projectName = currentProject?.name;

  const routeContext = useMemo(
    () => ({
      scope,
      workspaceId,
      projectId: scope === 'project' ? projectId : null,
      workspaceName,
      projectName: scope === 'project' ? projectName : null,
      projectNames: workspaceProjects.map((p) => p.name),
      currentScreen:
        scope === 'project'
          ? `Morph Agent · project ${projectName || projectId || ''}`
          : `Morph Agent · workspace ${workspaceName || workspaceId || ''}`,
      path,
    }),
    [scope, workspaceId, projectId, workspaceName, projectName, workspaceProjects, path],
  );

  const suggestions = scope === 'project' ? PROJECT_SUGGESTIONS : WORKSPACE_SUGGESTIONS;
  const jumpActions = quickStartActions(routeContext);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const [contextOpen, setContextOpen] = useState(true);
  const [agentSettings, setAgentSettings] = useState(() => loadAgentSettings());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMessages = messages.length > 0 || isThinking;

  // Reset chat when switching workspace/project Morph surfaces
  useEffect(() => {
    setMessages([]);
    setError('');
    setInputValue('');
  }, [scope, workspaceId, projectId]);

  const go = (to: string) => {
    navigate({ to: to as '/' });
  };

  useEffect(() => {
    let mounted = true;
    loadAgentSettingsFromAWS().then((settings) => {
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

    try {
      const response = await fetch(AGENT_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildAgentChatPayload(
            scope === 'project'
              ? `Project ${projectName || projectId}`
              : `Workspace ${workspaceName || workspaceId}`,
            nextMessages.map((m) => ({
              role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.text,
            })),
            agentSettings,
            routeContext,
          ),
        ),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || `Agent request failed with ${response.status}`);
      }

      const raw = data.choices?.[0]?.message?.content || data.text || 'No response returned.';
      const { cleanText, actions: modelActions } = extractMorphActions(String(raw), routeContext);
      const actions = mergeSuggestedActions(prompt, modelActions, routeContext, 2);

      setMessages((prev) => [
        ...prev,
        {
          id: `agt-${Date.now()}`,
          sender: 'agent',
          text: cleanText || String(raw),
          timestamp: Date.now(),
          actions,
        },
      ]);
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

  const memoryPath = projectId
    ? `/dashboard/w/${workspaceId}/p/${projectId}/memory`
    : workspaceId
      ? `/dashboard/w/${workspaceId}/memory`
      : '/dashboard';

  const cliSnippet =
    scope === 'project' && projectId
      ? `# install once
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
export PATH="$HOME/.local/bin:$PATH"

morph login
morph use ${workspaceId || '<workspaceId>'} ${projectId}
cd your-app && morph bind
morph providers add codexin
morph`
      : `# install once
curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash
export PATH="$HOME/.local/bin:$PATH"

morph login
morph use ${workspaceId || '<workspaceId>'}
cd your-app && morph bind
morph providers add codexin
morph`;

  return (
    <div className="flex h-[calc(100vh-7rem)] max-h-[900px] min-h-[500px] gap-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.04] dark:border-white/[0.08] dark:bg-[#0A0A0B]">
      {/* Main Chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 dark:from-violet-500/15 dark:to-blue-500/15">
              <img src={MORPH_LOGO} alt="" className="h-5 w-5 object-contain invert dark:invert-0" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">Morph</h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    scope === 'project'
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {scope === 'project' ? 'Project' : 'Workspace'}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  {scope === 'project'
                    ? `${projectName || 'Project'} · ${workspaceName || 'Workspace'}`
                    : workspaceName || 'Workspace'}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="flex items-center gap-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${cliConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}
                  />
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
                onClick={() => {
                  setMessages([]);
                  setError('');
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10">
              <div className="relative mb-6">
                <img
                  src={MORPH_ILLUSTRATION}
                  alt=""
                  className="h-32 w-32 object-contain opacity-90 sm:h-40 sm:w-40"
                />
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-500 dark:border-[#0A0A0B]">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                {scope === 'project' ? 'Project Morph' : 'Workspace Morph'}
              </h2>
              <p className="mt-2 max-w-md text-center text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {scope === 'project'
                  ? 'REQWID, NFTo, DEDSEC, and migration help for this project only.'
                  : 'Team, credits, projects, and CLI for this workspace — open a project for product tools.'}
              </p>

              {jumpActions.length > 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {jumpActions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => go(a.path)}
                      className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-300"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {suggestions.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => sendMessage(item.prompt)}
                    className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-500 transition group-hover:bg-violet-500/15 dark:bg-violet-500/10 dark:text-violet-400">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                        {item.prompt.slice(0, 72)}
                        {item.prompt.length > 72 ? '…' : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-1 px-4 py-5 sm:px-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 py-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.sender === 'agent' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[0.06]">
                      <img src={MORPH_LOGO} alt="Morph" className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`max-w-[85%] min-w-0 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`inline-block rounded-xl px-4 py-2.5 text-sm leading-6 ${
                        msg.sender === 'user'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {msg.sender === 'agent' ? (
                        <MorphReply text={msg.text} actions={msg.actions || []} onNavigate={go} />
                      ) : (
                        <p>{msg.text}</p>
                      )}
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

        {error && (
          <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              {error}
            </div>
            <button
              onClick={() => setError('')}
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-white/[0.08] sm:p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 shadow-sm transition-colors focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:focus-within:border-violet-500/40 dark:focus-within:ring-violet-500/5">
              <img
                src={MORPH_LOGO}
                alt=""
                className="h-4 w-4 shrink-0 object-contain opacity-40 invert dark:invert-0"
              />
              <input
                ref={inputRef}
                type="text"
                required
                disabled={isThinking}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  scope === 'project'
                    ? 'Ask about this project (REQWID, NFTo, migration)…'
                    : 'Ask about this workspace (team, credits, projects)…'
                }
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
              />
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
              Scope: {scope === 'project' ? 'this project' : 'this workspace only'}. Buttons never open the wrong level.
            </p>
          </form>
        </div>
      </div>

      {/* Context Sidebar — scope accurate */}
      {contextOpen && (
        <div className="hidden w-72 shrink-0 flex-col border-l border-zinc-200 dark:border-white/[0.08] lg:flex">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/[0.08]">
            <span className="text-xs font-semibold text-zinc-950 dark:text-white">
              {scope === 'project' ? 'Project context' : 'Workspace context'}
            </span>
            <button
              onClick={() => setContextOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-xs">
            <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p
                className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ fontSize: '10px' }}
              >
                Morph CLI
              </p>
              <p className="mb-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                {scope === 'project'
                  ? 'Bind CLI to this workspace and project.'
                  : 'Bind CLI to this workspace; pick a project later for REQWID/NFTo.'}
              </p>
              <pre className="overflow-x-auto rounded-md bg-zinc-950 p-2.5 font-mono text-[10px] leading-5 text-cyan-100/90">
                {cliSnippet}
              </pre>
              <button
                type="button"
                onClick={() => go(memoryPath)}
                className="mt-2 inline-flex text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                Shared memory →
              </button>
            </div>

            <div className="mb-5">
              <p
                className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ fontSize: '10px' }}
              >
                Workspace
              </p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{workspaceName || '—'}</p>
              {workspaceId && (
                <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-400">{workspaceId}</p>
              )}
            </div>

            {scope === 'project' ? (
              <div className="mb-5">
                <p
                  className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  style={{ fontSize: '10px' }}
                >
                  Project
                </p>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{projectName || '—'}</p>
                {projectId && (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-400">{projectId}</p>
                )}
                {currentProject?.enabledServices && currentProject.enabledServices.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {currentProject.enabledServices.map((s) => (
                      <span
                        key={s}
                        className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quickStartActions(routeContext).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => go(a.path)}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <p
                  className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  style={{ fontSize: '10px' }}
                >
                  Projects ({workspaceProjects.length})
                </p>
                {workspaceProjects.length === 0 ? (
                  <p className="text-[11px] leading-4 text-zinc-500">
                    No projects yet. Create one to use REQWID, NFTo, or DEDSEC.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {workspaceProjects.slice(0, 8).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() =>
                            go(`/dashboard/w/${workspaceId}/p/${p.id}/agent`)
                          }
                          className="w-full rounded-md border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-zinc-300 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
                        >
                          {p.name}
                          <span className="mt-0.5 block font-mono text-[9px] font-normal text-zinc-400">
                            Open project Morph →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quickStartActions(routeContext).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => go(a.path)}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <p
                className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ fontSize: '10px' }}
              >
                CLI Status
              </p>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cliConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                <span className={cliConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}>
                  {cliConnected
                    ? `Synced${cliLastActive ? ` · ${new Date(cliLastActive * 1000).toLocaleTimeString()}` : ''}`
                    : 'Not connected'}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <p
                className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ fontSize: '10px' }}
              >
                Provider
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">{agentSettings.provider}</p>
              <p className="mt-0.5 text-zinc-500">{agentSettings.model}</p>
            </div>

            <div>
              <p
                className="mb-2 font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                style={{ fontSize: '10px' }}
              >
                Session
              </p>
              <p className="text-zinc-500">{messages.length} messages · {scope} scope</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
