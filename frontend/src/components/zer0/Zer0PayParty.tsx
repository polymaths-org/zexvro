import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  Send, Shield, ShieldOff, Loader2, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Copy, Check, Eye, Lock, Ghost, Plus, Search, UserPlus, Wallet,
} from 'lucide-react';
import { getExplorerTxUrl, truncateKey } from '../../api/walletConnect';
import { useZer0Store } from '../../stores/zer0';
import { stellar, payrollApi, employeeApi } from '../../api/api';
import {
  estimateFreighterPromptsForAmount, isAutoSignEnabled,
  MAX_SHIELD_UNITS, planShieldPay,
} from '../../api/privacyPool';
import { copyText } from '../../lib/clipboard';
import { useStealthStore } from '../../stores/stealth';
import { generateStealthIdentity, isStealthMetaAddress, shortAddr } from '../../lib/stealth';
import type { Zer0Currency, Zer0PaymentType, Zer0Employee } from '../../stores/types';

const PAYMENT_TYPES: { value: Zer0PaymentType; label: string; desc: string }[] = [
  { value: 'payroll', label: 'Payroll', desc: 'Regular salary or wage payment' },
  { value: 'contractor', label: 'Contractor', desc: 'Independent contractor invoice' },
  { value: 'bonus', label: 'Bonus', desc: 'One-time performance bonus' },
  { value: 'reimbursement', label: 'Reimbursement', desc: 'Expense reimbursement' },
  { value: 'one-time', label: 'One-time transfer', desc: 'Ad-hoc payment to any party' },
];

function contactTagOf(emp: Zer0Employee): string {
  if (emp.contactTag === 'other' && emp.customTag) return emp.customTag;
  if (emp.contactTag) return emp.contactTag;
  return emp.role || 'contact';
}

export default function Zer0PayParty() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const pid = projectId || workspaceId || '';

  const allEmployees = useZer0Store(s => s.employees);
  const pool = useZer0Store(s => s.pool);
  const settings = useZer0Store(s => s.settings);
  const createPayment = useZer0Store(s => s.createPayment);
  const processPayment = useZer0Store(s => s.processPayment);
  const updateSettings = useZer0Store(s => s.updateSettings);
  const updateEmployee = useZer0Store(s => s.updateEmployee);

  const employees = useMemo(() => allEmployees.filter(e => e.projectId === pid), [allEmployees, pid]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  /** 1 recipients → 2 details → 3 review → 4 done */
  const [step, setStep] = useState<'recipients' | 'details' | 'review' | 'done'>('recipients');
  /** Multi-select from wallets directory */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** When true, pay a wallet not yet in the directory */
  const [newWalletMode, setNewWalletMode] = useState(false);
  const [payeeSearch, setPayeeSearch] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [customWallet, setCustomWallet] = useState('');
  const [customStealthMeta, setCustomStealthMeta] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Zer0Currency>(settings.defaultCurrency || 'XLM');
  const [paymentType, setPaymentType] = useState<Zer0PaymentType>('one-time');
  const [memo, setMemo] = useState('');
  const [shielded, setShielded] = useState(true);
  /** Per-payment stealth — does NOT rewrite workspace settings */
  const [useStealth, setUseStealth] = useState(!!settings.stealthPaymentsEnabled);
  const [showPrivacyMore, setShowPrivacyMore] = useState(false);
  /** Per-payment privacy knobs (seeded from workspace settings) */
  const [payDelaySec, setPayDelaySec] = useState(settings.privacyDelaySec || 0);
  const [payJitterSec, setPayJitterSec] = useState(settings.privacyJitterSec || 0);
  const [payDecoyOn, setPayDecoyOn] = useState(!!settings.decoyDepositsEnabled);
  const [payDecoyCount, setPayDecoyCount] = useState(settings.decoyDepositCount || 0);
  const [payBatch, setPayBatch] = useState(!!settings.batchDepositThenWithdraw);
  const [payPostDecoy, setPayPostDecoy] = useState(!!settings.postPayDecoyEnabled);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const [stealthSetupBusy, setStealthSetupBusy] = useState(false);
  const [stealthSetupMsg, setStealthSetupMsg] = useState('');

  // Keep currency default in sync after settings rehydrate / save
  useEffect(() => {
    if (settings.defaultCurrency) {
      setCurrency(settings.defaultCurrency);
    }
  }, [settings.defaultCurrency]);

  // Seed stealth + privacy knobs from workspace when settings hydrate (only before user edits)
  useEffect(() => {
    setUseStealth(!!settings.stealthPaymentsEnabled);
    setPayDelaySec(settings.privacyDelaySec || 0);
    setPayJitterSec(settings.privacyJitterSec || 0);
    setPayDecoyOn(!!settings.decoyDepositsEnabled);
    setPayDecoyCount(settings.decoyDepositCount || 0);
    setPayBatch(!!settings.batchDepositThenWithdraw);
    setPayPostDecoy(!!settings.postPayDecoyEnabled);
  }, [
    settings.stealthPaymentsEnabled,
    settings.privacyDelaySec,
    settings.privacyJitterSec,
    settings.decoyDepositsEnabled,
    settings.decoyDepositCount,
    settings.batchDepositThenWithdraw,
    settings.postPayDecoyEnabled,
  ]);

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

  const employeeMetaMap = useStealthStore(s => s.employeeMeta);
  const setEmployeeMeta = useStealthStore(s => s.setEmployeeMeta);
  const importIdentity = useStealthStore(s => s.importIdentity);

  const filteredPayees = useMemo(() => {
    const q = payeeSearch.trim().toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(e => {
      const tag = contactTagOf(e).toLowerCase();
      return (
        e.name.toLowerCase().includes(q)
        || (e.email || '').toLowerCase().includes(q)
        || (e.walletAddress || '').toLowerCase().includes(q)
        || tag.includes(q)
      );
    });
  }, [activeEmployees, payeeSearch]);

  const selectedEmployees = useMemo(
    () => activeEmployees.filter(e => selectedIds.includes(e.id)),
    [activeEmployees, selectedIds],
  );

  // Primary recipient (first selected, or new-wallet fields)
  const selectedEmployee = !newWalletMode && selectedEmployees[0] ? selectedEmployees[0] : null;
  const selectedEmployeeId = selectedEmployee?.id || '';
  const recipientName = newWalletMode
    ? customRecipient
    : (selectedEmployees.length === 1
      ? selectedEmployees[0].name
      : selectedEmployees.length > 1
        ? `${selectedEmployees.length} recipients`
        : '');
  const recipientWallet = newWalletMode
    ? customWallet
    : (selectedEmployee?.walletAddress || '');
  const recipientStealthMeta = (
    newWalletMode
      ? customStealthMeta
      : (selectedEmployee?.stealthMetaAddress
        || (selectedEmployeeId ? employeeMetaMap[selectedEmployeeId] : '')
        || '')
  ).trim();
  const hasValidStealthMeta = !!(recipientStealthMeta && isStealthMetaAddress(recipientStealthMeta));
  const canUseStealth = !!(
    useStealth
    && shielded
    && hasValidStealthMeta
  );

  const togglePayee = (id: string) => {
    setNewWalletMode(false);
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
    const emp = activeEmployees.find(e => e.id === id);
    if (emp && emp.salary > 0 && !amount) {
      setAmount(String(emp.salary));
      if (emp.currency) setCurrency(emp.currency);
    }
  };

  const enterNewWalletMode = () => {
    setNewWalletMode(true);
    setSelectedIds([]);
    setPayeeSearch('');
  };

  const settleCurrency: Zer0Currency = shielded ? 'XLM' : currency;

  const enableStealthForPayee = async () => {
    setStealthSetupMsg('');
    setStealthSetupBusy(true);
    try {
      // Per-payment only — do not force workspace stealth on
      setUseStealth(true);
      setShielded(true);

      if (selectedEmployeeId && selectedEmployee) {
        if (hasValidStealthMeta) {
          setStealthSetupMsg('Stealth already ready for this payee.');
          return;
        }
        const identity = generateStealthIdentity(selectedEmployee.name || 'Team member');
        importIdentity(identity);
        setEmployeeMeta(selectedEmployeeId, identity.metaAddress);
        updateEmployee(selectedEmployeeId, { stealthMetaAddress: identity.metaAddress });
        try {
          await employeeApi.update(selectedEmployeeId, {
            workspaceId: workspaceId || pid,
            stealthMetaAddress: identity.metaAddress,
          });
        } catch (e) {
          // Local store still has meta — backend optional
          console.warn('Could not persist stealth meta to API', e);
        }
        // Copy backup for payee in one click
        const backup = JSON.stringify({
          v: 1,
          label: identity.label,
          metaAddress: identity.metaAddress,
          scanSecretHex: identity.scanSecretHex,
          spendSecretHex: identity.spendSecretHex,
          spendPublicHex: identity.spendPublicHex,
          scanPublicHex: identity.scanPublicHex,
          createdAt: identity.createdAt,
        }, null, 2);
        await copyText(backup);
        setStealthSetupMsg(`Stealth ready · ${shortAddr(identity.metaAddress, 8)} · scan backup copied`);
      } else {
        // Custom recipient: generate meta they can share later
        const identity = generateStealthIdentity(customRecipient || 'Payee');
        importIdentity(identity);
        setCustomStealthMeta(identity.metaAddress);
        const backup = JSON.stringify({
          v: 1,
          label: identity.label,
          metaAddress: identity.metaAddress,
          scanSecretHex: identity.scanSecretHex,
          spendSecretHex: identity.spendSecretHex,
          spendPublicHex: identity.spendPublicHex,
          scanPublicHex: identity.scanPublicHex,
          createdAt: identity.createdAt,
        }, null, 2);
        await copyText(backup);
        setStealthSetupMsg(`Stealth meta set · ${shortAddr(identity.metaAddress, 8)} · scan backup copied for payee`);
      }
    } catch (e) {
      setStealthSetupMsg(e instanceof Error ? e.message : 'Could not set up stealth');
    } finally {
      setStealthSetupBusy(false);
    }
  };
  // Free-form amount → multi-denom plan (1000/100/10/1 XLM notes) for few ZK proofs.
  const typedAmount = parseFloat(amount);
  const shieldPlan = (!isNaN(typedAmount) && typedAmount > 0)
    ? planShieldPay(typedAmount)
    : null;
  const shieldedUnits = shieldPlan?.totalNotes || 0;
  const shieldedOnChainXlm = shieldPlan?.settledXlm || 0;
  const freighterPrompts = estimateFreighterPromptsForAmount(typedAmount || 0);
  const parsedAmount = typedAmount;
  const needBalance = shielded
    ? (isNaN(typedAmount) || typedAmount <= 0 ? 0 : shieldedOnChainXlm)
    : (isNaN(typedAmount) ? 0 : typedAmount);
  const hasFunds = !isNaN(typedAmount) && typedAmount > 0
    && (pool.balances[shielded ? 'XLM' : currency] || 0) >= needBalance;

  const recipientsReady = newWalletMode
    ? !!customRecipient.trim() && (!!customWallet.trim() || !!customStealthMeta.trim())
    : selectedIds.length > 0;

  const handleRecipientsNext = () => {
    if (newWalletMode) {
      if (!customRecipient.trim()) {
        alert('Enter a recipient name.');
        return;
      }
      if (!customWallet.trim() && !customStealthMeta.trim()) {
        alert('Enter a wallet address (G…), or a stealth meta later on the details step.');
        // Still allow continuing with name only — wallet can be filled / stealth on details
      }
      if (customWallet.trim() && !/^G[A-Z2-7]{55}$/.test(customWallet.trim())) {
        alert('Wallet must be a valid Stellar public key (G…, 56 characters).');
        return;
      }
    } else if (selectedIds.length === 0) {
      alert('Select at least one person from Wallets directory, or use “Send to new wallet”.');
      return;
    }
    setStep('details');
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Enter a valid amount greater than 0.');
      return;
    }
    if (!recipientsReady && !newWalletMode) {
      alert('Go back and select recipients first.');
      setStep('recipients');
      return;
    }
    if (newWalletMode && !customRecipient.trim()) {
      alert('Recipient name is required.');
      setStep('recipients');
      return;
    }
    setStep('review');
  };

  const handleSubmit = async () => {
    setIsProcessing(true);

    try {
      if (!shielded && !settings.allowTransparentPayments) {
        alert('Public transfers are disabled. Enable them in Settings or use private payroll.');
        return;
      }

      // Stealth is per-payment only (do not rewrite workspace stealth setting here)

      const fundingWallet = (settings.walletAddress || '').trim();
      if (!fundingWallet) {
        alert('Connect a funding wallet first (Payroll → Settings → Wallet).');
        return;
      }
      if (!/^G[A-Z2-7]{55}$/.test(fundingWallet)) {
        alert('Funding wallet address is invalid. It must start with G and be 56 characters.');
        return;
      }

      if (shielded && useStealth && !hasValidStealthMeta && !recipientWallet?.trim()) {
        alert('Stealth is on but this payee has no meta-address and no G… wallet. Use one-click stealth setup or add a wallet.');
        return;
      }

      if (!shielded && !recipientWallet?.trim()) {
        alert('Public pays need a recipient G… wallet.');
        return;
      }

      if (recipientWallet?.trim() && !/^G[A-Z2-7]{55}$/.test(recipientWallet.trim())) {
        alert('Recipient wallet is invalid. Stellar addresses start with G and are 56 characters.');
        return;
      }

      if (shielded && !useStealth && !recipientWallet?.trim()) {
        alert('Private pay without stealth needs a recipient G… wallet (or turn stealth on and set a meta-address).');
        return;
      }

      // Live Horizon pre-read before creating the payment row
      try {
        const funder = await stellar.getPoolBalance(fundingWallet, settings.horizonUrl);
        const need = shielded
          ? (shieldedOnChainXlm || 0)
          : (parsedAmount || 0);
        const have = shielded ? (funder.XLM || 0) : (funder[currency] || 0);
        if (need > 0 && have < need) {
          alert(
            `Not enough ${shielded ? 'XLM' : currency} on the funding wallet.\n`
            + `On-chain: ${have}\nNeed: ${need}\n`
            + (settings.horizonUrl?.includes('testnet') ? 'Tip: use Friendbot / Fund from faucet on testnet.' : 'Top up the wallet and retry.'),
          );
          return;
        }
        // Refresh pool UI so processPayment cache check is not stale
        useZer0Store.setState(state => ({
          pool: {
            ...state.pool,
            balances: {
              USDC: Number(funder.USDC) || 0,
              XLM: Number(funder.XLM) || 0,
              EURC: Number(funder.EURC) || 0,
            },
            lastUpdated: Date.now(),
          },
        }));
      } catch (e: any) {
        alert(`Could not read funding wallet from Stellar: ${e?.message || e}`);
        return;
      }

      const needsApproval =
        settings.paymentApprovalRequired
        || (settings.enforceThresholdApproval && parsedAmount >= (settings.complianceThreshold || 0));

      // Books keep the amount you typed; chain settles ceil(amount / unit) units
      const settleAmount = shielded ? shieldedOnChainXlm : parsedAmount;
      if (!(settleAmount > 0)) {
        alert(shielded
          ? 'Private amount rounds to 0 notes — enter at least 1 XLM.'
          : 'Enter a valid amount greater than 0.');
        return;
      }

      // Build payee list: multi-select directory contacts, or one new wallet
      type Payee = {
        employeeId: string | null;
        name: string;
        wallet: string;
        stealthMeta: string;
      };
      const payees: Payee[] = newWalletMode
        ? [{
            employeeId: null,
            name: customRecipient.trim(),
            wallet: customWallet.trim(),
            stealthMeta: customStealthMeta.trim(),
          }]
        : selectedEmployees.map(emp => ({
            employeeId: emp.id,
            name: emp.name,
            wallet: emp.walletAddress || '',
            stealthMeta: (emp.stealthMetaAddress || employeeMetaMap[emp.id] || '').trim(),
          }));

      if (!payees.length) {
        alert('No recipients selected.');
        return;
      }

      // Validate each payee quickly
      for (const p of payees) {
        const metaOk = !!(p.stealthMeta && isStealthMetaAddress(p.stealthMeta));
        if (shielded && useStealth && !metaOk && !p.wallet) {
          alert(`${p.name}: needs a wallet or stealth meta-address.`);
          return;
        }
        if (!shielded && !p.wallet) {
          alert(`${p.name}: public pays need a G… wallet.`);
          return;
        }
        if (p.wallet && !/^G[A-Z2-7]{55}$/.test(p.wallet)) {
          alert(`${p.name}: invalid wallet (must be G…, 56 chars).`);
          return;
        }
      }

      let lastPaymentId: string | null = null;
      for (const payee of payees) {
        const metaOk = !!(payee.stealthMeta && isStealthMetaAddress(payee.stealthMeta));
        const payment = createPayment({
          projectId: pid,
          employeeId: payee.employeeId,
          recipientName: payee.name,
          recipientWallet: payee.wallet || '',
          // Only attach meta when THIS pay wants stealth
          recipientStealthMeta: (shielded && useStealth && metaOk) ? payee.stealthMeta : null,
          // Authoritative per-payment flag — settle must honor this
          useStealth: !!(shielded && useStealth),
          privacyOverrides: shielded
            ? {
                privacyDelaySec: Math.max(0, payDelaySec || 0),
                privacyJitterSec: Math.max(0, payJitterSec || 0),
                decoyDepositsEnabled: !!payDecoyOn,
                decoyDepositCount: Math.max(0, payDecoyCount || 0),
                batchDepositThenWithdraw: !!payBatch,
                postPayDecoyEnabled: !!payPostDecoy,
              }
            : null,
          amount: settleAmount,
          // Public pays use selected currency; private pool always settles XLM
          currency: settleCurrency,
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
              walletAddress: payment.recipientWallet || (metaOk ? payee.stealthMeta : ''),
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

        lastPaymentId = payment.id;
        if (!needsApproval) {
          try {
            await processPayment(payment.id);
          } catch (e) {
            console.error('processPayment threw unexpectedly:', e);
            alert(e instanceof Error ? e.message : 'Payment failed unexpectedly');
          }
        }
      }

      setCreatedPaymentId(lastPaymentId);
      setStep('done');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('recipients');
    setSelectedIds([]);
    setNewWalletMode(false);
    setPayeeSearch('');
    setCustomRecipient('');
    setCustomWallet('');
    setCustomStealthMeta('');
    setAmount('');
    setCurrency(settings.defaultCurrency || 'XLM');
    setMemo('');
    setStealthSetupMsg('');
    setCreatedPaymentId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Send payment</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          First choose who gets paid, then set amount and privacy options.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        {(['Recipients', 'Details', 'Review', 'Done'] as const).map((label, i) => {
          const order = ['recipients', 'details', 'review', 'done'] as const;
          const currentIdx = order.indexOf(step);
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-700" />}
              <span className={i <= currentIdx ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Recipients only ── */}
      {step === 'recipients' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B] space-y-5">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Who are you paying?</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Select from Wallets directory, or send to a wallet that isn’t saved yet.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setNewWalletMode(false); }}
              className={`rounded-xl border p-4 text-left transition ${
                !newWalletMode
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
              }`}
            >
              <Wallet className={`mb-1.5 h-4 w-4 ${!newWalletMode ? '' : 'text-zinc-400'}`} />
              <p className="text-xs font-bold">From contacts</p>
              <p className={`mt-0.5 text-[10px] ${!newWalletMode ? 'opacity-80' : 'text-zinc-400'}`}>
                Search & check people in Wallets directory
              </p>
            </button>
            <button
              type="button"
              onClick={enterNewWalletMode}
              className={`rounded-xl border p-4 text-left transition ${
                newWalletMode
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
              }`}
            >
              <UserPlus className={`mb-1.5 h-4 w-4 ${newWalletMode ? '' : 'text-zinc-400'}`} />
              <p className="text-xs font-bold">New wallet</p>
              <p className={`mt-0.5 text-[10px] ${newWalletMode ? 'opacity-80' : 'text-zinc-400'}`}>
                Name + G… address — add full profile later
              </p>
            </button>
          </div>

          {!newWalletMode ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={payeeSearch}
                  onChange={e => setPayeeSearch(e.target.value)}
                  placeholder="Search name, email, tag, wallet…"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredPayees.length === 0 ? (
                  <div className="p-8 text-center">
                    <Wallet className="mx-auto mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-xs font-semibold text-zinc-500">No contacts match</p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Add people in Wallets directory, or choose New wallet.
                    </p>
                  </div>
                ) : (
                  filteredPayees.map(emp => {
                    const checked = selectedIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${
                          checked ? 'bg-zinc-50 dark:bg-zinc-900/50' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePayee(emp.id)}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{emp.name}</span>
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              {contactTagOf(emp)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-zinc-400">
                            {emp.email && <span>{emp.email}</span>}
                            {emp.walletAddress && (
                              <span className="font-mono">{shortAddr(emp.walletAddress, 4)}</span>
                            )}
                            {emp.salary > 0 && (
                              <span>{emp.salary} {emp.currency}</span>
                            )}
                          </div>
                        </div>
                        {checked && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
                      </label>
                    );
                  })
                )}
              </div>

              {selectedIds.length > 0 && (
                <p className="text-[11px] text-zinc-500">
                  <strong className="text-zinc-700 dark:text-zinc-200">{selectedIds.length}</strong> selected
                  {selectedIds.length > 1 ? ' · same amount will be sent to each on the next step' : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">New wallet recipient</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">Name *</label>
                  <input
                    value={customRecipient}
                    onChange={e => setCustomRecipient(e.target.value)}
                    placeholder="Recipient name"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">Wallet (G…)</label>
                  <input
                    value={customWallet}
                    onChange={e => setCustomWallet(e.target.value.trim())}
                    placeholder="G…"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>
              <p className="text-[10px] text-zinc-400">
                Optional for now if you’ll use stealth on the next step. You can save this contact later in Wallets directory.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleRecipientsNext}
            disabled={newWalletMode ? !customRecipient.trim() : selectedIds.length === 0}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continue to payment details <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── STEP 2: Payment details ── */}
      {step === 'details' && (
        <form onSubmit={handleReview} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B] space-y-5">
          {/* Selected recipients summary */}
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Paying</p>
              {newWalletMode ? (
                <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-white">
                  {customRecipient || 'New wallet'}
                  {customWallet && (
                    <span className="ml-2 font-mono text-[11px] font-normal text-zinc-500">
                      {shortAddr(customWallet, 4)}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-white">
                  {selectedEmployees.length === 1
                    ? selectedEmployees[0].name
                    : `${selectedEmployees.length} contacts`}
                </p>
              )}
              {!newWalletMode && selectedEmployees.length > 1 && (
                <p className="mt-1 text-[10px] text-zinc-500 line-clamp-2">
                  {selectedEmployees.map(e => e.name).join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStep('recipients')}
              className="shrink-0 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Change recipients
            </button>
          </div>

          {/* Payment Type */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2 block">Payment type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPaymentType(pt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    paymentType === pt.value
                      ? 'border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900/15 dark:border-white dark:bg-white/5 dark:ring-white/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{pt.label}</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{pt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount + currency — currency always choosable; private pays settle as XLM on-chain */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Amount *</label>
              <input required type="number" step="0.01" min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 100"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              {shielded && shieldPlan && shieldPlan.totalNotes > 0 && (
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Private settle moves <strong className="text-zinc-800 dark:text-zinc-200">{shieldedOnChainXlm.toLocaleString()} XLM</strong>
                  {' · '}{shieldPlan.description}
                  {shieldedOnChainXlm > typedAmount && (
                    <span className="text-amber-600 dark:text-amber-400"> · rounded up from {typedAmount}</span>
                  )}
                  {isAutoSignEnabled()
                    ? ' · treasury auto-sign'
                    : ` · ~${freighterPrompts} Freighter confirms`}
                </p>
              )}
              {shielded && (
                <p className="mt-1 text-[10px] text-zinc-400">
                  Currency selector is for books / public mode. Private pool always settles in XLM.
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Zer0Currency)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                <option value="XLM">XLM</option>
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
              </select>
              {shielded && currency !== 'XLM' && (
                <p className="mt-1 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                  On-chain: XLM
                </p>
              )}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="flex items-center gap-2">
                {shielded ? <Shield className="h-4 w-4 text-blue-500" /> : <ShieldOff className="h-4 w-4 text-zinc-400" />}
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{shielded ? 'Shielded Payment' : 'Transparent Payment'}</span>
                  <span className="text-[10px] text-zinc-400">{shielded
                    ? (isAutoSignEnabled()
                      ? 'Private · auto-sign · multi-pool ZK notes'
                      : 'Private · multi-pool ZK notes (slow without auto-sign)')
                    : 'Direct transfer — amount and parties fully public'}</span>
                </div>
              </div>
              <button type="button" onClick={() => setShielded(!shielded)}
                className={`relative h-5 w-9 rounded-full transition-colors ${shielded ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${shielded ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Stealth — nested under shield so it is obvious and one-click */}
            {shielded && (
              <div className={`rounded-lg border p-3 space-y-2.5 ${
                canUseStealth
                  ? 'border-violet-500/30 bg-violet-500/5'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/40'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <Ghost className={`h-4 w-4 shrink-0 mt-0.5 ${canUseStealth ? 'text-violet-500' : 'text-zinc-400'}`} />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Stealth one-time receive
                      </span>
                      <span className="text-[10px] text-zinc-500 leading-relaxed block mt-0.5">
                        {canUseStealth
                          ? <>Withdraw to a fresh G… from <span className="font-mono">{shortAddr(recipientStealthMeta, 8)}</span> — not the long-term wallet.</>
                          : 'Hide the payee’s long-term wallet. One click generates a meta-address for this payee.'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !useStealth;
                      setUseStealth(next);
                      // Per-payment only — does NOT change Settings → stealth default
                      if (next && !hasValidStealthMeta) {
                        void enableStealthForPayee();
                      }
                    }}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${
                      useStealth ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                    title={useStealth ? 'Disable stealth for this payment' : 'Enable stealth for this payment'}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useStealth ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {useStealth && !hasValidStealthMeta && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void enableStealthForPayee()}
                      disabled={stealthSetupBusy}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-500 disabled:opacity-50 transition"
                    >
                      {stealthSetupBusy ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Setting up…</>
                      ) : (
                        <><Plus className="h-3.5 w-3.5" /> One-click stealth setup</>
                      )}
                    </button>
                    {(newWalletMode || !selectedEmployeeId) && (
                      <input
                        value={customStealthMeta}
                        onChange={e => setCustomStealthMeta(e.target.value)}
                        placeholder="or paste z0st1… meta"
                        className="h-8 flex-1 min-w-0 rounded-md border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-zinc-950 px-2 text-[11px] font-mono outline-none"
                      />
                    )}
                  </div>
                )}

                {stealthSetupMsg && (
                  <p className="text-[10px] font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {stealthSetupMsg}
                  </p>
                )}

                {useStealth && hasValidStealthMeta && (
                  <p className="text-[10px] text-violet-700/90 dark:text-violet-300/90 leading-relaxed">
                    Ready · meta <span className="font-mono">{shortAddr(recipientStealthMeta, 10)}</span>
                    {recipientWallet ? ' · long-term wallet kept as fallback only' : ' · no long-term wallet needed'}
                  </p>
                )}
                {!useStealth && (
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Stealth is <strong>off for this payment</strong> — funds go to the payee’s long-term G… wallet (not a one-time address). No PIN needed.
                  </p>
                )}
              </div>
            )}

            {/* Per-payment advanced privacy (does not change workspace Settings) */}
            {shielded && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPrivacyMore(v => !v)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    View more · delay, decoys & batching
                  </span>
                  <span className="text-[10px] font-bold uppercase text-zinc-400">
                    {showPrivacyMore ? 'Hide' : 'Show'}
                  </span>
                </button>
                {showPrivacyMore && (
                  <div className="space-y-3 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      These apply to <strong>this payment only</strong>. Workspace defaults stay in Settings.
                      High Secure / long delays do not move money into Freighter if stealth is on — check the one-time address or PIN.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                          Timing delay (sec)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={600}
                          value={payDelaySec}
                          onChange={e => setPayDelaySec(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                          Jitter (sec)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={payJitterSec}
                          onChange={e => setPayJitterSec(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Pre-pay decoy deposits</p>
                        <p className="text-[10px] text-zinc-500">Extra notes to grow anonymity set</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayDecoyOn(v => !v)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${payDecoyOn ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${payDecoyOn ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {payDecoyOn && (
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">Decoy count</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={Math.max(1, payDecoyCount || 1)}
                          onChange={e => setPayDecoyCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                          className="h-9 w-full max-w-[120px] rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Batch deposit → withdraw</p>
                        <p className="text-[10px] text-zinc-500">Deposit all notes before withdraws</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayBatch(v => !v)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${payBatch ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${payBatch ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Post-pay decoy</p>
                        <p className="text-[10px] text-zinc-500">Leave an extra note in the pool after settle</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPayPostDecoy(v => !v)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${payPostDecoy ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${payPostDecoy ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {shielded && shieldPlan && shieldPlan.totalNotes > 0 && (
            <div className={`rounded-lg border px-3 py-2 text-[11px] ${
              shieldPlan.totalNotes > MAX_SHIELD_UNITS
                ? 'border-red-500/25 bg-red-500/5 text-red-700 dark:text-red-400'
                : shieldPlan.totalNotes >= 8
                  ? 'border-amber-500/25 bg-amber-500/5 text-amber-800 dark:text-amber-400'
                  : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400'
            }`}>
              {shieldPlan.totalNotes > MAX_SHIELD_UNITS ? (
                <>
                  <strong>{typedAmount} XLM</strong> needs {shieldPlan.totalNotes} ZK notes (max {MAX_SHIELD_UNITS}).
                  Split the payment or add larger pool tiers.
                </>
              ) : (
                <>
                  <strong>ZK multi-pool plan:</strong> {shieldPlan.description}
                  {' · '}~{Math.round(shieldPlan.estimatedSeconds / 60)} min with auto-sign
                  {freighterPrompts > 0 ? ` · ~${freighterPrompts} Freighter confirms` : ' · no Freighter spam'}
                  . Still fully private (shared pools).
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep('recipients')}
              className="h-10 flex-1 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!amount || !hasFunds}
              className="flex h-10 flex-[2] items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Review payment <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}

      {/* REVIEW STEP */}
      {step === 'review' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B] space-y-5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Review payment</h2>

          {!newWalletMode && selectedEmployees.length > 1 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-zinc-400 mb-1.5">
                {selectedEmployees.length} recipients · same amount each
              </p>
              <ul className="space-y-1">
                {selectedEmployees.map(e => (
                  <li key={e.id} className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-200">
                    <span className="font-semibold">{e.name}</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {e.walletAddress ? shortAddr(e.walletAddress, 4) : 'no wallet'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {[
              {
                label: 'Recipient',
                value: newWalletMode
                  ? customRecipient
                  : selectedEmployees.length === 1
                    ? selectedEmployees[0].name
                    : `${selectedEmployees.length} people from wallets directory`,
              },
              {
                label: 'Wallet',
                value: newWalletMode
                  ? (canUseStealth
                    ? (customWallet ? `${customWallet.slice(0, 8)}… (fallback)` : 'Stealth one-time G…')
                    : (customWallet || 'Not provided'))
                  : selectedEmployees.length === 1
                    ? (canUseStealth
                      ? (recipientWallet ? `${recipientWallet.slice(0, 8)}… (fallback only)` : 'Stealth one-time G…')
                      : (recipientWallet || 'Not provided'))
                    : 'Per-contact wallets from directory',
              },
              {
                label: 'Amount',
                value: shielded
                  ? `${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency} (settles ${shieldedOnChainXlm} XLM)`
                  : `${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`,
              },
              { label: 'Type', value: paymentType.replace('-', ' ') },
              { label: 'Memo', value: memo || '—' },
              { label: 'Privacy', value: shielded ? 'Shielded (ZK pool)' : 'Transparent' },
              ...(shielded
                ? [{
                    label: 'Stealth (this pay)',
                    value: useStealth
                      ? (canUseStealth
                        ? `On · one-time via ${shortAddr(recipientStealthMeta, 8)} · PIN after settle`
                        : 'On — missing meta (will use long-term wallet)')
                      : 'Off · long-term wallet only (no PIN)',
                  }, {
                    label: 'Timing delay',
                    value: payDelaySec > 0 || payJitterSec > 0
                      ? `${payDelaySec}s + up to ${payJitterSec}s jitter`
                      : 'None',
                  }]
                : []),
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-xs text-zinc-500">{row.label}</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 text-right max-w-[65%]">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep('details')}
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
