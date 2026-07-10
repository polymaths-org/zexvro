import { useMemo, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Plus, FolderKanban, ArrowRight, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjectStore } from '../../stores/project';

export default function ProjectsIndex({ initialShowWizard = false }: { initialShowWizard?: boolean }) {
  const { workspaceId } = useParams({ strict: false });
  const navigate = useNavigate();
  const allProjects = useProjectStore(s => s.projects);
  const createProject = useProjectStore(s => s.createProject);
  const [showWizard, setShowWizard] = useState(initialShowWizard);
  const [searchQuery, setSearchQuery] = useState('');

  const goTo = (path: string) => navigate({ to: path });

  const projects = useMemo(
    () => allProjects.filter(p => p.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(normalizedQuery) ||
      p.description.toLowerCase().includes(normalizedQuery)
    );
  }, [projects, searchQuery]);

  const handleCreate = (input: {
    name: string;
    description: string;
    purpose: string;
    framework: string;
    branch: string;
    network: string;
    enabledServices?: string[];
  }) => {
    if (!workspaceId) return;
    const project = createProject({ ...input, workspaceId });
    setShowWizard(false);
    goTo(`/dashboard/w/${workspaceId}/p/${project.id}/overview`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-100 dark:focus:border-zinc-600"
          />
        </div>
      )}

      {filteredProjects.length > 0 ? (
        <div className="space-y-2">
          {filteredProjects.map(project => (
            <button
              key={project.id}
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${project.id}/overview`)}
              className="group flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <FolderKanban className="h-4.5 w-4.5 text-zinc-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{project.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{project.description || 'No description'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-zinc-400">{project.framework}</p>
                  <p className="text-[10px] text-zinc-400">{project.network}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  project.lifecycle === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                  project.lifecycle === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  project.lifecycle === 'archived' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500' :
                  'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {project.lifecycle}
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
          <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No projects yet</h3>
          <p className="mt-1 text-xs text-zinc-500">Create your first project or import an existing repository.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Project
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Import Repository
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-500">No projects match "{searchQuery}"</p>
        </div>
      )}

      <AnimatePresence>
        {showWizard && (
          <CreateProjectWizard
            onClose={() => setShowWizard(false)}
            onCreate={handleCreate}
            existingProjectNames={projects.map(p => p.name)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectWizard({ onClose, onCreate, existingProjectNames }: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description: string;
    purpose: string;
    framework: string;
    branch: string;
    network: string;
    enabledServices?: string[];
  }) => void;
  existingProjectNames: string[];
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [projectType, setProjectType] = useState<'web_app' | 'backend_agent'>('web_app');
  const [framework, setFramework] = useState('Vite + React');
  const [branch, setBranch] = useState('main');
  const [network, setNetwork] = useState('Stellar Testnet');
  const [enabledServices, setEnabledServices] = useState<string[]>(['srv-privacy', 'srv-transformation']);

  const steps = [
    { label: 'Basics', description: 'Name and describe your project' },
    { label: 'Type', description: 'Choose your project type' },
    { label: 'Config', description: 'Environment defaults' },
    { label: 'Services', description: 'Select services to pre-install' },
    { label: 'Review', description: 'Confirm and create' },
  ];

  const handleProjectTypeChange = (val: 'web_app' | 'backend_agent') => {
    setProjectType(val);
    if (val === 'backend_agent') {
      setFramework('None (Backend Service)');
    } else {
      setFramework('Vite + React');
    }
  };

  const nameExists = step === 0 && existingProjectNames.some(existingName => existingName.toLowerCase() === name.trim().toLowerCase());
  const canNext = step === 0 ? (name.trim().length > 0 && !nameExists) : true;

  const handleCreate = () => {
    onCreate({ name: name.trim(), description, purpose, framework, branch, network, enabledServices });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Create Project</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{steps[step].description}</p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                i < step ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' :
                i === step ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' :
                'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] font-medium ${i === step ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className="w-4 h-px bg-zinc-200 dark:bg-zinc-700" />}
            </div>
          ))}
        </div>

        <div className="px-5 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Project name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                  autoFocus
                  className={`h-10 w-full rounded-lg border px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:outline-none ${
                    nameExists
                      ? 'border-rose-500 bg-rose-500/5 focus:border-rose-500 dark:border-rose-500/30'
                      : 'border-zinc-200 bg-white focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500'
                  }`}
                />
                {nameExists && (
                  <p className="mt-1 text-xs text-rose-500 font-medium">A project with this name already exists in this workspace.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project for?"
                  rows={2}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Privacy-preserving payment service"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {[
                { value: 'web_app' as const, label: 'Web Application / Dapp', description: 'Deploy a web interface with integrated smart contracts and agents' },
                { value: 'backend_agent' as const, label: 'Service-Only ZK Backend Agent', description: 'A backend agent/service runner without a frontend website' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => handleProjectTypeChange(option.value)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    projectType === option.value
                      ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{option.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {projectType === 'web_app' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Framework</label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option>Vite + React</option>
                    <option>Next.js</option>
                    <option>SvelteKit</option>
                    <option>Astro</option>
                    <option>Other</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Default branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Network</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option>Stellar Testnet</option>
                  <option>Stellar Mainnet</option>
                  <option>Ethereum Sepolia</option>
                  <option>Ethereum Mainnet</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {[
                { id: 'srv-privacy', label: 'Zero-Knowledge Privacy Pool (Zer0)', desc: 'Private transactions, stealth payouts, and zero-knowledge payroll verifications.' },
                { id: 'srv-transformation', label: 'Transformation Agent', desc: 'Codebase analysis and automated Web3 migrations.' },
                { id: 'srv-trade', label: 'Agent-to-Agent Trade Pipeline', desc: 'Secure agent-to-agent negotiations and asset settlements.' },
                { id: 'srv-agent-auth', label: 'Agent Authentication Service', desc: 'Verify human vs agent boundary with CAPTCHA-like controls.' },
                { id: 'srv-nft', label: 'NFT Service', desc: 'Simple NFT deployment and drop management.' },
                { id: 'srv-depin', label: 'De-pin Service', desc: 'Resource sharing and telemetry tracking (Pending product scope).' },
              ].map(s => {
                const isSelected = enabledServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setEnabledServices(enabledServices.filter(id => id !== s.id));
                      } else {
                        setEnabledServices([...enabledServices, s.id]);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-900/50'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                        : 'border-zinc-300 dark:border-zinc-700'
                    }`}>
                      {isSelected && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">{s.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Name</span>
                <span className="text-xs font-medium text-zinc-900 dark:text-white">{name}</span>
              </div>
              {description && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Description</span>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 max-w-[60%] truncate">{description}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Type</span>
                <span className="text-xs font-medium text-zinc-900 dark:text-white capitalize">{projectType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Framework</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{framework}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Network</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{network}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Branch</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{branch}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Services Enabled</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 max-w-[60%] truncate">
                  {enabledServices.length > 0
                    ? enabledServices.map(id => id.replace('srv-', '')).join(', ')
                    : 'None'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleCreate}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Create Project
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
