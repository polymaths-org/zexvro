import { useState, useMemo, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  Search, Filter, Download, ChevronDown, ExternalLink, Shield, ShieldOff, Calendar, Eye, X, ShieldCheck, Copy, Check, Ghost, BookOpen, RefreshCw,
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import { useStealthStore } from '../../stores/stealth';
import { useStealthClaimsStore } from '../../stores/stealthClaims';
import { payrollApi } from '../../api/api';
import { getExplorerTxUrl, getExplorerAccountUrl, truncateKey } from '../../api/walletConnect';
import {
  buildWithdrawUrl,
  createStealthClaim,
  networkFromHorizon,
  type IssuedClaim,
} from '../../lib/stealthClaim';
import StealthRedeemGuideModal from './StealthRedeemGuideModal';
import type { Zer0PaymentStatus, Zer0PaymentType } from '../../stores/types';

export default function Zer0History() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || workspaceId || '';
  const allPayments = useZer0Store(s => s.payments);
  const allProofs = useZer0Store(s => s.proofs);
  const settings = useZer0Store(s => s.settings);
  const outbound = useStealthStore(s => s.outbound);
  const scanEphemeral = useStealthStore(s => s.scanEphemeral);
  const issuedClaims = useStealthClaimsStore(s => s.issued);
  const addIssuedClaim = useStealthClaimsStore(s => s.addIssued);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Zer0PaymentStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<Zer0PaymentType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [guideClaim, setGuideClaim] = useState<{ claim: IssuedClaim; name?: string } | null>(null);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const reconcileStalePayments = useZer0Store(s => s.reconcileStalePayments);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt('Copy:', text);
    }
  };

  // Pull payroll runs from AWS into store so history survives reload
  useEffect(() => {
    const ws = workspaceId || '';
    if (!ws) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const runData = await payrollApi.listRuns(ws);
        if (cancelled) return;
        const runs = runData.runs || [];
        const local = useZer0Store.getState().payments;
        const byId = new Map(local.map(p => [p.id, p]));
        for (const run of runs) {
          const runId = run.id || run.runId;
          if (!runId) continue;
          const item = run.lineItems?.[0] || {};
          const existing = byId.get(runId);
          if (existing) {
            byId.set(runId, {
              ...existing,
              projectId: existing.projectId || run.projectId || item.projectId || pid,
              status: run.status || existing.status,
              txHash: run.txHash || existing.txHash,
              processedAt: run.processedAt || existing.processedAt,
              amount: run.totalAmount ?? existing.amount,
              shielded: item.shielded ?? existing.shielded,
              recipientName: existing.recipientName || item.name || 'Unknown',
              recipientWallet: existing.recipientWallet || item.walletAddress || '',
            });
          } else if (run.lineItems?.length) {
            byId.set(runId, {
              id: runId,
              projectId: run.projectId || item.projectId || pid,
              employeeId: item.employeeId || null,
              recipientName: item.name || 'Unknown',
              recipientWallet: item.walletAddress || '',
              amount: item.amount || run.totalAmount || 0,
              currency: item.currency || 'XLM',
              type: item.type || run.type || 'payroll',
              status: run.status || 'completed',
              shielded: item.shielded ?? false,
              memo: item.memo || run.memo || '',
              proofId: null,
              txHash: run.txHash || null,
              lastError: run.status === 'failed' ? (run.lastError || null) : null,
              approvedBy: null,
              createdAt: run.createdAt || Date.now(),
              processedAt: run.processedAt || null,
            } as any);
          }
        }
        // Re-link proofs → payments by paymentId (AWS runs often lack proofId)
        const proofs = useZer0Store.getState().proofs;
        for (const proof of proofs) {
          if (!proof.paymentId || !proof.id) continue;
          const pay = byId.get(proof.paymentId);
          if (pay && !pay.proofId) {
            byId.set(proof.paymentId, { ...pay, proofId: proof.id });
          }
        }

        useZer0Store.setState({
          payments: Array.from(byId.values()).sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
          ),
        });
        // After AWS merge, clear orphan Processing / Queued leftovers
        useZer0Store.getState().reconcileStalePayments({ maxAgeMs: 60_000 });
      } catch (e) {
        console.error('History sync failed:', e);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, pid]);

  // Show payments for this project, or legacy rows with missing projectId
  const payments = useMemo(
    () => allPayments.filter(p =>
      !p.projectId || p.projectId === pid || p.projectId === workspaceId || p.projectId === projectId,
    ),
    [allPayments, pid, workspaceId, projectId],
  );

  const stuckCount = useMemo(
    () => payments.filter(p => p.status === 'processing' || p.status === 'approved').length
      + allProofs.filter(pr => pr.status === 'queued' || pr.status === 'generating').length,
    [payments, allProofs],
  );

  const handleClearStuck = () => {
    const r = reconcileStalePayments({ forceAll: true, maxAgeMs: 0 });
    setReconcileMsg(
      r.paymentsFixed || r.proofsFixed
        ? `Cleared ${r.paymentsFixed} payment(s) + ${r.proofsFixed} proof(s). Failed rows can be retried.`
        : 'Nothing stuck — all rows look terminal.',
    );
    window.setTimeout(() => setReconcileMsg(null), 4000);
  };

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(p.recipientName || '').toLowerCase().includes(q) || String(p.memo || '').toLowerCase().includes(q) || String(p.id || '').toLowerCase().includes(q);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Payment ledger</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Internal books: {payments.length} payments · {payments.filter(p => p.status === 'completed').length} completed
            {syncing ? ' · syncing…' : ' · saved locally + AWS'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stuckCount > 0 && (
            <button
              type="button"
              onClick={handleClearStuck}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:text-amber-200 hover:bg-amber-500/15 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Clear stuck ({stuckCount})
            </button>
          )}
          <button onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>
      {reconcileMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          {reconcileMsg}
        </div>
      )}

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
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${statusColors[p.status || ''] || ''}`}>
                          {String(p.status || '').replace('_', ' ')}
                        </span>
                        {p.stealth && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            stealth
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <span>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>•</span>
                        <span className="capitalize">{String(p.type || '').replace('-', ' ')}</span>
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
                          <a
                            href={getExplorerTxUrl(p.txHash, (settings?.horizonUrl || '').includes('testnet') ? 'TESTNET' : 'PUBLIC')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-blue-500 hover:text-blue-400 flex items-center gap-1 transition"
                          >
                            {truncateKey(p.txHash, 8, 6)} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : <span className="text-zinc-400">—</span>}
                      </div>
                      <div>
                        <span className="text-zinc-400 font-semibold uppercase block mb-0.5">Processed At</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{p.processedAt ? new Date(p.processedAt).toLocaleString() : '—'}</span>
                      </div>
                      {p.status === 'failed' && p.lastError && (
                        <div className="col-span-2 sm:col-span-4">
                          <span className="text-red-400 font-semibold uppercase block mb-0.5">Error</span>
                          <span className="text-red-500 dark:text-red-400 font-mono text-[10px] break-all">{p.lastError}</span>
                        </div>
                      )}
                      {p.stealth && (
                        <>
                          <div className="col-span-2 sm:col-span-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                              <Ghost className="h-3 w-3" /> Stealth destination — not your Freighter wallet
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                               XLM went to a one-time address. Prefer the PIN + /withdraw link for non-tech recipients.
                             </p>
                             {(() => {
                               const claim = issuedClaims.find(c =>
                                 c.paymentId === p.id
                                 || (p.stealthOneTimeAddress && c.oneTimePublicKey === p.stealthOneTimeAddress),
                               );
                               const rec = outbound.find(r => r.paymentId === p.id)
                                 || (p.stealthOneTimeAddress
                                   ? outbound.find(r => r.oneTimePublicKey === p.stealthOneTimeAddress)
                                   : undefined);
                               if (!claim) {
                                 if (!rec?.oneTimeSecret || !p.stealthOneTimeAddress) return null;
                                 return (
                                   <button
                                     type="button"
                                     onClick={() => {
                                       void (async () => {
                                         try {
                                           const minted = await createStealthClaim({
                                             oneTimeSecret: rec.oneTimeSecret,
                                             oneTimePublicKey: p.stealthOneTimeAddress!,
                                             amountXlm: p.amount,
                                             note: p.recipientName,
                                             paymentId: p.id,
                                             network: networkFromHorizon(settings?.horizonUrl || ''),
                                           });
                                           addIssuedClaim(minted);
                                           setGuideClaim({ claim: minted, name: p.recipientName });
                                         } catch (e: any) {
                                           setRecoverMsg(e?.message || 'Could not mint PIN claim');
                                         }
                                       })();
                                     }}
                                     className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 text-white text-[10px] font-bold"
                                   >
                                     <BookOpen className="h-3.5 w-3.5" />
                                     Create withdraw PIN + instructions
                                   </button>
                                 );
                               }
                               return (
                                 <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-2">
                                   <div className="flex flex-wrap items-center justify-between gap-2">
                                     <div>
                                       <span className="text-[10px] font-semibold uppercase text-zinc-400">Withdraw PIN</span>
                                       <p className="font-mono text-base font-bold tracking-widest text-zinc-900 dark:text-white">{claim.pin}</p>
                                     </div>
                                     <button
                                       type="button"
                                       onClick={() => setGuideClaim({ claim, name: p.recipientName })}
                                       className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 text-white text-[10px] font-bold"
                                     >
                                       <BookOpen className="h-3.5 w-3.5" />
                                       Instructions
                                     </button>
                                   </div>
                                   <div className="flex items-start gap-1.5">
                                     <span className="font-mono text-[9px] break-all text-zinc-600 dark:text-zinc-300">
                                       {buildWithdrawUrl(claim.claimCode)}
                                     </span>
                                     <button type="button" onClick={() => void copyText(`wurl-${p.id}`, buildWithdrawUrl(claim.claimCode))} className="shrink-0 text-zinc-400">
                                       {copied === `wurl-${p.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                     </button>
                                   </div>
                                 </div>
                               );
                             })()}
                             <div className="grid sm:grid-cols-2 gap-3">
                               <div>
                                 <span className="text-zinc-400 font-semibold uppercase block mb-0.5">One-time address</span>
                                 <div className="flex items-start gap-1.5">
                                   <span className="font-mono text-violet-600 dark:text-violet-400 break-all text-[10px]">
                                     {p.stealthOneTimeAddress || '—'}
                                   </span>
                                   {p.stealthOneTimeAddress && (
                                     <>
                                       <button type="button" onClick={() => void copyText(`ota-${p.id}`, p.stealthOneTimeAddress!)} className="shrink-0 text-zinc-400 hover:text-zinc-700">
                                         {copied === `ota-${p.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                       </button>
                                       <a
                                         href={getExplorerAccountUrl(
                                           p.stealthOneTimeAddress,
                                           (settings?.horizonUrl || '').includes('testnet') ? 'TESTNET' : 'PUBLIC',
                                         )}
                                         target="_blank"
                                         rel="noreferrer"
                                         className="shrink-0 text-blue-500"
                                       >
                                         <ExternalLink className="h-3 w-3" />
                                       </a>
                                     </>
                                   )}
                                 </div>
                               </div>
                               <div>
                                 <span className="text-zinc-400 font-semibold uppercase block mb-0.5">Ephemeral pub (scan)</span>
                                 <div className="flex items-start gap-1.5">
                                   <span className="font-mono text-zinc-600 dark:text-zinc-400 break-all text-[10px]">
                                     {p.stealthEphemeralPub || '—'}
                                   </span>
                                   {p.stealthEphemeralPub && (
                                     <button type="button" onClick={() => void copyText(`eph-${p.id}`, p.stealthEphemeralPub!)} className="shrink-0 text-zinc-400 hover:text-zinc-700">
                                       {copied === `eph-${p.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                     </button>
                                   )}
                                 </div>
                               </div>
                             </div>
                             {(() => {
                               const rec = outbound.find(r => r.paymentId === p.id)
                                 || (p.stealthOneTimeAddress
                                   ? outbound.find(r => r.oneTimePublicKey === p.stealthOneTimeAddress)
                                   : undefined);
                               if (!rec?.oneTimeSecret) {
                                 return (
                                   <div className="flex flex-wrap items-center gap-2">
                                     <button
                                       type="button"
                                       onClick={() => {
                                         if (!p.stealthEphemeralPub) {
                                           setRecoverMsg('Missing ephemeral key on this payment.');
                                           return;
                                         }
                                         const found = scanEphemeral(p.stealthEphemeralPub, p.id);
                                         setRecoverMsg(
                                           found
                                             ? `Recovered one-time secret for ${found.oneTimePublicKey} — open Stealth → Recovered inbound`
                                             : 'No match. Import the payee scan identity first, then retry (salt = payment id).',
                                         );
                                       }}
                                       className="h-7 px-2.5 rounded-md bg-violet-600 text-white text-[10px] font-bold"
                                     >
                                       Try recover with scan keys
                                     </button>
                                     {recoverMsg && expandedId === p.id && (
                                       <span className="text-[10px] text-zinc-500">{recoverMsg}</span>
                                     )}
                                   </div>
                                 );
                               }
                               return (
                                 <details className="text-[10px]">
                                   <summary className="cursor-pointer font-semibold text-zinc-500">Advanced — one-time secret (S…)</summary>
                                   <div className="mt-1.5 flex items-start gap-1.5">
                                     <span className="font-mono text-amber-700 dark:text-amber-300 break-all text-[10px]">
                                       {rec.oneTimeSecret}
                                     </span>
                                     <button type="button" onClick={() => void copyText(`sec-${p.id}`, rec.oneTimeSecret)} className="shrink-0 text-zinc-400 hover:text-zinc-700">
                                       {copied === `sec-${p.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                     </button>
                                   </div>
                                   <p className="text-[10px] text-zinc-400 mt-1">
                                     Only for tech users. Prefer PIN + /withdraw for teammates.
                                   </p>
                                 </details>
                               );
                             })()}
                           </div>
                        </>
                      )}
                      {p.shielded && (
                        <div>
                          <span className="text-zinc-400 font-semibold uppercase block mb-0.5">ZK Proof</span>
                          {(() => {
                            const proof = allProofs.find(pr => pr.paymentId === p.id);
                            if (!proof) return <span className="text-zinc-400">Not found</span>;
                            if (proof.status === 'verified') {
                              return (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <button
                                    onClick={() => setSelectedProofId(proof.id)}
                                    className="text-blue-500 hover:text-blue-400 font-semibold transition"
                                  >
                                    View Details
                                  </button>
                                  <span className="text-zinc-400">•</span>
                                  <button
                                    onClick={() => downloadProof(proof, p)}
                                    className="text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-200 font-semibold transition"
                                  >
                                    Download
                                  </button>
                                </div>
                              );
                            }
                            return <span className="text-zinc-500 capitalize font-medium italic">{proof.status}</span>;
                          })()}
                        </div>
                      )}

                      {(p.status === 'failed' || p.status === 'processing' || p.status === 'approved') && (
                        <div className="col-span-2 sm:col-span-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-end gap-2">
                          {(p.status === 'processing' || p.status === 'approved') && (
                            <button
                              type="button"
                              onClick={() => {
                                useZer0Store.getState().updatePaymentStatus(p.id, 'failed', {
                                  lastError: 'Manually marked failed (was stuck processing).',
                                });
                                const proof = allProofs.find(pr => pr.paymentId === p.id);
                                if (proof && (proof.status === 'queued' || proof.status === 'generating')) {
                                  useZer0Store.getState().updateProofStatus(proof.id, 'failed');
                                }
                              }}
                              className="inline-flex h-8 items-center justify-center px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            >
                              Mark failed
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              // Unstick then re-run settle (processPayment already handles orphan processing)
                              if (p.status === 'processing') {
                                useZer0Store.getState().updatePaymentStatus(p.id, 'failed', {
                                  lastError: 'Retrying after stuck processing…',
                                });
                              } else if (p.status === 'approved') {
                                // leave approved — processPayment accepts it
                              }
                              void useZer0Store.getState().processPayment(p.id);
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1.5 px-3.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {p.status === 'failed' ? 'Retry payment' : 'Resume / retry'}
                          </button>
                        </div>
                      )}
                      {p.status === 'pending_approval' && (
                        <div className="col-span-2 sm:col-span-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-end gap-2">
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
                            className="inline-flex h-8 items-center justify-center px-3.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm"
                          >
                            Approve & Execute
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
                            className="inline-flex h-8 items-center justify-center px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
                  <span className="text-zinc-400 block font-medium">ZK Proof System</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{selectedProof.proofSystem}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Generation Time</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                    {selectedProof.generationTimeMs ? `${selectedProof.generationTimeMs} ms` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Associated Payment ID</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono">{selectedProof.paymentId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Created At</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{new Date(selectedProof.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedPayment && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-2.5">Associated Shielded Payment</h4>
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

      {guideClaim && (
        <StealthRedeemGuideModal
          claim={guideClaim.claim}
          recipientName={guideClaim.name}
          onClose={() => setGuideClaim(null)}
        />
      )}
    </div>
  );
}
