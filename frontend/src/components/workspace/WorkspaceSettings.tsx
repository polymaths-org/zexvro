import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Save, Building2, CreditCard, Shield, GitBranch, Globe2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';
import { useWorkspaceRbac } from '../../rbac/useWorkspaceRbac';
import RequirePermission, { AccessDenied } from '../../rbac/RequirePermission';

export default function WorkspaceSettings() {
  const { workspaceId } = useParams({ strict: false });
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const updateWorkspace = useWorkspaceStore(s => s.updateWorkspace);
  const { can, role } = useWorkspaceRbac(workspaceId);
  const canWrite = can('workspace.settings.write');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    plan: 'Team workspace',
    billingEmail: '',
    defaultNetwork: 'Stellar Testnet',
    defaultBranch: 'main',
    requireInviteApproval: false,
    allowMemberProjectCreation: true,
    auditRetentionDays: 90,
    preferredCurrency: 'USD',
  });

  useEffect(() => {
    if (!workspace) return;
    setForm({
      name: workspace.name,
      plan: workspace.plan,
      billingEmail: workspace.settings?.billingEmail || '',
      defaultNetwork: workspace.settings?.defaultNetwork || 'Stellar Testnet',
      defaultBranch: workspace.settings?.defaultBranch || 'main',
      requireInviteApproval: workspace.settings?.requireInviteApproval || false,
      allowMemberProjectCreation: workspace.settings?.allowMemberProjectCreation ?? true,
      auditRetentionDays: workspace.settings?.auditRetentionDays || 90,
      preferredCurrency: (workspace.settings as any)?.preferredCurrency || 'USD',
    });
  }, [workspace]);

  if (!workspace) return null;

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) return;
    updateWorkspace(workspace.id, {
      name: form.name,
      plan: form.plan,
      settings: {
        billingEmail: form.billingEmail,
        // Keep existing region if present (platform-managed); clients do not edit cloud regions.
        region: workspace.settings?.region || 'us-east-1',
        defaultNetwork: form.defaultNetwork,
        defaultBranch: form.defaultBranch,
        requireInviteApproval: form.requireInviteApproval,
        allowMemberProjectCreation: form.allowMemberProjectCreation,
        auditRetentionDays: form.auditRetentionDays,
        preferredCurrency: form.preferredCurrency,
      } as any,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <RequirePermission
      permission="workspace.settings.read"
      workspaceId={workspaceId}
      fallback={<AccessDenied title="Settings access required" />}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Workspace identity, chain defaults, access rules, and audit retention.
          {role ? ` Your role: ${role}.` : ''}
          {!canWrite ? ' Read-only for your role.' : ''}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6" aria-disabled={!canWrite}>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Workspace" icon={<Building2 className="h-4 w-4" />}>
            <Field label="Workspace Name">
              <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </Field>
            <Field label="Plan Label">
              <input value={form.plan} onChange={event => setForm(current => ({ ...current, plan: event.target.value }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </Field>
            <Field label="Billing Email">
              <input type="email" value={form.billingEmail} onChange={event => setForm(current => ({ ...current, billingEmail: event.target.value }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </Field>
          </Section>
 
          <Section title="Defaults" icon={<Globe2 className="h-4 w-4" />}>
            <Field label="Preferred Display Currency">
              <select value={form.preferredCurrency} onChange={event => setForm(current => ({ ...current, preferredCurrency: event.target.value }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="XLM">XLM</option>
              </select>
            </Field>
            <Field label="Default chain network">
              <select value={form.defaultNetwork} onChange={event => setForm(current => ({ ...current, defaultNetwork: event.target.value }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                <option>Stellar Testnet</option>
                <option>Stellar Mainnet</option>
              </select>
            </Field>
            <Field label="Default Project Branch">
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input value={form.defaultBranch} onChange={event => setForm(current => ({ ...current, defaultBranch: event.target.value }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
            </Field>
          </Section>

          <Section title="Access Policy" icon={<Shield className="h-4 w-4" />}>
            <Toggle label="Require invite approval" checked={form.requireInviteApproval} onChange={value => setForm(current => ({ ...current, requireInviteApproval: value }))} />
            <Toggle label="Allow members to create projects" checked={form.allowMemberProjectCreation} onChange={value => setForm(current => ({ ...current, allowMemberProjectCreation: value }))} />
          </Section>

          <Section title="Operations" icon={<CreditCard className="h-4 w-4" />}>
            <Field label="Audit Retention Days">
              <input type="number" min="1" max="3650" value={form.auditRetentionDays} onChange={event => setForm(current => ({ ...current, auditRetentionDays: parseInt(event.target.value, 10) || 90 }))} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
            </Field>
          </Section>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-green-600 dark:text-green-400">Settings saved</span>}
          {canWrite && (
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              <Save className="h-4 w-4" /> Save Workspace Settings
            </button>
          )}
        </div>
      </form>
    </div>
    </RequirePermission>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">{icon}{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-zinc-550">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
