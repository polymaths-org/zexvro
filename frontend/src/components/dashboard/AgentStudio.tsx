import React, { useState } from 'react';
import {
  Loader2,
  Send,
  Sparkles,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import {
  buildAgentChatPayload,
  loadAgentSettings,
} from '../../agent/settings';

const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface AgentStudioProps {
  cliConnected?: boolean;
  cliLastActive?: number | null;
}

export default function AgentStudio({ cliConnected = false, cliLastActive = null }: AgentStudioProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const agentSettings = loadAgentSettings();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isThinking) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    setIsThinking(true);
    setError('');

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAgentChatPayload(
          'Agentic Operations',
          nextMessages.map((message) => ({
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: message.text,
          })),
        )),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Agent request failed with ${response.status}`);
      }

      const agentMessage: Message = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: data.text || 'No response returned.',
        timestamp: 'Just now',
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent request failed.';
      setError(message);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={MORPH_LOGO}
            alt="Morph"
            className="h-9 w-9 shrink-0 object-contain invert dark:invert-0"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
              Agentic Operations
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
              Live Morph chat for workspace operations, powered through the server-side opencode proxy.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([]);
            setError('');
          }}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white/80 px-3 text-xs font-medium text-zinc-600 shadow-sm shadow-zinc-950/[0.03] transition hover:border-red-300 hover:text-red-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-red-400/40 dark:hover:text-red-300"
          title="Clear chat"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
      </div>

      <section className="flex min-h-[680px] h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/85 shadow-sm shadow-zinc-950/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Morph Chat</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {agentSettings.provider} / {agentSettings.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${cliConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className={cliConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {cliConnected
                ? `CLI synced${cliLastActive ? ` ${new Date(cliLastActive * 1000).toLocaleTimeString()}` : ''}`
                : 'CLI not linked'}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && !isThinking ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <img
                src={MORPH_ILLUSTRATION}
                alt="Morph assistant"
                className="h-44 w-44 object-contain sm:h-52 sm:w-52"
              />
              <h2 className="mt-3 text-xl font-semibold text-zinc-950 dark:text-white">Ask Morph</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Type a workspace question or operation request. Responses come from the opencode proxy when `OPENCODE_API_KEY` is configured.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[86%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                        : 'border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-6">{message.text}</p>
                    <span className="mt-2 block text-right text-[11px] text-zinc-400">{message.timestamp}</span>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Morph is calling opencode...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="border-t border-zinc-200 p-3 dark:border-white/10">
          <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 shadow-inner dark:border-white/10 dark:bg-black/25">
            <TerminalSquare className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="text"
              required
              disabled={isThinking}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Morph about this workspace"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
