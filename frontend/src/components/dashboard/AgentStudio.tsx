import React, { useState } from 'react';
import {
  CheckCircle2,
  History,
  Loader2,
  Send,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';

const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

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
}

const promptStarters = [
  'Plan a Transformation Agent setup flow',
  'Review this workspace before a change',
  'Create an approval card for a risky action',
  'Summarize memory and security handoffs',
];

export default function AgentStudio() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isThinking) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsThinking(true);

    window.setTimeout(() => {
      const lowerPrompt = prompt.toLowerCase();
      let text = 'I can prepare this as a safe workspace proposal. Nothing is connected to backend execution yet, so any action stays inside this chat until a human approves it.';
      let approvalCard: Message['approvalCard'];

      if (lowerPrompt.includes('transform') || lowerPrompt.includes('code')) {
        text = 'I prepared a Transformation Agent plan: inspect repository context, list allowed files, define blocked areas, create a change checklist, then wait for human approval before edits.';
        approvalCard = {
          actionName: 'Prepare transformation checklist',
          description: 'Creates a local planning card only. It does not edit files, deploy, call wallets, or run backend services.',
        };
      } else if (lowerPrompt.includes('approval') || lowerPrompt.includes('risky')) {
        text = 'I drafted an approval card. The card should describe scope, affected files, rollback path, and the exact operation that needs a human signature.';
        approvalCard = {
          actionName: 'Record approval requirement',
          description: 'Stores a draft requirement in UI state only. No sensitive operation runs from this prototype.',
        };
      } else if (lowerPrompt.includes('security') || lowerPrompt.includes('memory')) {
        text = 'I would summarize decisions, blockers, owner handoffs, and security notes. Raw logs should stay out of memory until a backend retention policy exists.';
      }

      const agentMessage: Message = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text,
        timestamp: 'Just now',
        approvalCard,
      };

      setMessages((prev) => [...prev, agentMessage]);
      setIsThinking(false);
    }, 900);
  };

  const handleApproveAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === msgId && message.approvalCard
          ? { ...message, approvalCard: { ...message.approvalCard, approved: true } }
          : message
      )
    );
  };

  const handleDeclineAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === msgId && message.approvalCard
          ? { ...message, approvalCard: { ...message.approvalCard, declined: true } }
          : message
      )
    );
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
              Chat with Morph for transformation planning, setup review, and approval-safe actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[
            { label: 'History', icon: History },
            { label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.label}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white/80 px-3 text-xs font-medium text-zinc-600 shadow-sm shadow-zinc-950/[0.03] transition hover:border-violet-300 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-violet-400/50 dark:hover:text-white"
              title={item.label}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setMessages([])}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white/80 text-zinc-500 shadow-sm shadow-zinc-950/[0.03] transition hover:border-red-300 hover:text-red-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-red-400/40 dark:hover:text-red-300"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="flex min-h-[680px] h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/85 shadow-sm shadow-zinc-950/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-400/30 bg-violet-500/10">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Morph Chat</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Prototype assistant. Backend actions are not connected.</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            title="Chat preferences"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && !isThinking ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <img
                src={MORPH_ILLUSTRATION}
                alt="Morph assistant"
                className="h-48 w-48 object-contain sm:h-56 sm:w-56"
              />
              <h2 className="mt-3 text-xl font-semibold text-zinc-950 dark:text-white">How can Morph help?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Start with a prompt or ask Morph to prepare setup notes, review a planned change, or draft an approval card.
              </p>
              <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {promptStarters.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInputValue(prompt)}
                    className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2.5 text-left text-sm font-medium text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[86%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                        : 'border border-violet-400/20 bg-violet-500/10 text-zinc-800 dark:text-zinc-100'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-6">{message.text}</p>

                    {message.approvalCard && (
                      <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-white/85 p-3 dark:border-white/10 dark:bg-black/20">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <div>
                            <p className="text-xs font-semibold uppercase text-zinc-900 dark:text-white">Approval card</p>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{message.approvalCard.actionName}</p>
                          </div>
                        </div>
                        <p className="rounded-md bg-zinc-50 p-2 text-xs leading-5 text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
                          {message.approvalCard.description}
                        </p>

                        {message.approvalCard.approved ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approved
                          </span>
                        ) : message.approvalCard.declined ? (
                          <span className="inline-flex rounded-md bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-500">
                            Declined
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <button
                              onClick={() => handleApproveAction(message.id)}
                              className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-600"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineAction(message.id)}
                              className="rounded-md border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-500 transition hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="mt-2 block text-right text-[11px] text-zinc-400">{message.timestamp}</span>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    Morph is preparing a safe response...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-zinc-200 p-3 dark:border-white/10">
          <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 shadow-inner dark:border-white/10 dark:bg-black/25">
            <input
              type="text"
              required
              disabled={isThinking}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Morph"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
