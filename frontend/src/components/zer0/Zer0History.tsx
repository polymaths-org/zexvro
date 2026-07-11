import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  Search, Filter, Download, ChevronDown, ExternalLink, Shield, ShieldOff, Calendar
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import type { Zer0PaymentStatus, Zer0PaymentType } from '../../stores/types';

export default function Zer0History() {
  const { projectId } = useParams({ strict: false });
  const pid = projectId || '';
  const allPayments = useZer0Store(s => s.payments);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Zer0PaymentStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<Zer0PaymentType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const payments = useMemo(() => allPayments.filter(p => p.projectId === pid), [allPayments, pid]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.recipientName.toLowerCase().includes(q) || p.memo.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [payments, search, filterStatus, filterType]);

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pending_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    approved: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    draft: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/60',
    cancelled: 'bg-zinc-200/60 text-zinc-400',
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Recipient', 'Amount', 'Currency', 'Type', 'Status', 'Shielded', 'Memo', 'TX Hash'];
    const rows = filtered.map(p => [
      p.id,
      new Date(p.createdAt).toISOString(),
      p.recipientName,
      p.amount.toString(),
      p.currency,
      p.type,
      p.status,
      p.shielded ? 'Yes' : 'No',
      p.memo,
      p.txHash || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zer0-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Payment History</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {payments.length} total payments • {payments.filter(p => p.status === 'completed').length} completed
          </p>
        </div>
        <button onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, memo, or ID…"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="failed">Failed</option>
          <option value="draft">Draft</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
          <option value="all">All Types</option>
          <option value="payroll">Payroll</option>
          <option value="contractor">Contractor</option>
          <option value="bonus">Bonus</option>
          <option value="reimbursement">Reimbursement</option>
          <option value="one-time">One-Time</option>
        </select>
      </div>

      {/* Payment List */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-500 mb-1">No payments found</p>
            <p className="text-xs text-zinc-400">Payments will appear here once you start processing them.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(p => (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      {p.shielded ? <Shield className="h-3.5 w-3.5 text-blue-500" /> : <ShieldOff className="h-3.5 w-3.5 text-zinc-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{p.recipientName}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${statusColors[p.status] || ''}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <span>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>•</span>
                        <span className="capitalize">{p.type.replace('-', ' ')}</span>
                        {p.memo && <><span>•</span><span className="truncate max-w-[200px]">{p.memo}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
                      {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.currency}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 pt-0 bg-zinc-50/30 dark:bg-zinc-900/10">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="text-zinc-400 font-semibold uppercase block mb-0.5">Payment ID</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">{p.id}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-semibold uppercase block mb-0.5">Wallet</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">{p.recipientWallet || '—'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 font-semibold uppercase block mb-0.5">TX Hash</span>
                        {p.txHash ? (
                          <span className="font-mono text-blue-500 flex items-center gap-1">{p.txHash.slice(0, 16)}… <ExternalLink className="h-2.5 w-2.5" /></span>
                        ) : <span className="text-zinc-400">—</span>}
                      </div>
                      <div>
                        <span className="text-zinc-400 font-semibold uppercase block mb-0.5">Processed At</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{p.processedAt ? new Date(p.processedAt).toLocaleString() : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
