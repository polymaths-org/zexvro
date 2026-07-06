import React, { useState } from 'react';
import { 
  Brain, Plus, Search, Filter, HelpCircle, CheckCircle2, 
  X, AlertTriangle, ChevronRight, Bookmark, ArrowUpRight, ShieldCheck 
} from 'lucide-react';
import { MemoryEntry } from '../../types';
import { mockMemoryEntries } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';

interface MemoryProps {
  memoryEntries: MemoryEntry[];
  setMemoryEntries: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
  openNewMemoryModal: boolean;
  setOpenNewMemoryModal: (open: boolean) => void;
}

export default function Memory({ 
  memoryEntries, 
  setMemoryEntries, 
  openNewMemoryModal, 
  setOpenNewMemoryModal 
}: MemoryProps) {
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFilter, setLabelFilter] = useState<'all' | 'decision' | 'blocker' | 'handoff'>('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  // Form states
  const [newSrv, setNewSrv] = useState('Zero-Knowledge Privacy Pool');
  const [newFiles, setNewFiles] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newDecisions, setNewDecisions] = useState('');
  const [newFollowups, setNewFollowups] = useState('');
  const [newBlockers, setNewBlockers] = useState('');
  const [newVerification, setNewVerification] = useState('');
  const [newLabel, setNewLabel] = useState<'decision' | 'blocker' | 'handoff' | 'general'>('decision');

  // Validation state
  const [validationError, setValidationError] = useState('');

  // Handle creation of memory entry
  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) {
      setValidationError('Summary is a required field');
      return;
    }
    if (!newVerification.trim()) {
      setValidationError('Verification results are required to commit to memory');
      return;
    }

    const newEntry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      service: newSrv,
      filesChanged: newFiles.split(',').map(f => f.trim()).filter(Boolean),
      summary: newSummary,
      decisions: newDecisions.split('\n').map(d => d.trim()).filter(Boolean),
      followUps: newFollowups.split('\n').map(f => f.trim()).filter(Boolean),
      blockers: newBlockers.split('\n').map(b => b.trim()).filter(Boolean),
      verification: newVerification,
      date: 'Just now',
      owner: 'paris-29',
      label: newLabel
    };

    setMemoryEntries([newEntry, ...memoryEntries]);

    // Reset forms
    setNewSrv('Zero-Knowledge Privacy Pool');
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

  // Filter logic
  const filteredEntries = memoryEntries.filter(m => {
    const matchesSearch = m.summary.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLabel = labelFilter === 'all' || m.label === labelFilter;
    const matchesService = serviceFilter === 'all' || m.service === serviceFilter;

    return matchesSearch && matchesLabel && matchesService;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <Brain className="h-5 w-5 text-brand-blue" />
            Agent Shared Memory
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Decentralized operational knowledge ledger synced across human operators and autonomous agents
          </p>
        </div>
        <button
          onClick={() => setOpenNewMemoryModal(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-medium text-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Memory Entry
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search decisions, summaries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Label selector filter */}
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-500"
          >
            <option value="all">Type: All</option>
            <option value="decision">Decisions</option>
            <option value="blocker">Blockers</option>
            <option value="handoff">Handoffs</option>
          </select>

          {/* Service selector filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-500"
          >
            <option value="all">Service: All</option>
            <option value="Zero-Knowledge Privacy Pool">ZK Privacy Pool</option>
            <option value="Transformation Agent">Transformation Agent</option>
            <option value="A-2-A Trade Pipeline">A-2-A Trade Pipeline</option>
            <option value="De-pin">De-pin</option>
          </select>
        </div>
      </div>

      {/* Memory catalog grid/list */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400">No memory entries match the criteria.</p>
          </div>
        ) : (
          filteredEntries.map((m) => (
            <motion.div
              key={m.id}
              layout
              className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4 hover:border-zinc-300 dark:hover:border-zinc-800 transition-colors"
            >
              {/* Card top bar */}
              <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 rounded mt-0.5 ${
                    m.label === 'decision' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : m.label === 'blocker'
                      ? 'bg-red-500/10 text-red-500 animate-pulse'
                      : 'bg-brand-blue/10 text-brand-blue'
                  }`}>
                    <Bookmark className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">{m.service}</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Author: <span className="text-zinc-500 dark:text-zinc-300">@{m.owner}</span> • {m.date}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border uppercase tracking-wider ${
                  m.label === 'decision'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : m.label === 'blocker'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
                }`}>
                  {m.label}
                </span>
              </div>

              {/* Memory Summary content */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Knowledge Summary</span>
                  <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed mt-1 font-sans">{m.summary}</p>
                </div>

                {m.decisions.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Decisions locked</span>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-700 dark:text-zinc-300 mt-1 font-mono text-[11px]">
                      {m.decisions.map((d, dIdx) => <li key={dIdx}>{d}</li>)}
                    </ul>
                  </div>
                )}

                {m.blockers.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono font-bold text-red-400 uppercase block">Active system blockers</span>
                    <ul className="list-disc pl-4 space-y-1 text-red-400 mt-1 font-mono text-[11px]">
                      {m.blockers.map((b, bIdx) => <li key={bIdx}>{b}</li>)}
                    </ul>
                  </div>
                )}

                {m.followUps.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Planned Follow-ups</span>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 mt-1 font-mono text-[11px]">
                      {m.followUps.map((f, fIdx) => <li key={fIdx}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Verification line */}
                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/80 rounded-md font-mono text-[10.5px] leading-relaxed flex items-start gap-2 text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase text-[9.5px] text-emerald-500 block">Cryptographic Verification: Passed</span>
                    {m.verification}
                  </div>
                </div>
              </div>

              {/* Files touched footer */}
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-3 font-mono text-[10px] text-zinc-400">
                <span className="uppercase">Files Touched:</span>
                {m.filesChanged.length > 0 ? m.filesChanged.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[9px] text-zinc-500">{f}</span>
                )) : <span className="text-zinc-500 italic">None</span>}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* New Memory Modal */}
      <AnimatePresence>
        {openNewMemoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenNewMemoryModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-xl rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white font-heading">Commit new decision to shared memory</h3>
                <button onClick={() => setOpenNewMemoryModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMemory} className="space-y-4 mt-4 text-xs">
                {/* Service area selection */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Service Module Area</label>
                  <select
                    value={newSrv}
                    onChange={(e) => setNewSrv(e.target.value)}
                    className="w-full px-2.5 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="Zero-Knowledge Privacy Pool">Zero-Knowledge Privacy Pool</option>
                    <option value="Transformation Agent">Transformation Agent</option>
                    <option value="A-2-A Trade Pipeline">A-2-A Trade Pipeline</option>
                    <option value="Captcha-like Agent Authentication Service">Captcha-like Agent Auth</option>
                    <option value="De-pin">De-pin</option>
                  </select>
                </div>

                {/* Entry Label */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Memory Entry Label</label>
                  <div className="flex gap-2">
                    {['decision', 'blocker', 'handoff', 'general'].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setNewLabel(lbl as any)}
                        className={`px-3 py-1.5 rounded font-mono text-[10px] border uppercase transition-all cursor-pointer ${
                          newLabel === lbl
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold border-zinc-950 dark:border-white'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary (Required, validates visually) */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">
                    Knowledge Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Provide a concise summary of this memory entry..."
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded border bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                      validationError && !newSummary ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  />
                </div>

                {/* Decisions Locked */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Decisions Locked (one per line)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Standardize proof curves to BN254"
                    value={newDecisions}
                    onChange={(e) => setNewDecisions(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                  />
                </div>

                {/* Verification (Required, validates visually) */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">
                    Verification Method & Results <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Provide exact testing, simulations, or proofs validating this decision..."
                    value={newVerification}
                    onChange={(e) => setNewVerification(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded border bg-zinc-50/20 dark:bg-zinc-900/10 text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                      validationError && !newVerification ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  />
                </div>

                {/* Files and Follow-ups */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Files Changed (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. src/proof.ts"
                      value={newFiles}
                      onChange={(e) => setNewFiles(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-semibold text-zinc-500 uppercase mb-1">Blockers (one per line)</label>
                    <input
                      type="text"
                      placeholder="e.g. Missing Horizon registry API"
                      value={newBlockers}
                      onChange={(e) => setNewBlockers(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="p-2.5 border border-red-500/20 bg-red-500/5 text-red-500 rounded flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setOpenNewMemoryModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer"
                  >
                    Commit to Shared Memory
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
