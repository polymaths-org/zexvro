import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Settings, ShieldAlert, Save } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

export default function ProjectSettings() {
  const { projectId, workspaceId } = useParams({ strict: false });
  const navigate = useNavigate();
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [name, setName] = useState(currentProject?.name || '');
  const [description, setDescription] = useState(currentProject?.description || '');
  const [framework, setFramework] = useState(currentProject?.framework || '');
  const [branch, setBranch] = useState(currentProject?.branch || 'main');
  const [network, setNetwork] = useState(currentProject?.network || 'Stellar Testnet');
  const [purpose, setPurpose] = useState(currentProject?.purpose || '');
  const [lifecycle, setLifecycle] = useState(currentProject?.lifecycle || 'active');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    setName(currentProject.name);
    setDescription(currentProject.description);
    setFramework(currentProject.framework);
    setBranch(currentProject.branch || 'main');
    setNetwork(currentProject.network || 'Stellar Testnet');
    setPurpose(currentProject.purpose || '');
    setLifecycle(currentProject.lifecycle);
  }, [currentProject]);

  if (!currentProject) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    projectStore.updateProject(currentProject.id, {
      name,
      description,
      purpose,
      framework,
      branch,
      network,
      lifecycle,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handleDelete = () => {
    const confirm = window.confirm('Are you absolutely sure you want to permanently delete this project? This will erase all environments, logs, and configurations.');
    if (confirm) {
      projectStore.deleteProject(currentProject.id);
      navigate({ to: `/dashboard/w/${workspaceId}/projects` });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Modify project configuration parameters, environments, and deletion.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Purpose</label>
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Default Branch</label>
              <input
                type="text"
                required
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Lifecycle</label>
              <select
                value={lifecycle}
                onChange={e => setLifecycle(e.target.value as any)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Target Network</label>
              <select
                value={network}
                onChange={e => setNetwork(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option>Stellar Testnet</option>
                <option>Stellar Mainnet</option>
                <option>Ethereum Sepolia</option>
                <option>Ethereum Mainnet</option>
              </select>
            </div>
          </div>

          {framework !== 'None (Backend Service)' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Framework Preset</label>
              <select
                value={framework}
                onChange={e => setFramework(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option>Vite + React</option>
                <option>Next.js</option>
                <option>SvelteKit</option>
                <option>Astro</option>
                <option>Other</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && <span className="text-xs font-medium text-green-600 dark:text-green-400">Configuration saved</span>}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Save className="h-4 w-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
            <p className="text-xs text-red-650 dark:text-red-300 mt-0.5">
              Irreversible actions that will permanently affect the project and its active workloads.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-red-500/10 pt-4">
          <div>
            <p className="text-xs font-bold text-zinc-750 dark:text-zinc-200">Delete this project</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Once you delete a project, there is no going back. Please be certain.</p>
          </div>
          <button
            onClick={handleDelete}
            className="rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-semibold transition"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
