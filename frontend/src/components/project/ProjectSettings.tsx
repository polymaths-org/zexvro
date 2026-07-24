import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Save, ShieldAlert, Network } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useZer0Store } from '../../stores/zer0';
import { serviceCatalog } from '../../data/serviceCatalog';
import { setNftNetworkPreference } from '../../services/nft/nftApi';

type ChainEnv = 'testnet' | 'mainnet';
type ServiceNetKey = 'zer0' | 'nfto' | 'dedsec' | 'reqwid' | 'morph';

const SERVICE_NET_META: Array<{
  serviceId: string;
  key: ServiceNetKey;
  name: string;
  mode: 'chain' | 'api' | 'agent';
  mainnetReady: boolean;
  note: string;
}> = [
  {
    serviceId: 'srv-privacy',
    key: 'zer0',
    name: 'Zer0',
    mode: 'chain',
    mainnetReady: true,
    note: 'Switches Horizon / Soroban endpoints used by Zer0 wallet flows.',
  },
  {
    serviceId: 'srv-nft',
    key: 'nfto',
    name: 'NFTo',
    mode: 'chain',
    mainnetReady: true,
    note: 'Sets Freighter/explorer preference. Hosted mint still needs App Runner mainnet env (WASM hash + sponsor).',
  },
  {
    serviceId: 'srv-depin',
    key: 'dedsec',
    name: 'DEDSEC',
    mode: 'chain',
    mainnetReady: true,
    note: 'Export depin.config with stellar:testnet or stellar:pubnet + OZ facilitator; apply via DEPIN_CONFIG_* and restart gateway.',
  },
  {
    serviceId: 'srv-agent-auth',
    key: 'reqwid',
    name: 'REQWID',
    mode: 'api',
    mainnetReady: false,
    note: 'Off-chain capability gate (captcha + PoP) — not a Stellar network toggle.',
  },
  {
    serviceId: 'srv-transformation',
    key: 'morph',
    name: 'Morph',
    mode: 'agent',
    mainnetReady: false,
    note: 'Agent tooling — no chain network switch.',
  },
];

function normalizeNetwork(raw?: string): ChainEnv {
  if (!raw) return 'testnet';
  const n = raw.toLowerCase();
  if (n.includes('main')) return 'mainnet';
  return 'testnet';
}

function networkLabel(env: ChainEnv) {
  return env === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet';
}

function Segmented({
  value,
  onChange,
  disabledMainnet,
}: {
  value: ChainEnv;
  onChange: (v: ChainEnv) => void;
  disabledMainnet?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => onChange('testnet')}
        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
          value === 'testnet'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
        }`}
      >
        Testnet
      </button>
      <button
        type="button"
        disabled={disabledMainnet}
        onClick={() => !disabledMainnet && onChange('mainnet')}
        title={disabledMainnet ? 'Mainnet not wired for this service yet' : undefined}
        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          value === 'mainnet'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
        }`}
      >
        Mainnet
      </button>
    </div>
  );
}

export default function ProjectSettings() {
  const { projectId, workspaceId } = useParams({ strict: false });
  const navigate = useNavigate();
  const projectStore = useProjectStore();
  const updateZer0Settings = useZer0Store(s => s.updateSettings);
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [name, setName] = useState(currentProject?.name || '');
  const [description, setDescription] = useState(currentProject?.description || '');
  const [purpose, setPurpose] = useState(currentProject?.purpose || '');
  const [network, setNetwork] = useState<ChainEnv>(normalizeNetwork(currentProject?.network));
  const [lifecycle, setLifecycle] = useState(currentProject?.lifecycle || 'active');
  const [enabledServices, setEnabledServices] = useState<string[]>(currentProject?.enabledServices || []);
  const [serviceNetworks, setServiceNetworks] = useState<Partial<Record<ServiceNetKey, ChainEnv>>>(
    currentProject?.serviceNetworks || {},
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    setName(currentProject.name);
    setDescription(currentProject.description);
    setPurpose(currentProject.purpose || '');
    setNetwork(normalizeNetwork(currentProject.network));
    setLifecycle(currentProject.lifecycle);
    setEnabledServices(currentProject.enabledServices || []);
    setServiceNetworks(currentProject.serviceNetworks || {});
  }, [currentProject]);

  const enabledNetRows = useMemo(
    () => SERVICE_NET_META.filter((row) => enabledServices.includes(row.serviceId)),
    [enabledServices],
  );

  if (!currentProject) return null;

  const toggleService = (serviceId: string) => {
    setEnabledServices((prev) => (
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    ));
  };

  const setServiceNet = (key: ServiceNetKey, value: ChainEnv) => {
    setServiceNetworks((prev) => ({ ...prev, [key]: value }));
  };

  const applyZer0Network = (env: ChainEnv) => {
    if (env === 'mainnet') {
      updateZer0Settings({
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://mainnet.sorobanrpc.com',
      });
    } else {
      updateZer0Settings({
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const nextServiceNetworks: Partial<Record<ServiceNetKey, ChainEnv>> = { ...serviceNetworks };
    for (const row of SERVICE_NET_META) {
      if (!enabledServices.includes(row.serviceId)) continue;
      if (row.mode !== 'chain') continue;
      if (!nextServiceNetworks[row.key]) {
        nextServiceNetworks[row.key] = network;
      }
      if (!row.mainnetReady) {
        nextServiceNetworks[row.key] = 'testnet';
      }
    }

    projectStore.updateProject(currentProject.id, {
      name,
      description,
      purpose,
      network: networkLabel(network),
      lifecycle,
      enabledServices,
      serviceNetworks: nextServiceNetworks,
    });

    const zer0Net = nextServiceNetworks.zer0 || network;
    if (enabledServices.includes('srv-privacy')) {
      applyZer0Network(zer0Net);
    }

    const nftoNet = nextServiceNetworks.nfto || network;
    if (enabledServices.includes('srv-nft')) {
      setNftNetworkPreference(nftoNet);
    }

    setServiceNetworks(nextServiceNetworks);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handleDelete = () => {
    const confirm = window.confirm('Permanently delete this project? This cannot be undone.');
    if (confirm) {
      projectStore.deleteProject(currentProject.id);
      navigate({ to: `/dashboard/w/${workspaceId}/projects` });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Project settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          General config, default network, and per-service testnet / mainnet preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">General</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Project name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Purpose</label>
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Lifecycle</label>
            <select
              value={lifecycle}
              onChange={e => setLifecycle(e.target.value as typeof lifecycle)}
              className="h-10 w-full max-w-xs rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </section>

        {/* Network */}
        <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="flex items-start gap-3">
            <Network className="mt-0.5 h-4 w-4 text-brand-blue" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Network</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Project default applies to new service prefs. Workspace ZCR burn gate is separate (workspace credits).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Project default</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Does not by itself rewire hosted NFT / DEDSEC APIs.</p>
            </div>
            <Segmented value={network} onChange={setNetwork} />
          </div>

          {enabledNetRows.length > 0 ? (
            <div className="divide-y divide-zinc-100 border-y border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
              {enabledNetRows.map((row) => {
                const value = (serviceNetworks[row.key] || network) as ChainEnv;
                const effective = row.mode === 'chain' && !row.mainnetReady ? 'testnet' : value;
                return (
                  <div key={row.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-950 dark:text-white">{row.name}</p>
                        {row.mode !== 'chain' ? (
                          <span className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700">
                            {row.mode === 'api' ? 'API' : 'Agent'}
                          </span>
                        ) : !row.mainnetReady ? (
                          <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            Testnet only
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{row.note}</p>
                    </div>
                    {row.mode === 'chain' ? (
                      <Segmented
                        value={effective}
                        disabledMainnet={!row.mainnetReady}
                        onChange={(v) => setServiceNet(row.key, v)}
                      />
                    ) : (
                      <span className="text-[11px] font-medium text-zinc-400">Not chain-bound</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Enable services below to set per-service networks.</p>
          )}
        </section>

        {/* Services */}
        <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Enabled services</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceCatalog.map((service) => {
              const on = enabledServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`rounded-md border px-3 py-2.5 text-left transition ${
                    on
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{service.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide">{on ? 'On' : 'Off'}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-80">{service.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Integrations stub */}
        <section className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/20">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Integrations</h2>
          <p className="mt-1 text-xs text-zinc-500">Discord webhooks and other project integrations — coming soon.</p>
        </section>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved</span>}
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Save className="h-4 w-4" />
            Save configuration
          </button>
        </div>
      </form>

      <section className="space-y-4 rounded-md border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
            <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-300/80">
              Irreversible actions that permanently affect this project.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex h-10 items-center rounded-md border border-red-500/40 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:bg-transparent dark:hover:bg-red-500/10"
        >
          Delete project
        </button>
      </section>
    </div>
  );
}
