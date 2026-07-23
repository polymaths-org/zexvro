import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileCode2,
  Filter,
  GitBranch,
  Layers,
  Plus,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import type { MemoryEntry, MemoryLabel } from '../../types';
import { AnimatePresence, motion } from 'motion/react';

const AREAS = [
  'Morph',
  'Gate',
  'NFT',
  'De-pin',
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
  /** Scope label for header */
  scopeLabel?: string;
  workspaceId?: string;
  projectId?: string;
  /** Extra Morph platform keys (siteKey refs, collection ids, etc.) */
  morphMeta?: Record<string, unknown>;
  loading?: boolean;
  saveError?: string | null;
}

function labelStyles(label: MemoryLabel) {
  switch (label) {
    case 'decision':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400';
    case 'blocker':
      return 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400';
    case 'handoff':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400';
    case 'migration':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400';
    case 'context':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400';
    default:
      return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400';
  }
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: memoryEntries.length };
    for (const e of memoryEntries) {
      c[e.label] = (c[e.label] || 0) + 1;
    }
    return c;
  }, [memoryEntries]);

  const filteredEntries = useMemo(() => {
    return memoryEntries
      .filter((m) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          m.summary.toLowerCase().includes(q) ||
          m.service.toLowerCase().includes(q) ||
          m.decisions.some((d) => d.toLowerCase().includes(q)) ||
          m.blockers.some((b) => b.toLowerCase().includes(q));
        const matchesLabel = labelFilter === 'all' || m.label === labelFilter;
        const matchesArea = areaFilter === 'all' || m.service === areaFilter;
        return matchesSearch && matchesLabel && matchesArea;
      })
      .slice()
      .sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
  }, [memoryEntries, searchTerm, labelFilter, areaFilter]);

  const morphMetaEntries = useMemo(() => {
    if (!morphMeta) return [] as [string, unknown][];
    return Object.entries(morphMeta).filter(([k]) => k.startsWith('morph:') || k.includes('collection') || k.includes('gate') || k.includes('site'));
  }, [morphMeta]);

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) {
      setValidationError('Add a short summary so the next person (or Morph) gets it.');
      return;
    }

    const now = new Date();
    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      service: newSrv,
      filesChanged: newFiles.split(',').map((f) => f.trim()).filter(Boolean),
      summary: newSummary.trim(),
      decisions: newDecisions.split('\n').map((d) => d.trim()).filter(Boolean),
      followUps: newFollowups.split('\n').map((f) => f.trim()).filter(Boolean),
      blockers: newBlockers.split('\n').map((b) => b.trim()).filter(Boolean),
      verification: newVerification.trim(),
      date: 'Just now',
      createdAt: now.toISOString(),
      owner: 'You',
      source: 'human',
      label: newLabel,
    };

    setMemoryEntries([newEntry, ...memoryEntries]);
    setNewSrv('Morph');
    setNewFiles('');
    setNewSummary('');
    setNewDecisions('');
    setNewFollowups('');
    setNewBlockers('');
    setNewVerification('');
    setNewLabel('decision');
    setValidationError('');
    setOpenNewMemoryModal(false);
  };

  const doCopy = (text: string, id: string) => {
    copyText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1500);
  };

  const cliLines = [
    'morph login',
    workspaceId ? `morph use ${workspaceId}${projectId ? ` ${projectId}` : ''}` : 'morph use <workspaceId>',
    'morph bind',
    'morph',
  ];

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
            Decisions, blockers, and context for <span className="font-medium text-zinc-700 dark:text-zinc-300">{scopeLabel}</span>.
            Humans and Morph both read this — write what the next agent needs.
          </p>
          {(workspaceId || projectId) && (
            <p className="mt-2 font-mono text-[11px] text-zinc-400">
              {workspaceId && <span>ws:{workspaceId.slice(0, 12)}{workspaceId.length > 12 ? '…' : ''}</span>}
              {projectId && <span className="ml-2">project:{projectId.slice(0, 12)}{projectId.length > 12 ? '…' : ''}</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpenNewMemoryModal(true)}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add note
        </button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Could not save to platform memory: {saveError}
        </div>
      )}

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
                Login links Morph to this ZEXVRO account. Bind the repo folder so migrations land on the right workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => doCopy(cliLines.join('\n'), 'cli')}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/10"
          >
            <Copy className="h-3 w-3" />
            {copied === 'cli' ? 'Copied' : 'Copy setup'}
          </button>
        </div>
        <pre className="overflow-x-auto border-t border-white/10 bg-black/40 px-4 py-3 font-mono text-[11px] leading-6 text-cyan-100/90">
          {cliLines.map((line) => (
            <div key={line}>
              <span className="text-zinc-500 select-none">$ </span>
              {line}
            </div>
          ))}
        </pre>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Entries', value: memoryEntries.length, icon: Layers },
          { label: 'Blockers', value: counts.blocker || 0, icon: AlertTriangle },
          { label: 'Decisions', value: counts.decision || 0, icon: CheckCircle2 },
          { label: 'Morph notes', value: memoryEntries.filter((e) => e.source === 'morph' || e.service === 'Morph').length, icon: GitBranch },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-white/[0.08] dark:bg-[#0A0A0B]"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Morph platform bindings */}
      {morphMetaEntries.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#0A0A0B]">
          <div className="mb-3 flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Morph bindings</h2>
            <span className="text-[10px] text-zinc-400">IDs Morph wrote for this account (no secrets)</span>
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
                  title="Copy"
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
              {l.id !== 'all' && counts[l.id] ? (
                <span className="ml-1 opacity-60">{counts[l.id]}</span>
              ) : null}
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
            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">No notes yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Add a decision or handoff so the next person — or Morph — does not re-learn the same context.
            </p>
            <button
              type="button"
              onClick={() => setOpenNewMemoryModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add first note
            </button>
          </div>
        ) : (
          filteredEntries.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-white/[0.08] dark:bg-[#0A0A0B] dark:hover:border-white/15 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${labelStyles(m.label)}`}>
                    {m.label}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">{m.service}</span>
                  <span className="text-[11px] text-zinc-400">
                    {m.source === 'morph' ? 'Morph' : m.owner} · {m.date}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{m.summary}</p>

              {m.decisions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Decisions</p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {m.decisions.map((d) => (
                      <li key={d} className="flex gap-2">
                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {m.blockers.length > 0 && (
                <div className="mt-3 rounded-md border border-red-500/15 bg-red-500/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Blockers</p>
                  <ul className="mt-1 space-y-1 text-xs text-red-600/90 dark:text-red-300/90">
                    {m.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {m.followUps.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Next</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                    {m.followUps.map((f) => (
                      <li key={f}>{f}</li>
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
                  {m.filesChanged.map((f) => (
                    <span
                      key={f}
                      className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))
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
              onClick={() => setOpenNewMemoryModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative z-10 w-full max-w-lg rounded-t-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0A0A0B] sm:rounded-xl sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Add to shared memory</h3>
                <button type="button" onClick={() => setOpenNewMemoryModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMemory} className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Area</label>
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
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Type</label>
                    <select
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value as MemoryLabel)}
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
                    Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="What should the next person or Morph know?"
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-zinc-900 focus:border-zinc-300 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Decisions (one per line)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Use Gate on score submit only"
                    value={newDecisions}
                    onChange={(e) => setNewDecisions(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Blockers (one per line)
                    </label>
                    <textarea
                      rows={2}
                      value={newBlockers}
                      onChange={(e) => setNewBlockers(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                    />
                  </div>
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
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Files (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="src/server.ts, client/index.tsx"
                    value={newFiles}
                    onChange={(e) => setNewFiles(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 font-mono dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    How to verify (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. npm test · redeploy Lakebed · hit unpaid tip → 402"
                    value={newVerification}
                    onChange={(e) => setNewVerification(e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-transparent px-2.5 py-2 dark:border-white/10"
                  />
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
                    onClick={() => setOpenNewMemoryModal(false)}
                    className="px-3 py-2 text-xs font-medium text-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950"
                  >
                    Save note
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
