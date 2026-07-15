import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Brain,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  Key,
  Layers,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Service } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ServicesProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
}

const serviceBlueprints: Record<Service['category'], {
  icon: typeof Blocks;
  state: string;
  purpose: string;
  inputs: string[];
  setup: string[];
  checklist: string[];
}> = {
  privacy: {
    icon: Lock,
    state: 'Needs protocol scope',
    purpose: 'Let teams design private transaction flows where public verification is possible without exposing sensitive business details.',
    inputs: ['Transaction privacy requirements', 'Supported asset or contract type', 'Compliance review boundary', 'Stellar/Soroban integration target'],
    setup: ['Create proof-flow draft', 'Define public vs private fields', 'Prepare sandbox test vectors'],
    checklist: ['Threat model is documented', 'No live funds are connected', 'Reviewer approval is required before backend work'],
  },
  transformation: {
    icon: Brain,
    state: 'Ready for planning',
    purpose: 'Inspect repositories, prepare migration plans, and turn approved Web2-to-Web3 tasks into small reviewable actions.',
    inputs: ['Git repository URL or uploaded source', 'Target Web3 architecture', 'Allowed files and forbidden files', 'Approval rules for agent actions'],
    setup: ['Run repository read-only scan', 'Generate migration map', 'Create approval cards for each action'],
    checklist: ['Repository permissions are explicit', 'Shared memory is current', 'Agent cannot execute without sign-off'],
  },
  trade: {
    icon: Sparkles,
    state: 'Needs protocol draft',
    purpose: 'Provide a controlled channel where autonomous agents can discover, negotiate, and settle trades through defined wallet rules.',
    inputs: ['Agent identity format', 'Wallet policy', 'Negotiation rules', 'Settlement and dispute path'],
    setup: ['Define agent capability schema', 'Draft offer/request handshake', 'Set spending and approval limits'],
    checklist: ['Wallet permissions are capped', 'Human override is defined', 'Simulation mode exists before live trades'],
  },
  auth: {
    icon: Key,
    state: 'Needs signal model',
    purpose: 'Classify humans and agents at login or API boundaries, then expose clear controls for platform owners.',
    inputs: ['SDK target platform', 'Signal collection rules', 'Human verification path', 'Data marketplace consent model'],
    setup: ['Design challenge flow', 'Map SDK/API responses', 'Create consent and policy screens'],
    checklist: ['Privacy policy is ready', 'False-positive handling exists', 'Marketplace data is opt-in only'],
  },
  nft: {
    icon: Blocks,
    state: 'Frontend draft ready',
    purpose: 'Help non-Web3 creators create, deploy, and manage NFT drops without understanding low-level chain tooling.',
    inputs: ['Collection metadata', 'IPFS media package', 'Creator-controlled minting rules', 'USDC checkout configuration'],
    setup: ['Open collection workspace', 'Prepare contract deployment', 'Review metadata and royalty preference'],
    checklist: ['Metadata can be previewed', 'No deployment happens without approval', 'Creator owns final approval'],
  },
  depin: {
    icon: Radio,
    state: 'Gateway scaffold ready',
    purpose: 'Protect HTTP API and compute resources with exact per-request USDC payments using the Stellar x402 protocol.',
    inputs: ['Protected route and upstream URL', 'USDC price and recipient', 'Stellar network', 'Timeout and rate-limit policy'],
    setup: ['Create provider configuration', 'Run testnet gateway', 'Verify payment and settlement flow'],
    checklist: ['Uses standard x402 v2 headers', 'No user funds are held by ZEXVRO', 'Physical hardware adapters remain out of v1'],
  },
};

function stateTone(status: Service['status']) {
  if (status === 'active') return 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
  if (status === 'configuring') return 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
}

export default function Services({ services }: ServicesProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [panelServiceId, setPanelServiceId] = useState<string | null>(null);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || services[0],
    [selectedServiceId, services]
  );
  const panelService = services.find((service) => service.id === panelServiceId);

  const selectedBlueprint = selectedService ? serviceBlueprints[selectedService.category] : null;
  const SelectedIcon = selectedBlueprint?.icon || Blocks;

  useEffect(() => {
    const category = searchParams.get('service');
    const requestedService = services.find(service => service.category === category);
    if (requestedService) setSelectedServiceId(requestedService.id);
  }, [searchParams, services]);

  return (
    <div className="space-y-6">
      {/* AI NOTE: Services screen is a setup/workflow surface. Keep it empty-state honest; do not add metrics, owners, balances, or live usage. */}
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
            <Blocks className="h-5 w-5 text-brand-blue" />
            Services
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Configure MVP services with required inputs, approval rules, and setup drafts before a service is connected to this workspace.
          </p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
          <ClipboardList className="h-4 w-4" />
          Create setup draft
        </button>
      </div>

      <section className="grid gap-5 xl:grid-cols-[260px_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Catalog</p>
          </div>
          <div className="p-2">
            {services.map((service) => {
              const blueprint = serviceBlueprints[service.category];
              const Icon = blueprint.icon;
              const isSelected = selectedServiceId === service.id;

              return (
                <button
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-white'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-brand-blue' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} />
                  <span className="min-w-0 flex-1 truncate">{service.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedService && selectedBlueprint && (
          <motion.div
            key={selectedService.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]"
          >
            <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-brand-blue dark:border-zinc-800 dark:bg-zinc-900">
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{selectedService.name}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${stateTone(selectedService.status)}`}>
                        {selectedBlueprint.state}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{selectedBlueprint.purpose}</p>
                  </div>
                </div>
                <button
                  onClick={() => selectedService.category === 'nft'
                    ? navigate('/services/nft')
                    : setPanelServiceId(selectedService.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {selectedService.category === 'nft' ? 'Open collections' : 'Open setup'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-3">
              <div className="border-b border-zinc-200 p-5 dark:border-zinc-800 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Required inputs</h3>
                </div>
                <div className="space-y-2">
                  {selectedBlueprint.inputs.map((item) => (
                    <div key={item} className="flex gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-b border-zinc-200 p-5 dark:border-zinc-800 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Setup options</h3>
                </div>
                <div className="space-y-2">
                  {selectedBlueprint.setup.map((item) => (
                    <button
                      key={item}
                      className="group flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 p-3 text-left text-xs text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <span>{item}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand-blue" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Before enabling</h3>
                </div>
                <div className="space-y-3">
                  {selectedBlueprint.checklist.map((item) => (
                    <div key={item} className="flex gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: BadgeCheck, title: 'Approval-first', text: 'Every service action should become a review card before it can affect infrastructure, wallets, contracts, or user data.' },
          { icon: Cpu, title: 'Workspace disconnected', text: 'No live telemetry is shown here. Local service scaffolds are not presented as deployed or connected integrations.' },
          { icon: ShieldCheck, title: 'User controls', text: 'Users need clear inputs, permission levels, secrets handling, and rollback paths before enabling a service.' },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <item.icon className="h-4 w-4 text-brand-blue" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">{item.title}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.text}</p>
          </div>
        ))}
      </section>

      <AnimatePresence>
        {panelService && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelServiceId(null)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Setup draft</p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{panelService.name}</h3>
                </div>
                <button
                  onClick={() => setPanelServiceId(null)}
                  className="rounded-md border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  title="Close setup panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {[
                  { title: 'What this will do', items: [serviceBlueprints[panelService.category].purpose] },
                  { title: 'Inputs to collect', items: serviceBlueprints[panelService.category].inputs },
                  { title: 'User options', items: serviceBlueprints[panelService.category].setup },
                  { title: 'Enablement checks', items: serviceBlueprints[panelService.category].checklist },
                ].map((section) => (
                  <div key={section.title} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">{section.title}</h4>
                    <div className="mt-3 space-y-2">
                      {section.items.map((item) => (
                        <div key={item} className="flex gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 border-t border-zinc-200 p-5 dark:border-zinc-800 sm:flex-row">
                <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                  <ClipboardList className="h-4 w-4" />
                  Save draft
                </button>
                <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                  Request approval
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
