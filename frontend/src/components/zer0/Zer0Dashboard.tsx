import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import {
  DollarSign, Users, ArrowUpRight, TrendingUp, Plus,
  Send, Wallet, RefreshCw, ShieldCheck, Eye, Download, X, Clock, Loader2, CheckCircle2, XCircle
} from 'lucide-react';
import { stellar, payrollApi } from '../../api/api';
import { useZer0Store } from '../../stores/zer0';
import { useWorkspaceStore } from '../../stores/workspace';
import { getCommitmentCount, getContractRoot, DENOMINATION_XLM } from '../../api/privacyPool';

export default function Zer0Dashboard() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || workspaceId || '';

  const allEmployees = useZer0Store(s => s.employees);
  const allPayments = useZer0Store(s => s.payments);
  const allProofs = useZer0Store(s => s.proofs);
  const pool = useZer0Store(s => s.pool);
  const settings = useZer0Store(s => s.settings);

  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);
  const [onChainPool, setOnChainPool] = useState<{ count: number; root: string } | null>(null);
  const [onChainLoading, setOnChainLoading] = useState(false);

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace());
  const preferredCurrency = (currentWorkspace?.settings as any)?.preferredCurrency || 'USD';

  const CONVERSION_RATES: Record<string, { rate: number; symbol: string }> = {
    USDC: { rate: 1.00, symbol: '$' },
    EURC: { rate: 1.08, symbol: '€' },
    XLM: { rate: 0.095, symbol: '*' }
  };

  const totalPoolFiat = useMemo(() => {
    let usdTotal = 0;
    usdTotal += (pool.balances.USDC || 0) * CONVERSION_RATES.USDC.rate;
    usdTotal += (pool.balances.EURC || 0) * CONVERSION_RATES.EURC.rate;
    usdTotal += (pool.balances.XLM || 0) * CONVERSION_RATES.XLM.rate;

    if (preferredCurrency === 'EUR') {
      return usdTotal * 0.925; // 1 USD = 0.925 EUR
    }
    return usdTotal;
  }, [pool.balances, preferredCurrency]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  const basePath = projectId ? `/dashboard/w/${workspaceId}/p/${projectId}` : `/dashboard/w/${workspaceId}`;

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
  const totalDisbursedThisMonthFiat = useMemo(() => {
    return completedThisMonth.reduce((sum, p) => {
      const rate = CONVERSION_RATES[p.currency]?.rate || 1.00;
      const usdVal = p.amount * rate;
      if (preferredCurrency === 'EUR') {
        return sum + (usdVal * 0.925);
      }
      return sum + usdVal;
    }, 0);
  }, [completedThisMonth, preferredCurrency]);
  const recentPayments = payments.slice(0, 8);
  const approvalAwaitingPayments = useMemo(
    () => payments.filter(p => p.status === 'pending_approval'),
    [payments],
  );

  const refreshBalance = async () => {
    if (!settings?.walletAddress || !settings.walletAddress.trim()) {
      setBalanceError('Connect a funding wallet in Settings before refreshing balances.');
      return;
    }
    setIsRefreshing(true);
    setBalanceError('');
    try {
      const balances = await stellar.getPoolBalance(settings.walletAddress.trim(), settings.horizonUrl);
      const usdc = Number(balances.USDC) || 0;
      const xlm = Number(balances.XLM) || 0;
      const eurc = Number(balances.EURC) || 0;
      const hasAnyBalance = usdc > 0 || xlm > 0 || eurc > 0;
      if (hasAnyBalance) {
        useZer0Store.setState(state => ({
          pool: {
            ...state.pool,
            balances: {
              USDC: Number.isFinite(usdc) ? usdc : state.pool.balances.USDC,
              XLM: Number.isFinite(xlm) ? xlm : state.pool.balances.XLM,
              EURC: Number.isFinite(eurc) ? eurc : state.pool.balances.EURC,
            },
            lastUpdated: Date.now(),
          },
        }));
      } else {
        setBalanceError('Wallet returned zero balances. Pool balance preserved — use Refill to add funds.');
      }
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : 'Could not refresh wallet balances.');
    } finally {
      setIsRefreshing(false);
    }
  };



  useEffect(() => {
    if (settings.walletAddress && settings.walletAddress.trim()) {
      refreshBalance();
    }
  }, [settings.walletAddress, settings.horizonUrl]);

  // Fetch on-chain privacy pool data from Soroban contract
  useEffect(() => {
    if (settings.contractAddress && settings.contractAddress.trim()) {
      setOnChainLoading(true);
      Promise.all([getCommitmentCount(), getContractRoot()])
        .then(([count, root]) => setOnChainPool({ count, root }))
        .catch(() => setOnChainPool(null))
        .finally(() => setOnChainLoading(false));
    }
  }, [settings.contractAddress]);

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pending_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    draft: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/60',
    approved: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    cancelled: 'bg-zinc-200/60 text-zinc-400',
  };

  const downloadProof = (proof: any, payment?: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      proofId: proof.id,
      projectId: proof.projectId,
      paymentId: proof.paymentId,
      proofSystem: proof.proofSystem,
      status: proof.status,
      verificationKey: proof.verificationKey || "N/A",
      proofData: proof.proofData || "N/A",
      generationTimeMs: proof.generationTimeMs,
      createdAt: new Date(proof.createdAt).toISOString(),
      verifiedAt: proof.verifiedAt ? new Date(proof.verifiedAt).toISOString() : null,
      recipient: payment ? {
        name: payment.recipientName,
        walletAddress: payment.recipientWallet,
        amount: payment.amount,
        currency: payment.currency
      } : null
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ZK_Proof_${proof.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const selectedProof = useMemo(() => allProofs.find(p => p.id === selectedProofId) || null, [allProofs, selectedProofId]);
  const selectedPayment = useMemo(() => selectedProof ? allPayments.find(p => p.id === selectedProof.paymentId) : null, [selectedProof, allPayments]);

  const proofStatusColors: Record<string, { color: string; bg: string }> = {
    queued: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    generating: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
    verified: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    failed: { color: 'text-red-500', bg: 'bg-red-500/10' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Payroll overview</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Funding wallet, team roster, and disbursements — private or public.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`${basePath}/zer0/pay` as any}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-sm"
          >
            <Send className="h-3.5 w-3.5" /> Send payment
          </Link>
          <Link
            to={`${basePath}/zer0/people` as any}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add team member
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Funding wallet',
            value: preferredCurrency === 'EUR'
              ? `€${totalPoolFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })} EUR`
              : `$${totalPoolFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
            sub: `${pool.balances.XLM.toLocaleString()} XLM · ${pool.balances.USDC.toLocaleString()} USDC · ${pool.balances.EURC.toLocaleString()} EURC`,
            icon: Wallet,
            color: 'text-blue-500',
          },
          {
            label: 'Active on payroll',
            value: activeEmployees.length.toString(),
            sub: `${employees.length} in team directory`,
            icon: Users,
            color: 'text-violet-500',
          },
          {
            label: 'Paid this month',
            value: preferredCurrency === 'EUR'
              ? `€${totalDisbursedThisMonthFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })} EUR`
              : `$${totalDisbursedThisMonthFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
            sub: `${completedThisMonth.length} completed disbursements`,
            icon: TrendingUp,
            color: 'text-emerald-500',
          },
          {
            label: 'Awaiting action',
            value: pendingPayments.length.toString(),
            sub: pendingPayments.length > 0 ? 'Needs approval or processing' : 'Nothing pending',
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
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Approvals */}
          {approvalAwaitingPayments.length > 0 && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-500/5 dark:border-amber-500/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="h-4 w-4 text-amber-500" /> Pending Approvals ({approvalAwaitingPayments.length})
                </h3>
                <span className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Requires manager action</span>
              </div>
              <div className="divide-y divide-amber-100 dark:divide-amber-500/10 max-h-[220px] overflow-y-auto pr-1">
                {approvalAwaitingPayments.map(p => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 dark:text-white truncate">{p.recipientName}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {p.type} • {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.currency} {p.memo && `• ${p.memo}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={async () => {
                          try {
                            await payrollApi.updateRun(p.id, { workspaceId: workspaceId || pid, status: 'approved' });
                            useZer0Store.setState(s => ({
                              payments: s.payments.map(item => item.id === p.id ? { ...item, status: 'approved' } : item)
                            }));
                            useZer0Store.getState().processPayment(p.id);
                          } catch (e) {
                            console.error('Failed to approve payment:', e);
                          }
                        }}
                        className="h-7 px-2.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[10px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await payrollApi.updateRun(p.id, { workspaceId: workspaceId || pid, status: 'cancelled' });
                            useZer0Store.setState(s => ({
                              payments: s.payments.map(item => item.id === p.id ? { ...item, status: 'cancelled' } : item)
                            }));
                          } catch (e) {
                            console.error('Failed to reject payment:', e);
                          }
                        }}
                        className="h-7 px-2.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
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
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColors[p.status || ''] || ''}`}>
                        {String(p.status || '').replace('_', ' ')}
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

          {/* Payment proof audit trail */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden mt-6">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-500" /> Private payment proofs
              </h3>
              <Link
                to={`${basePath}/zer0/proofs` as any}
                className="text-[10px] font-semibold text-blue-500 hover:text-blue-600"
              >
                View all →
              </Link>
            </div>

            {allProofs.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">No private payments yet — proofs appear here for audit.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {allProofs.slice(0, 5).map(proof => {
                  const payment = allPayments.find(pay => pay.id === proof.paymentId);
                  const pStatus = proof.status || 'queued';
                  const st = proofStatusColors[pStatus] || proofStatusColors.queued;

                  return (
                    <div key={proof.id} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{proof.id}</span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${st.bg} ${st.color}`}>
                            {pStatus}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">
                          {proof.proofSystem} • For: {payment ? payment.recipientName : 'Unknown'}
                          {proof.generationTimeMs && ` • ${proof.generationTimeMs}ms`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedProofId(proof.id)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {proof.status === 'verified' && (
                          <button
                            onClick={() => downloadProof(proof, payment)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
                            title="Download Proof"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pool Balance Source */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-blue-500" /> Funding wallet
          </h3>

          <button
            type="button"
            onClick={refreshBalance}
            disabled={isRefreshing}
            className="mb-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh balances
          </button>

          {balanceError && (
            <p className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[10px] text-amber-600 dark:text-amber-400">
              {balanceError}
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="text-zinc-400">Wallet</span>
              <span className="truncate font-mono font-semibold text-zinc-700 dark:text-zinc-300">{settings.walletAddress || 'Not configured'}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">USDC Balance</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.balances.USDC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">XLM Balance</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.balances.XLM.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">EURC Balance</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.balances.EURC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">Total Processed</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pool.totalPaymentsProcessed}</span>
            </div>
          </div>

          {/* Shared privacy pool (public mixer) */}
          {settings.contractAddress && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-400 font-bold uppercase tracking-wider">Shared privacy pool</span>
                {onChainLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
              </div>
              {onChainPool ? (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-400">Deposits (anonymity set)</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{onChainPool.count}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-400">Unit size</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{DENOMINATION_XLM} XLM</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[10px]">
                    <span className="text-zinc-400">Pool state id</span>
                    <span className="truncate font-mono text-zinc-500 dark:text-zinc-400">{onChainPool.root.slice(0, 16)}…</span>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-zinc-400">No contract configured</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0A0A0B] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Zero-Knowledge Proof Details</h3>
              </div>
              <button
                onClick={() => setSelectedProofId(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-left">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-zinc-400 block font-medium">Proof ID</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono font-semibold">{selectedProof.id}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${
                    selectedProof.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' :
                    selectedProof.status === 'generating' ? 'bg-blue-500/10 text-blue-500' :
                    selectedProof.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}>
                    {selectedProof.status}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Proof protocol</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{selectedProof.proofSystem}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Processing time</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                    {selectedProof.generationTimeMs ? `${selectedProof.generationTimeMs} ms` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Payment reference</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono">{selectedProof.paymentId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Created</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{new Date(selectedProof.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedPayment && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-2.5">Linked private payment</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs text-left">
                    <div>
                      <span className="text-zinc-400 block font-medium">Recipient</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{selectedPayment.recipientName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Amount</span>
                      <span className="text-zinc-850 dark:text-emerald-400 font-bold">
                        {selectedPayment.amount.toFixed(2)} {selectedPayment.currency}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-400 block font-medium">Recipient Wallet</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-mono break-all">{selectedPayment.recipientWallet}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Verification Key (VK)</label>
                  <textarea
                    readOnly
                    value={selectedProof.verificationKey || "N/A"}
                    className="w-full h-16 px-3 py-2 text-[10px] font-mono rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-650 dark:text-zinc-300 resize-none outline-none focus:border-zinc-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Proof Parameters (πA, πB, πC)</label>
                  <textarea
                    readOnly
                    value={selectedProof.proofData || "N/A"}
                    className="w-full h-24 px-3 py-2 text-[10px] font-mono rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-650 dark:text-zinc-300 resize-none outline-none focus:border-zinc-300"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20 flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedProofId(null)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-805 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Close
              </button>
              {selectedProof.status === 'verified' && (
                <button
                  onClick={() => downloadProof(selectedProof, selectedPayment)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Download Proof Package
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
