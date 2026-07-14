import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  Search, Plus, X, Users, Mail, Wallet, Briefcase,
  MoreHorizontal, Edit3, UserX, ChevronDown, Shield, Copy, Check, Loader2, Ghost,
} from 'lucide-react';
import { employeeApi } from '../../api/api';
import { useZer0Store } from '../../stores/zer0';
import { useStealthStore } from '../../stores/stealth';
import { generateStealthIdentity, isStealthMetaAddress, shortAddr } from '../../lib/stealth';
import { copyText } from '../../lib/clipboard';
import type { Zer0Employee, Zer0Currency, Zer0PayFrequency, Zer0EmployeeStatus } from '../../stores/types';

const DEPARTMENTS = ['Engineering', 'Design', 'Operations', 'Finance', 'Marketing', 'Sales', 'Legal', 'Other'];
const ROLES = ['Employee', 'Contractor', 'Manager', 'Director', 'VP', 'C-Suite'];

export default function Zer0People() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || workspaceId || '';
  const scopeWorkspaceId = workspaceId || pid;

  const allEmployees = useZer0Store(s => s.employees);
  const updateEmployee = useZer0Store(s => s.updateEmployee);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Zer0EmployeeStatus | 'all'>('all');
  const [filterDept, setFilterDept] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const setEmployeeMeta = useStealthStore(s => s.setEmployeeMeta);
  const importIdentity = useStealthStore(s => s.importIdentity);
  const employeeMetaMap = useStealthStore(s => s.employeeMeta);
  const updateSettings = useZer0Store(s => s.updateSettings);
  const stealthPaymentsEnabled = useZer0Store(s => s.settings.stealthPaymentsEnabled);

  // Form state
  const [form, setForm] = useState({
    name: '', email: '', role: 'Employee', department: 'Engineering',
    walletAddress: '', stealthMetaAddress: '', salary: '', currency: 'USDC' as Zer0Currency,
    frequency: 'monthly' as Zer0PayFrequency,
  });
  const [generatedScanBackup, setGeneratedScanBackup] = useState<string | null>(null);
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [stealthBusyId, setStealthBusyId] = useState<string | null>(null);
  const [stealthFlash, setStealthFlash] = useState('');

  const employees = useMemo(() => allEmployees.filter(e => e.projectId === pid), [allEmployees, pid]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterDept !== 'all' && e.department !== filterDept) return false;
      if (search) {
        const q = search.toLowerCase();
        return String(e.name || '').toLowerCase().includes(q) || String(e.email || '').toLowerCase().includes(q) || String(e.role || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [employees, search, filterStatus, filterDept]);

  const resetForm = () => {
    setForm({
      name: '', email: '', role: 'Employee', department: 'Engineering',
      walletAddress: '', stealthMetaAddress: '', salary: '', currency: 'USDC', frequency: 'monthly',
    });
    setEditingId(null);
    setGeneratedScanBackup(null);
  };

  const normalizeEmployee = (raw: any): Zer0Employee => ({
    id: raw.id || raw.employeeId,
    projectId: raw.projectId || pid,
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || '',
    department: raw.department || '',
    walletAddress: raw.walletAddress || '',
    stealthMetaAddress: raw.stealthMetaAddress || '',
    salary: Number(raw.salary || 0),
    currency: (raw.currency || 'USDC') as Zer0Currency,
    frequency: (raw.frequency || 'monthly') as Zer0PayFrequency,
    status: (raw.status || 'active') as Zer0EmployeeStatus,
    startDate: Number(raw.startDate || Date.now()),
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salary = parseFloat(form.salary);
    if (isNaN(salary) || salary < 0) return;

    setIsSaving(true);
    setError('');
    const meta = form.stealthMetaAddress.trim();
    if (meta && !isStealthMetaAddress(meta)) {
      setError('Stealth meta-address must start with z0st1… (generate one or paste a valid address).');
      setIsSaving(false);
      return;
    }

    const payload = {
      workspaceId: scopeWorkspaceId,
      projectId: pid,
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department,
      walletAddress: form.walletAddress,
      stealthMetaAddress: meta || undefined,
      salary,
      currency: form.currency,
      frequency: form.frequency,
      status: 'active' as Zer0EmployeeStatus,
      startDate: Date.now(),
    };

    try {
      if (editingId) {
        const res = await employeeApi.update(editingId, payload);
        const emp = normalizeEmployee(res.employee || { ...payload, id: editingId });
        updateEmployee(editingId, emp);
        if (meta) setEmployeeMeta(editingId, meta);
      } else {
        const res = await employeeApi.create(payload);
        const employee = normalizeEmployee(res.employee || payload);
        useZer0Store.setState(state => ({ employees: [...state.employees, employee] }));
        if (meta && employee.id) setEmployeeMeta(employee.id, meta);
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const terminateEmployee = async (id: string) => {
    setError('');
    try {
      const res = await employeeApi.delete(id);
      updateEmployee(id, normalizeEmployee(res.employee || { id, projectId: pid, status: 'terminated' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to terminate employee.');
    }
    setOpenMenu(null);
  };

  const startEdit = (emp: Zer0Employee) => {
    const metaFromStore = useStealthStore.getState().employeeMeta[emp.id] || '';
    setForm({
      name: emp.name, email: emp.email, role: emp.role, department: emp.department,
      walletAddress: emp.walletAddress,
      stealthMetaAddress: emp.stealthMetaAddress || metaFromStore,
      salary: emp.salary.toString(),
      currency: emp.currency, frequency: emp.frequency,
    });
    setGeneratedScanBackup(null);
    setEditingId(emp.id);
    setShowModal(true);
    setOpenMenu(null);
  };

  const handleGenerateStealth = () => {
    const identity = generateStealthIdentity(form.name || 'Team member');
    importIdentity(identity);
    setForm(f => ({ ...f, stealthMetaAddress: identity.metaAddress }));
    // Backup blob for the payee (scan + spend secrets). Never put on-chain.
    setGeneratedScanBackup(JSON.stringify({
      v: 1,
      label: identity.label,
      metaAddress: identity.metaAddress,
      scanSecretHex: identity.scanSecretHex,
      spendSecretHex: identity.spendSecretHex,
      spendPublicHex: identity.spendPublicHex,
      scanPublicHex: identity.scanPublicHex,
      createdAt: identity.createdAt,
    }, null, 2));
  };

  /** One-click: enable workspace stealth + generate meta for a team member */
  const enableStealthForEmployee = async (emp: Zer0Employee) => {
    setStealthFlash('');
    setStealthBusyId(emp.id);
    setOpenMenu(null);
    try {
      if (!stealthPaymentsEnabled) {
        updateSettings({ stealthPaymentsEnabled: true });
      }
      const existing = (emp.stealthMetaAddress || employeeMetaMap[emp.id] || '').trim();
      if (existing && isStealthMetaAddress(existing)) {
        setStealthFlash(`${emp.name}: stealth already ready`);
        return;
      }
      const identity = generateStealthIdentity(emp.name || 'Team member');
      importIdentity(identity);
      setEmployeeMeta(emp.id, identity.metaAddress);
      updateEmployee(emp.id, { stealthMetaAddress: identity.metaAddress });
      try {
        await employeeApi.update(emp.id, {
          workspaceId: scopeWorkspaceId,
          stealthMetaAddress: identity.metaAddress,
        });
      } catch (e) {
        console.warn('Could not persist stealth meta to API', e);
      }
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
      setStealthFlash(`${emp.name}: stealth ready · ${shortAddr(identity.metaAddress, 8)} · scan backup copied`);
    } catch (e) {
      setStealthFlash(e instanceof Error ? e.message : 'Could not enable stealth');
    } finally {
      setStealthBusyId(null);
      setTimeout(() => setStealthFlash(''), 5000);
    }
  };

  const statusBadge: Record<Zer0EmployeeStatus, string> = {
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    invited: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    inactive: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/60',
    terminated: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Team directory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {employees.length} team members • {employees.filter(e => e.status === 'active').length} active
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add team member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {stealthFlash && (
        <div className="rounded-md border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
          <Ghost className="h-3.5 w-3.5 shrink-0" />
          {stealthFlash}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-500 mb-1">No employees found</p>
            <p className="text-xs text-zinc-400">Add your first team member to start running payroll.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-right">Salary</th>
                  <th className="px-4 py-2.5">Frequency</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        {emp.name}
                        {(emp.stealthMetaAddress || employeeMetaMap[emp.id]) && (
                          <span title="Stealth meta-address on file" className="inline-flex items-center text-violet-500">
                            <Shield className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{emp.email}</div>
                      {(emp.stealthMetaAddress || employeeMetaMap[emp.id]) && (
                        <div className="text-[9px] font-mono text-violet-500/80 mt-0.5">
                          {shortAddr(emp.stealthMetaAddress || employeeMetaMap[emp.id], 6)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{emp.department}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{emp.role}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                      {emp.salary.toLocaleString('en-US', { minimumFractionDigits: 2 })} {emp.currency}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 capitalize">{String(emp.frequency || '').replace('-', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusBadge[emp.status || 'active'] || ''}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)}
                        className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                      </button>
                      {openMenu === emp.id && (
                        <div className="absolute right-4 top-10 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                          <button
                            onClick={() => startEdit(emp)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                          {!(emp.stealthMetaAddress || employeeMetaMap[emp.id]) && (
                            <button
                              onClick={() => void enableStealthForEmployee(emp)}
                              disabled={stealthBusyId === emp.id}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20 disabled:opacity-50"
                            >
                              {stealthBusyId === emp.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Ghost className="h-3 w-3" />}
                              One-click stealth
                            </button>
                          )}
                          <button
                            onClick={() => terminateEmployee(emp.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <UserX className="h-3 w-3" /> Deactivate
                          </button>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white dark:bg-[#0C0C0D] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Full Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Email *</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Wallet Address (Stellar Public Key)</label>
                <input value={form.walletAddress} onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
                  placeholder="G... long-term fallback wallet"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none font-mono focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <p className="text-[10px] text-zinc-400 mt-1">Used for transparent pays, and as fallback if stealth is off.</p>
              </div>

              <div className="rounded-lg border border-violet-200/70 dark:border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Stealth meta-address
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateStealth}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> One-click generate
                  </button>
                </div>
                <input
                  value={form.stealthMetaAddress}
                  onChange={e => setForm(f => ({ ...f, stealthMetaAddress: e.target.value }))}
                  placeholder="z0st1… (one-time receive meta)"
                  className="h-9 w-full rounded-lg border border-violet-200 dark:border-violet-500/30 bg-white px-3 text-xs outline-none font-mono focus:border-violet-500 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Private pays withdraw to a <strong>fresh G… address</strong> derived from this meta — not the long-term wallet.
                  Share the meta publicly; keep scan secrets offline (Stealth scanner).
                </p>
                {generatedScanBackup && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      Save this backup for the payee (scan keys) — shown once:
                    </p>
                    <textarea
                      readOnly
                      value={generatedScanBackup}
                      rows={4}
                      className="w-full rounded-md border border-amber-300/50 bg-white dark:bg-zinc-950 p-2 text-[10px] font-mono text-zinc-700 dark:text-zinc-300"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await copyText(generatedScanBackup);
                        setCopiedMeta(true);
                        setTimeout(() => setCopiedMeta(false), 1500);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600"
                    >
                      {copiedMeta ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy backup JSON
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Salary *</label>
                  <input required type="number" step="0.01" min="0" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Zer0Currency }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    <option value="USDC">USDC</option><option value="XLM">XLM</option><option value="EURC">EURC</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Zer0PayFrequency }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    <option value="monthly">Monthly</option><option value="bi-weekly">Bi-Weekly</option>
                    <option value="weekly">Weekly</option><option value="one-time">One-Time</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="h-9 px-4 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition">
                  Cancel
                </button>
                <button type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition">
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
