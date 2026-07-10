import { useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';

export default function Zer0Proofs() {
  const { projectId } = useParams({ strict: false });
  const pid = projectId || '';

  const allProofs = useZer0Store(s => s.proofs);
  const allPayments = useZer0Store(s => s.payments);
  const updateProofStatus = useZer0Store(s => s.updateProofStatus);

  const proofs = useMemo(() => allProofs.filter(p => p.projectId === pid), [allProofs, pid]);
  const payments = useMemo(() => allPayments.filter(p => p.projectId === pid), [allPayments, pid]);
  const getPaymentForProof = (paymentId: string) => payments.find(p => p.id === paymentId);

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
    updateProofStatus(proofId, 'generating');
    setTimeout(() => {
      updateProofStatus(proofId, 'verified', {
        generationTimeMs: 900 + Math.round(Math.random() * 800),
        proofData: `0xretry_${Math.random().toString(16).slice(2, 18)}`,
        verifiedAt: Date.now(),
      });
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Proof Manager</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Track zero-knowledge proof generation status for shielded payments.
        </p>
      </div>

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
              const cfg = statusConfig[proof.status];
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
                    {proof.status === 'failed' && (
                      <button onClick={() => handleRetry(proof.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition">
                        <RefreshCw className="h-3 w-3" /> Retry
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
  );
}
