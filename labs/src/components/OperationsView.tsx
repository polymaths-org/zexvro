import React, { useState } from 'react';
import {
  BarChart3,
  Users,
  FileCheck,
  Clock,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  X,
  ExternalLink,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { Submission, Lab, SubmissionStatus } from '../types';
import { Card } from './ui/Card';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface OperationsViewProps {
  labs: Lab[];
  submissions: Submission[];
  onUpdateSubmission?: (id: string, status: SubmissionStatus, note?: string) => void;
}

const statusConfig: Record<SubmissionStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'danger'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
  for_review: { label: 'For Review', variant: 'default', icon: <AlertCircle className="h-3 w-3" /> },
  passed: { label: 'Passed', variant: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', variant: 'danger', icon: <XCircle className="h-3 w-3" /> },
};

export const OperationsView: React.FC<OperationsViewProps> = ({
  labs,
  submissions,
  onUpdateSubmission,
}) => {
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | 'all'>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  const filteredSubmissions = submissions.filter(s => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesLab = filterLab === 'all' || s.labId === filterLab;
    const matchesSearch = !searchQuery ||
      s.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.labTitle?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesLab && matchesSearch;
  });

  const countByStatus = (status: SubmissionStatus) => submissions.filter(s => s.status === status).length;

  const handleExportCSV = () => {
    const headers = ['Student', 'Lab', 'Status', 'Score', 'Submitted At', 'Reviewer', 'Note'];
    const rows = filteredSubmissions.map(s => [
      s.userName || s.userId,
      s.labTitle || s.labId,
      s.status,
      s.score?.toString() || '',
      s.submittedAt,
      s.reviewedBy || '',
      s.reviewNote || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zexvro-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold rounded-full mb-2">
          <BarChart3 className="h-3.5 w-3.5 text-white" />
          <span>OPERATIONS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
          Platform Operations Dashboard
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xl">
          Monitor submissions, review queue, and platform activity across all Web3 labs.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950 border border-amber-800 rounded-xl">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Pending</p>
              <p className="text-lg font-black text-white">{countByStatus('pending')}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950 border border-blue-800 rounded-xl">
              <AlertCircle className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">For Review</p>
              <p className="text-lg font-black text-white">{countByStatus('for_review')}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950 border border-emerald-800 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Passed</p>
              <p className="text-lg font-black text-white">{countByStatus('passed')}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-950 border border-red-800 rounded-xl">
              <XCircle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Rejected</p>
              <p className="text-lg font-black text-white">{countByStatus('rejected')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters & Controls */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by student or lab..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            {(['all', 'pending', 'for_review', 'passed', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                  filterStatus === s
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'for_review' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Lab filter */}
          <select
            value={filterLab}
            onChange={e => setFilterLab(e.target.value)}
            className="bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white"
          >
            <option value="all">All Labs</option>
            {labs.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>

          {/* Export */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-heading flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-white" />
            Submissions ({filteredSubmissions.length})
          </h2>
          <button className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {filteredSubmissions.length === 0 ? (
          <EmptyState
            title="No submissions found"
            description="Submissions will appear here when students complete and submit labs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-black text-zinc-400 uppercase text-[10px] tracking-widest border-b border-zinc-800 font-bold">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Lab</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredSubmissions.map(sub => {
                  const config = statusConfig[sub.status];
                  return (
                    <tr key={sub.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="p-3 font-bold text-white">{sub.userName || sub.userId}</td>
                      <td className="p-3 text-zinc-300 max-w-xs truncate">{sub.labTitle || sub.labId}</td>
                      <td className="p-3">
                        <StatusBadge variant={config.variant} icon={config.icon}>
                          {config.label}
                        </StatusBadge>
                      </td>
                      <td className="p-3 text-white font-bold">{sub.score ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedSub(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> View details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submission detail modal (view-only — no pass/reject) */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-700 rounded-3xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusBadge variant={statusConfig[selectedSub.status].variant} icon={statusConfig[selectedSub.status].icon}>
                    {statusConfig[selectedSub.status].label}
                  </StatusBadge>
                  <span className="text-[10px] font-mono text-zinc-500">{selectedSub.type || 'lab'}</span>
                </div>
                <h2 className="text-lg font-black text-white font-heading">{selectedSub.labTitle || selectedSub.labId}</h2>
                <p className="text-xs text-zinc-400">{selectedSub.userName || selectedSub.userId}</p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-xl shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <Row label="Student" value={selectedSub.userName || selectedSub.userId} />
              <Row label="Lab" value={selectedSub.labTitle || selectedSub.labId} />
              <Row label="Lab ID" value={selectedSub.labId} mono />
              <Row label="Score" value={selectedSub.score != null ? String(selectedSub.score) : '—'} />
              <Row label="Submitted" value={new Date(selectedSub.submittedAt).toLocaleString()} />
              <Row label="Submission ID" value={selectedSub.id} mono />
              {selectedSub.reviewedBy && <Row label="Reviewed by" value={selectedSub.reviewedBy} />}
              {selectedSub.formData && Object.keys(selectedSub.formData).length > 0 && (
                <div className="pt-1">
                  <dt className="text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-bold mb-2">
                    {selectedSub.inputElementTitle || 'Learner Details'}
                  </dt>
                  <dd className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                    {Object.entries(selectedSub.formData).map(([label, val]) => (
                      <div key={label} className="flex justify-between gap-4 items-start">
                        <span className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider font-bold shrink-0">{label}</span>
                        <span className="text-zinc-100 text-xs font-mono text-right break-words">{val}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}
              {selectedSub.reviewNote && (
                <div className="flex justify-between gap-4 items-start">
                  <dt className="text-zinc-500 font-mono text-[11px] uppercase tracking-widest font-bold shrink-0">Note</dt>
                  <dd className="text-zinc-200 text-right font-mono text-xs whitespace-pre-wrap">{selectedSub.reviewNote}</dd>
                </div>
              )}
            </dl>

            {selectedSub.repoUrl && (
              <a
                href={selectedSub.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-extrabold rounded-xl hover:bg-zinc-200 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View submission link
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider font-bold">{label}</dt>
    <dd className={`text-zinc-200 text-xs text-right ${mono ? 'font-mono' : 'font-bold'}`}>{value || '—'}</dd>
  </div>
);
