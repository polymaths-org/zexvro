import React, { useState } from 'react';
import { 
  FolderKanban, Plus, Search, Filter, RefreshCw, X, 
  CheckCircle2, AlertTriangle, ArrowUpRight, HelpCircle, Laptop, ShieldAlert 
} from 'lucide-react';
import { Project } from '../../types';
import { mockProjects, mockServices } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectsProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  openNewModal: boolean;
  setOpenNewModal: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export default function Projects({ 
  projects, 
  setProjects, 
  openNewModal, 
  setOpenNewModal,
  setActiveTab
}: ProjectsProps) {
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  // Form states for creating a new project
  const [newProjName, setNewProjName] = useState('');
  const [newProjEnv, setNewProjEnv] = useState('Testnet');
  const [newProjNetwork, setNewProjNetwork] = useState('Stellar Testnet');
  const [newProjTemplate, setNewProjTemplate] = useState('stellar-smart-contract-starter');
  const [newProjServices, setNewProjServices] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  const availableTemplates = [
    { id: 'stellar-smart-contract-starter', name: 'Stellar Smart Contract Starter (Rust)', desc: 'Pre-configured Soroban contract template with test suites' },
    { id: 'privacy-pool-api', name: 'Privacy Pool API starter', desc: 'Zero-Knowledge Privacy Pool setup template' },
    { id: 'trade-pipeline-agent', name: 'A-2-A Trade Pipeline Agent (Go)', desc: 'Agent negotiation and wallet-policy starter' },
    { id: 'depin-telemetry-connector', name: 'De-pin Telemetry Connector (Rust)', desc: 'Secure node monitoring connector configured for Horizon' }
  ];

  // Handle service toggling inside form
  const toggleServiceInForm = (serviceName: string) => {
    if (newProjServices.includes(serviceName)) {
      setNewProjServices(newProjServices.filter(s => s !== serviceName));
    } else {
      setNewProjServices([...newProjServices, serviceName]);
    }
  };

  // Create Project handler
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) {
      setFormError('Project name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newProjName)) {
      setFormError('Project name must be alphanumeric and hyphenated (e.g. smart-contract-v1)');
      return;
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: newProjName,
      status: 'active',
      serviceUsage: newProjServices.length > 0 ? newProjServices : ['Transformation Agent'],
      region: 'us-east-1 (Stellar Testnet)',
      network: newProjNetwork,
      lastDeployment: 'Just now',
      owner: 'Workspace',
      branch: 'main',
      framework: newProjTemplate.includes('Go') ? 'Go' : newProjTemplate.includes('Rust') ? 'Rust' : 'React + Node'
    };

    setProjects([newProject, ...projects]);
    
    // Reset form
    setNewProjName('');
    setNewProjServices([]);
    setFormError('');
    setOpenNewModal(false);
  };

  // Filter projects dynamically
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.owner.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesService = serviceFilter === 'all' || p.serviceUsage.some(s => s.toLowerCase().includes(serviceFilter.toLowerCase()));
    
    return matchesSearch && matchesStatus && matchesService;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-brand-blue" />
            Projects
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your sovereign cloud nodes and Web3 services
          </p>
        </div>
        <button
          onClick={() => setOpenNewModal(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-medium text-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Project
        </button>
      </div>

      {/* Control bar (Search + Filters) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue dark:focus:border-brand-blue"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 text-xs text-zinc-500 mr-1">
            <Filter className="h-3 w-3" />
            <span>Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="deploying">Deploying</option>
            <option value="failed">Failed</option>
            <option value="paused">Paused</option>
          </select>

          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none cursor-pointer"
          >
            <option value="all">Service: All</option>
            <option value="privacy">ZK Pool</option>
            <option value="transformation">Transform Agent</option>
            <option value="trade">Trade Pipeline</option>
            <option value="auth">Agent Auth</option>
            <option value="depin">De-pin</option>
          </select>

          <button 
            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setServiceFilter('all'); }}
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
            title="Reset Filters"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/5 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-blue/10 h-12 w-12 -m-2"></div>
            <div className="relative p-2 rounded-full border border-brand-blue/20 bg-brand-blue/5 text-brand-blue">
              <FolderKanban className="h-6 w-6" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">No projects found</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm mt-1">
            There are no projects that match the filters. Clear the search/filters or spin up a new sovereign template.
          </p>
          <button
            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setServiceFilter('all'); }}
            className="mt-4 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#0A0A0B] text-xs font-semibold text-zinc-400 dark:text-zinc-500 tracking-wide uppercase font-sans">
                <th className="p-4">Project Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Active Services</th>
                <th className="p-4">Network & Region</th>
                <th className="p-4">Last Deployment</th>
                <th className="p-4">Branch</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
              {filteredProjects.map((p) => (
                <tr 
                  key={p.id} 
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30 transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                        <Laptop className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-zinc-900 dark:text-white group-hover:text-brand-blue dark:group-hover:text-brand-blue transition-colors font-sans text-sm">{p.name}</span>
                        <p className="text-xs text-zinc-400 mt-0.5">Owner: <span className="text-zinc-500 dark:text-zinc-300 font-medium">{p.owner}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : p.status === 'deploying'
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : p.status === 'failed'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-zinc-500/10 text-zinc-500'
                    }`}>
                      <span className={`h-1 w-1 rounded-full ${
                        p.status === 'active' 
                          ? 'bg-emerald-500 animate-pulse' 
                          : p.status === 'deploying'
                          ? 'bg-brand-blue animate-pulse'
                          : p.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-zinc-500'
                      }`}></span>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {p.serviceUsage.map((svc) => (
                        <span key={svc} className="text-xs font-sans px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400">
                          {svc.replace('Service', '').replace('Authentication', '')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      {p.network}
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{p.region}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs">{p.lastDeployment}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{p.branch}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setActiveTab('deployments')}
                      className="text-xs text-brand-blue hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Project Dialog Modal */}
      <AnimatePresence>
        {openNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenNewModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white font-heading">Spin up new ZEXVRO project</h3>
                <button 
                  onClick={() => setOpenNewModal(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                {/* Project Name */}
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. smart-contract-demo"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-brand-blue"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">Alphanumeric, lowercase, and hyphens only.</p>
                </div>

                {/* Network & Env Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Target Network</label>
                    <select
                      value={newProjNetwork}
                      onChange={(e) => setNewProjNetwork(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="Stellar Testnet">Stellar Testnet</option>
                      <option value="Sovereign Sandbox">Sovereign Sandbox (Offline)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Environment Badge</label>
                    <select
                      value={newProjEnv}
                      onChange={(e) => setNewProjEnv(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="Testnet">Testnet (Public Sandbox)</option>
                      <option value="Internal">Internal Dev</option>
                    </select>
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Starter Template</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {availableTemplates.map((tpl) => (
                      <div 
                        key={tpl.id}
                        onClick={() => setNewProjTemplate(tpl.id)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          newProjTemplate === tpl.id 
                            ? 'border-brand-blue bg-brand-blue/5' 
                            : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <span className="block text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">{tpl.name}</span>
                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-relaxed">{tpl.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services Allocation */}
                <div>
                  <label className="block text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase">Pre-allocate Services</label>
                  <div className="flex flex-wrap gap-1.5">
                    {mockServices.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleServiceInForm(svc.name)}
                        className={`px-2.5 py-1 rounded border font-mono text-[10px] transition-colors ${
                          newProjServices.includes(svc.name)
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                            : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {svc.name.replace('Service', '').replace('Authentication', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {formError && (
                  <div className="p-2.5 rounded border border-red-500/20 bg-red-500/5 text-red-500 text-xs flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setOpenNewModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 cursor-pointer"
                  >
                    Deploy Project Node
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
