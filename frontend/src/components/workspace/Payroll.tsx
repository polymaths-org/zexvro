import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Filter,
  History,
  Play,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { employeeApi, payrollApi, payrollTaxonomyApi } from '../../api/api';
import { useWorkspaceStore } from '../../stores/workspace';
import { useZer0Store } from '../../stores/zer0';
import { connectFreighter, connectAlbedo, connectXBull, isValidStellarPublicKey } from '../../api/walletConnect';
import { Loader2 } from 'lucide-react';
import type {
  Zer0Currency,
  Zer0Employee,
  Zer0EmployeeStatus,
  Zer0PayFrequency,
  Zer0PaymentStatus,
} from '../../stores/types';

type PayrollTab = 'employees' | 'runs' | 'history' | 'roles' | 'departments' | 'settings';
type PayrollRunStatus = 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
type HistorySort = 'newest' | 'oldest' | 'role' | 'department' | 'amount_high' | 'amount_low' | 'status' | 'type';

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
  status?: PayrollRunStatus;
}

interface PayrollRun {
  id: string;
  workspaceId: string;
  period: string;
  lineItems: PayrollLineItem[];
  totalAmount: number;
  employeeCount: number;
  status: PayrollRunStatus;
  createdAt: number;
  updatedAt?: number;
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

interface HistoryRow {
  id: string;
  recipientName: string;
  recipientWallet: string;
  amount: number;
  currency: Zer0Currency;
  status: string;
  type: string;
  role: string;
  department: string;
  createdAt: number;
  processedAt: number | null;
}

interface PayrollTaxonomyItem {
  id: string;
  type: 'role' | 'department';
  name: string;
}

const TABS: Array<{ id: PayrollTab; label: string; icon: ReactNode }> = [
  { id: 'employees', label: 'Employees', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'runs', label: 'Payroll Runs', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'history', label: 'Payment History', icon: <History className="h-3.5 w-3.5" /> },
  { id: 'roles', label: 'Roles Manager', icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  { id: 'departments', label: 'Department Manager', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-3.5 w-3.5" /> },
];

const EMPLOYEE_STATUSES: Zer0EmployeeStatus[] = ['active', 'invited', 'inactive', 'terminated'];
const CURRENCIES: Zer0Currency[] = ['USDC', 'XLM', 'EURC'];
const FREQUENCIES: Zer0PayFrequency[] = ['weekly', 'bi-weekly', 'monthly', 'one-time'];
const RUN_STATUSES: PayrollRunStatus[] = ['pending_approval', 'approved', 'processing', 'completed', 'failed', 'cancelled'];

const EMPTY_FORM = (currency: Zer0Currency): EmployeeForm => ({
  name: '',
  email: '',
  department: '',
  role: '',
  walletAddress: '',
  salary: '',
  currency,
  frequency: 'monthly',
  status: 'active',
});

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  const safeAmount = typeof amount === 'number' ? amount : 0;
  return `${safeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`;
}

const CONVERSION_RATES: Record<Zer0Currency, { rate: number; symbol: string; label: string }> = {
  USDC: { rate: 1.00, symbol: '$', label: 'USD' },
  EURC: { rate: 1.08, symbol: '€', label: 'EUR' },
  XLM: { rate: 0.12, symbol: '$', label: 'USD' },
};

function formatFiatConversion(amount: number | null | undefined, cryptoCurrency: Zer0Currency, preferredFiat: 'USD' | 'EUR' = 'USD'): string {
  const safeAmount = typeof amount === 'number' ? amount : 0;
  const usdVal = safeAmount * (CONVERSION_RATES[cryptoCurrency]?.rate || 1);
  if (preferredFiat === 'EUR') {
    const eurVal = usdVal * 0.925; // 1 USD = 0.925 EUR approx
    return `€${eurVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  }
  return `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

function formatDate(value?: number | string | null) {
  if (!value) return 'Not processed';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeEmployee(raw: any, workspaceId: string): Zer0Employee {
  const now = Date.now();
  return {
    id: raw.id || raw.employeeId,
    projectId: raw.projectId || raw.workspaceId || workspaceId,
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || '',
    department: raw.department || '',
    walletAddress: raw.walletAddress || '',
    salary: Number(raw.salary || 0),
    currency: (raw.currency || 'USDC') as Zer0Currency,
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
    period: raw.period || 'Current period',
    lineItems: lineItems.map((item: any) => ({
      employeeId: item.employeeId || item.id || '',
      name: item.name || '',
      email: item.email || '',
      walletAddress: item.walletAddress || '',
      amount: Number(item.amount || 0),
      currency: (item.currency || raw.currency || 'USDC') as Zer0Currency,
      frequency: (item.frequency || 'monthly') as Zer0PayFrequency,
      department: item.department || '',
      role: item.role || '',
      status: (item.status || raw.status || 'pending_approval') as PayrollRunStatus,
    })),
    totalAmount: Number(raw.totalAmount || lineItems.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)),
    employeeCount: Number(raw.employeeCount || lineItems.length),
    status: (raw.status || 'pending_approval') as PayrollRunStatus,
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: raw.updatedAt ? Number(raw.updatedAt) : undefined,
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseEmployeeCsv(text: string, defaultCurrency: Zer0Currency): EmployeeForm[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});

    return {
      name: row.name || '',
      email: row.email || '',
      role: row.role || '',
      department: row.department || '',
      walletAddress: row.walletAddress || '',
      salary: row.salary || '0',
      currency: (row.currency || defaultCurrency) as Zer0Currency,
      frequency: (row.frequency || 'monthly') as Zer0PayFrequency,
      status: 'active' as Zer0EmployeeStatus,
    };
  }).filter(row => row.name || row.email);
}

function statusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return String(status).split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const palette: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600 dark:text-green-400',
    invited: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    inactive: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
    terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
    pending_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    processing: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
    failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
    cancelled: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
  };

  const safeStatus = status || 'unknown';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${palette[safeStatus] || palette.inactive}`}>
      {statusLabel(safeStatus)}
    </span>
  );
}

function uniqueSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function taxonomyIdFor(type: 'role' | 'department', name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return `${type}#${slug}`;
}

function normalizeTaxonomyItem(raw: any): PayrollTaxonomyItem | null {
  const type = raw?.type;
  const name = String(raw?.name || '').trim();
  if ((type !== 'role' && type !== 'department') || !name) return null;
  return {
    id: raw.id || raw.taxonomyId || taxonomyIdFor(type, name),
    type,
    name,
  };
}

function employeeWorkspaceMatches(employee: Zer0Employee, workspaceId: string) {
  const explicitWorkspaceId = (employee as any).workspaceId;
  return explicitWorkspaceId ? explicitWorkspaceId === workspaceId : employee.projectId === workspaceId;
}

export default function Payroll() {
  const { workspaceId: routeWorkspaceId } = useParams({ strict: false });
  const currentWorkspaceId = useWorkspaceStore(s => s.currentWorkspaceId);
  const activeWorkspaceId = String(routeWorkspaceId || currentWorkspaceId || '');
  const employees = useZer0Store(s => s.employees);
  const payments = useZer0Store(s => s.payments);
  const settingsState = useZer0Store(s => s.settings);
  const updateSettings = useZer0Store(s => s.updateSettings);

  const workspace = useWorkspaceStore(s => s.workspaces.find(w => w.id === activeWorkspaceId));
  const preferredCurrency = ((workspace?.settings as any)?.preferredCurrency || 'USD') as 'USD' | 'EUR';

  const [activeTab, setActiveTab] = useState<PayrollTab>('employees');
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<Zer0EmployeeStatus | 'all'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<Zer0PaymentStatus | PayrollRunStatus | 'all'>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historyRoleFilter, setHistoryRoleFilter] = useState('all');
  const [historyDepartmentFilter, setHistoryDepartmentFilter] = useState('all');
  const [historySort, setHistorySort] = useState<HistorySort>('newest');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [managedRoles, setManagedRoles] = useState<string[]>([]);
  const [managedDepartments, setManagedDepartments] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [roleAssignmentEmployeeId, setRoleAssignmentEmployeeId] = useState('');
  const [roleAssignmentValue, setRoleAssignmentValue] = useState('');
  const [departmentAssignmentEmployeeId, setDepartmentAssignmentEmployeeId] = useState('');
  const [departmentAssignmentValue, setDepartmentAssignmentValue] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Zer0Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(() => EMPTY_FORM(settingsState?.defaultCurrency || 'USDC'));
  const [csvPreview, setCsvPreview] = useState<EmployeeForm[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      employeeApi.list(activeWorkspaceId),
      payrollApi.listRuns(activeWorkspaceId),
      payrollTaxonomyApi.list(activeWorkspaceId),
    ])
      .then(([employeeData, runData, taxonomyData]) => {
        if (cancelled) return;
        useZer0Store.setState({
          employees: (employeeData.employees || []).map(employee => normalizeEmployee(employee, activeWorkspaceId)),
        });
        setPayrollRuns((runData.runs || []).map(run => normalizeRun(run, activeWorkspaceId)));
        const taxonomyItems = (taxonomyData.items || [])
          .map(normalizeTaxonomyItem)
          .filter((item): item is PayrollTaxonomyItem => Boolean(item));
        setManagedRoles(uniqueSorted(taxonomyItems.filter(item => item.type === 'role').map(item => item.name)));
        setManagedDepartments(uniqueSorted(taxonomyItems.filter(item => item.type === 'department').map(item => item.name)));
      })
      .catch(err => setErrorMessage(err.message || 'Failed to load payroll data.'))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setRoleAssignmentEmployeeId('');
    setRoleAssignmentValue('');
    setDepartmentAssignmentEmployeeId('');
    setDepartmentAssignmentValue('');
  }, [activeWorkspaceId]);

  const workspaceEmployees = useMemo(() => {
    if (!activeWorkspaceId) return [];
    return employees.filter(employee => employeeWorkspaceMatches(employee, activeWorkspaceId));
  }, [activeWorkspaceId, employees]);

  const employeeById = useMemo(() => {
    return new Map(workspaceEmployees.map(employee => [employee.id, employee]));
  }, [workspaceEmployees]);

  const isWalletConnected = settingsState?.walletAddress && /^G[A-Z2-7]{55}$/.test(settingsState.walletAddress);

  const visibleEmployees = useMemo(() => {
    return workspaceEmployees.filter(employee => {
      if (departmentFilter !== 'all' && employee.department !== departmentFilter) return false;
      if (roleFilter !== 'all' && employee.role !== roleFilter) return false;
      if (statusFilter !== 'all' && employee.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return [employee.name, employee.email, employee.role, employee.department, employee.walletAddress]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [departmentFilter, roleFilter, searchQuery, statusFilter, workspaceEmployees]);

  const payrollEmployees = useMemo(() => {
    return workspaceEmployees.filter(employee => employee.status === 'active');
  }, [workspaceEmployees]);

  const departments = useMemo(() => {
    return uniqueSorted([...managedDepartments, ...workspaceEmployees.map(employee => employee.department)]);
  }, [managedDepartments, workspaceEmployees]);

  const roles = useMemo(() => {
    return uniqueSorted([...managedRoles, ...workspaceEmployees.map(employee => employee.role)]);
  }, [managedRoles, workspaceEmployees]);

  const runReviewItems: PayrollLineItem[] = useMemo(() => {
    return payrollEmployees.map(employee => ({
      employeeId: employee.id,
      name: employee.name,
      email: employee.email,
      walletAddress: employee.walletAddress,
      amount: employee.salary,
      currency: employee.currency,
      frequency: employee.frequency,
      department: employee.department,
      role: employee.role,
      status: 'pending_approval',
    }));
  }, [payrollEmployees]);

  const runTotal = useMemo(() => {
    return runReviewItems.reduce((sum, item) => sum + item.amount, 0);
  }, [runReviewItems]);

  const runTotalFiat = useMemo(() => {
    return runReviewItems.reduce((sum, item) => {
      const rate = CONVERSION_RATES[item.currency]?.rate || 1.00;
      const usdVal = item.amount * rate;
      if (preferredCurrency === 'EUR') {
        return sum + (usdVal * 0.925);
      }
      return sum + usdVal;
    }, 0);
  }, [runReviewItems, preferredCurrency]);

  const historyRows = useMemo<HistoryRow[]>(() => {
    const runRows = payrollRuns.flatMap(run =>
      run.lineItems.map(item => {
        const employee = employeeById.get(item.employeeId);
        return {
          id: `${run.id}_${item.employeeId}`,
          recipientName: item.name,
          recipientWallet: item.walletAddress,
          amount: item.amount,
          currency: item.currency,
          status: (item.status || run.status) as string,
          type: 'payroll',
          role: item.role || employee?.role || '',
          department: item.department || employee?.department || '',
          createdAt: run.createdAt,
          processedAt: run.status === 'completed' ? run.updatedAt || run.createdAt : null,
        };
      })
    );

    const paymentRows = payments
      .filter(payment => payment.projectId === activeWorkspaceId || (payment.employeeId ? employeeById.has(payment.employeeId) : false))
      .map(payment => {
        const employee = payment.employeeId ? employeeById.get(payment.employeeId) : undefined;
        return {
          id: payment.id,
          recipientName: payment.recipientName,
          recipientWallet: payment.recipientWallet,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          type: payment.type,
          role: employee?.role || '',
          department: employee?.department || '',
          createdAt: payment.createdAt,
          processedAt: payment.processedAt,
        };
      });

    return [...runRows, ...paymentRows]
      .filter(row => {
        if (historyStatusFilter !== 'all' && row.status !== historyStatusFilter) return false;
        if (historyTypeFilter !== 'all' && row.type !== historyTypeFilter) return false;
        if (historyRoleFilter !== 'all' && row.role !== historyRoleFilter) return false;
        if (historyDepartmentFilter !== 'all' && row.department !== historyDepartmentFilter) return false;
        if (historyStartDate && row.createdAt < new Date(historyStartDate).getTime()) return false;
        if (historyEndDate && row.createdAt > new Date(historyEndDate).getTime() + 24 * 3600 * 1000) return false;
        return true;
      })
      .sort((a, b) => {
        if (historySort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
        if (historySort === 'role') return String(a.role || 'Unassigned').localeCompare(String(b.role || 'Unassigned')) || (b.createdAt || 0) - (a.createdAt || 0);
        if (historySort === 'department') return String(a.department || 'Unassigned').localeCompare(String(b.department || 'Unassigned')) || (b.createdAt || 0) - (a.createdAt || 0);
        if (historySort === 'amount_high') return (b.amount || 0) - (a.amount || 0) || (b.createdAt || 0) - (a.createdAt || 0);
        if (historySort === 'amount_low') return (a.amount || 0) - (b.amount || 0) || (b.createdAt || 0) - (a.createdAt || 0);
        if (historySort === 'status') return String(a.status || '').localeCompare(String(b.status || '')) || (b.createdAt || 0) - (a.createdAt || 0);
        if (historySort === 'type') return String(a.type || '').localeCompare(String(b.type || '')) || (b.createdAt || 0) - (a.createdAt || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [activeWorkspaceId, employeeById, historyDepartmentFilter, historyEndDate, historyRoleFilter, historySort, historyStartDate, historyStatusFilter, historyTypeFilter, payments, payrollRuns]);

  const totalPayrollFiat = visibleEmployees.reduce((sum, employee) => {
    const rate = CONVERSION_RATES[employee.currency]?.rate || 1.00;
    const usdVal = employee.salary * rate;
    if (preferredCurrency === 'EUR') {
      return sum + (usdVal * 0.925);
    }
    return sum + usdVal;
  }, 0);

  const cryptoBreakdown = useMemo(() => {
    const counts = {} as Record<Zer0Currency, number>;
    visibleEmployees.forEach(e => {
      counts[e.currency] = (counts[e.currency] || 0) + e.salary;
    });
    return Object.entries(counts)
      .map(([curr, amt]) => `${amt.toLocaleString()} ${curr}`)
      .join(' + ');
  }, [visibleEmployees]);

  function applyTaxonomyItem(item: PayrollTaxonomyItem) {
    if (item.type === 'role') {
      setManagedRoles(current => uniqueSorted([...current, item.name]));
      return;
    }
    setManagedDepartments(current => uniqueSorted([...current, item.name]));
  }

  async function ensureTaxonomyValue(type: 'role' | 'department', name: string) {
    const value = name.trim();
    if (!activeWorkspaceId || !value) return;
    if (type === 'role' && managedRoles.includes(value)) return;
    if (type === 'department' && managedDepartments.includes(value)) return;

    const response = await payrollTaxonomyApi.create({
      workspaceId: activeWorkspaceId,
      type,
      name: value,
    });
    const item = normalizeTaxonomyItem(response.item || { id: taxonomyIdFor(type, value), type, name: value });
    if (item) applyTaxonomyItem(item);
  }

  async function registerTaxonomy(role: string, department: string) {
    await Promise.all([
      ensureTaxonomyValue('role', role),
      ensureTaxonomyValue('department', department),
    ]);
  }

  async function registerTaxonomyValues(roleValues: string[], departmentValues: string[]) {
    const nextRoles = uniqueSorted(roleValues);
    const nextDepartments = uniqueSorted(departmentValues);
    await Promise.all([
      ...nextRoles.map(role => ensureTaxonomyValue('role', role)),
      ...nextDepartments.map(department => ensureTaxonomyValue('department', department)),
    ]);
  }

  function openAddEmployee(defaults: Partial<Pick<EmployeeForm, 'role' | 'department'>> = {}) {
    setEditingEmployee(null);
    setEmployeeForm({ ...EMPTY_FORM(settingsState?.defaultCurrency || 'USDC'), ...defaults });
    setErrorMessage('');
    setShowEmployeeModal(true);
  }

  async function addRole(event: FormEvent) {
    event.preventDefault();
    const value = newRole.trim();
    if (!value) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await ensureTaxonomyValue('role', value);
      setRoleAssignmentValue(value);
      setNewRole('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save role.');
    } finally {
      setIsSaving(false);
    }
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    const value = newDepartment.trim();
    if (!value) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await ensureTaxonomyValue('department', value);
      setDepartmentAssignmentValue(value);
      setNewDepartment('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save department.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRole(role: string) {
    if (workspaceEmployees.some(employee => employee.role === role)) {
      setErrorMessage('Move employees out of this role before deleting it.');
      return;
    }
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await payrollTaxonomyApi.delete(taxonomyIdFor('role', role), activeWorkspaceId);
      setManagedRoles(current => current.filter(item => item !== role));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete role.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDepartment(department: string) {
    if (workspaceEmployees.some(employee => employee.department === department)) {
      setErrorMessage('Move employees out of this department before deleting it.');
      return;
    }
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await payrollTaxonomyApi.delete(taxonomyIdFor('department', department), activeWorkspaceId);
      setManagedDepartments(current => current.filter(item => item !== department));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete department.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateEmployeeAssignment(employeeId: string, updates: Partial<Pick<Zer0Employee, 'role' | 'department'>>) {
    const employee = workspaceEmployees.find(item => item.id === employeeId);
    if (!employee || !activeWorkspaceId) return;

    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await employeeApi.update(employee.id, {
        workspaceId: activeWorkspaceId,
        projectId: employee.projectId || activeWorkspaceId,
        ...updates,
      });
      const updated = normalizeEmployee(response.employee || { ...employee, ...updates }, activeWorkspaceId);
      useZer0Store.setState(state => ({
        employees: state.employees.map(item => item.id === employee.id ? updated : item),
      }));
      await registerTaxonomy(updated.role, updated.department);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update employee assignment.');
    } finally {
      setIsSaving(false);
    }
  }

  function openEditEmployee(employee: Zer0Employee) {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      email: employee.email,
      department: employee.department,
      role: employee.role,
      walletAddress: employee.walletAddress,
      salary: String(employee.salary),
      currency: employee.currency,
      frequency: employee.frequency,
      status: employee.status,
    });
    setErrorMessage('');
    setShowEmployeeModal(true);
  }

  async function handleEmployeeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId) {
      setErrorMessage('Select a workspace before saving employees.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    const now = Date.now();
    const payload = {
      workspaceId: activeWorkspaceId,
      projectId: activeWorkspaceId,
      ...employeeForm,
      salary: Number(employeeForm.salary || 0),
      startDate: editingEmployee?.startDate || now,
    };

    try {
      if (editingEmployee) {
        const response = await employeeApi.update(editingEmployee.id, payload);
        const employee = normalizeEmployee(response.employee || { ...editingEmployee, ...payload }, activeWorkspaceId);
        useZer0Store.setState(state => ({
          employees: state.employees.map(item => item.id === editingEmployee.id ? employee : item),
        }));
        await registerTaxonomy(employee.role, employee.department);
      } else {
        const response = await employeeApi.create(payload);
        const employee = normalizeEmployee(response.employee || payload, activeWorkspaceId);
        useZer0Store.setState(state => ({
          employees: [...state.employees.filter(item => item.id !== employee.id), employee],
        }));
        await registerTaxonomy(employee.role, employee.department);
      }
      setShowEmployeeModal(false);
      setEditingEmployee(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save employee.');
    } finally {
      setIsSaving(false);
    }
  }

  async function terminateEmployee(employee: Zer0Employee) {
    if (!activeWorkspaceId) return;

    setErrorMessage('');
    try {
      const response = await employeeApi.delete(employee.id);
      const updated = normalizeEmployee(response.employee || { ...employee, status: 'terminated' }, activeWorkspaceId);
      useZer0Store.setState(state => ({
        employees: state.employees.map(item => item.id === employee.id ? updated : item),
      }));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to terminate employee.');
    }
  }

  async function handleCsvChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    const rows = parseEmployeeCsv(text, settingsState?.defaultCurrency || 'USDC');
    setCsvPreview(rows);
    setShowCsvModal(true);
  }

  async function confirmCsvImport() {
    if (!activeWorkspaceId || csvPreview.length === 0) return;

    setIsSaving(true);
    setErrorMessage('');
    try {
      const employeesPayload = csvPreview.map(row => ({
        ...row,
        workspaceId: activeWorkspaceId,
        projectId: activeWorkspaceId,
        salary: Number(row.salary || 0),
      }));
      const response = await employeeApi.bulkCreate({ workspaceId: activeWorkspaceId, employees: employeesPayload });
      const imported = (response.employees || employeesPayload).map((employee: any) => normalizeEmployee(employee, activeWorkspaceId));
      useZer0Store.setState(state => ({
        employees: [
          ...state.employees.filter(existing => !imported.some(employee => employee.id === existing.id)),
          ...imported,
        ],
      }));
      await registerTaxonomyValues(
        imported.map((employee: Zer0Employee) => employee.role),
        imported.map((employee: Zer0Employee) => employee.department),
      );
      setCsvPreview([]);
      setShowCsvModal(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to import employees.');
    } finally {
      setIsSaving(false);
    }
  }

  async function createPayrollRun() {
    if (!activeWorkspaceId || runReviewItems.length === 0) return;

    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await payrollApi.createRun({
        workspaceId: activeWorkspaceId,
        period: payrollPeriod,
        lineItems: runReviewItems,
        totalAmount: runTotal,
        employeeCount: runReviewItems.length,
        status: settingsState?.paymentApprovalRequired ? 'pending_approval' : 'approved',
      });
      const run = normalizeRun(response.run, activeWorkspaceId);
      setPayrollRuns(current => [run, ...current.filter(item => item.id !== run.id)]);
      setShowRunModal(false);
      setActiveTab('runs');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create payroll run.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRunStatus(run: PayrollRun, status: PayrollRunStatus) {
    setErrorMessage('');
    try {
      const response = await payrollApi.updateRun(run.id, { workspaceId: run.workspaceId, status });
      const updated = normalizeRun(response.run || { ...run, status, updatedAt: Date.now() }, activeWorkspaceId);
      setPayrollRuns(current => current.map(item => item.id === run.id ? updated : item));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update payroll run.');
    }
  }

  function exportHistory() {
    const header = ['recipientName', 'walletAddress', 'role', 'department', 'amount', 'currency', 'type', 'status', 'createdAt', 'processedAt'];
    const rows = historyRows.map(row => [
      row.recipientName,
      row.recipientWallet,
      row.role || '',
      row.department || '',
      row.amount,
      row.currency,
      row.type,
      row.status,
      new Date(row.createdAt).toISOString(),
      row.processedAt ? new Date(row.processedAt).toISOString() : '',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zexvro-payment-history-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {!isWalletConnected && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Funding Wallet Disconnected</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  A Stellar funding wallet is required to process payroll runs and fund employee wallets. Go to the Settings tab to configure it.
                </p>
              </div>
            </div>
            {activeTab !== 'settings' && (
              <button
                onClick={() => setActiveTab('settings')}
                className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-amber-650 px-4 text-xs font-semibold text-white hover:bg-amber-650 transition shadow-sm shrink-0"
              >
                Go to Settings
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Payroll</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {isLoading ? 'Loading payroll records...' : `${visibleEmployees.length} employees, ${payrollRuns.length} payroll runs`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowRunModal(true)}
            disabled={payrollEmployees.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Play className="h-3.5 w-3.5" />
            Run Payroll
          </button>
          <button
            onClick={() => openAddEmployee()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Employee
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={<Users className="h-4 w-4" />} label="Employees" value={String(workspaceEmployees.length)} />
        <Metric icon={<Check className="h-4 w-4" />} label="Active" value={String(payrollEmployees.length)} />
        <Metric icon={<BadgeCheck className="h-4 w-4" />} label="Roles" value={String(roles.length)} />
        <Metric icon={<Building2 className="h-4 w-4" />} label="Departments" value={String(departments.length)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Metric icon={<Clock className="h-4 w-4" />} label="Runs" value={String(payrollRuns.length)} />
        <Metric
          icon={<Calendar className="h-4 w-4" />}
          label="Visible Payroll"
          value={preferredCurrency === 'EUR' ? `€${totalPayrollFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} EUR` : `$${totalPayrollFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`}
          detail={cryptoBreakdown ? `Breakdown: ${cryptoBreakdown}` : undefined}
        />
      </div>

      <div className="flex overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-[#080809]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search employees"
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={departmentFilter}
                onChange={event => setDepartmentFilter(event.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="all">All departments</option>
                {departments.map(department => <option key={department} value={department}>{department}</option>)}
              </select>
              <select
                value={roleFilter}
                onChange={event => setRoleFilter(event.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="all">All roles</option>
                {roles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as Zer0EmployeeStatus | 'all')}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="all">All statuses</option>
                {EMPLOYEE_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                <Upload className="h-3.5 w-3.5" />
                Import CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvChange} />
              </label>
            </div>
          </div>

          <DataPanel>
            {visibleEmployees.length === 0 ? (
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="No employees yet. Add your first team member or import from CSV."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Wallet Address</th>
                      <th className="px-4 py-3 font-semibold">Salary</th>
                      <th className="px-4 py-3 font-semibold">Currency</th>
                      <th className="px-4 py-3 font-semibold">Frequency</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {visibleEmployees.map(employee => (
                      <tr key={employee.id} className="text-xs text-zinc-650 dark:text-zinc-300">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{employee.name}</td>
                        <td className="px-4 py-3">{employee.email}</td>
                        <td className="px-4 py-3">{employee.department || 'Unassigned'}</td>
                        <td className="px-4 py-3">{employee.role || 'Member'}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px]">{employee.walletAddress || 'No wallet'}</td>
                        <td className="px-4 py-3 font-semibold">
                          <div>{employee.salary.toLocaleString()}</div>
                          <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                            ~ {formatFiatConversion(employee.salary, employee.currency, preferredCurrency)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{employee.currency}</td>
                        <td className="px-4 py-3">{statusLabel(employee.frequency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={employee.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openEditEmployee(employee)}
                              title="Edit employee"
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => terminateEmployee(employee)}
                              title="Terminate employee"
                              disabled={employee.status === 'terminated'}
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>
        </section>
      )}

      {activeTab === 'runs' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Payroll Runs</h2>
              <p className="mt-1 text-xs text-zinc-500">{payrollEmployees.length} active employees are eligible for the next run.</p>
            </div>
            <button
              onClick={() => setShowRunModal(true)}
              disabled={payrollEmployees.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Play className="h-3.5 w-3.5" />
              Run Payroll
            </button>
          </div>

          <DataPanel>
            {payrollRuns.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-10 w-10" />}
                title="No payroll runs yet. Add employees first, then run your first payroll."
              />
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {payrollRuns.map(run => (
                  <div key={run.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{run.period}</h3>
                        <StatusBadge status={run.status} />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDate(run.createdAt)} - {run.employeeCount} employees - {formatCurrency(run.totalAmount, settingsState?.defaultCurrency || 'USDC')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {run.status === 'pending_approval' && (
                        <button onClick={() => updateRunStatus(run, 'approved')} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      )}
                      {(run.status === 'approved' || run.status === 'pending_approval') && (
                        <button onClick={() => updateRunStatus(run, 'processing')} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                          <ChevronRight className="h-3.5 w-3.5" />
                          Process
                        </button>
                      )}
                      {run.status === 'processing' && (
                        <button onClick={() => updateRunStatus(run, 'completed')} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-green-600 px-2.5 text-xs font-medium text-white hover:bg-green-700">
                          <Check className="h-3.5 w-3.5" />
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <select value={historyStatusFilter} onChange={event => setHistoryStatusFilter(event.target.value as any)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <option value="all">All statuses</option>
                {RUN_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <select value={historyTypeFilter} onChange={event => setHistoryTypeFilter(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <option value="all">All types</option>
                <option value="payroll">Payroll</option>
                <option value="contractor">Contractor</option>
                <option value="bonus">Bonus</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="one-time">One-time</option>
              </select>
              <select value={historyRoleFilter} onChange={event => setHistoryRoleFilter(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <option value="all">All roles</option>
                {roles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <select value={historyDepartmentFilter} onChange={event => setHistoryDepartmentFilter(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <option value="all">All departments</option>
                {departments.map(department => <option key={department} value={department}>{department}</option>)}
              </select>
              <select value={historySort} onChange={event => setHistorySort(event.target.value as HistorySort)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="role">Role A-Z</option>
                <option value="department">Department A-Z</option>
                <option value="amount_high">Amount high-low</option>
                <option value="amount_low">Amount low-high</option>
                <option value="status">Status A-Z</option>
                <option value="type">Type A-Z</option>
              </select>
              <input type="date" value={historyStartDate} onChange={event => setHistoryStartDate(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" />
              <input type="date" value={historyEndDate} onChange={event => setHistoryEndDate(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" />
            </div>
            <button onClick={exportHistory} className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          <DataPanel>
            {historyRows.length === 0 ? (
              <EmptyState icon={<History className="h-10 w-10" />} title="No payment history matches the selected filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Recipient</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {historyRows.map(row => (
                      <tr key={row.id} className="text-xs text-zinc-650 dark:text-zinc-300">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900 dark:text-white">{row.recipientName}</p>
                          <p className="mt-0.5 max-w-[260px] truncate font-mono text-[10px] text-zinc-400">{row.recipientWallet || 'No wallet'}</p>
                        </td>
                        <td className="px-4 py-3">{row.role || 'Unassigned'}</td>
                        <td className="px-4 py-3">{row.department || 'Unassigned'}</td>
                        <td className="px-4 py-3">{statusLabel(row.type)}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(row.amount, row.currency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                        <td className="px-4 py-3">{formatDate(row.processedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>
        </section>
      )}

      {activeTab === 'roles' && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <DataPanel>
              <form onSubmit={addRole} className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add Role</h2>
                  <p className="mt-1 text-xs text-zinc-500">Create reusable role labels for employees and payment history filters.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newRole}
                    onChange={event => setNewRole(event.target.value)}
                    placeholder="Role name"
                    className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </form>
            </DataPanel>

            <DataPanel>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Assign Employee Role</h2>
                  <p className="mt-1 text-xs text-zinc-500">Move an existing employee into a role without opening the full employee editor.</p>
                </div>
                <select
                  value={roleAssignmentEmployeeId}
                  onChange={event => setRoleAssignmentEmployeeId(event.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <option value="">Select employee</option>
                  {workspaceEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name || employee.email}</option>)}
                </select>
                <select
                  value={roleAssignmentValue}
                  onChange={event => setRoleAssignmentValue(event.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <option value="">Select role</option>
                  {roles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!roleAssignmentEmployeeId || !roleAssignmentValue || isSaving}
                  onClick={() => updateEmployeeAssignment(roleAssignmentEmployeeId, { role: roleAssignmentValue })}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Role Assignment
                </button>
              </div>
            </DataPanel>
          </div>

          <DataPanel>
            {roles.length === 0 ? (
              <EmptyState icon={<BadgeCheck className="h-10 w-10" />} title="No roles yet. Add a role, then assign employees to it." />
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {roles.map(role => {
                  const assigned = workspaceEmployees.filter(employee => employee.role === role);
                  const rolePayroll = assigned.reduce((sum, employee) => sum + employee.salary, 0);
                  return (
                    <div key={role} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{role}</h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {assigned.length} employees - {formatCurrency(rolePayroll, settingsState?.defaultCurrency || 'USDC')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAddEmployee({ role })}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Employee
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRole(role)}
                          disabled={assigned.length > 0}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DataPanel>
        </section>
      )}

      {activeTab === 'departments' && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <DataPanel>
              <form onSubmit={addDepartment} className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add Department</h2>
                  <p className="mt-1 text-xs text-zinc-500">Create departments for payroll grouping and payment history filtering.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newDepartment}
                    onChange={event => setNewDepartment(event.target.value)}
                    placeholder="Department name"
                    className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </form>
            </DataPanel>

            <DataPanel>
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Assign Employee Department</h2>
                  <p className="mt-1 text-xs text-zinc-500">Move an existing employee into a department directly.</p>
                </div>
                <select
                  value={departmentAssignmentEmployeeId}
                  onChange={event => setDepartmentAssignmentEmployeeId(event.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <option value="">Select employee</option>
                  {workspaceEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name || employee.email}</option>)}
                </select>
                <select
                  value={departmentAssignmentValue}
                  onChange={event => setDepartmentAssignmentValue(event.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <option value="">Select department</option>
                  {departments.map(department => <option key={department} value={department}>{department}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!departmentAssignmentEmployeeId || !departmentAssignmentValue || isSaving}
                  onClick={() => updateEmployeeAssignment(departmentAssignmentEmployeeId, { department: departmentAssignmentValue })}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Department Assignment
                </button>
              </div>
            </DataPanel>
          </div>

          <DataPanel>
            {departments.length === 0 ? (
              <EmptyState icon={<Building2 className="h-10 w-10" />} title="No departments yet. Add a department, then assign employees to it." />
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {departments.map(department => {
                  const assigned = workspaceEmployees.filter(employee => employee.department === department);
                  const departmentPayroll = assigned.reduce((sum, employee) => sum + employee.salary, 0);
                  return (
                    <div key={department} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{department}</h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {assigned.length} employees - {formatCurrency(departmentPayroll, settingsState?.defaultCurrency || 'USDC')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAddEmployee({ department })}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Employee
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDepartment(department)}
                          disabled={assigned.length > 0}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DataPanel>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <SettingField label="Default currency">
              <select value={settingsState?.defaultCurrency || 'USDC'} onChange={event => updateSettings({ defaultCurrency: event.target.value as Zer0Currency })} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </SettingField>
            <SettingField label="Payment approval required">
              <label className="inline-flex h-9 items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={!!settingsState?.paymentApprovalRequired}
                  onChange={event => updateSettings({ paymentApprovalRequired: event.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                />
                Require approval before processing
              </label>
            </SettingField>
            <SettingField label="Timezone">
              <input value={settingsState?.timezone || ''} onChange={event => updateSettings({ timezone: event.target.value })} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" />
            </SettingField>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Funding Wallet Connection</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Connect a Stellar wallet extension or manually enter a public key starting with 'G'.
              </p>
            </div>

            <div className="grid gap-3">
              <SettingField label="Stellar Public Key">
                <input
                  value={settingsState?.walletAddress || ''}
                  onChange={event => updateSettings({ walletAddress: event.target.value })}
                  placeholder="G..."
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />
              </SettingField>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={walletLoading}
                  onClick={async () => {
                    setWalletLoading(true);
                    setWalletError(null);
                    setConnectedProvider('Freighter');
                    try {
                      const conn = await connectFreighter();
                      updateSettings({ walletAddress: conn.publicKey });
                    } catch (err: any) {
                      setWalletError(err.message || 'Freighter connection failed');
                    } finally {
                      setWalletLoading(false);
                    }
                  }}
                  className="h-10 rounded-lg border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  {walletLoading && connectedProvider === 'Freighter' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect Freighter
                </button>
                <button
                  type="button"
                  disabled={walletLoading}
                  onClick={async () => {
                    setWalletLoading(true);
                    setWalletError(null);
                    setConnectedProvider('Albedo');
                    try {
                      const conn = await connectAlbedo();
                      updateSettings({ walletAddress: conn.publicKey });
                    } catch (err: any) {
                      setWalletError(err.message || 'Albedo connection failed');
                    } finally {
                      setWalletLoading(false);
                    }
                  }}
                  className="h-10 rounded-lg border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  {walletLoading && connectedProvider === 'Albedo' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect Albedo
                </button>
                <button
                  type="button"
                  disabled={walletLoading}
                  onClick={async () => {
                    setWalletLoading(true);
                    setWalletError(null);
                    setConnectedProvider('xBull');
                    try {
                      const conn = await connectXBull();
                      updateSettings({ walletAddress: conn.publicKey });
                    } catch (err: any) {
                      setWalletError(err.message || 'xBull connection failed');
                    } finally {
                      setWalletLoading(false);
                    }
                  }}
                  className="h-10 rounded-lg border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  {walletLoading && connectedProvider === 'xBull' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect xBull
                </button>
              </div>

              {walletError && (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded-lg p-3">
                  {walletError}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {showEmployeeModal && (
        <Modal title={editingEmployee ? 'Edit Employee' : 'Add Employee'} onClose={() => setShowEmployeeModal(false)}>
          <form onSubmit={handleEmployeeSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Name" required value={employeeForm.name} onChange={value => setEmployeeForm(form => ({ ...form, name: value }))} />
              <TextField label="Email" required type="email" value={employeeForm.email} onChange={value => setEmployeeForm(form => ({ ...form, email: value }))} />
              <Field label="Department">
                <input
                  list="payroll-departments"
                  value={employeeForm.department}
                  onChange={event => setEmployeeForm(form => ({ ...form, department: event.target.value }))}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <datalist id="payroll-departments">
                  {departments.map(department => <option key={department} value={department} />)}
                </datalist>
              </Field>
              <Field label="Role">
                <input
                  list="payroll-roles"
                  value={employeeForm.role}
                  onChange={event => setEmployeeForm(form => ({ ...form, role: event.target.value }))}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <datalist id="payroll-roles">
                  {roles.map(role => <option key={role} value={role} />)}
                </datalist>
              </Field>
              <TextField label="Wallet Address" value={employeeForm.walletAddress} onChange={value => setEmployeeForm(form => ({ ...form, walletAddress: value }))} />
              <div>
                <TextField label="Salary" required type="number" value={employeeForm.salary} onChange={value => setEmployeeForm(form => ({ ...form, salary: value }))} />
                <div className="text-[10px] text-zinc-500 mt-1 pl-1 font-medium">
                  Equivalent: {formatFiatConversion(Number(employeeForm.salary || 0), employeeForm.currency, preferredCurrency)}
                </div>
              </div>
              <Field label="Currency">
                <select value={employeeForm.currency} onChange={event => setEmployeeForm(form => ({ ...form, currency: event.target.value as Zer0Currency }))} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </Field>
              <Field label="Frequency">
                <select value={employeeForm.frequency} onChange={event => setEmployeeForm(form => ({ ...form, frequency: event.target.value as Zer0PayFrequency }))} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  {FREQUENCIES.map(frequency => <option key={frequency} value={frequency}>{statusLabel(frequency)}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={employeeForm.status} onChange={event => setEmployeeForm(form => ({ ...form, status: event.target.value as Zer0EmployeeStatus }))} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  {EMPLOYEE_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </Field>
            </div>
            <ModalActions onCancel={() => setShowEmployeeModal(false)} isSaving={isSaving} saveLabel={editingEmployee ? 'Save Changes' : 'Add Employee'} />
          </form>
        </Modal>
      )}

      {showCsvModal && (
        <Modal title="Import Employees" onClose={() => setShowCsvModal(false)}>
          <div className="space-y-4">
            <div className="max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[700px] text-left">
                <thead className="border-b border-zinc-100 text-[10px] uppercase text-zinc-400 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Salary</th>
                    <th className="px-3 py-2">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {csvPreview.map((row, index) => (
                    <tr key={`${row.email}_${index}`} className="text-xs text-zinc-650 dark:text-zinc-300">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2">{row.department}</td>
                      <td className="px-3 py-2">{row.salary}</td>
                      <td className="px-3 py-2">{row.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ModalActions onCancel={() => setShowCsvModal(false)} onSave={confirmCsvImport} isSaving={isSaving} saveLabel={`Import ${csvPreview.length}`} />
          </div>
        </Modal>
      )}

      {showRunModal && (
        <Modal title="Run Payroll" onClose={() => setShowRunModal(false)}>
          <div className="space-y-4">
            <Field label="Period">
              <input type="month" value={payrollPeriod} onChange={event => setPayrollPeriod(event.target.value)} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </Field>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 text-xs dark:border-zinc-800">
                <span className="font-semibold text-zinc-900 dark:text-white">{runReviewItems.length} employees</span>
                <div className="text-right">
                  <span className="font-semibold text-zinc-900 dark:text-white block">
                    {preferredCurrency === 'EUR' ? `€${runTotalFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} EUR` : `$${runTotalFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                    ({cryptoBreakdown})
                  </span>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-zinc-100 overflow-auto dark:divide-zinc-800">
                {runReviewItems.map(item => (
                  <div key={item.employeeId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white">{item.name}</p>
                      <p className="truncate text-zinc-500">{item.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-zinc-900 dark:text-white block">{formatCurrency(item.amount, item.currency)}</span>
                      <span className="text-[10px] text-zinc-400 font-normal block mt-0.5">~ {formatFiatConversion(item.amount, item.currency, preferredCurrency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ModalActions onCancel={() => setShowRunModal(false)} onSave={createPayrollRun} isSaving={isSaving} saveLabel="Confirm Run" />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 truncate text-xl font-semibold text-zinc-900 dark:text-white">{value}</p>
      {detail && <div className="mt-1.5 text-[10px] text-zinc-400 font-medium">{detail}</div>}
    </div>
  );
}

function DataPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
      {children}
    </div>
  );
}

function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center text-zinc-400">
      {icon}
      <p className="mt-3 max-w-md text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close modal" />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function TextField({ label, value, onChange, required, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        required={required}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </Field>
  );
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</p>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSave, isSaving, saveLabel }: {
  onCancel: () => void;
  onSave?: () => void;
  isSaving: boolean;
  saveLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
        Cancel
      </button>
      <button
        type={onSave ? 'button' : 'submit'}
        onClick={onSave}
        disabled={isSaving}
        className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSaving ? 'Saving...' : saveLabel}
      </button>
    </div>
  );
}
