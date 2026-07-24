import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Copy,
  FileCode2,
  Filter,
  GitBranch,
  Layers,
  Plus,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type { MemoryEntry, MemoryLabel } from '../../types';
import { normalizeMemoryEntry } from '../../lib/memoryNormalize';
import { AnimatePresence, motion } from 'motion/react';

const AREAS = [
  'Morph',
  'REQWID',
  'NFTo',
  'DEDSEC',
  'Zer0',
  'Frontend',
  'Backend',
  'Infra',
  'Other',
] as const;

const LABELS: { id: MemoryLabel | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'decision', label: 'Decisions' },
  { id: 'blocker', label: 'Blockers' },
  { id: 'handoff', label: 'Handoffs' },
  { id: 'context', label: 'Context' },
  { id: 'migration', label: 'Migrations' },
  { id: 'general', label: 'Notes' },
];

interface MemoryProps {
  memoryEntries: MemoryEntry[];
  setMemoryEntries: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
  openNewMemoryModal: boolean;
  setOpenNewMemoryModal: (open: boolean) => void;
  scopeLabel?: string;
  workspaceId?: string;
  projectId?: string;
  morphMeta?: Record<string, unknown>;
  loading?: boolean;
  saveError?: string | null;
}

function labelStyles(label: MemoryLabel) {
  switch (label) {
    case 'decision':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400';
    case 'blocker':
      return 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400';
    case 'handoff':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400';
    case 'migration':
      return 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400';
    case 'context':
      return 'bg-amber-500/10 text-amber-800 border-amber-500/20 dark:text-amber-400';
    default:
      return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400';
  }
}

function formatWhen(iso?: string, fallback = '—') {
  if (!iso) return fallback;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return fallback;
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function isBlockerEntry(m: MemoryEntry) {
  return m.label === 'blocker' || m.blockers.length > 0;
}

function isDecisionEntry(m: MemoryEntry) {
  return m.label === 'decision' || m.decisions.length > 0;
}

function isOpenBlocker(m: MemoryEntry) {
  return isBlockerEntry(m) && m.status !== 'resolved';
}

export default function Memory({
  memoryEntries,
  setMemoryEntries,
  openNewMemoryModal,
  setOpenNewMemoryModal,
  scopeLabel = 'This project',
  workspaceId,
  projectId,
  morphMeta,
  loading,
  saveError,
}: MemoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFilter, setLabelFilter] = useState<MemoryLabel | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [showResolved, setShowResolved] = useState(false);
  const [copied, setCopied] = useState('');

  const [newSrv, setNewSrv] = useState<string>('Morph');
  const [newFiles, setNewFiles] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newDecisions, setNewDecisions] = useState('');
  const [newFollowups, setNewFollowups] = useState('');
  const [newBlockers, setNewBlockers] = useState('');
  const [newVerification, setNewVerification] = useState('');
  const [newLabel, setNewLabel] = useState<MemoryLabel>('decision');
  const [validationError, setValidationError] = useState('');
  const [quickMode, setQuickMode] = useState<'decision' | 'blocker' | null>(null);

  // Normalize once for display (parent may hold raw API data)
  const entries = useMemo(
    () =>
      memoryEntries
        .map((e) => normalizeMemoryEntry(e))
        .filter((e): e is MemoryEntry => Boolean(e)),
    [memoryEntries],
  );

  const openBlockers = useMemo(() => entries.filter(isOpenBlocker), [entries]);
  const decisionCount = useMemo(
    () => entries.reduce((n, e) => n + Math.max(e.decisions.length, e.label === 'decision' ? 1 : 0), 0),
    [entries],
  );
  const openBlockerItemCount = useMemo(
    () => openBlockers.reduce((n, e) => n + Math.max(e.blockers.length, 1), 0),
    [openBlockers],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) {
      c[e.label] = (c[e.label] || 0) + 1;
    }
    // Tabs also count content-bearing notes
    c.decision = entries.filter(isDecisionEntry).length;
    c.blocker = entries.filter(isBlockerEntry).length;
    return c;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((m) => {
        if (!showResolved && m.status === 'resolved' && isBlockerEntry(m)) return false;
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          m.summary.toLowerCase().includes(q) ||
          m.service.toLowerCase().includes(q) ||
          m.decisions.some((d) => d.toLowerCase().includes(q)) ||
          m.blockers.some((b) => b.toLowerCase().includes(q)) ||
          m.followUps.some((f) => f.toLowerCase().includes(q));
        let matchesLabel = true;
        if (labelFilter === 'decision') matchesLabel = isDecisionEntry(m);
        else if (labelFilter === 'blocker') matchesLabel = isBlockerEntry(m);
        else if (labelFilter !== 'all') matchesLabel = m.label === labelFilter;
        const matchesArea = areaFilter === 'all' || m.service === areaFilter;
        return matchesSearch && matchesLabel && matchesArea;
      })
      .slice()
      .sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
  }, [entries, searchTerm, labelFilter, areaFilter, showResolved]);

  const recentDecisions = useMemo(() => {
    return entries
      .filter(isDecisionEntry)
      .slice()
      .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))
      .slice(0, 5);
  }, [entries]);

  const morphMetaEntries = useMemo(() => {
    if (!morphMeta) return [] as [string, unknown][];
    return Object.entries(morphMeta).filter(
      ([k]) => k.startsWith('morph:') || k.includes('collection') || k.includes('gate') || k.includes('site'),
    );
  }, [morphMeta]);

  const openCreate = (mode?: 'decision' | 'blocker') => {
    if (mode) {
      setNewLabel(mode);
      setQuickMode(mode);
    } else {
      setQuickMode(null);
    }
    setValidationError('');
    setOpenNewMemoryModal(true);
  };

  const resetForm = () => {
    setNewSrv('Morph');
    setNewFiles('');
    setNewSummary('');
    setNewDecisions('');
    setNewFollowups('');
    setNewBlockers('');
    setNewVerification('');
    setNewLabel('decision');
    setQuickMode(null);
    setValidationError('');
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const summary = newSummary.trim();
    let decisions = newDecisions.split('\n').map((d) => d.trim()).filter(Boolean);
    let blockers = newBlockers.split('\n').map((b) => b.trim()).filter(Boolean);

    // Type-aware defaults: decision/blocker content can live in summary alone
    if (newLabel === 'decision' && decisions.length === 0 && summary) {
      decisions = [summary];
    }
    if (newLabel === 'blocker' && blockers.length === 0 && summary) {
      blockers = [summary];
    }

    if (!summary && decisions.length === 0 && blockers.length === 0) {
      setValidationError(
        newLabel === 'blocker'
          ? 'Write the blocker so the next person knows what is stuck.'
          : newLabel === 'decision'
            ? 'Write the decision you want recorded.'
            : 'Add a short summary so the next person (or Morph) gets it.',
      );
      return;
    }

    const now = new Date();
    const finalSummary =
      summary ||
      (newLabel === 'blocker' ? blockers[0] : '') ||
      (newLabel === 'decision' ? decisions[0] : '') ||
      'Note';

    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      service: newSrv,
      filesChanged: newFiles.split(',').map((f) => f.trim()).filter(Boolean),
      summary: finalSummary,
      decisions,
      followUps: newFollowups.split('\n').map((f) => f.trim()).filter(Boolean),
      blockers,
      verification: newVerification.trim(),
      date: 'Just now',
      createdAt: now.toISOString(),
      owner: 'You',
      source: 'human',
      label: newLabel,
      status: 'open',
    };

    setMemoryEntries((prev) => [newEntry, ...prev]);
    resetForm();
    setOpenNewMemoryModal(false);
  };

  const resolveEntry = (id: string) => {
    setMemoryEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'resolved' as const, resolvedAt: new Date().toISOString(), date: 'Resolved' }
          : e,
      ),
    );
  };

  const reopenEntry = (id: string) => {
    setMemoryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'open' as const, resolvedAt: undefined, date: 'Reopened' } : e)),
    );
  };

  const deleteEntry = (id: string) => {
    setMemoryEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const doCopy = (text: string, id: string) => {
    copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1500);
  };

  const cliLines = [
    '# Install Morph CLI (once)',
    'curl -fsSL https://raw.githubusercontent.com/polymaths-org/zexvro/main/scripts/install-morph.sh | bash',
    'export PATH="$HOME/.local/bin:$PATH"',
    '',
    '# Link ZEXVRO account + this workspace',
    'morph login',
    workspaceId
      ? `morph use ${workspaceId}${projectId ? ` ${projectId}` : ''}`
      : 'morph use <workspaceId>',
    'cd your-app && morph bind',
    '',
    '# LLM (CodexIn / Grok) then start',
    'morph providers add codexin',
    'morph',
  ];

  const primaryFieldLabel =
    newLabel === 'blocker' ? 'What is blocked?' : newLabel === 'decision' ? 'What did we decide?' : 'Summary';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
            <BookOpen className="h-5 w-5 text-zinc-500" />
            Shared memory
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Decisions and blockers for{' '}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{scopeLabel}</span>. Morph and
            teammates both read this.
          </p>
          {(workspaceId || projectId) && (
            <p className="mt-2 font-mono text-[11px] text-zinc-400">
              {workspaceId && (
                <span>
                  ws:{workspaceId.slice(0, 12)}
                  {workspaceId.length > 12 ? '…' : ''}
                </span>
              )}
              {projectId && (
                <span className="ml-2">
                  project:{projectId.slice(0, 12)}
                  {projectId.length > 12 ? '…' : ''}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => openCreate('decision')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 transition hover:bg-emerald-500/15 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Log decision
          </button>
          <button
            type="button"
            onClick={() => openCreate('blocker')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-800 transition hover:bg-red-500/15 dark:text-red-300"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Log blocker
          </button>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Note
          </button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Could not sync platform memory: {saveError}
        </div>
      )}

      {/* Stats — real decision/blocker item counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Entries', value: entries.length, icon: Layers, onClick: () => setLabelFilter('all') },
          {
            label: 'Open blockers',
            value: openBlockerItemCount,
            icon: AlertTriangle,
            onClick: () => {
              setLabelFilter('blocker');
              setShowResolved(false);
            },
            accent: openBlockerItemCount > 0 ? 'text-red-600 dark:text-red-400' : undefined,
          },
          {
            label: 'Decisions',
            value: decisionCount,
            icon: CheckCircle2,
            onClick: () => setLabelFilter('decision'),
            accent: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Morph notes',
            value: entries.filter((e) => e.source === 'morph' || e.service === 'Morph').length,
            icon: GitBranch,
          },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onClick}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left transition hover:border-zinc-300 dark:border-white/[0.08] dark:bg-[#0A0A0B] dark:hover:border-white/15"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${s.accent || 'text-zinc-950 dark:text-white'}`}>
              {s.value}
            </p>
          </button>
        ))}
      </div>

      {/* Focus boards */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-red-500/15 bg-gradient-to-b from-red-500/[0.06] to-transparent p-4 dark:from-red-500/[0.08]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Open blockers</h2>
              <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                {openBlockers.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openCreate('blocker')}
              className="text-[11px] font-medium text-red-600 hover:underline dark:text-red-400"
            >
              + Add
            </button>
          </div>
          {openBlockers.length === 0 ? (
            <p className="text-xs leading-5 text-zinc-500">No open blockers. Nice.</p>
          ) : (
            <ul className="space-y-2">
              {openBlockers.slice(0, 6).map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-red-500/10 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{m.summary}</p>
                      {m.blockers.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {m.blockers.map((b, i) => (
                            <li key={`${m.id}-b-${i}`} className="text-[11px] text-red-700/90 dark:text-red-300/90">
                              · {b}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-400">
                        {m.service} · {formatWhen(m.createdAt, m.date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolveEntry(m.id)}
                      className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                      title="Mark resolved"
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-4 dark:from-emerald-500/[0.08]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Recent decisions</h2>
            </div>
            <button
              type="button"
              onClick={() => openCreate('decision')}
              className="text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              + Add
            </button>
          </div>
          {recentDecisions.length === 0 ? (
            <p className="text-xs leading-5 text-zinc-500">No decisions logged yet. Capture the next call outcome here.</p>
          ) : (
            <ul className="space-y-2">
              {recentDecisions.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-emerald-500/10 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-black/20"
                >
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{m.summary}</p>
                  {m.decisions.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {m.decisions.map((d, i) => (
                        <li key={`${m.id}-d-${i}`} className="flex gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300/90">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {m.service} · {formatWhen(m.createdAt, m.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Morph CLI strip */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 text-zinc-100 dark:border-white/10">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Terminal className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Morph CLI</p>
              <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                Login links Morph to this ZEXVRO account. Bind the repo so migrations land here.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => doCopy(cliLines.join('\n'), 'cli')}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/10"
          >
            <Copy className="h-3 w-3" />
            {copied === 'cli' ? 'Copied' : 'Copy install + setup'}
          </button>
        </div>
        <pre className="overflow-x-auto border-t border-white/10 bg-black/40 px-4 py-3 font-mono text-[11px] leading-6 text-cyan-100/90">
          {cliLines.map((line, i) => (
            <div key={`${i}-${line}`}>
              {line.startsWith('#') || line === '' ? (
                <span className="text-zinc-500">{line || ' '}</span>
              ) : (
                <>
                  <span className="select-none text-zinc-500">$ </span>
                  {line}
                </>
              )}
            </div>
          ))}
        </pre>
      </div>

      {morphMetaEntries.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#0A0A0B]">
          <div className="mb-3 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Morph bindings</h2>
            <span className="text-[10px] text-zinc-400">Public IDs only</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {morphMetaEntries.map(([k, v]) => (
              <div
                key={k}
                className="flex items-start justify-between gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-2.5 py-2 font-mono text-[11px] dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-zinc-500">{k}</p>
                  <p className="mt-0.5 break-all text-zinc-800 dark:text-zinc-200">
                    {typeof v === 'string' ? v : JSON.stringify(v)}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  onClick={() => doCopy(typeof v === 'string' ? v : JSON.stringify(v), k)}
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/[0.08] dark:bg-[#0A0A0B] sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search decisions, blockers, files…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50/80 py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="hidden h-3.5 w-3.5 text-zinc-400 sm:block" />
          {LABELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLabelFilter(l.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                labelFilter === l.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              {l.label}
              {l.id !== 'all' && counts[l.id] ? <span className="ml-1 opacity-60">{counts[l.id]}</span> : null}
            </button>
          ))}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-[11px] text-zinc-600 dark:border-white/10 dark:text-zinc-300"
          >
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="ml-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center text-xs text-zinc-400 dark:border-white/10">
            Loading shared memory…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-14 text-center dark:border-white/10">
            <BookOpen className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Log a decision or blocker so Morph and the next person skip the archaeology.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => openCreate('decision')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Log decision
              </button>
              <button
                type="button"
                onClick={() => openCreate('blocker')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Log blocker
              </button>
            </div>
          </div>
        ) : (
          filteredEntries.map((m) => {
            const resolved = m.status === 'resolved';
            return (
              <article
                key={m.id}
                className={`rounded-xl border bg-white p-4 transition sm:p-5 dark:bg-[#0A0A0B] ${
                  resolved
                    ? 'border-zinc-200/80 opacity-75 dark:border-white/[0.06]'
                    : isOpenBlocker(m)
                      ? 'border-red-500/20 dark:border-red-500/25'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-white/[0.08] dark:hover:border-white/15'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${labelStyles(m.label)}`}
                    >
                      {m.label}
                    </span>
                    {resolved && (
                      <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-white/10">
                        resolved
                      </span>
                    )}
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white">{m.service}</span>
                    <span className="text-[11px] text-zinc-400">
                      {m.source === 'morph' ? 'Morph' : m.owner} · {formatWhen(m.createdAt, m.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isBlockerEntry(m) && !resolved && (
                      <button
                        type="button"
                        onClick={() => resolveEntry(m.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Resolve
                      </button>
                    )}
                    {isBlockerEntry(m) && resolved && (
                      <button
                        type="button"
                        onClick={() => reopenEntry(m.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:border-white/10 dark:text-zinc-300"
                      >
                        <Circle className="h-3 w-3" />
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteEntry(m.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-500/10 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{m.summary}</p>

                {m.decisions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Decisions
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {m.decisions.map((d, i) => (
                        <li key={`${m.id}-dec-${i}`} className="flex gap-2 text-xs text-zinc-800 dark:text-zinc-200">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.blockers.length > 0 && (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2.5 ${
                      resolved
                        ? 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02]'
                        : 'border-red-500/15 bg-red-500/[0.06]'
                    }`}
                  >
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        resolved ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      Blockers
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {m.blockers.map((b, i) => (
                        <li
                          key={`${m.id}-blk-${i}`}
                          className={`flex gap-2 text-xs ${
                            resolved ? 'text-zinc-500 line-through' : 'text-red-800 dark:text-red-200/90'
                          }`}
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.followUps.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Next</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                      {m.followUps.map((f, i) => (
                        <li key={`${m.id}-fu-${i}`}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.verification && (
                  <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">How to verify: </span>
                    {m.verification}
                  </p>
                )}

                {m.filesChanged.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-white/[0.06]">
                    {m.filesChanged.map((f, i) => (
                      <span
                        key={`${m.id}-f-${i}`}
                        className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {openNewMemoryModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setOpenNewMemoryModal(false);
                resetForm();
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative z-10 w-full max-w-lg rounded-t-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0A0A0B] sm:rounded-xl sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {quickMode === 'blocker'
                    ? 'Log a blocker'
                    : quickMode === 'decision'
                      ? 'Log a decision'
                      : 'Add to shared memory'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setOpenNewMemoryModal(false);
                    resetForm();
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMemory} className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Area
                    </label>
                    <select
                      value={newSrv}
                      onChange={(e) => setNewSrv(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    >
                      {AREAS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Type
                    </label>
                    <select
                      value={newLabel}
                      onChange={(e) => {
                        const v = e.target.value as MemoryLabel;
                        setNewLabel(v);
                        setQuickMode(v === 'decision' || v === 'blocker' ? v : null);
                      }}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    >
                      {LABELS.filter((l) => l.id !== 'all').map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {primaryFieldLabel} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required={false}
                    rows={3}
                    placeholder={
                      newLabel === 'blocker'
                        ? 'e.g. Gate siteKey missing on production captcha'
                        : newLabel === 'decision'
                          ? 'e.g. REQWID captcha on token.purchase before NFT checkout'
                          : 'What should the next person or Morph know?'
                    }
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-zinc-900 focus:border-zinc-300 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {newLabel === 'decision' || newLabel === 'blocker'
                      ? 'This is saved as the main decision/blocker. Optional extra lines below.'
                      : 'Required unless you fill decisions or blockers below.'}
                  </p>
                </div>

                {(newLabel === 'decision' || newLabel === 'general' || newLabel === 'handoff' || newLabel === 'context' || newLabel === 'migration') && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Extra decisions (one per line)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional bullet points"
                      value={newDecisions}
                      onChange={(e) => setNewDecisions(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    />
                  </div>
                )}

                {(newLabel === 'blocker' || newLabel === 'general' || newLabel === 'handoff') && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Extra blockers (one per line)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional bullet points"
                      value={newBlockers}
                      onChange={(e) => setNewBlockers(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Follow-ups (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={newFollowups}
                    onChange={(e) => setNewFollowups(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Files (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="src/server.ts"
                      value={newFiles}
                      onChange={(e) => setNewFiles(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 font-mono dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      How to verify
                    </label>
                    <input
                      type="text"
                      placeholder="npm test · hit unpaid tip → 402"
                      value={newVerification}
                      onChange={(e) => setNewVerification(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {validationError}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenNewMemoryModal(false);
                      resetForm();
                    }}
                    className="px-3 py-2 text-xs font-medium text-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950"
                  >
                    {newLabel === 'blocker' ? 'Save blocker' : newLabel === 'decision' ? 'Save decision' : 'Save note'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
