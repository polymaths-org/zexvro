import { useMemo, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  Send, Shield, ShieldOff, Loader2, ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
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
  const pid = projectId || '';

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

  const selectedEmployee = activeEmployees.find(e => e.id === selectedEmployeeId);
  const recipientName = selectedEmployee?.name || customRecipient;
  const recipientWallet = selectedEmployee?.walletAddress || customWallet;
  const parsedAmount = parseFloat(amount);
  const hasFunds = !isNaN(parsedAmount) && (pool.balances[currency] || 0) >= parsedAmount;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!recipientName) return;
    setStep('review');
  };

  const handleSubmit = () => {
    setIsProcessing(true);

    const payment = createPayment({
      projectId: pid,
      employeeId: selectedEmployeeId || null,
      recipientName,
      recipientWallet,
      amount: parsedAmount,
      currency,
      type: paymentType,
      status: settings.paymentApprovalRequired ? 'pending_approval' : 'approved',
      shielded,
      memo,
    });

    // Process immediately if no approval required
    if (!settings.paymentApprovalRequired) {
      processPayment(payment.id);
    }

    setCreatedPaymentId(payment.id);

    setTimeout(() => {
      setIsProcessing(false);
      setStep('done');
    }, shielded ? 2500 : 1000);
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Pay a Party</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Create a new payment — select a team member or enter a custom recipient.
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
              <input required type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value as Zer0Currency)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                <option value="USDC">USDC</option><option value="XLM">XLM</option><option value="EURC">EURC</option>
              </select>
            </div>
          </div>

          {/* Balance indicator */}
          {amount && (
            <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${hasFunds ? 'text-emerald-600' : 'text-red-500'}`}>
              {hasFunds ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              Pool balance: {(pool.balances[currency] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
              {!hasFunds && ' — Insufficient funds. Deposit more to pool first.'}
            </div>
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
                <span className="text-[10px] text-zinc-400">{shielded ? 'Amount and recipient hidden on public ledger' : 'Visible on public ledger'}</span>
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
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {shielded ? 'Generating ZK Proof…' : 'Processing…'}</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Confirm & Send</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* DONE STEP */}
      {step === 'done' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-[#0A0A0B] text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Payment {settings.paymentApprovalRequired ? 'Submitted for Approval' : 'Sent Successfully'}</h2>
          <p className="text-xs text-zinc-500">
            {parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency} to {recipientName}
            {shielded && ' — ZK proof generated and verified.'}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={handleReset}
              className="h-9 px-4 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition">
              New Payment
            </button>
            <button onClick={() => navigate({ to: `/dashboard/w/${workspaceId}/p/${projectId}/zer0/history` as any })}
              className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition">
              View History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
