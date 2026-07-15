import { zkWorkerApi } from '../api/api';
import { usePaymentSession, isPaymentInFlight } from '../stores/paymentSession';
import { useZer0Store } from '../stores/zer0';

let resumeStarted = false;

/**
 * After reload: if a payment session was mid-flight, re-open the modal and
 * try to finish from worker jobIds when possible.
 *
 * Server settle is the source of truth once a jobId exists — browser does not
 * re-submit notes (avoids double-pay). If jobs are gone, mark failed with a
 * clear recovery message.
 */
export function startPaymentResumeWatcher() {
  if (resumeStarted || typeof window === 'undefined') return;
  resumeStarted = true;

  const boot = async () => {
    // Wait for zustand rehydrate
    await new Promise(r => setTimeout(r, 400));
    try {
      const persistApi = (usePaymentSession as any).persist;
      if (persistApi?.hasHydrated && !persistApi.hasHydrated()) {
        await new Promise<void>(resolve => {
          const t = setTimeout(() => resolve(), 1500);
          persistApi.onFinishHydration?.(() => {
            clearTimeout(t);
            resolve();
          });
        });
      }
    } catch {
      // ignore
    }

    const session = usePaymentSession.getState().session;
    if (!session) return;

    // Terminal sessions: just show modal if still open
    if (session.phase === 'done' || session.phase === 'error') {
      if (session.dismissible) {
        usePaymentSession.getState().openModal();
      }
      return;
    }

    usePaymentSession.getState().openModal();
    usePaymentSession.getState().updateProgress({
      paymentId: session.paymentId,
      label: 'Reconnected — checking payment status…',
      phase: 'settling',
    });

    const payment = useZer0Store.getState().payments.find(p => p.id === session.paymentId);
    if (payment?.status === 'completed' && payment.txHash) {
      usePaymentSession.getState().completeSession({
        txHash: payment.txHash,
        label: 'Payment already completed',
      });
      return;
    }
    if (payment?.status === 'failed') {
      usePaymentSession.getState().failSession(payment.lastError || 'Payment failed');
      return;
    }

    const jobIds = session.jobIds || [];
    if (jobIds.length === 0) {
      // No job to resume — either never reached worker or browser path mid-flight.
      // Age out after 15 min so we don't leave users stuck forever.
      const age = Date.now() - (session.startedAt || 0);
      if (age > 15 * 60 * 1000) {
        useZer0Store.getState().updatePaymentStatus(session.paymentId, 'failed', {
          lastError: 'Lost connection during private settle. Check history / chain before retrying.',
        });
        usePaymentSession.getState().failSession(
          'Lost connection during settle and no worker job was stored. Check Payment ledger before retrying.',
        );
      } else {
        usePaymentSession.getState().updateProgress({
          paymentId: session.paymentId,
          label: 'Payment was interrupted. If it does not finish soon, check Payment ledger before retrying.',
          phase: 'settling',
        });
        // Soft fail after another wait window so modal is not permanent
        setTimeout(() => {
          const s = usePaymentSession.getState().session;
          if (s && s.paymentId === session.paymentId && isPaymentInFlight(s) && !(s.jobIds?.length)) {
            useZer0Store.getState().updatePaymentStatus(session.paymentId, 'failed', {
              lastError: 'Payment interrupted by page reload. Verify on-chain status before retry.',
            });
            usePaymentSession.getState().failSession(
              'Payment interrupted by page reload. Verify on-chain status before retry.',
            );
          }
        }, 45_000);
      }
      return;
    }

    // Poll all known jobs until all done or any error
    const deadline = Date.now() + 12 * 60 * 1000;
    let lastTx: string | null = null;
    const remaining = new Set(jobIds);

    while (Date.now() < deadline && remaining.size > 0) {
      for (const jobId of [...remaining]) {
        try {
          const job = await zkWorkerApi.job(jobId);
          if (job.progress) {
            usePaymentSession.getState().updateProgress({
              paymentId: session.paymentId,
              label: `Server settle: ${job.progress}`,
              phase: 'settling',
            });
          }
          if (job.status === 'error') {
            useZer0Store.getState().updatePaymentStatus(session.paymentId, 'failed', {
              lastError: job.error || 'Worker job failed',
            });
            usePaymentSession.getState().failSession(job.error || 'Worker job failed after reload');
            return;
          }
          if (job.status === 'done') {
            remaining.delete(jobId);
            lastTx = job.result?.lastTxHash || lastTx;
          }
        } catch (e) {
          usePaymentSession.getState().updateProgress({
            paymentId: session.paymentId,
            label: `Network blip while checking job… (${e instanceof Error ? e.message : 'retrying'})`,
            phase: 'settling',
          });
        }
      }
      if (remaining.size === 0) break;
      await new Promise(r => setTimeout(r, 1500));
    }

    if (remaining.size === 0 && lastTx) {
      const pay = useZer0Store.getState().payments.find(p => p.id === session.paymentId);
      if (pay && pay.status !== 'completed') {
        useZer0Store.getState().updatePaymentStatus(session.paymentId, 'completed', {
          txHash: lastTx,
          processedAt: Date.now(),
        });
      }
      usePaymentSession.getState().completeSession({
        txHash: lastTx,
        label: 'Payment completed (recovered after reload)',
      });
      return;
    }

    if (remaining.size > 0) {
      usePaymentSession.getState().updateProgress({
        paymentId: session.paymentId,
        label: 'Still waiting on worker jobs… leave this open',
        phase: 'settling',
      });
    }
  };

  void boot();
}
