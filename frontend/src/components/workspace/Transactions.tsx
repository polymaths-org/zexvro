import { useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Search, Filter, Download,
  CircleDollarSign, TrendingUp, TrendingDown, Clock, AlertCircle
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import type { Zer0Payment } from '../../stores/types';

type TransactionType = 'incoming' | 'outgoing' | 'swap' | 'pending';
type TransactionStatus = 'confirmed' | 'pending' | 'failed';

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  token: string;
  usdValue: string;
  from: string;
  to: string;
  timestamp: string;
  network: string;
  hash: string;
}

const TYPE_CONFIG: Record<TransactionType, { icon: React.ReactNode; label: string; color: string }> = {
  incoming: { icon: <ArrowDownLeft className="h-3.5 w-3.5" />, label: 'Received', color: 'text-green-500 bg-green-500/10' },
  outgoing: { icon: <ArrowUpRight className="h-3.5 w-3.5" />, label: 'Sent', color: 'text-red-500 bg-red-500/10' },
  swap: { icon: <CircleDollarSign className="h-3.5 w-3.5" />, label: 'Swap', color: 'text-blue-500 bg-blue-500/10' },
  pending: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Pending', color: 'text-amber-500 bg-amber-500/10' },
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
  confirmed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function Transactions() {
  const { workspaceId } = useParams({ strict: false });
  const payments = useZer0Store(s => s.payments);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

  const paymentTransactions = useMemo<Transaction[]>(() => payments.map((payment: Zer0Payment) => ({
    id: payment.id,
    type: payment.status === 'pending_approval' || payment.status === 'processing' || payment.status === 'approved' ? 'pending' : 'outgoing',
    status: payment.status === 'completed' ? 'confirmed' : payment.status === 'failed' ? 'failed' : 'pending',
    amount: payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    token: payment.currency,
    usdValue: `${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${payment.currency}`,
    from: workspaceId || 'workspace',
    to: payment.recipientWallet || payment.recipientName,
    timestamp: new Date(payment.createdAt).toLocaleString(),
    network: 'Stellar',
    hash: payment.txHash || payment.id,
  })), [payments, workspaceId]);

  const transactions = useMemo(() => {
    let filtered = paymentTransactions;
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.amount.includes(q) || tx.token.toLowerCase().includes(q) ||
        tx.from.toLowerCase().includes(q) || tx.to.toLowerCase().includes(q) ||
        tx.hash.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [paymentTransactions, searchQuery, typeFilter]);

  const totalIn = paymentTransactions.filter(tx => tx.type === 'incoming' && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + parseFloat(tx.amount.replace(/,/g, '')), 0);
  const totalOut = paymentTransactions.filter(tx => tx.type === 'outgoing' && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + parseFloat(tx.amount.replace(/,/g, '')), 0);
  const pendingCount = paymentTransactions.filter(tx => tx.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Transactions</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              View and manage all financial transactions across your workspace.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total Received"
          value={`$${totalIn.toLocaleString()}`}
          accent="green"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Total Sent"
          value={`$${totalOut.toLocaleString()}`}
          accent="red"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending"
          value={pendingCount.toString()}
          detail={pendingCount > 0 ? 'Awaiting confirmation' : 'All clear'}
          accent="amber"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by token, address, or hash..."
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          {(['all', 'incoming', 'outgoing', 'swap', 'pending'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                typeFilter === t
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        {transactions.length === 0 ? (
          <div className="p-10 text-center">
            <CircleDollarSign className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No transactions found</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {searchQuery ? 'Try adjusting your search or filters.' : 'Transactions will appear here once they occur.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.map(tx => {
              const config = TYPE_CONFIG[tx.type];
              return (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                    {config.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{config.label}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[tx.status]}`}>
                        {tx.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">
                      {tx.from} → {tx.to}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.type === 'incoming' ? 'text-green-600 dark:text-green-400' : tx.type === 'outgoing' ? 'text-zinc-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`}>
                      {tx.type === 'incoming' ? '+' : tx.type === 'outgoing' ? '-' : ''}{tx.amount} {tx.token.split(' ')[0]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{tx.usdValue}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[11px] text-zinc-400">{tx.timestamp}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-300 dark:text-zinc-600">{tx.network}</p>
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
  accent: 'green' | 'red' | 'amber';
}) {
  const accentColors = {
    green: 'bg-green-500/10 text-green-500',
    red: 'bg-red-500/10 text-red-500',
    amber: 'bg-amber-500/10 text-amber-500',
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
