import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, Eye, Download, X } from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import { proofApi } from '../../api/api';

export default function Zer0Proofs() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || workspaceId || '';

  const allProofs = useZer0Store(s => s.proofs);
  const allPayments = useZer0Store(s => s.payments);
  const updateProofStatus = useZer0Store(s => s.updateProofStatus);
  const reconcileStalePayments = useZer0Store(s => s.reconcileStalePayments);

  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  // Re-merge proofs from AWS so Payment proofs survive reload / server restart
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await proofApi.list('');
        if (cancelled) return;
        const remote = (res.proofs || []).filter((p: any) => p?.id);
        if (!remote.length) return;
        const local = useZer0Store.getState().proofs;
        const byId = new Map(local.map(p => [p.id, p]));
        for (const raw of remote) {
          const existing = byId.get(raw.id);
          byId.set(raw.id, existing ? {
            ...existing,
            ...raw,
            proofData: raw.proofData || existing.proofData,
            verificationKey: raw.verificationKey || existing.verificationKey,
            generationTimeMs: raw.generationTimeMs ?? existing.generationTimeMs,
            verifiedAt: raw.verifiedAt || existing.verifiedAt,
            status: raw.status === 'verified' || existing.status !== 'verified' ? (raw.status || existing.status) : existing.status,
          } : {
            id: raw.id,
            projectId: raw.projectId || '',
            paymentId: raw.paymentId || '',
            proofSystem: raw.proofSystem || 'Groth16',
            status: raw.status || 'queued',
            verificationKey: raw.verificationKey ?? null,
            proofData: raw.proofData ?? null,
            generationTimeMs: raw.generationTimeMs ?? null,
            createdAt: Number(raw.createdAt) || Date.now(),
            verifiedAt: raw.verifiedAt ? Number(raw.verifiedAt) : null,
          });
        }
        useZer0Store.setState({
          proofs: Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        });
        useZer0Store.getState().reconcileStalePayments({ maxAgeMs: 60_000 });
      } catch (e) {
        console.error('Proof sync failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, pid]);

  const proofs = useMemo(
    () => allProofs.filter(p =>
      !p.projectId || p.projectId === pid || p.projectId === workspaceId || p.projectId === projectId,
    ),
    [allProofs, pid, workspaceId, projectId],
  );
  const payments = useMemo(
    () => allPayments.filter(p =>
      !p.projectId || p.projectId === pid || p.projectId === workspaceId || p.projectId === projectId,
    ),
    [allPayments, pid, workspaceId, projectId],
  );
  const getPaymentForProof = (paymentId: string) => payments.find(p => p.id === paymentId);

  const selectedProof = useMemo(() => allProofs.find(p => p.id === selectedProofId) || null, [allProofs, selectedProofId]);
  const selectedPayment = useMemo(() => selectedProof ? getPaymentForProof(selectedProof.paymentId) : null, [selectedProof, payments]);

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    queued: { icon: Clock, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', label: 'Queued' },
    generating: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Generating' },
    verified: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Verified' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  };

  const stats = useMemo(() => ({
    total: proofs.length,
    verified: proofs.filter(p => p.status === 'verified').length,
    generating: proofs.filter(p => p.status === 'generating').length,
    failed: proofs.filter(p => p.status === 'failed').length,
    avgTime: proofs.filter(p => p.generationTimeMs).reduce((sum, p) => sum + (p.generationTimeMs || 0), 0) /
      (proofs.filter(p => p.generationTimeMs).length || 1),
  }), [proofs]);

  const handleRetry = (proofId: string) => {
    const proof = useZer0Store.getState().proofs.find(p => p.id === proofId);
    updateProofStatus(proofId, 'queued', {
      generationTimeMs: null,
      proofData: null,
      verifiedAt: null,
    });
    // Real retry = re-run the linked payment settle (proof rows are audit records)
    if (proof?.paymentId) {
      const pay = useZer0Store.getState().payments.find(p => p.id === proof.paymentId);
      if (pay && pay.status !== 'completed') {
        if (pay.status === 'processing') {
          useZer0Store.getState().updatePaymentStatus(pay.id, 'failed', {
            lastError: 'Retrying from proofs page…',
          });
        }
        void useZer0Store.getState().processPayment(proof.paymentId);
      }
    }
  };

  const handleClearStuckProofs = () => {
    const r = reconcileStalePayments({ forceAll: true, maxAgeMs: 0 });
    setReconcileMsg(
      r.proofsFixed || r.paymentsFixed
        ? `Cleared ${r.proofsFixed} stuck proof(s) + ${r.paymentsFixed} payment(s).`
        : 'No stuck proofs found.',
    );
    window.setTimeout(() => setReconcileMsg(null), 4000);
  };

  const stuckProofs = useMemo(
    () => proofs.filter(p => p.status === 'queued' || p.status === 'generating').length,
    [proofs],
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Payment proofs</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit trail for private payroll — each shielded payment produces a verifiable proof record for your books.
          </p>
        </div>
        {stuckProofs > 0 && (
          <button
            type="button"
            onClick={handleClearStuckProofs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:text-amber-200 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Clear stuck proofs ({stuckProofs})
          </button>
        )}
      </div>
      {reconcileMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          {reconcileMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Proofs', value: stats.total, color: 'text-zinc-900 dark:text-white' },
          { label: 'Verified', value: stats.verified, color: 'text-emerald-600' },
          { label: 'In Progress', value: stats.generating, color: 'text-blue-600' },
          { label: 'Avg Gen Time', value: stats.total ? `${Math.round(stats.avgTime)}ms` : '—', color: 'text-zinc-900 dark:text-white' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">{s.label}</span>
            <span className={`text-xl font-bold mt-1 block ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Proof List */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
        {proofs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-500 mb-1">No proofs generated yet</p>
            <p className="text-xs text-zinc-400">Proofs are automatically generated when you send shielded payments.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {proofs.map(proof => {
              const cfg = statusConfig[proof.status] || statusConfig.queued;
              const Icon = cfg.icon;
              const payment = getPaymentForProof(proof.paymentId);

              return (
                <div key={proof.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 ${cfg.color} ${proof.status === 'generating' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">{proof.id}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <span>{proof.proofSystem}</span>
                        <span>•</span>
                        <span>{new Date(proof.createdAt).toLocaleDateString()}</span>
                        {payment && <><span>•</span><span>For: {payment.recipientName}</span></>}
                        {proof.generationTimeMs && <><span>•</span><span>{proof.generationTimeMs}ms</span></>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {proof.proofData && (
                      <span className="text-[9px] font-mono text-zinc-400 hidden sm:block">{proof.proofData.slice(0, 20)}…</span>
                    )}
                    <button
                      onClick={() => setSelectedProofId(proof.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                    >
                      <Eye className="h-3 w-3" /> View Details
                    </button>
                    {proof.status === 'verified' && (
                      <button
                        onClick={() => downloadProof(proof, payment)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                      >
                        <Download className="h-3 w-3" /> Download
                      </button>
                    )}
                    {(proof.status === 'failed' || proof.status === 'queued' || proof.status === 'generating') && (
                      <>
                        {(proof.status === 'queued' || proof.status === 'generating') && (
                          <button
                            type="button"
                            onClick={() => updateProofStatus(proof.id, 'failed')}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 transition"
                          >
                            Mark failed
                          </button>
                        )}
                        <button onClick={() => handleRetry(proof.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition">
                          <RefreshCw className="h-3 w-3" /> {proof.status === 'failed' ? 'Retry pay' : 'Retry'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-zinc-400 block font-medium">Proof ID</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono font-semibold">{selectedProof.id}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${statusConfig[selectedProof.status]?.bg} ${statusConfig[selectedProof.status]?.color}`}>
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
                  <div className="grid grid-cols-2 gap-4 text-xs">
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
