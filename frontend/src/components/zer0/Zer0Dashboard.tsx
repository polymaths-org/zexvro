import { useMemo, useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import {
  DollarSign, Users, ArrowUpRight, TrendingUp, Plus,
  Send, Loader2, Wallet, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import type { Zer0Currency } from '../../stores/types';

export default function Zer0Dashboard() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || '';

  const allEmployees = useZer0Store(s => s.employees);
  const allPayments = useZer0Store(s => s.payments);
  const pool = useZer0Store(s => s.pool);
  const settings = useZer0Store(s => s.settings);
  const depositToPool = useZer0Store(s => s.depositToPool);
  const withdrawFromPool = useZer0Store(s => s.withdrawFromPool);

  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState<Zer0Currency>('USDC');
  const [isDepositing, setIsDepositing] = useState(false);

  const basePath = `/dashboard/w/${workspaceId}/p/${projectId}`;

  const employees = useMemo(() => allEmployees.filter(e => e.projectId === pid), [allEmployees, pid]);
  const payments = useMemo(() => allPayments.filter(p => p.projectId === pid), [allPayments, pid]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const pendingPayments = useMemo(
    () => payments.filter(p => ['draft', 'pending_approval', 'approved', 'processing'].includes(p.status)),
    [payments],
  );
  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return payments.filter(p => p.status === 'completed' && p.createdAt >= startOfMonth);
  }, [payments]);
  const totalDisbursedThisMonth = completedThisMonth.reduce((sum, p) => sum + p.amount, 0);
  const recentPayments = payments.slice(0, 8);

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;
    setIsDepositing(true);
    // Simulate network delay
    setTimeout(() => {
      depositToPool(depositCurrency, amt);
      setDepositAmount('');
      setIsDepositing(false);
    }, 800);
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pending_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    draft: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/60',
    approved: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    cancelled: 'bg-zinc-200/60 text-zinc-400',
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Zer0 Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your private payroll pool, employees, and payments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`${basePath}/zer0/pay` as any}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-sm"
          >
            <Send className="h-3.5 w-3.5" /> Pay Someone
          </Link>
          <Link
            to={`${basePath}/zer0/people` as any}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add Employee
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Pool Balance',
            value: `$${pool.balances.USDC.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            sub: `${pool.balances.XLM.toLocaleString()} XLM`,
            icon: Wallet,
            color: 'text-blue-500',
          },
          {
            label: 'Active Employees',
            value: activeEmployees.length.toString(),
            sub: `${employees.length} total roster`,
            icon: Users,
            color: 'text-violet-500',
          },
          {
            label: 'This Month',
            value: `$${totalDisbursedThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            sub: `${completedThisMonth.length} payments completed`,
            icon: TrendingUp,
            color: 'text-emerald-500',
          },
          {
            label: 'Pending',
            value: pendingPayments.length.toString(),
            sub: pendingPayments.length > 0 ? 'Awaiting processing' : 'All clear',
            icon: ArrowUpRight,
            color: 'text-amber-500',
          },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-white">{card.value}</div>
              <div className="text-[11px] text-zinc-400 mt-1">{card.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Payments */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Recent Payments</h3>
            <Link
              to={`${basePath}/zer0/history` as any}
              className="text-[10px] font-semibold text-blue-500 hover:text-blue-600"
            >
              View All →
            </Link>
          </div>

          {recentPayments.length === 0 ? (
            <div className="p-8 text-center">
              <DollarSign className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No payments yet. Create your first payment to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentPayments.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{p.recipientName}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColors[p.status] || ''}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {p.type} • {new Date(p.createdAt).toLocaleDateString()}
                      {p.shielded && ' • 🛡️ Shielded'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white tabular-nums">
                    {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Deposit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" /> Fund Pool
          </h3>

          <form onSubmit={handleDeposit} className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1">Currency</label>
              <select
                value={depositCurrency}
                onChange={e => setDepositCurrency(e.target.value as Zer0Currency)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="USDC">USDC</option>
                <option value="XLM">XLM</option>
                <option value="EURC">EURC</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-zinc-400 uppercase block mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isDepositing}
              className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isDepositing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Deposit to Pool'}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">USDC Balance</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.balances.USDC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">XLM Balance</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.balances.XLM.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">Total Processed</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.totalPaymentsProcessed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
