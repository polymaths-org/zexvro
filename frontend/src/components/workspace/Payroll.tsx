import { useParams, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  History,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  Users,
  UserX,
  Wallet,
  X,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';
import { employeeApi, payrollApi, proofApi } from '../../api/api';
import { getExplorerTxUrl, truncateKey } from '../../api/walletConnect';
import { useWorkspaceStore } from '../../stores/workspace';
import { useProjectStore } from '../../stores/project';
import { useZer0Store } from '../../stores/zer0';
import type {
  Zer0Currency,
  Zer0Employee,
  Zer0EmployeeStatus,
  Zer0PayFrequency,
  Zer0Payment,
  Zer0PaymentStatus,
  Zer0PaymentType,
  Zer0Proof,
  Zer0ProofStatus,
} from '../../stores/types';

/* ─── Types ─── */

type PayrollTab = 'employees' | 'run' | 'history' | 'proofs';
type RunStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'partial';
type HistorySort = 'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'name' | 'status' | 'type';
type ProofSort = 'newest' | 'oldest' | 'status' | 'system' | 'time';
type EmpSort = 'name' | 'salary_high' | 'salary_low' | 'department' | 'role' | 'newest';

interface PayrollLineItem {
  employeeId: string;
  name: string;
  email: string;
  walletAddress: string;
  amount: number;
  currency: Zer0Currency;
  frequency: Zer0PayFrequency;
  department: string;
  role: string;
  status?: RunStatus;
  txHash?: string | null;
  paymentId?: string | null;
  lastError?: string | null;
}

interface PayrollRun {
  id: string;
  workspaceId: string;
  projectId?: string;
  period: string;
  lineItems: PayrollLineItem[];
  totalAmount: number;
  employeeCount: number;
  status: RunStatus;
  shielded: boolean;
  createdAt: number;
  updatedAt?: number;
  processedAt?: number | null;
  lastError?: string | null;
}

interface EmployeeForm {
  name: string;
  email: string;
  department: string;
  role: string;
  walletAddress: string;
  salary: string;
  currency: Zer0Currency;
  frequency: Zer0PayFrequency;
  status: Zer0EmployeeStatus;
}

/* ─── Constants ─── */

const TABS: Array<{ id: PayrollTab; label: string; icon: ReactNode }> = [
  { id: 'employees', label: 'Employees', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'run', label: 'Payroll Run', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'history', label: 'History', icon: <History className="h-3.5 w-3.5" /> },
  { id: 'proofs', label: 'Proofs', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const DEPARTMENTS = ['Engineering', 'Design', 'Operations', 'Finance', 'Marketing', 'Sales', 'Legal', 'HR', 'Other'];
const ROLES = ['Employee', 'Contractor', 'Manager', 'Director', 'VP', 'C-Suite', 'Intern'];
const CURRENCIES: Zer0Currency[] = ['USDC', 'XLM', 'EURC'];
const FREQUENCIES: Zer0PayFrequency[] = ['weekly', 'bi-weekly', 'monthly', 'one-time'];
const EMP_STATUSES: Zer0EmployeeStatus[] = ['active', 'invited', 'inactive', 'terminated'];

const EMPTY_FORM = (currency: Zer0Currency = 'XLM'): EmployeeForm => ({
  name: '',
  email: '',
  department: 'Engineering',
  role: 'Employee',
  walletAddress: '',
  salary: '',
  currency,
  frequency: 'monthly',
  status: 'active',
});

/* ─── Helpers ─── */

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  const safe = typeof amount === 'number' ? amount : 0;
  return `${safe.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${currency || ''}`.trim();
}

function formatDate(value?: number | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(value?: number | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: string) {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isValidWallet(addr?: string) {
  return Boolean(addr && /^G[A-Z2-7]{55}$/.test(addr));
}

function normalizeEmployee(raw: any, fallbackScope: string): Zer0Employee {
  const now = Date.now();
  return {
    id: raw.id || raw.employeeId,
    projectId: raw.projectId || raw.workspaceId || fallbackScope,
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || '',
    department: raw.department || '',
    walletAddress: raw.walletAddress || '',
    salary: Number(raw.salary || 0),
    currency: (raw.currency || 'XLM') as Zer0Currency,
    frequency: (raw.frequency || 'monthly') as Zer0PayFrequency,
    status: (raw.status || 'active') as Zer0EmployeeStatus,
    startDate: Number(raw.startDate || raw.createdAt || now),
    createdAt: Number(raw.createdAt || now),
    updatedAt: Number(raw.updatedAt || now),
  };
}

function normalizeRun(raw: any, workspaceId: string): PayrollRun {
  const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  return {
    id: raw.id || raw.runId,
    workspaceId: raw.workspaceId || workspaceId,
    projectId: raw.projectId,
    period: raw.period || 'Current period',
    lineItems: lineItems.map((item: any) => ({
      employeeId: item.employeeId || item.id || '',
      name: item.name || 'Unknown',
      email: item.email || '',
      walletAddress: item.walletAddress || '',
      amount: Number(item.amount || 0),
      currency: (item.currency || raw.currency || 'XLM') as Zer0Currency,
      frequency: (item.frequency || 'monthly') as Zer0PayFrequency,
      department: item.department || '',
      role: item.role || '',
      status: (item.status || raw.status || 'pending_approval') as RunStatus,
      txHash: item.txHash || null,
      paymentId: item.paymentId || null,
      lastError: item.lastError || null,
    })),
    totalAmount: Number(raw.totalAmount || lineItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)),
    employeeCount: Number(raw.employeeCount || lineItems.length),
    status: (raw.status || 'pending_approval') as RunStatus,
    shielded: Boolean(raw.shielded ?? raw.lineItems?.[0]?.shielded),
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: raw.updatedAt ? Number(raw.updatedAt) : undefined,
    processedAt: raw.processedAt ? Number(raw.processedAt) : null,
    lastError: raw.lastError || null,
  };
}

function isBatchRun(run: PayrollRun) {
  return run.lineItems.length > 1 || Boolean(run.period && /^\d{4}-\d{2}/.test(run.period));
}

/* ─── Component ─── */

export default function Payroll() {
  const { workspaceId: routeWorkspaceId, projectId: routeProjectId } = useParams({ strict: false });
  const storeWorkspaceId = useWorkspaceStore(s => s.currentWorkspaceId);
  const storeProjectId = useProjectStore(s => s.currentProjectId);
  const workspaceId = String(routeWorkspaceId || storeWorkspaceId || '');
  const projectId = String(routeProjectId || storeProjectId || workspaceId || '');
  const scopeId = projectId || workspaceId;

  const allEmployees = useZer0Store(s => s.employees);
  const allPayments = useZer0Store(s => s.payments);
  const allProofs = useZer0Store(s => s.proofs);
  const settings = useZer0Store(s => s.settings);
  const pool = useZer0Store(s => s.pool);
  const processPayment = useZer0Store(s => s.processPayment);
  const createPayment = useZer0Store(s => s.createPayment);
  const updatePaymentStatus = useZer0Store(s => s.updatePaymentStatus);
  const updateEmployee = useZer0Store(s => s.updateEmployee);

  const [tab, setTab] = useState<PayrollTab>('employees');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Employees tab
  const [empSearch, setEmpSearch] = useState('');
  const [empDept, setEmpDept] = useState('all');
  const [empRole, setEmpRole] = useState('all');
  const [empStatus, setEmpStatus] = useState<Zer0EmployeeStatus | 'all'>('all');
  const [empSort, setEmpSort] = useState<EmpSort>('name');
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Zer0Employee | null>(null);
  const [empForm, setEmpForm] = useState<EmployeeForm>(() => EMPTY_FORM(settings?.defaultCurrency || 'XLM'));
  const [empSaving, setEmpSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Run tab
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runPeriod, setRunPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [runSearch, setRunSearch] = useState('');
  const [runDept, setRunDept] = useState('all');
  const [runSort, setRunSort] = useState<'name' | 'salary_high' | 'salary_low' | 'department'>('name');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({});
  const [shielded, setShielded] = useState(true);
  const [runSaving, setRunSaving] = useState(false);
  const [processingRunId, setProcessingRunId] = useState<string | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runModalStep, setRunModalStep] = useState<'select' | 'processing' | 'done'>('select');

  // History tab
  const [histSearch, setHistSearch] = useState('');
  const [histStatus, setHistStatus] = useState<Zer0PaymentStatus | 'all'>('all');
  const [histType, setHistType] = useState<Zer0PaymentType | 'all'>('all');
  const [histSource, setHistSource] = useState<'all' | 'payroll' | 'party'>('all');
  const [histSort, setHistSort] = useState<HistorySort>('newest');
  const [histPrivacy, setHistPrivacy] = useState<'all' | 'private' | 'public'>('all');

  // Proofs tab
  const [proofSearch, setProofSearch] = useState('');
  const [proofStatus, setProofStatus] = useState<Zer0ProofStatus | 'all'>('all');
  const [proofSort, setProofSort] = useState<ProofSort>('newest');
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);

  const basePath = routeProjectId
    ? `/dashboard/w/${workspaceId}/p/${routeProjectId}`
    : `/dashboard/w/${workspaceId}`;

  const walletOk = Boolean(settings?.walletAddress && isValidWallet(settings.walletAddress));
  const stellarNet = (settings?.horizonUrl || '').includes('testnet') ? 'TESTNET' as const : 'PUBLIC' as const;

  /* ─── Scoped data ─── */

  const employees = useMemo(() => {
    return allEmployees.filter(e =>
      !e.projectId ||
      e.projectId === projectId ||
      e.projectId === workspaceId ||
      e.projectId === scopeId ||
      (e as any).workspaceId === workspaceId,
    );
  }, [allEmployees, projectId, workspaceId, scopeId]);

  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'active' || e.status === 'invited'),
    [employees],
  );

  const departments = useMemo(() => {
    const set = new Set([...DEPARTMENTS, ...employees.map(e => e.department).filter(Boolean)]);
    return Array.from(set).sort();
  }, [employees]);

  const roles = useMemo(() => {
    const set = new Set([...ROLES, ...employees.map(e => e.role).filter(Boolean)]);
    return Array.from(set).sort();
  }, [employees]);

  const payments = useMemo(() => {
    return allPayments.filter(p =>
      !p.projectId ||
      p.projectId === projectId ||
      p.projectId === workspaceId ||
      p.projectId === scopeId,
    );
  }, [allPayments, projectId, workspaceId, scopeId]);

  const proofs = useMemo(() => {
    return allProofs.filter(p =>
      !p.projectId ||
      p.projectId === projectId ||
      p.projectId === workspaceId ||
      p.projectId === scopeId,
    );
  }, [allProofs, projectId, workspaceId, scopeId]);

  const batchRuns = useMemo(
    () => runs
      .filter(r => isBatchRun(r))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [runs],
  );

  const selectedRun = useMemo(
    () => batchRuns.find(r => r.id === selectedRunId) || null,
    [batchRuns, selectedRunId],
  );

  /* ─── Load ─── */

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [empData, runData, proofRes] = await Promise.all([
        employeeApi.list(workspaceId),
        payrollApi.listRuns(workspaceId),
        proofApi.list(''),
      ]);

      const remoteEmps = (empData.employees || []).map((e: any) => normalizeEmployee(e, scopeId));
      const localEmps = useZer0Store.getState().employees;
      const empMap = new Map(localEmps.map(e => [e.id, e]));
      for (const e of remoteEmps) if (e.id) empMap.set(e.id, e);
      useZer0Store.setState({ employees: Array.from(empMap.values()) });

      const remoteRuns = (runData.runs || []).map((r: any) => normalizeRun(r, workspaceId));
      setRuns(remoteRuns);
      if (!selectedRunId && remoteRuns.find(isBatchRun)) {
        setSelectedRunId(remoteRuns.find(isBatchRun)!.id);
      }

      const remoteProofs = (proofRes.proofs || []).filter((p: any) => p?.id);
      if (remoteProofs.length) {
        const local = useZer0Store.getState().proofs;
        const byId = new Map(local.map(p => [p.id, p]));
        for (const raw of remoteProofs) {
          const existing = byId.get(raw.id);
          byId.set(raw.id, existing ? { ...existing, ...raw } : {
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, scopeId, selectedRunId]);

  useEffect(() => {
    loadData();
  }, [workspaceId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Employees filtered ─── */

  const filteredEmployees = useMemo(() => {
    let list = [...employees];
    if (empStatus !== 'all') list = list.filter(e => e.status === empStatus);
    if (empDept !== 'all') list = list.filter(e => e.department === empDept);
    if (empRole !== 'all') list = list.filter(e => e.role === empRole);
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(e =>
        [e.name, e.email, e.role, e.department, e.walletAddress]
          .some(v => String(v || '').toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      if (empSort === 'salary_high') return (b.salary || 0) - (a.salary || 0);
      if (empSort === 'salary_low') return (a.salary || 0) - (b.salary || 0);
      if (empSort === 'department') return String(a.department).localeCompare(String(b.department)) || a.name.localeCompare(b.name);
      if (empSort === 'role') return String(a.role).localeCompare(String(b.role)) || a.name.localeCompare(b.name);
      if (empSort === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [employees, empStatus, empDept, empRole, empSearch, empSort]);

  /* ─── Run modal people ─── */

  const runModalPeople = useMemo(() => {
    let list = activeEmployees.filter(e => e.status === 'active');
    if (runDept !== 'all') list = list.filter(e => e.department === runDept);
    if (runSearch.trim()) {
      const q = runSearch.toLowerCase();
      list = list.filter(e =>
        [e.name, e.email, e.role, e.department].some(v => String(v || '').toLowerCase().includes(q)),
      );
    }
    list = [...list].sort((a, b) => {
      if (runSort === 'salary_high') return (b.salary || 0) - (a.salary || 0);
      if (runSort === 'salary_low') return (a.salary || 0) - (b.salary || 0);
      if (runSort === 'department') return String(a.department).localeCompare(String(b.department));
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [activeEmployees, runDept, runSearch, runSort]);

  const runPreview = useMemo(() => {
    return activeEmployees
      .filter(e => selectedIds.has(e.id))
      .map(e => {
        const override = amountOverrides[e.id];
        const amount = override !== undefined && override !== '' ? Number(override) : e.salary;
        return {
          employeeId: e.id,
          name: e.name,
          email: e.email,
          walletAddress: e.walletAddress,
          amount: Number.isFinite(amount) ? amount : 0,
          currency: (shielded ? 'XLM' : e.currency) as Zer0Currency,
          frequency: e.frequency,
          department: e.department,
          role: e.role,
        } satisfies PayrollLineItem;
      });
  }, [activeEmployees, selectedIds, amountOverrides, shielded]);

  const runTotal = useMemo(() => runPreview.reduce((s, i) => s + (i.amount || 0), 0), [runPreview]);

  /* ─── History filtered (ALL payments: payroll runs + pay party) ─── */

  const historyRows = useMemo(() => {
    let list = [...payments];

    // Source: payroll batch vs ad-hoc (pay party)
    if (histSource === 'payroll') {
      list = list.filter(p => p.type === 'payroll' || Boolean(p.employeeId));
    } else if (histSource === 'party') {
      list = list.filter(p => p.type !== 'payroll' || !p.employeeId);
    }

    if (histStatus !== 'all') list = list.filter(p => p.status === histStatus);
    if (histType !== 'all') list = list.filter(p => p.type === histType);
    if (histPrivacy === 'private') list = list.filter(p => p.shielded);
    if (histPrivacy === 'public') list = list.filter(p => !p.shielded);
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase();
      list = list.filter(p =>
        [p.recipientName, p.memo, p.id, p.recipientWallet, p.txHash]
          .some(v => String(v || '').toLowerCase().includes(q)),
      );
    }

    list.sort((a, b) => {
      if (histSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (histSort === 'amount_high') return (b.amount || 0) - (a.amount || 0);
      if (histSort === 'amount_low') return (a.amount || 0) - (b.amount || 0);
      if (histSort === 'name') return String(a.recipientName).localeCompare(String(b.recipientName));
      if (histSort === 'status') return String(a.status).localeCompare(String(b.status));
      if (histSort === 'type') return String(a.type).localeCompare(String(b.type));
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }, [payments, histSource, histStatus, histType, histPrivacy, histSearch, histSort]);

  /* ─── Proofs filtered (ALL proofs) ─── */

  const filteredProofs = useMemo(() => {
    let list = [...proofs];
    if (proofStatus !== 'all') list = list.filter(p => p.status === proofStatus);
    if (proofSearch.trim()) {
      const q = proofSearch.toLowerCase();
      list = list.filter(p => {
        const pay = payments.find(x => x.id === p.paymentId);
        return [p.id, p.paymentId, p.proofSystem, p.proofData, pay?.recipientName]
          .some(v => String(v || '').toLowerCase().includes(q));
      });
    }
    list.sort((a, b) => {
      if (proofSort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (proofSort === 'status') return String(a.status).localeCompare(String(b.status));
      if (proofSort === 'system') return String(a.proofSystem).localeCompare(String(b.proofSystem));
      if (proofSort === 'time') return (b.generationTimeMs || 0) - (a.generationTimeMs || 0);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }, [proofs, proofStatus, proofSearch, proofSort, payments]);

  const selectedProof = useMemo(
    () => proofs.find(p => p.id === selectedProofId) || null,
    [proofs, selectedProofId],
  );

  /* ─── Employee CRUD ─── */

  function openAddEmployee() {
    setEditingEmp(null);
    setEmpForm(EMPTY_FORM(settings?.defaultCurrency || 'XLM'));
    setShowEmpModal(true);
    setOpenMenu(null);
  }

  function openEditEmployee(emp: Zer0Employee) {
    setEditingEmp(emp);
    setEmpForm({
      name: emp.name,
      email: emp.email,
      department: emp.department || 'Engineering',
      role: emp.role || 'Employee',
      walletAddress: emp.walletAddress || '',
      salary: String(emp.salary || ''),
      currency: emp.currency || 'XLM',
      frequency: emp.frequency || 'monthly',
      status: emp.status || 'active',
    });
    setShowEmpModal(true);
    setOpenMenu(null);
  }

  async function saveEmployee(e: FormEvent) {
    e.preventDefault();
    const salary = parseFloat(empForm.salary);
    if (isNaN(salary) || salary < 0) {
      setError('Enter a valid salary.');
      return;
    }
    setEmpSaving(true);
    setError('');
    const payload = {
      workspaceId,
      projectId: scopeId,
      name: empForm.name.trim(),
      email: empForm.email.trim(),
      role: empForm.role,
      department: empForm.department,
      walletAddress: empForm.walletAddress.trim(),
      salary,
      currency: empForm.currency,
      frequency: empForm.frequency,
      status: empForm.status,
      startDate: editingEmp?.startDate || Date.now(),
    };
    try {
      if (editingEmp) {
        const res = await employeeApi.update(editingEmp.id, payload);
        updateEmployee(editingEmp.id, normalizeEmployee(res.employee || { ...payload, id: editingEmp.id }, scopeId));
        setSuccess(`Updated ${payload.name}.`);
      } else {
        const res = await employeeApi.create(payload);
        const emp = normalizeEmployee(res.employee || { ...payload, id: createId('emp') }, scopeId);
        useZer0Store.setState(s => ({ employees: [...s.employees, emp] }));
        setSuccess(`Added ${payload.name}.`);
      }
      setShowEmpModal(false);
      setEditingEmp(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setEmpSaving(false);
    }
  }

  async function deactivateEmployee(id: string) {
    setOpenMenu(null);
    setError('');
    try {
      const res = await employeeApi.delete(id, workspaceId);
      updateEmployee(id, normalizeEmployee(res.employee || { id, projectId: scopeId, status: 'terminated' }, scopeId));
      setSuccess('Employee deactivated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  }

  /* ─── Payroll run ─── */

  function openRunModal() {
    setError('');
    setSuccess('');
    setRunSearch('');
    setRunDept('all');
    setAmountOverrides({});
    setRunPeriod(new Date().toISOString().slice(0, 7));
    setShielded(true);
    setRunModalStep('select');
    setProcessLog([]);
    const ready = activeEmployees.filter(e => e.status === 'active' && isValidWallet(e.walletAddress) && e.salary > 0);
    setSelectedIds(new Set(ready.map(e => e.id)));
    setShowRunModal(true);
  }

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = runModalPeople.map(e => e.id);
    const allOn = ids.length > 0 && ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allOn) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  async function createAndProcessRun() {
    if (!workspaceId || runPreview.length === 0) {
      setError('Select at least one person.');
      return;
    }
    const missingWallet = runPreview.filter(i => !isValidWallet(i.walletAddress));
    if (missingWallet.length) {
      setError(`${missingWallet.length} selected person(s) missing a valid Stellar wallet.`);
      return;
    }
    const badAmount = runPreview.filter(i => !i.amount || i.amount <= 0);
    if (badAmount.length) {
      setError(`${badAmount.length} selected person(s) have amount ≤ 0.`);
      return;
    }
    if (!walletOk) {
      setError('Connect a funding wallet in Settings first.');
      return;
    }
    if (!shielded && !settings.allowTransparentPayments) {
      setError('Public transfers are disabled. Use private mode or enable public in Settings.');
      return;
    }

    setRunSaving(true);
    setError('');
    setRunModalStep('processing');
    setProcessLog(['Creating payroll run…']);

    const runId = createId('run');
    const needsApproval = Boolean(settings.paymentApprovalRequired);
    const status: RunStatus = needsApproval ? 'pending_approval' : 'approved';
    const lineItems = runPreview.map(item => ({
      ...item,
      status,
      shielded,
      projectId: scopeId,
      type: 'payroll',
      memo: `Payroll ${runPeriod}`,
    }));

    const payload = {
      workspaceId,
      runId,
      projectId: scopeId,
      period: runPeriod,
      type: 'payroll',
      shielded,
      lineItems,
      totalAmount: runTotal,
      employeeCount: lineItems.length,
      status,
      memo: `Payroll run ${runPeriod}`,
    };

    let run: PayrollRun;
    try {
      const res = await payrollApi.createRun(payload);
      run = normalizeRun(res.run || payload, workspaceId);
      setRuns(prev => [run, ...prev.filter(r => r.id !== run.id)]);
      setSelectedRunId(run.id);
      setProcessLog(prev => [...prev, `Run ${run.period} created (${lineItems.length} people).`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
      setRunModalStep('select');
      setRunSaving(false);
      return;
    }

    if (needsApproval) {
      setProcessLog(prev => [...prev, 'Awaiting approval — process after approve.']);
      setRunModalStep('done');
      setRunSaving(false);
      setSuccess('Run created — approve it, then process.');
      setTab('run');
      return;
    }

    // Process immediately
    setProcessingRunId(run.id);
    await executeRunPayments(run);
    setRunSaving(false);
    setProcessingRunId(null);
    setRunModalStep('done');
    setTab('run');
  }

  async function executeRunPayments(run: PayrollRun) {
    const log = (msg: string) => setProcessLog(prev => [...prev, msg]);
    log(`Processing ${run.lineItems.length} payments…`);

    try {
      await payrollApi.updateRun(run.id, {
        workspaceId: run.workspaceId || workspaceId,
        status: 'processing',
        updatedAt: Date.now(),
      });
    } catch {}
    setRuns(prev => prev.map(r => (r.id === run.id ? { ...r, status: 'processing' } : r)));

    const updatedItems: PayrollLineItem[] = [];
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < run.lineItems.length; i++) {
      const item = run.lineItems[i];
      log(`[${i + 1}/${run.lineItems.length}] Paying ${item.name}…`);

      if (!isValidWallet(item.walletAddress)) {
        failed++;
        updatedItems.push({ ...item, status: 'failed', lastError: 'Invalid wallet' });
        log(`  ✗ invalid wallet`);
        continue;
      }
      if (!item.amount || item.amount <= 0) {
        failed++;
        updatedItems.push({ ...item, status: 'failed', lastError: 'Invalid amount' });
        log(`  ✗ invalid amount`);
        continue;
      }

      try {
        // Prefer employee stealth meta so batch payroll can one-time-receive when enabled
        const empForMeta = item.employeeId
          ? useZer0Store.getState().employees.find(e => e.id === item.employeeId)
          : null;
        const payMeta = (empForMeta?.stealthMetaAddress || '').trim() || null;

        const payment = createPayment({
          projectId: run.projectId || scopeId,
          employeeId: item.employeeId || null,
          recipientName: item.name,
          recipientWallet: item.walletAddress,
          recipientStealthMeta: run.shielded ? payMeta : null,
          amount: item.amount,
          currency: run.shielded ? 'XLM' : item.currency,
          type: 'payroll',
          status: 'approved',
          shielded: run.shielded,
          memo: `Payroll ${run.period}`,
          lastError: null,
        });

        await processPayment(payment.id);
        await new Promise(r => setTimeout(r, 250));
        const final = useZer0Store.getState().payments.find(p => p.id === payment.id);

        if (final?.status === 'completed') {
          completed++;
          updatedItems.push({
            ...item,
            status: 'completed',
            txHash: final.txHash,
            paymentId: payment.id,
            lastError: null,
          });
          log(`  ✓ ${final.txHash ? truncateKey(final.txHash, 6, 4) : 'paid'}`);
        } else {
          failed++;
          const errMsg = final?.lastError || 'Payment failed';
          updatedItems.push({ ...item, status: 'failed', paymentId: payment.id, lastError: errMsg });
          if (final?.status === 'processing') updatePaymentStatus(payment.id, 'failed', { lastError: errMsg });
          log(`  ✗ ${errMsg}`);
        }
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : 'Payment error';
        updatedItems.push({ ...item, status: 'failed', lastError: errMsg });
        log(`  ✗ ${errMsg}`);
      }
    }

    const finalStatus: RunStatus =
      failed === 0 ? 'completed' : completed === 0 ? 'failed' : 'partial';

    const nextRun: PayrollRun = {
      ...run,
      lineItems: updatedItems,
      status: finalStatus,
      processedAt: Date.now(),
      updatedAt: Date.now(),
      lastError: failed ? `${failed} failed` : null,
    };

    try {
      await payrollApi.updateRun(run.id, {
        workspaceId: run.workspaceId || workspaceId,
        status: finalStatus === 'partial' ? 'completed' : finalStatus,
        lineItems: updatedItems,
        processedAt: Date.now(),
        updatedAt: Date.now(),
        totalAmount: run.totalAmount,
        txHash: updatedItems.find(i => i.txHash)?.txHash || null,
        lastError: nextRun.lastError,
      });
    } catch {}

    setRuns(prev => prev.map(r => (r.id === run.id ? nextRun : r)));
    log(`Done — ${completed} paid, ${failed} failed.`);
    setSuccess(
      finalStatus === 'completed'
        ? `Payroll complete: ${completed} paid.`
        : finalStatus === 'partial'
          ? `Partial: ${completed} paid, ${failed} failed.`
          : `All ${failed} payments failed.`,
    );
  }

  async function processExistingRun(run: PayrollRun) {
    if (processingRunId) return;
    if (!walletOk) {
      setError('Connect funding wallet first.');
      return;
    }
    if (run.status === 'pending_approval') {
      setError('Approve this run first.');
      return;
    }
    setProcessingRunId(run.id);
    setProcessLog([]);
    setShowRunModal(true);
    setRunModalStep('processing');
    setSelectedRunId(run.id);
    await executeRunPayments(run);
    setProcessingRunId(null);
    setRunModalStep('done');
  }

  async function updateRunStatus(run: PayrollRun, status: RunStatus) {
    setError('');
    try {
      const res = await payrollApi.updateRun(run.id, {
        workspaceId: run.workspaceId || workspaceId,
        status,
        updatedAt: Date.now(),
      });
      const updated = normalizeRun(res.run || { ...run, status }, workspaceId);
      setRuns(prev => prev.map(r => (r.id === run.id ? updated : r)));
      setSuccess(`Run marked ${statusLabel(status)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update run');
    }
  }

  /* ─── Export ─── */

  function exportHistoryCsv() {
    const header = ['id', 'recipient', 'wallet', 'amount', 'currency', 'type', 'status', 'shielded', 'memo', 'txHash', 'createdAt', 'processedAt'];
    const rows = historyRows.map(p => [
      p.id, p.recipientName, p.recipientWallet, p.amount, p.currency, p.type, p.status,
      p.shielded ? 'yes' : 'no', p.memo || '', p.txHash || '',
      new Date(p.createdAt).toISOString(),
      p.processedAt ? new Date(p.processedAt).toISOString() : '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zexvro-payroll-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadProof(proof: Zer0Proof) {
    const payment = payments.find(p => p.id === proof.paymentId);
    const data = {
      proofId: proof.id,
      projectId: proof.projectId,
      paymentId: proof.paymentId,
      proofSystem: proof.proofSystem,
      status: proof.status,
      verificationKey: proof.verificationKey,
      proofData: proof.proofData,
      generationTimeMs: proof.generationTimeMs,
      createdAt: new Date(proof.createdAt).toISOString(),
      verifiedAt: proof.verifiedAt ? new Date(proof.verifiedAt).toISOString() : null,
      recipient: payment ? {
        name: payment.recipientName,
        wallet: payment.recipientWallet,
        amount: payment.amount,
        currency: payment.currency,
      } : null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZK_Proof_${proof.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const readyCount = activeEmployees.filter(e => isValidWallet(e.walletAddress) && e.salary > 0).length;
  const fundXlm = pool?.balances?.XLM || 0;

  /* ─── Render ─── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Payroll</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Manage team, run batch payroll, review full ledger & proofs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadData()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {tab === 'employees' && (
            <button
              onClick={openAddEmployee}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" /> Add employee
            </button>
          )}
          {(tab === 'run' || tab === 'employees') && (
            <button
              onClick={openRunModal}
              disabled={activeEmployees.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Run payroll
            </button>
          )}
        </div>
      </div>

      {/* Browser-like tabs */}
      <div className="flex items-end gap-0 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          const count =
            t.id === 'employees' ? employees.length
            : t.id === 'run' ? batchRuns.length
            : t.id === 'history' ? payments.length
            : proofs.length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition shrink-0 ${
                active
                  ? 'text-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {count}
              </span>
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-zinc-900 dark:bg-white" />
              )}
            </button>
          );
        })}
      </div>

      {error && <Banner tone="error" onClose={() => setError('')}>{error}</Banner>}
      {success && <Banner tone="success" onClose={() => setSuccess('')}>{success}</Banner>}

      {/* ═══════════ EMPLOYEES ═══════════ */}
      {tab === 'employees' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                placeholder="Search name, email, role…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <select value={empDept} onChange={e => setEmpDept(e.target.value)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={empRole} onChange={e => setEmpRole(e.target.value)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={empStatus} onChange={e => setEmpStatus(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All statuses</option>
              {EMP_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            <select value={empSort} onChange={e => setEmpSort(e.target.value as EmpSort)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="name">Sort: Name</option>
              <option value="salary_high">Salary high→low</option>
              <option value="salary_low">Salary low→high</option>
              <option value="department">Department</option>
              <option value="role">Role</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Total" value={String(employees.length)} />
            <MiniStat label="Active / payable" value={`${activeEmployees.filter(e => e.status === 'active').length} / ${readyCount}`} />
            <MiniStat label="Funding wallet" value={walletOk ? truncateKey(settings.walletAddress, 4, 4) : 'Not connected'} hint={!walletOk ? (
              <Link to={`${basePath}/zer0/settings` as any} className="text-blue-600 dark:text-blue-400 hover:underline">Settings →</Link>
            ) : `~${formatCurrency(fundXlm, 'XLM')}`} />
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-xs text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filteredEmployees.length === 0 ? (
              <Empty icon={<Users className="h-9 w-9" />} title="No employees match" detail="Add people or clear filters." action={
                <button onClick={openAddEmployee} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                  <Plus className="h-3.5 w-3.5" /> Add employee
                </button>
              } />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Department</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Salary</th>
                      <th className="px-4 py-2.5 font-semibold">Frequency</th>
                      <th className="px-4 py-2.5 font-semibold">Wallet</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900 dark:text-white">{emp.name}</p>
                          <p className="text-[10px] text-zinc-400">{emp.email}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{emp.department || '—'}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{emp.role || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900 dark:text-white">
                          {formatCurrency(emp.salary, emp.currency)}
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-500">{String(emp.frequency || '').replace('-', ' ')}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-zinc-500">
                          {isValidWallet(emp.walletAddress) ? truncateKey(emp.walletAddress, 4, 4) : (
                            <span className="text-amber-600">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                        <td className="relative px-4 py-3">
                          <button onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                          </button>
                          {openMenu === emp.id && (
                            <div className="absolute right-4 top-10 z-20 min-w-[130px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                              <button onClick={() => openEditEmployee(emp)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                <Edit3 className="h-3 w-3" /> Edit
                              </button>
                              {emp.status !== 'terminated' && (
                                <button onClick={() => deactivateEmployee(emp.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                                  <UserX className="h-3 w-3" /> Deactivate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════ PAYROLL RUN ═══════════ */}
      {tab === 'run' && (
        <section className="space-y-4">
          {/* Auto-run placeholder */}
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200/80 dark:bg-zinc-800">
                  <Clock className="h-4 w-4 text-zinc-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Auto-run payroll</h3>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Currently undeveloped
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Scheduled monthly / bi-weekly runs will land here. For now, start a manual run.
                  </p>
                </div>
              </div>
              <button
                onClick={openRunModal}
                disabled={activeEmployees.length === 0}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                <Play className="h-4 w-4" />
                Run payroll
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* Runs list */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Runs</h2>
                <span className="text-[10px] font-medium uppercase text-zinc-400">{batchRuns.length} total</span>
              </div>
              {loading ? (
                <div className="flex justify-center py-14 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : batchRuns.length === 0 ? (
                <Empty icon={<Play className="h-9 w-9" />} title="No payroll runs yet" detail="Click Run payroll to select people and pay them." />
              ) : (
                <div className="max-h-[480px] divide-y divide-zinc-100 overflow-auto dark:divide-zinc-800">
                  {batchRuns.map(run => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full px-4 py-3.5 text-left transition ${
                        selectedRunId === run.id ? 'bg-zinc-50 dark:bg-zinc-900/50' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{run.period}</span>
                        <StatusBadge status={run.status} />
                        {run.shielded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            <Shield className="h-2.5 w-2.5" /> Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                            <ShieldOff className="h-2.5 w-2.5" /> Public
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {run.employeeCount} people · {formatCurrency(run.totalAmount, run.shielded ? 'XLM' : run.lineItems[0]?.currency || 'XLM')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{formatDate(run.createdAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Run detail */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
              {!selectedRun ? (
                <Empty icon={<Users className="h-9 w-9" />} title="Select a run" detail="Review line items, approve, or process payments." />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{selectedRun.period}</h2>
                        <StatusBadge status={selectedRun.status} />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {selectedRun.employeeCount} people · {formatCurrency(selectedRun.totalAmount, selectedRun.shielded ? 'XLM' : 'mixed')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRun.status === 'pending_approval' && (
                        <>
                          <button onClick={() => updateRunStatus(selectedRun, 'approved')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button onClick={() => updateRunStatus(selectedRun, 'cancelled')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-700">
                            Cancel
                          </button>
                        </>
                      )}
                      {(selectedRun.status === 'approved' || selectedRun.status === 'failed' || selectedRun.status === 'partial') && (
                        <button
                          onClick={() => processExistingRun(selectedRun)}
                          disabled={!!processingRunId || !walletOk}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                        >
                          {processingRunId === selectedRun.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Process payments
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase text-zinc-400 dark:bg-zinc-900/80">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Person</th>
                          <th className="px-4 py-2 font-semibold">Amount</th>
                          <th className="px-4 py-2 font-semibold">Status</th>
                          <th className="px-4 py-2 font-semibold">Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {selectedRun.lineItems.map((item, idx) => (
                          <tr key={`${item.employeeId}_${idx}`}>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-zinc-900 dark:text-white">{item.name}</p>
                              <p className="font-mono text-[10px] text-zinc-400">
                                {item.walletAddress ? truncateKey(item.walletAddress, 4, 4) : 'No wallet'}
                              </p>
                              {item.lastError && <p className="text-[10px] text-red-500">{item.lastError}</p>}
                            </td>
                            <td className="px-4 py-2.5 font-semibold">{formatCurrency(item.amount, item.currency)}</td>
                            <td className="px-4 py-2.5"><StatusBadge status={item.status || selectedRun.status} /></td>
                            <td className="px-4 py-2.5">
                              {item.txHash ? (
                                <a href={getExplorerTxUrl(item.txHash, stellarNet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                  {truncateKey(item.txHash, 4, 4)} <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ HISTORY (full ledger) ═══════════ */}
      {tab === 'history' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-xs text-zinc-500">
              Full payment ledger — payroll runs <strong className="text-zinc-700 dark:text-zinc-300">and</strong> Send payment (pay party). Sort & filter everything here.
            </p>
            <button onClick={exportHistoryCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-800">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search name, memo, tx…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <select value={histSource} onChange={e => setHistSource(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All sources</option>
              <option value="payroll">Payroll runs</option>
              <option value="party">Pay party / ad-hoc</option>
            </select>
            <select value={histStatus} onChange={e => setHistStatus(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All statuses</option>
              {['completed', 'processing', 'pending_approval', 'approved', 'failed', 'cancelled', 'draft'].map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <select value={histType} onChange={e => setHistType(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All types</option>
              {['payroll', 'contractor', 'bonus', 'reimbursement', 'one-time'].map(t => (
                <option key={t} value={t}>{statusLabel(t)}</option>
              ))}
            </select>
            <select value={histPrivacy} onChange={e => setHistPrivacy(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">Private + public</option>
              <option value="private">Private only</option>
              <option value="public">Public only</option>
            </select>
            <select value={histSort} onChange={e => setHistSort(e.target.value as HistorySort)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="amount_high">Amount high</option>
              <option value="amount_low">Amount low</option>
              <option value="name">Name A–Z</option>
              <option value="status">Status</option>
              <option value="type">Type</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Shown" value={String(historyRows.length)} />
            <MiniStat label="Completed" value={String(historyRows.filter(p => p.status === 'completed').length)} />
            <MiniStat label="Private" value={String(historyRows.filter(p => p.shielded).length)} />
            <MiniStat label="Volume" value={formatCurrency(historyRows.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0), '')} />
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
            {historyRows.length === 0 ? (
              <Empty icon={<History className="h-9 w-9" />} title="No payments match" detail="Run payroll or use Send payment — both appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Recipient</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Amount</th>
                      <th className="px-4 py-2.5 font-semibold">Privacy</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Tx / Proof</th>
                      <th className="px-4 py-2.5 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {historyRows.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900 dark:text-white">{p.recipientName}</p>
                          <p className="font-mono text-[10px] text-zinc-400">{p.recipientWallet ? truncateKey(p.recipientWallet, 4, 4) : '—'}</p>
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">{statusLabel(p.type)}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatCurrency(p.amount, p.currency)}</td>
                        <td className="px-4 py-3">
                          {p.shielded ? (
                            <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400"><Shield className="h-3 w-3" /> Private</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-500"><ShieldOff className="h-3 w-3" /> Public</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {p.txHash ? (
                              <a href={getExplorerTxUrl(p.txHash, stellarNet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                {truncateKey(p.txHash, 4, 4)} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : <span className="text-zinc-400">—</span>}
                            {p.proofId && (
                              <button onClick={() => { setTab('proofs'); setSelectedProofId(p.proofId); }} className="text-left text-[10px] font-medium text-violet-600 hover:underline dark:text-violet-400">
                                Proof →
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{formatShortDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════ PROOFS (full) ═══════════ */}
      {tab === 'proofs' && (
        <section className="space-y-4">
          <p className="text-xs text-zinc-500">
            All ZK payment proofs — from payroll batches and Send payment. Sort, filter, download for audit.
          </p>

          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={String(filteredProofs.length)} />
            <MiniStat label="Verified" value={String(filteredProofs.filter(p => p.status === 'verified').length)} />
            <MiniStat label="Failed" value={String(filteredProofs.filter(p => p.status === 'failed').length)} />
            <MiniStat label="Avg gen" value={
              filteredProofs.some(p => p.generationTimeMs)
                ? `${Math.round(filteredProofs.filter(p => p.generationTimeMs).reduce((s, p) => s + (p.generationTimeMs || 0), 0) / (filteredProofs.filter(p => p.generationTimeMs).length || 1))}ms`
                : '—'
            } />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input value={proofSearch} onChange={e => setProofSearch(e.target.value)} placeholder="Search proof id, recipient…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <select value={proofStatus} onChange={e => setProofStatus(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="all">All statuses</option>
              {['verified', 'generating', 'queued', 'failed'].map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <select value={proofSort} onChange={e => setProofSort(e.target.value as ProofSort)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="status">Status</option>
              <option value="system">Proof system</option>
              <option value="time">Gen time</option>
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
              {filteredProofs.length === 0 ? (
                <Empty icon={<ShieldCheck className="h-9 w-9" />} title="No proofs yet" detail="Private (shielded) payments generate proofs automatically." />
              ) : (
                <div className="max-h-[520px] divide-y divide-zinc-100 overflow-auto dark:divide-zinc-800">
                  {filteredProofs.map(proof => {
                    const pay = payments.find(p => p.id === proof.paymentId);
                    const active = selectedProofId === proof.id;
                    return (
                      <button
                        key={proof.id}
                        onClick={() => setSelectedProofId(proof.id)}
                        className={`w-full px-4 py-3 text-left transition ${active ? 'bg-zinc-50 dark:bg-zinc-900/50' : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30'}`}
                      >
                        <div className="flex items-center gap-2">
                          <ProofStatusIcon status={proof.status} />
                          <span className="truncate font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">{proof.id}</span>
                          <StatusBadge status={proof.status} />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {proof.proofSystem}
                          {pay ? ` · ${pay.recipientName}` : ''}
                          {proof.generationTimeMs ? ` · ${proof.generationTimeMs}ms` : ''}
                          {' · '}{formatShortDate(proof.createdAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
              {!selectedProof ? (
                <Empty icon={<ShieldCheck className="h-9 w-9" />} title="Select a proof" detail="View verification details and download JSON." />
              ) : (
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Proof detail</h3>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-400">{selectedProof.id}</p>
                    </div>
                    <button onClick={() => downloadProof(selectedProof)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium dark:border-zinc-700">
                      <Download className="h-3.5 w-3.5" /> JSON
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <Detail label="Status" value={<StatusBadge status={selectedProof.status} />} />
                    <Detail label="System" value={selectedProof.proofSystem} />
                    <Detail label="Created" value={formatDate(selectedProof.createdAt)} />
                    <Detail label="Verified" value={formatDate(selectedProof.verifiedAt)} />
                    <Detail label="Gen time" value={selectedProof.generationTimeMs != null ? `${selectedProof.generationTimeMs}ms` : '—'} />
                    <Detail label="Payment" value={selectedProof.paymentId || '—'} mono />
                    <Detail label="Proof data" value={selectedProof.proofData ? truncateKey(selectedProof.proofData, 10, 8) : '—'} mono />
                    <Detail label="VK" value={selectedProof.verificationKey ? truncateKey(selectedProof.verificationKey, 8, 6) : '—'} mono />
                  </dl>
                  {(() => {
                    const pay = payments.find(p => p.id === selectedProof.paymentId);
                    if (!pay) return null;
                    return (
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Linked payment</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-900 dark:text-white">{pay.recipientName}</p>
                        <p className="text-[11px] text-zinc-500">{formatCurrency(pay.amount, pay.currency)} · {statusLabel(pay.type)}</p>
                        {pay.txHash && (
                          <a href={getExplorerTxUrl(pay.txHash, stellarNet)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                            View tx <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ EMPLOYEE MODAL ═══════════ */}
      {showEmpModal && (
        <Modal title={editingEmp ? 'Edit employee' : 'Add employee'} onClose={() => { setShowEmpModal(false); setEditingEmp(null); }}>
          <form onSubmit={saveEmployee} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name *">
                <input required value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Email *">
                <input required type="email" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <select value={empForm.department} onChange={e => setEmpForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Role">
                <select value={empForm.role} onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Stellar wallet (G…)">
              <input value={empForm.walletAddress} onChange={e => setEmpForm(f => ({ ...f, walletAddress: e.target.value }))} placeholder="G…" className={`${inputCls} font-mono`} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Salary *">
                <input required type="number" min="0" step="any" value={empForm.salary} onChange={e => setEmpForm(f => ({ ...f, salary: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Currency">
                <select value={empForm.currency} onChange={e => setEmpForm(f => ({ ...f, currency: e.target.value as Zer0Currency }))} className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Frequency">
                <select value={empForm.frequency} onChange={e => setEmpForm(f => ({ ...f, frequency: e.target.value as Zer0PayFrequency }))} className={inputCls}>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{statusLabel(f)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Status">
              <select value={empForm.status} onChange={e => setEmpForm(f => ({ ...f, status: e.target.value as Zer0EmployeeStatus }))} className={inputCls}>
                {EMP_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <button type="button" onClick={() => { setShowEmpModal(false); setEditingEmp(null); }} className="h-9 rounded-lg px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
              <button type="submit" disabled={empSaving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
                {empSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {empSaving ? 'Saving…' : editingEmp ? 'Save changes' : 'Add employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════ RUN PAYROLL BIG POPUP ═══════════ */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => runModalStep !== 'processing' && setShowRunModal(false)} aria-label="Close" />
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {runModalStep === 'select' && 'Run payroll — select people'}
                  {runModalStep === 'processing' && 'Processing payroll…'}
                  {runModalStep === 'done' && 'Payroll finished'}
                </h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {runModalStep === 'select' && 'Search, sort, check people, set amounts, then pay.'}
                  {runModalStep === 'processing' && 'Do not close this window while payments are in flight.'}
                  {runModalStep === 'done' && 'Review results below or close and check History / Proofs.'}
                </p>
              </div>
              {runModalStep !== 'processing' && (
                <button onClick={() => setShowRunModal(false)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {runModalStep === 'select' && (
              <>
                <div className="space-y-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Pay period">
                      <input type="month" value={runPeriod} onChange={e => setRunPeriod(e.target.value)} className={inputCls} />
                    </Field>
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Privacy</span>
                      <div className="flex h-9 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <button type="button" onClick={() => setShielded(true)} className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold ${shielded ? 'bg-violet-600 text-white' : 'text-zinc-500'}`}>
                          <Shield className="h-3.5 w-3.5" /> Private
                        </button>
                        <button type="button" onClick={() => {
                          if (!settings.allowTransparentPayments) { setError('Public transfers disabled in Settings.'); return; }
                          setShielded(false);
                        }} className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold ${!shielded ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500'}`}>
                          <ShieldOff className="h-3.5 w-3.5" /> Public
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Selected total</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">{formatCurrency(runTotal, shielded ? 'XLM' : 'mixed')} · {selectedIds.size} people</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                      <input value={runSearch} onChange={e => setRunSearch(e.target.value)} placeholder="Search people…"
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
                    </div>
                    <select value={runDept} onChange={e => setRunDept(e.target.value)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                      <option value="all">All departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={runSort} onChange={e => setRunSort(e.target.value as any)} className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                      <option value="name">Sort: Name</option>
                      <option value="salary_high">Salary high</option>
                      <option value="salary_low">Salary low</option>
                      <option value="department">Department</option>
                    </select>
                    <button type="button" onClick={toggleAllVisible} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-800">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      {runModalPeople.length && runModalPeople.every(e => selectedIds.has(e.id)) ? 'Deselect visible' : 'Select visible'}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {runModalPeople.length === 0 ? (
                    <Empty icon={<Users className="h-9 w-9" />} title="No people to pay" detail="Add active employees with wallets in the Employees tab." />
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-zinc-100 bg-zinc-50 text-[10px] uppercase text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                        <tr>
                          <th className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={runModalPeople.length > 0 && runModalPeople.every(e => selectedIds.has(e.id))}
                              onChange={toggleAllVisible}
                              className="h-3.5 w-3.5 rounded"
                            />
                          </th>
                          <th className="px-3 py-2.5 font-semibold">Person</th>
                          <th className="px-3 py-2.5 font-semibold">Dept / Role</th>
                          <th className="px-3 py-2.5 font-semibold">Wallet</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {runModalPeople.map(emp => {
                          const checked = selectedIds.has(emp.id);
                          const amountVal = amountOverrides[emp.id] ?? String(emp.salary || '');
                          const walletBad = !isValidWallet(emp.walletAddress);
                          return (
                            <tr key={emp.id} className={checked ? 'bg-emerald-500/[0.04]' : ''}>
                              <td className="px-3 py-2.5">
                                <input type="checkbox" checked={checked} onChange={() => toggleId(emp.id)} className="h-3.5 w-3.5 rounded" />
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-zinc-900 dark:text-white">{emp.name}</p>
                                <p className="text-[10px] text-zinc-400">{emp.email}</p>
                              </td>
                              <td className="px-3 py-2.5 text-zinc-500">{emp.department || '—'} · {emp.role || '—'}</td>
                              <td className="px-3 py-2.5 font-mono text-[10px]">
                                {walletBad ? <span className="text-amber-600">No valid wallet</span> : truncateKey(emp.walletAddress, 4, 4)}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={!checked}
                                    value={amountVal}
                                    onChange={e => setAmountOverrides(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                    className="h-8 w-28 rounded-md border border-zinc-200 bg-white px-2 text-right text-xs font-semibold outline-none disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                                  />
                                  <span className="w-8 text-[10px] text-zinc-400">{shielded ? 'XLM' : emp.currency}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    {!walletOk ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <Wallet className="h-3.5 w-3.5" /> Connect funding wallet in Settings first
                      </span>
                    ) : settings.paymentApprovalRequired ? (
                      'Approval required — run will wait after create'
                    ) : (
                      'Will create run and process payments immediately'
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowRunModal(false)} className="h-9 rounded-lg px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={createAndProcessRun}
                      disabled={runSaving || selectedIds.size === 0 || !walletOk}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {runSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Pay {selectedIds.size} selected
                    </button>
                  </div>
                </div>
              </>
            )}

            {(runModalStep === 'processing' || runModalStep === 'done') && (
              <div className="flex min-h-[280px] flex-1 flex-col px-5 py-4">
                <div className="mb-3 flex items-center gap-2">
                  {runModalStep === 'processing' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  )}
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {runModalStep === 'processing' ? 'Processing payments…' : 'Batch complete'}
                  </span>
                </div>
                <div className="max-h-72 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  {processLog.length === 0 ? 'Starting…' : processLog.map((line, i) => <div key={i}>{line}</div>)}
                </div>
                {runModalStep === 'done' && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => { setShowRunModal(false); setTab('history'); }} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-700">
                      View history
                    </button>
                    <button type="button" onClick={() => { setShowRunModal(false); setTab('proofs'); }} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-medium dark:border-zinc-700">
                      View proofs
                    </button>
                    <button type="button" onClick={() => setShowRunModal(false)} className="h-9 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── UI atoms ─── */

const inputCls = 'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100';

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#080809]">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-900 dark:text-white">{value}</p>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}

function Empty({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center text-zinc-400">
      {icon}
      <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-zinc-500">{detail}</p>
      {action}
    </div>
  );
}

function Banner({ tone, children, onClose }: { tone: 'error' | 'success'; children: ReactNode; onClose: () => void }) {
  const styles = tone === 'error'
    ? 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400'
    : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400';
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${styles}`}>
      {tone === 'error' ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span className="flex-1">{children}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    pending_approval: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    approved: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    verified: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    partial: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
    cancelled: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    invited: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    inactive: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    terminated: 'bg-red-500/10 text-red-600',
    queued: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800',
    generating: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] || map.draft}`}>
      {statusLabel(status)}
    </span>
  );
}

function ProofStatusIcon({ status }: { status: string }) {
  if (status === 'verified') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
  if (status === 'generating') return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />;
  return <Clock className="h-4 w-4 shrink-0 text-zinc-400" />;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 text-xs text-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
    </div>
  );
}
