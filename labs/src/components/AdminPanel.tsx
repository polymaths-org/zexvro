import React, { useState } from 'react';
import { api } from '../lib/api';
import {
  ShieldCheck,
  PlusCircle,
  Eye,
  LayoutDashboard,
  Layers,
  BarChart3,
  Users,
  Award,
  Settings2,
  Trash2,
  FileCheck,
  ExternalLink,
  GitFork,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Lab, LabCategory, LabDifficulty, Badge, User, Submission, SubmissionStatus } from '../types';
import { LabManagerPanel } from './admin/LabManagerPanel';
import { SaveButton } from './admin/SaveButton';

interface AdminPanelProps {
  labs: Lab[];
  badges: Badge[];
  users?: User[];
  currentUser?: User;
  submissions?: Submission[];
  tab?: ManagementTab;
  onTabChange?: (tab: ManagementTab) => void;
  onInviteUser?: (username: string) => void;
  onCreateLab: (lab: Partial<Lab>) => void;
  onUpdateLab: (id: string, lab: Partial<Lab>) => Promise<boolean>;
  onDeleteLab: (id: string) => void;
  onPreviewLab: (lab: Lab) => void;
  onUpdateBadge: (id: string, badge: Partial<Badge>) => void;
  onCreateBadge: (badge: Partial<Badge>) => void;
  onDeleteBadge: (id: string) => void;
  onUpdateSubmission?: (id: string, status: SubmissionStatus, note?: string) => void;
  onUpdateUserRole?: (id: string, role: 'admin' | 'student') => void;
}

type ManagementTab = 'overview' | 'labs' | 'operations' | 'users' | 'submissions';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  labs,
  badges,
  users = [],
  currentUser,
  submissions = [],
  tab: controlledTab,
  onTabChange,
  onInviteUser,
  onCreateLab,
  onUpdateLab,
  onDeleteLab,
  onPreviewLab,
  onUpdateBadge,
  onCreateBadge,
  onDeleteBadge,
  onUpdateSubmission,
  onUpdateUserRole,
}) => {
  const [tab, setTab] = useState<ManagementTab>(controlledTab || 'overview');
  const activeTab = controlledTab ?? tab;
  const changeTab = (t: ManagementTab) => {
    setTab(t);
    onTabChange?.(t);
  };
  const [managingLab, setManagingLab] = useState<Lab | null>(null);

  // Create-lab quick form
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LabCategory>('Smart Contracts');
  const [difficulty, setDifficulty] = useState<LabDifficulty>('Introductory');
  const [xp, setXp] = useState(250);

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    onCreateLab({
      title,
      description,
      category,
      difficulty,
      xpReward: Number(xp) || 0,
      isPublished: false,
      status: 'draft',
      tags: [],
      author: 'Admin Zexvro',
      durationMinutes: 30,
      timeLimitMinutes: null,
      tasks: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    });
    setTitle('');
    setDescription('');
    setCreating(false);
  };

  if (managingLab) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <LabManagerPanel
          key={managingLab.id}
          lab={managingLab}
          badges={badges}
          onUpdateLab={(id, patch) => {
            setManagingLab((prev) => (prev ? { ...prev, ...patch } : prev));
            return onUpdateLab(id, patch).then((ok) => {
              if (ok) setManagingLab((prev) => (prev ? { ...prev, ...patch } : prev));
              return ok;
            });
          }}
          onDeleteLab={(id) => {
            onDeleteLab(id);
            setManagingLab(null);
          }}
          onPreviewLab={onPreviewLab}
          onBack={() => setManagingLab(null)}
        />
      </div>
    );
  }

  const publishedCount = labs.filter((l) => l.status === 'published' || l.isPublished).length;
  const draftCount = labs.filter((l) => l.status === 'draft' || !l.isPublished).length;
  const enrolledTotal = labs.reduce((n, l) => n + (l.enrolledCount ?? l.completions ?? 0), 0);
  const completionsTotal = labs.reduce((n, l) => n + (l.completions ?? 0), 0);

  const tabs: { id: ManagementTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'labs', label: 'Labs', icon: <Layers className="h-4 w-4" /> },
    { id: 'operations', label: 'Operations', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'submissions', label: 'Submissions', icon: <FileCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-soft border border-blue-900/60 text-blue-accent text-xs font-mono font-bold rounded-full mb-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          ADMIN MANAGEMENT
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">Management Panel</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-xl">
          Manage labs, operations, users and credentials for the ZEXVRO web3 platform.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all font-heading flex items-center gap-2 ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Labs" value={labs.length} icon={<Layers className="h-5 w-5" />} />
            <StatCard label="Published" value={publishedCount} icon={<Settings2 className="h-5 w-5" />} accent />
            <StatCard label="Drafts" value={draftCount} icon={<ShieldCheck className="h-5 w-5" />} />
            <StatCard label="Users" value={users.length} icon={<Users className="h-5 w-5" />} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Enrollments" value={enrolledTotal.toLocaleString()} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Completions" value={completionsTotal.toLocaleString()} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="Badges" value={badges.length} icon={<Award className="h-5 w-5" />} />
            <StatCard label="Live Courses" value={publishedCount} icon={<Settings2 className="h-5 w-5" />} />
          </div>
          <button
            onClick={() => changeTab("labs")}
            className="px-4 py-2 btn-primary-blue text-white text-sm font-extrabold rounded-xl flex items-center gap-2 font-heading"
          >
            <PlusCircle className="h-4 w-4" /> Manage Labs
          </button>
        </div>
      )}

      {/* LABS */}
      {activeTab === 'labs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-accent" />
              All Labs ({labs.length})
            </h2>
            <button
              onClick={() => setCreating(!creating)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
            >
              {creating ? 'Cancel' : <><PlusCircle className="h-4 w-4" /> New Lab</>}
            </button>
          </div>

          {creating && (
            <form onSubmit={handleCreate} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white font-heading">Create a new lab (draft)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Lab title"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LabCategory)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {['Smart Contracts', 'DeFi Protocols', 'NFTs & Digital Assets', 'DAOs & Governance', 'Cross-chain & L2s', 'ZK & Privacy'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as LabDifficulty)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {['Introductory', 'Intermediate', 'Advanced'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown on cards"
                rows={2}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-mono text-zinc-400 font-bold uppercase">XP Reward</label>
                <input
                  type="number"
                  value={xp}
                  onChange={(e) => setXp(Number(e.target.value))}
                  className="w-28 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <SaveButton onSave={(done) => { handleCreate(); done(); }} label="Create Draft" variant="compact" className="ml-auto" />
              </div>
            </form>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-black text-zinc-400 uppercase text-[11px] tracking-widest border-b border-zinc-800 font-mono font-bold">
                  <tr>
                    <th className="p-3.5">Lab</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Enrolled</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {labs.map((lab) => (
                    <tr key={lab.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="p-3.5 font-bold text-white max-w-xs truncate">{lab.title}</td>
                      <td className="p-3.5 text-zinc-400">{lab.category}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase ${
                            lab.status === 'draft' || !lab.isPublished
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                              : lab.status === 'closed'
                              ? 'bg-red-950/60 text-red-300 border border-red-800'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {lab.status === 'draft' || !lab.isPublished ? 'Draft' : lab.status === 'closed' ? 'Closed' : 'Live'}
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-400">{(lab.enrolledCount ?? lab.completions ?? 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => onPreviewLab(lab)}
                          className="p-2 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            // Always open the manager against a fresh copy from
                            // the server so flags/types a previous session (or
                            // the seed script) set are never stale-clobbered.
                            api.fetchLab(lab.id).then((data) => {
                              setManagingLab(data?.lab || lab);
                            });
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-lg font-heading"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => {
                            if (!window.confirm(`Delete lab "${lab.title}"? This cannot be undone.`)) return;
                            onDeleteLab(lab.id);
                          }}
                          className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                          title="Delete lab"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {labs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500 text-sm font-mono">
                        No labs yet — create your first draft.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS */}
      {activeTab === 'operations' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-accent" />
            Operations Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Live Labs" value={publishedCount} icon={<Layers className="h-5 w-5" />} />
            <StatCard label="Total Enrollments" value={enrolledTotal.toLocaleString()} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Total Completions" value={completionsTotal.toLocaleString()} icon={<BarChart3 className="h-5 w-5" />} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-black text-zinc-400 uppercase text-[11px] tracking-widest border-b border-zinc-800 font-mono font-bold">
                <tr>
                  <th className="p-3">Lab</th>
                  <th className="p-3">Enrolled</th>
                  <th className="p-3">Completions</th>
                  <th className="p-3">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {labs.map((lab) => {
                  const enr = lab.enrolledCount ?? lab.completions ?? 0;
                  const comp = lab.completions ?? 0;
                  const rate = enr > 0 ? Math.round((comp / enr) * 100) : 0;
                  return (
                    <tr key={lab.id} className="hover:bg-zinc-900/60">
                      <td className="p-3 font-bold text-white">{lab.title}</td>
                      <td className="p-3">{enr.toLocaleString()}</td>
                      <td className="p-3">{comp.toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-zinc-400 font-mono text-xs">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USERS */}
      {activeTab === 'users' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-accent" />
            Platform Users
          </h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-black border border-zinc-800 rounded-xl p-3">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {u.name?.[0] || u.username?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{u.name || u.username}</p>
                  <p className="text-[11px] font-mono text-zinc-500 truncate">@{u.username} · {u.email}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase ${
                    u.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {u.role}
                </span>
                {onUpdateUserRole && u.id !== currentUser?.id && (
                  <button
                    onClick={() => onUpdateUserRole(u.id, u.role === 'admin' ? 'student' : 'admin')}
                    title={u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    className="px-2 py-1 text-[10px] font-mono font-bold rounded-md border transition-colors ${
                      u.role === 'admin'
                        ? 'border-red-800 text-red-300 hover:bg-red-950/50'
                        : 'border-blue-800 text-blue-300 hover:bg-blue-950/50'
                    }"
                  >
                    {u.role === 'admin' ? 'Revoke' : 'Make Admin'}
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && <p className="text-xs text-zinc-500 font-mono text-center py-6">No users yet.</p>}
          </div>
          {onInviteUser && (
            <InviteUserInput onInvite={onInviteUser} />
          )}
        </div>
      )}

      {/* SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-blue-accent" />
              Submissions ({submissions.length})
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="px-2 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 rounded-md">
                {submissions.filter((s) => s.status === 'pending').length} pending
              </span>
              <span className="px-2 py-1 bg-blue-950/60 border border-blue-800 text-blue-300 rounded-md">
                {submissions.filter((s) => s.status === 'for_review').length} review
              </span>
              <span className="px-2 py-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-md">
                {submissions.filter((s) => s.status === 'passed').length} passed
              </span>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm font-mono">
              No submissions yet. Students' repo submissions and lab completions appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-black text-zinc-400 uppercase text-[11px] tracking-widest border-b border-zinc-800 font-mono font-bold">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Lab</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Repo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {submissions.map((s) => {
                    const open = s.status === 'pending' || s.status === 'for_review';
                    return (
                      <tr key={s.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="p-3 font-bold text-white">{s.userName || s.userId}</td>
                        <td className="p-3 text-zinc-400 max-w-xs truncate">{s.labTitle || s.labId}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase ${s.type === 'repo' ? 'bg-blue-950/60 text-blue-300 border border-blue-800' : 'bg-zinc-900 text-zinc-300 border border-zinc-700'}`}>
                            {s.type === 'repo' ? 'Repo' : 'Lab'}
                          </span>
                        </td>
                        <td className="p-3">
                          {s.repoUrl ? (
                            <a
                              href={s.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-accent hover:text-white font-mono text-xs flex items-center gap-1.5"
                            >
                              <GitFork className="h-3 w-3" />
                              <span className="max-w-[160px] truncate">{s.repoUrl.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-600 font-mono text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase ${
                              s.status === 'pending'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                                : s.status === 'for_review'
                                ? 'bg-blue-950/60 text-blue-300 border border-blue-800'
                                : s.status === 'passed'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950/60 text-red-300 border border-red-800'
                            }`}
                          >
                            {s.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {s.reviewedBy ? `by ${s.reviewedBy}` : 'View-only'}
                          </span>
                          {s.reviewNote && (
                            <p className="text-[10px] text-zinc-500 mt-1 italic">{s.reviewNote}</p>
                          )}
                          {s.formData && Object.keys(s.formData).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(s.formData).map(([k, v]) => (
                                <p key={k} className="text-[10px] text-zinc-400 font-mono truncate max-w-[220px]">
                                  <span className="text-zinc-600 uppercase">{k}: </span>{v}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: boolean }> = ({
  label,
  value,
  icon,
  accent,
}) => (
  <div className={`bg-zinc-950 border ${accent ? 'border-blue-800' : 'border-zinc-800'} rounded-2xl p-5`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-blue-accent border border-zinc-800'}`}>
      {icon}
    </div>
    <p className="text-2xl font-black text-white font-heading">{value}</p>
    <p className="text-[11px] font-mono text-zinc-500 uppercase font-bold mt-0.5">{label}</p>
  </div>
);

const InviteUserInput: React.FC<{ onInvite: (username: string) => void }> = ({ onInvite }) => {
  const [val, setVal] = useState('');
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && val.trim() && (onInvite(val.trim()), setVal(''))}
        placeholder="Invite by GitHub username"
        className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={() => val.trim() && (onInvite(val.trim()), setVal(''))}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl font-heading"
      >
        Invite
      </button>
    </div>
  );
};
