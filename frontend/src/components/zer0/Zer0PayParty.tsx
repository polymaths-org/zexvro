import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  Send, Shield, ShieldOff, Loader2, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Copy, Check, Eye, Lock
} from 'lucide-react';
import { getExplorerTxUrl, truncateKey } from '../../api/walletConnect';
import { useZer0Store } from '../../stores/zer0';
import { stellar, payrollApi } from '../../api/api';
import { DENOMINATION_XLM, estimateFreighterPrompts, isAutoSignEnabled } from '../../api/privacyPool';
import { copyText } from '../../lib/clipboard';
import type { Zer0Currency, Zer0PaymentType } from '../../stores/types';

const PAYMENT_TYPES: { value: Zer0PaymentType; label: string; desc: string }[] = [
  { value: 'payroll', label: 'Payroll', desc: 'Regular salary or wage payment' },
  { value: 'contractor', label: 'Contractor', desc: 'Independent contractor invoice' },
  { value: 'bonus', label: 'Bonus', desc: 'One-time performance bonus' },
  { value: 'reimbursement', label: 'Reimbursement', desc: 'Expense reimbursement' },
  { value: 'one-time', label: 'One-Time Transfer', desc: 'Ad-hoc payment to any party' },
];

export default function Zer0PayParty() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const pid = projectId || workspaceId || '';

  const allEmployees = useZer0Store(s => s.employees);
  const pool = useZer0Store(s => s.pool);
  const settings = useZer0Store(s => s.settings);
  const createPayment = useZer0Store(s => s.createPayment);
  const processPayment = useZer0Store(s => s.processPayment);

  const employees = useMemo(() => allEmployees.filter(e => e.projectId === pid), [allEmployees, pid]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const [step, setStep] = useState<'form' | 'review' | 'done'>('form');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [customWallet, setCustomWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Zer0Currency>(settings.defaultCurrency);
  const [paymentType, setPaymentType] = useState<Zer0PaymentType>('payroll');
  const [memo, setMemo] = useState('');
  const [shielded, setShielded] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);

  const fundFromFaucet = async () => {
    setIsFunding(true);
    try {
      if (settings.walletAddress && settings.walletAddress.trim()) {
        await fetch(`https://friendbot.stellar.org/?addr=${settings.walletAddress.trim()}`);
        const balances = await stellar.getPoolBalance(settings.walletAddress.trim(), settings.horizonUrl);
        useZer0Store.setState(state => ({
          pool: {
            ...state.pool,
            balances: {
              USDC: Number.isFinite(Number(balances.USDC)) ? Number(balances.USDC) : state.pool.balances.USDC,
              XLM: Number.isFinite(Number(balances.XLM)) ? Number(balances.XLM) : state.pool.balances.XLM,
              EURC: Number.isFinite(Number(balances.EURC)) ? Number(balances.EURC) : state.pool.balances.EURC,
            },
            lastUpdated: Date.now(),
          },
        }));
      } else {
        useZer0Store.setState(state => ({
          pool: {
            ...state.pool,
            balances: {
              ...state.pool.balances,
              [currency]: (state.pool.balances[currency] || 0) + 10000,
            },
            lastUpdated: Date.now(),
          },
        }));
      }
      setFundingSuccess(true);
      setTimeout(() => setFundingSuccess(false), 3000);
    } catch (e) {
      console.error('Faucet funding failed:', e);
    } finally {
      setIsFunding(false);
    }
  };

  // Pull balance from Horizon on mount / wallet change — only update if Horizon has funds
  useEffect(() => {
    const autoRefresh = async () => {
      if (settings.walletAddress && settings.walletAddress.trim()) {
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
          }
        } catch (err) {
          console.error('Failed to auto-refresh pool balance in PayParty:', err);
        }
      }
    };
    autoRefresh();
  }, [settings.walletAddress, settings.horizonUrl]);

  const selectedEmployee = activeEmployees.find(e => e.id === selectedEmployeeId);
  const recipientName = selectedEmployee?.name || customRecipient;
  const recipientWallet = selectedEmployee?.walletAddress || customWallet;
  // Free-form amount → ceil to 1 XLM ZK units. Multi-unit: 1 bulk fund + N deposits + N withdraws.
  const typedAmount = parseFloat(amount);
  const shieldedUnits = (!isNaN(typedAmount) && typedAmount > 0)
    ? Math.max(1, Math.min(50, Math.ceil(typedAmount / DENOMINATION_XLM)))
    : 0;
  const shieldedOnChainXlm = shieldedUnits * DENOMINATION_XLM;
  const freighterPrompts = estimateFreighterPrompts(shieldedUnits || 1);
  const parsedAmount = typedAmount;
  const needBalance = shielded
    ? (isNaN(typedAmount) || typedAmount <= 0 ? 0 : shieldedOnChainXlm)
    : (isNaN(typedAmount) ? 0 : typedAmount);
  const hasFunds = !isNaN(typedAmount) && typedAmount > 0
    && (pool.balances[shielded ? 'XLM' : currency] || 0) >= needBalance;

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!recipientName) return;
    setStep('review');
  };

  const handleSubmit = async () => {
    setIsProcessing(true);

    if (!shielded && !settings.allowTransparentPayments) {
      setIsProcessing(false);
      alert('Public transfers are disabled. Enable them in Settings or use private payroll.');
      return;
    }

    const needsApproval =
      settings.paymentApprovalRequired
      || (settings.enforceThresholdApproval && parsedAmount >= (settings.complianceThreshold || 0));

    // Books keep the amount you typed; chain settles ceil(amount / unit) units
    const settleAmount = shielded ? shieldedOnChainXlm : parsedAmount;
    const payment = createPayment({
      projectId: pid,
      employeeId: selectedEmployeeId || null,
      recipientName,
      recipientWallet,
      amount: settleAmount,
      currency: shielded ? 'XLM' : currency,
      type: paymentType,
      status: needsApproval ? 'pending_approval' : 'approved',
      shielded,
      memo: shielded ? '' : memo,
      lastError: needsApproval
        ? (settings.paymentApprovalRequired
          ? 'Awaiting manager approval'
          : `Above review threshold (${settings.complianceThreshold})`)
        : null,
    });

    // Always persist a payroll run so Payment ledger survives reload
    try {
      await payrollApi.createRun({
        workspaceId: workspaceId || pid,
        runId: payment.id,
        projectId: pid,
        type: payment.type,
        lineItems: [{
          employeeId: payment.employeeId || 'ad_hoc',
          name: payment.recipientName,
          email: '',
          amount: payment.amount,
          currency: payment.currency,
          walletAddress: payment.recipientWallet,
          status: needsApproval ? 'pending_approval' : 'processing',
          shielded: payment.shielded,
          projectId: pid,
          type: payment.type,
          memo: payment.memo || '',
        }],
        totalAmount: payment.amount,
        status: needsApproval ? 'pending_approval' : 'processing',
        memo: payment.memo || '',
      });
    } catch (e) {
      console.error('Failed to create payroll run in backend:', e);
    }

    if (!needsApproval) {
      try {
        await processPayment(payment.id);
      } catch (e) {
        console.error('processPayment threw unexpectedly:', e);
      }
    }

    setCreatedPaymentId(payment.id);
    setIsProcessing(false);
    setStep('done');
  };

  const handleReset = () => {
    setStep('form');
    setSelectedEmployeeId('');
    setCustomRecipient('');
    setCustomWallet('');
    setAmount('');
    setMemo('');
    setCreatedPaymentId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Send payment</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Pay a team member or outside party. Private mode routes funds through the shared pool in fixed units.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        {['Details', 'Review', 'Done'].map((label, i) => {
          const stepIdx = i;
          const currentIdx = step === 'form' ? 0 : step === 'review' ? 1 : 2;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-700" />}
              <span className={stepIdx <= currentIdx ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* FORM STEP */}
      {step === 'form' && (
        <form onSubmit={handleReview} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B] space-y-5">
          {/* Recipient */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2 block">Recipient</label>
            <select
              value={selectedEmployeeId}
              onChange={e => {
                setSelectedEmployeeId(e.target.value);
                if (e.target.value) {
                  const emp = activeEmployees.find(emp => emp.id === e.target.value);
                  if (emp) {
                    setAmount(emp.salary.toString());
                    setCurrency(emp.currency);
                  }
                }
              }}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Custom recipient (enter below)</option>
              {activeEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.department} ({e.salary} {e.currency}/{e.frequency})</option>
              ))}
            </select>
          </div>

          {!selectedEmployeeId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Recipient Name *</label>
                <input required={!selectedEmployeeId} value={customRecipient} onChange={e => setCustomRecipient(e.target.value)}
                  placeholder="John Doe"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Wallet Address</label>
                <input value={customWallet} onChange={e => setCustomWallet(e.target.value)}
                  placeholder="G... or 0x..."
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
            </div>
          )}

          {/* Payment Type */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2 block">Payment Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPaymentType(pt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    paymentType === pt.value
                      ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{pt.label}</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{pt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Amount *</label>
              <input required type="number" step="0.01" min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 2477.27"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              {shielded && !isNaN(typedAmount) && typedAmount > 0 && (
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  ZK pays <strong className="text-zinc-800 dark:text-zinc-200">{shieldedOnChainXlm.toLocaleString()} XLM</strong>
                  {' '}({shieldedUnits}×{DENOMINATION_XLM} unit{shieldedUnits === 1 ? '' : 's'})
                  {shieldedOnChainXlm > typedAmount && (
                    <span className="text-amber-600 dark:text-amber-400"> · rounded up from {typedAmount}</span>
                  )}
                  {isAutoSignEnabled()
                    ? ' · treasury auto-sign (no Freighter popups)'
                    : ` · ~${freighterPrompts} Freighter confirms (1 bulk fund + deposit/withdraw per unit)`}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Currency</label>
              <select
                value={shielded ? 'XLM' : currency}
                disabled={shielded}
                onChange={e => setCurrency(e.target.value as Zer0Currency)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-70">
                <option value="USDC">USDC</option><option value="XLM">XLM</option><option value="EURC">EURC</option>
              </select>
            </div>
          </div>

          {/* Balance indicator */}
          {amount && (
            hasFunds ? (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Funding wallet: {(pool.balances[shielded ? 'XLM' : currency] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {shielded ? 'XLM' : currency}
                {shielded && ` · will move ${shieldedOnChainXlm.toLocaleString()} XLM on-chain`}
              </div>
            ) : (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[11px] uppercase tracking-wider text-red-700 dark:text-red-300">Insufficient balance</span>
                    <span className="text-zinc-600 dark:text-zinc-300 text-[11px] block mt-0.5 font-normal">
                      Wallet has {(pool.balances[shielded ? 'XLM' : currency] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {shielded ? 'XLM' : currency}.
                      Needs {needBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {shielded ? 'XLM' : currency}.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fundFromFaucet}
                  disabled={isFunding}
                  className="shrink-0 h-8 px-3 rounded bg-red-600/90 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5 text-[11px] shadow-sm hover:shadow active:scale-[0.98]"
                >
                  {isFunding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Refilling...
                    </>
                  ) : fundingSuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Refilled!
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 rotate-45" />
                      {settings.walletAddress ? 'Refill Pool' : 'Add Mock Funds'}
                    </>
                  )}
                </button>
              </div>
            )
          )}

          {/* Memo */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Memo / Reference</label>
            <input value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="e.g. July 2026 salary, Bug bounty #42"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2">
              {shielded ? <Shield className="h-4 w-4 text-blue-500" /> : <ShieldOff className="h-4 w-4 text-zinc-400" />}
              <div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{shielded ? 'Shielded Payment' : 'Transparent Payment'}</span>
                <span className="text-[10px] text-zinc-400">{shielded
                  ? (isAutoSignEnabled()
                    ? 'Private payroll · auto-sign (enter any amount)'
                    : 'Private payroll · enter any amount (split into pool units)')
                  : 'Direct transfer — amount and parties fully public'}</span>
              </div>
            </div>
            <button type="button" onClick={() => setShielded(!shielded)}
              className={`relative h-5 w-9 rounded-full transition-colors ${shielded ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${shielded ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!recipientName || !amount || !hasFunds}
            className="w-full h-10 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            Review Payment <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      {/* REVIEW STEP */}
      {step === 'review' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B] space-y-5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Review Payment</h2>

          <div className="space-y-3">
            {[
              { label: 'Recipient', value: recipientName },
              { label: 'Wallet', value: recipientWallet || 'Not provided' },
              { label: 'Amount', value: `${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}` },
              { label: 'Type', value: paymentType.replace('-', ' ') },
              { label: 'Memo', value: memo || '—' },
              { label: 'Privacy', value: shielded ? '🛡️ Shielded (ZK Proof)' : 'Transparent' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-xs text-zinc-500">{row.label}</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep('form')}
              className="flex-1 h-10 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition">
              Back
            </button>
            <button onClick={handleSubmit} disabled={isProcessing}
              className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
              {isProcessing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Queueing…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Confirm & Send</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* DONE STEP — Full Receipt */}
      {step === 'done' && (
        <PaymentReceipt
          paymentId={createdPaymentId}
          recipientName={recipientName}
          amount={parsedAmount}
          currency={currency}
          shielded={shielded}
          memo={memo}
          network={settings.horizonUrl.includes('testnet') ? 'testnet' : 'public'}
          onNewPayment={handleReset}
          onViewHistory={() => navigate({ to: `${projectId ? `/dashboard/w/${workspaceId}/p/${projectId}` : `/dashboard/w/${workspaceId}`}/zer0/history` as any })}
        />
      )}
    </div>
  );
}

/* ─── Payment Receipt Component ─── */
function PaymentReceipt({ paymentId, recipientName, amount, currency, shielded, memo, network, onNewPayment, onViewHistory }: {
  paymentId: string | null;
  recipientName: string;
  amount: number;
  currency: string;
  shielded: boolean;
  memo: string;
  network: 'testnet' | 'public';
  onNewPayment: () => void;
  onViewHistory: () => void;
}) {
  const payment = useZer0Store(s => s.payments.find(p => p.id === paymentId));
  const proof = useZer0Store(s => payment?.proofId ? s.proofs.find(p => p.id === payment.proofId) : null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      const ok = await copyText(text);
      if (ok) {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
        return;
      }
    } catch {
      // ignore
    }
    try {
      window.prompt('Copy this value (Ctrl/Cmd+C):', text);
    } catch {
      // ignore — copy unavailable in this context
    }
  };

  const status = payment?.status || 'processing';
  const txHash = payment?.txHash || null;
  const stellarNet = network === 'testnet' ? 'TESTNET' as const : 'PUBLIC' as const;
  const onChainAmount = payment?.amount ?? amount;
  const onChainCurrency = shielded ? 'XLM' : currency;
  const recipientWallet = payment?.recipientWallet || '';

  const statusConfig = {
    processing: { label: 'Processing…', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> },
    completed: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
    failed: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10', icon: <AlertCircle className="h-5 w-5 text-red-500" /> },
    pending_approval: { label: 'Pending Approval', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Loader2 className="h-5 w-5 text-blue-500" /> },
    approved: { label: 'Approved', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <CheckCircle2 className="h-5 w-5 text-blue-500" /> },
  };
  const sc = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-6 py-4 ${sc.bg}`}>
        {sc.icon}
        <div>
          <h2 className={`text-sm font-bold ${sc.color}`}>{sc.label}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {onChainAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {onChainCurrency} → {recipientName}
            {network === 'testnet' && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">(Stellar Testnet)</span>}
          </p>
        </div>
      </div>

      {/* Receipt Details */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {shielded && status === 'completed' && (
          <div className="px-6 py-3 bg-blue-500/5 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Private pool paid <strong className="text-zinc-800 dark:text-zinc-200">{onChainAmount} XLM</strong> in fixed units (testnet).
            Friend must use <strong>Stellar Testnet</strong> for the wallet below.
          </div>
        )}
        {recipientWallet && (
          <div className="flex items-center justify-between px-6 py-3 gap-3">
            <span className="text-[11px] font-medium text-zinc-500 shrink-0">Paid to wallet</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] text-zinc-800 dark:text-zinc-200 truncate">{recipientWallet}</span>
              <button onClick={() => copyToClipboard(recipientWallet, 'wallet')} className="p-0.5 text-zinc-400 hover:text-zinc-600 shrink-0">
                {copiedField === 'wallet' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}
        {/* TX Hash */}
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-[11px] font-medium text-zinc-500">TX Hash</span>
          {txHash ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{truncateKey(txHash, 8, 6)}</span>
              <button onClick={() => copyToClipboard(txHash, 'tx')} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                {copiedField === 'tx' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
              <a href={getExplorerTxUrl(txHash, stellarNet)} target="_blank" rel="noreferrer" className="p-0.5 text-blue-500 hover:text-blue-600">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400 italic">Generating…</span>
          )}
        </div>

        {/* Proof Info (shielded only) */}
        {shielded && (
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-[11px] font-medium text-zinc-500">ZK Proof</span>
            {proof ? (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  proof.status === 'verified' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  proof.status === 'generating' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  proof.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                  'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                }`}>
                  {proof.status === 'generating' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                  {proof.status}
                </span>
                {proof.proofData && (
                  <>
                    <span className="font-mono text-[10px] text-zinc-500">{truncateKey(proof.proofData, 6, 4)}</span>
                    <button onClick={() => copyToClipboard(proof.proofData!, 'proof')} className="p-0.5 text-zinc-400 hover:text-zinc-600">
                      {copiedField === 'proof' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-zinc-400 italic">Queued…</span>
            )}
          </div>
        )}

        {status === 'failed' && payment?.lastError && (
          <div className="flex items-start justify-between px-6 py-3">
            <span className="text-[11px] font-medium text-red-500">Error</span>
            <span className="text-[10px] text-red-500 font-mono max-w-[260px] text-right break-all">{payment.lastError}</span>
          </div>
        )}

        {/* Privacy */}
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-[11px] font-medium text-zinc-500">Privacy</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
            {shielded ? (
              <><Lock className="h-3 w-3 text-violet-500" /> <span className="text-violet-600 dark:text-violet-400">Shielded</span></>
            ) : (
              <><Eye className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">Transparent</span></>
            )}
          </span>
        </div>

        {memo && (
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-[11px] font-medium text-zinc-500">Memo</span>
            <span className="text-[11px] text-zinc-700 dark:text-zinc-300">{memo}</span>
          </div>
        )}

        {proof?.generationTimeMs && (
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-[11px] font-medium text-zinc-500">Proof Generation</span>
            <span className="text-[11px] text-zinc-700 dark:text-zinc-300">{(proof.generationTimeMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      {/* Explorer Link */}
      {txHash && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-3">
          <a
            href={getExplorerTxUrl(txHash, stellarNet)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Stellar Explorer →
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-4 flex gap-2">
        <button onClick={onNewPayment}
          className="flex-1 h-9 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition">
          New Payment
        </button>
        <button onClick={onViewHistory}
          className="flex-1 h-9 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition">
          View History
        </button>
      </div>
    </div>
  );
}
