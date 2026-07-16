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
import type {
  Zer0Employee, Zer0Currency, Zer0PayFrequency, Zer0EmployeeStatus, Zer0ContactTag,
} from '../../stores/types';

const CONTACT_TAGS: { value: Zer0ContactTag; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'partner', label: 'Partner' },
  { value: 'other', label: 'Other…' },
];

function tagLabel(emp: Zer0Employee): string {
  if (emp.contactTag === 'other' && emp.customTag) return emp.customTag;
  if (emp.contactTag) {
    const found = CONTACT_TAGS.find(t => t.value === emp.contactTag);
    if (found) return found.label.replace('…', '');
  }
  // Legacy role field
  return emp.role || 'Contact';
}

export default function Zer0People() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const pid = projectId || workspaceId || '';
  const scopeWorkspaceId = workspaceId || pid;

  const allEmployees = useZer0Store(s => s.employees);
  const updateEmployee = useZer0Store(s => s.updateEmployee);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Zer0EmployeeStatus | 'all'>('all');
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
  const defaultCurrency = useZer0Store(s => s.settings.defaultCurrency) || 'XLM';
  const [form, setForm] = useState({
    name: '',
    email: '',
    contactInfo: '',
    contactTag: 'employee' as Zer0ContactTag,
    customTag: '',
    notes: '',
    walletAddress: '',
    stealthMetaAddress: '',
    salary: '',
    currency: 'XLM' as Zer0Currency,
    frequency: 'monthly' as Zer0PayFrequency,
  });
  const [generatedScanBackup, setGeneratedScanBackup] = useState<string | null>(null);
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [stealthBusyId, setStealthBusyId] = useState<string | null>(null);
  const [stealthFlash, setStealthFlash] = useState('');
  const [filterTag, setFilterTag] = useState<Zer0ContactTag | 'all'>('all');

  const employees = useMemo(() => allEmployees.filter(e => e.projectId === pid), [allEmployees, pid]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterTag !== 'all') {
        const tag = e.contactTag || (e.role?.toLowerCase().includes('contract') ? 'contractor' : 'employee');
        if (tag !== filterTag) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          String(e.name || '').toLowerCase().includes(q)
          || String(e.email || '').toLowerCase().includes(q)
          || String(e.walletAddress || '').toLowerCase().includes(q)
          || String(e.contactInfo || '').toLowerCase().includes(q)
          || String(tagLabel(e) || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, search, filterStatus, filterTag]);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      contactInfo: '',
      contactTag: 'employee',
      customTag: '',
      notes: '',
      walletAddress: '',
      stealthMetaAddress: '',
      salary: '',
      currency: (defaultCurrency as Zer0Currency) || 'XLM',
      frequency: 'monthly',
    });
    setEditingId(null);
    setGeneratedScanBackup(null);
  };

  const normalizeEmployee = (raw: any): Zer0Employee => ({
    id: raw.id || raw.employeeId,
    projectId: raw.projectId || pid,
    name: raw.name || '',
    email: raw.email || '',
    role: raw.role || raw.contactTag || 'employee',
    department: raw.department || '',
    walletAddress: raw.walletAddress || '',
    stealthMetaAddress: raw.stealthMetaAddress || '',
    salary: Number(raw.salary || 0),
    currency: (raw.currency || 'XLM') as Zer0Currency,
    frequency: (raw.frequency || 'monthly') as Zer0PayFrequency,
    status: (raw.status || 'active') as Zer0EmployeeStatus,
    startDate: Number(raw.startDate || Date.now()),
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
    contactTag: (raw.contactTag as Zer0ContactTag) || undefined,
    customTag: raw.customTag || '',
    contactInfo: raw.contactInfo || '',
    notes: raw.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salary = form.salary.trim() === '' ? 0 : parseFloat(form.salary);
    if (isNaN(salary) || salary < 0) {
      setError('Default amount must be a valid number (or leave blank).');
      return;
    }

    setIsSaving(true);
    setError('');
    const meta = form.stealthMetaAddress.trim();
    if (meta && !isStealthMetaAddress(meta)) {
      setError('Stealth meta-address must start with z0st1… (generate one or paste a valid address).');
      setIsSaving(false);
      return;
    }

    const roleLabel = form.contactTag === 'other'
      ? (form.customTag.trim() || 'Other')
      : (CONTACT_TAGS.find(t => t.value === form.contactTag)?.label.replace('…', '') || form.contactTag);

    const payload = {
      workspaceId: scopeWorkspaceId,
      projectId: pid,
      name: form.name,
      email: form.email,
      role: roleLabel,
      department: form.notes || '',
      walletAddress: form.walletAddress,
      stealthMetaAddress: meta || undefined,
      salary,
      currency: form.currency,
      frequency: form.frequency,
      status: 'active' as Zer0EmployeeStatus,
      startDate: Date.now(),
      contactTag: form.contactTag,
      customTag: form.contactTag === 'other' ? form.customTag.trim() : '',
      contactInfo: form.contactInfo.trim(),
      notes: form.notes.trim(),
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
    const inferredTag: Zer0ContactTag = emp.contactTag
      || (String(emp.role || '').toLowerCase().includes('contract') ? 'contractor' : 'employee');
    setForm({
      name: emp.name,
      email: emp.email,
      contactInfo: emp.contactInfo || '',
      contactTag: inferredTag,
      customTag: emp.customTag || (inferredTag === 'other' ? emp.role : ''),
      notes: emp.notes || emp.department || '',
      walletAddress: emp.walletAddress,
      stealthMetaAddress: emp.stealthMetaAddress || metaFromStore,
      salary: emp.salary.toString(),
      currency: emp.currency,
      frequency: emp.frequency,
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
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Wallets directory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {employees.length} contacts · {employees.filter(e => e.status === 'active').length} active · pick them later in Send payment
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, wallet, tag…"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Deactivated</option>
        </select>
        <select
          value={filterTag}
          onChange={e => setFilterTag(e.target.value as any)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="all">All tags</option>
          {CONTACT_TAGS.map(t => (
            <option key={t.value} value={t.value}>{t.label.replace('…', '')}</option>
          ))}
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
            <p className="text-sm font-semibold text-zinc-500 mb-1">No wallets yet</p>
            <p className="text-xs text-zinc-400">Add a contact with a Stellar address to pay them quickly.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Tag</th>
                  <th className="px-4 py-2.5">Wallet</th>
                  <th className="px-4 py-2.5 text-right">Default amount</th>
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
                      <div className="text-[10px] text-zinc-400 mt-0.5">{emp.email || '—'}</div>
                      {emp.contactInfo && (
                        <div className="text-[10px] text-zinc-400 mt-0.5">{emp.contactInfo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {tagLabel(emp)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                      {emp.walletAddress ? shortAddr(emp.walletAddress, 5) : '—'}
                      {(emp.stealthMetaAddress || employeeMetaMap[emp.id]) && (
                        <div className="text-[9px] font-mono text-violet-500/80 mt-0.5">
                          stealth {shortAddr(emp.stealthMetaAddress || employeeMetaMap[emp.id], 5)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                      {emp.salary > 0
                        ? `${emp.salary.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${emp.currency}`
                        : '—'}
                    </td>
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
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{editingId ? 'Edit contact' : 'Add contact'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Doe"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="optional@email.com"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Contact info</label>
                  <input value={form.contactInfo} onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                    placeholder="Phone, Telegram, Discord…"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Tag</label>
                  <select value={form.contactTag} onChange={e => setForm(f => ({ ...f, contactTag: e.target.value as Zer0ContactTag }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    {CONTACT_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {form.contactTag === 'other' && (
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Custom tag *</label>
                  <input required value={form.customTag} onChange={e => setForm(f => ({ ...f, customTag: e.target.value }))}
                    placeholder="e.g. Advisor, DAO member, Friend…"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Wallet address (Stellar G…)</label>
                <input value={form.walletAddress} onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
                  placeholder="G…"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none font-mono focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <p className="text-[10px] text-zinc-400 mt-1">Used for public pays, and as fallback if stealth is off.</p>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
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
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Default amount</label>
                  <input type="number" step="0.01" min="0" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                    placeholder="0"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Zer0Currency }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                    <option value="EURC">EURC</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Zer0PayFrequency }))}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="weekly">Weekly</option>
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
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
