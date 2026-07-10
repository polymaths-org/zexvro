import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Users, Clock, CircleDollarSign, CheckCircle2, AlertCircle,
  Plus, Search, Filter, ArrowUpRight, Download, Calendar
} from 'lucide-react';

type PayrollStatus = 'paid' | 'pending' | 'processing' | 'failed';

interface PayrollEntry {
  id: string;
  recipient: string;
  email: string;
  amount: string;
  token: string;
  status: PayrollStatus;
  type: 'salary' | 'contractor' | 'bonus' | 'expense';
  period: string;
  processedAt: string | null;
  scheduledFor: string;
}

import { useZer0Store } from '../../stores/zer0';

const STATUS_CONFIG: Record<PayrollStatus, { label: string; color: string; icon: React.ReactNode }> = {
  paid: { label: 'Paid', color: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: <Clock className="h-3 w-3" /> },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: <CircleDollarSign className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
};

const TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  contractor: 'Contractor',
  bonus: 'Bonus',
  expense: 'Expense',
};

export default function Payroll() {
  const { workspaceId } = useParams({ strict: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | 'all'>('all');

  const storePayments = useZer0Store(s => s.payments);
  const storeEmployees = useZer0Store(s => s.employees);

  const entries: PayrollEntry[] = storePayments.map(p => {
    const emp = storeEmployees.find(e => e.id === p.employeeId);
    return {
      id: p.id,
      recipient: p.recipientName,
      email: emp?.email || `${p.recipientName.toLowerCase().replace(/\s+/g, '')}@zexvro.dev`,
      amount: p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      token: p.currency,
      status: p.status === 'completed' ? 'paid' : p.status as PayrollStatus,
      type: p.type as any,
      period: 'Jun 2026',
      processedAt: p.processedAt ? new Date(p.processedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      scheduledFor: new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  });

  const filtered = entries.filter(entry => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return entry.recipient.toLowerCase().includes(q) ||
        entry.email.toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPaid = entries.filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + parseFloat(e.amount.replace(/,/g, '')), 0);
  const totalPending = entries.filter(e => e.status === 'pending' || e.status === 'processing')
    .reduce((sum, e) => sum + parseFloat(e.amount.replace(/,/g, '')), 0);
  const failedCount = entries.filter(e => e.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Payroll</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Manage team compensation, contractor payments, and expense reimbursements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              <Plus className="h-3.5 w-3.5" />
              New Payment
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Total Paid"
          value={`$${totalPaid.toLocaleString()}`}
          accent="green"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Upcoming"
          value={`$${totalPending.toLocaleString()}`}
          detail={`${entries.filter(e => e.status === 'pending' || e.status === 'processing').length} payments queued`}
          accent="amber"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Recipients"
          value={new Set(entries.map(e => e.recipient)).size.toString()}
          detail="Unique payees"
          accent="blue"
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Failed"
          value={failedCount.toString()}
          detail={failedCount > 0 ? 'Needs attention' : 'All good'}
          accent={failedCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Next payroll banner */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-blue-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Next scheduled payroll</p>
          <p className="text-xs text-zinc-500">Jul 5, 2026 — 2 payments totaling $4,300.00 USDC</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600">
          <ArrowUpRight className="h-3.5 w-3.5" />
          Review
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or type..."
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          {(['all', 'paid', 'pending', 'processing', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                statusFilter === s
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Payroll table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No payroll entries found</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {searchQuery ? 'Try adjusting your search or filters.' : 'Create your first payment to get started.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(entry => {
              const statusConfig = STATUS_CONFIG[entry.status];
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {entry.recipient.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{entry.recipient}</span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-medium">
                        {TYPE_LABELS[entry.type]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{entry.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {entry.amount} {entry.token}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{entry.period}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[11px] text-zinc-400">{entry.scheduledFor}</p>
                    {entry.processedAt && (
                      <p className="mt-0.5 text-[10px] text-green-500">Paid {entry.processedAt}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  accent: 'green' | 'amber' | 'blue' | 'red';
}) {
  const accentColors = {
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    blue: 'bg-blue-500/10 text-blue-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center rounded-md p-1.5 ${accentColors[accent]}`}>
          {icon}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-zinc-400">{detail}</p>}
    </div>
  );
}
