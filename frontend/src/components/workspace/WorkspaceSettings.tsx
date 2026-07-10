import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Save, Building2, CreditCard, Shield } from 'lucide-react';

export default function WorkspaceSettings() {
  const { workspaceId } = useParams({ strict: false });
  const [workspaceName, setWorkspaceName] = useState(workspaceId || 'Default Polymaths Workspace');
  const [billingEmail, setBillingEmail] = useState('billing@polymaths.org');
  const [region, setRegion] = useState('us-east');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Workspace settings updated successfully!');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Workspace properties, organization name, billing emails, and regions.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Workspace Name
            </label>
            <input
              type="text"
              required
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Billing Email
            </label>
            <input
              type="email"
              required
              value={billingEmail}
              onChange={e => setBillingEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Server Deployment Region
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="us-east">US East (N. Virginia)</option>
              <option value="eu-west">EU West (Frankfurt)</option>
              <option value="ap-southeast">AP Southeast (Singapore)</option>
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Save className="h-4 w-4" /> Save Workspace Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
