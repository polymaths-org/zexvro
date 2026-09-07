import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Blocks,
  Power,
  PowerOff,
} from 'lucide-react';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import type { Service } from '../../types';
import { useProjectStore } from '../../stores/project';

interface ServicesProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
}

const SERVICE_BRAND: Partial<Record<Service['category'], { src: string; invert?: boolean }>> = {
  privacy: { src: '/services/zer0-32.png', invert: true },
  nft: { src: '/services/nfto-32.png' },
  depin: { src: '/services/dedsec-32.png', invert: true },
  auth: { src: '/services/reqwid-32.png' },
  transformation: { src: '/morph/morph-logo.svg', invert: true },
};

const serviceMeta: Record<Service['category'], {
  state: string;
  purpose: string;
  routeSegment?: string;
}> = {
  privacy: {
    state: 'Mainnet live',
    purpose: 'Private payment flows with ZK proofs on Stellar. 4 deployed pool contracts with real Merkle trees.',
    routeSegment: 'zer0',
  },
  transformation: {
    state: 'Agent ready',
    purpose: 'Web2→Web3 migration agent. Inspects repos, plans migration path, executes with human approval.',
    routeSegment: 'transformation',
  },
  trade: {
    state: 'Removed',
    purpose: 'A2A Trade has been removed from MVP scope.',
  },
  auth: {
    state: 'Gate ready',
    purpose: 'Dual-channel human/agent auth gate. Humans prove humanity, agents prove identity — policy decides access.',
    routeSegment: 'agent-auth',
  },
  nft: {
    state: 'Mainnet live',
    purpose: 'NFT collections on Stellar mainnet. Create, mint, and sell with embedded USDC/XLM checkout.',
    routeSegment: 'nft',
  },
  depin: {
    state: 'Gateway live',
    purpose: 'x402 paid-access gateway. Protect any HTTP API with per-request Stellar USDC micro-payments.',
    routeSegment: 'depin',
  },
  rpc: {
    state: 'Proposed',
    purpose: 'Proposed — RPC & Horizon gateway with API-key auth and event indexing. 1-day wrapper over public Soroban RPC.',
    routeSegment: undefined,
  },
  storage: {
    state: 'Proposed',
    purpose: 'Proposed — IPFS & S3 storage drive for metadata, media, anddApp artifacts. 1-day build on existing Pinata/S3.',
    routeSegment: undefined,
  },
  relay: {
    state: 'Proposed',
    purpose: 'Proposed — fee-bump gas relayer for gasless Soroban calls, billed in ZCR. 2-day build on fee-bump builder.',
    routeSegment: undefined,
  },
};

function ServiceBrandIcon({ category, className = '' }: { category: Service['category']; className?: string }) {
  const brand = SERVICE_BRAND[category];
  if (brand) {
    return (
      <img
        src={brand.src}
        alt=""
        aria-hidden="true"
        className={`object-contain ${brand.invert ? 'invert dark:invert-0' : ''} ${className}`}
      />
    );
  }
  return <Blocks className={className} />;
}

function stateTone(status: Service['status'] | 'enabled') {
  if (status === 'active' || status === 'enabled') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (status === 'configuring') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (status === 'proposed') return 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  return 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
}

export default function Services({ services }: ServicesProps) {
  const navigate = useNavigate();
  const { workspaceId, projectId } = useParams({ strict: false });
  const search = useRouterState({ select: (s) => s.location.search });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find((p) => p.id === projectId);
  const enabledServices = currentProject?.enabledServices || [];

  const catalog = useMemo(
    () => services.filter((s) => s.category !== 'trade'),
    [services],
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>(catalog[0]?.id || '');

  const selectedService = useMemo(
    () => catalog.find((service) => service.id === selectedServiceId) || catalog[0],
    [selectedServiceId, catalog],
  );

  const meta = selectedService ? serviceMeta[selectedService.category] : null;
  const isSelectedEnabled = selectedService ? enabledServices.includes(selectedService.id) : false;

  useEffect(() => {
    const params = new URLSearchParams(typeof search === 'string' ? search : '');
    const category = params.get('service');
    const requestedService = catalog.find((service) => service.category === category);
    if (requestedService) setSelectedServiceId(requestedService.id);
  }, [search, catalog]);

  const openService = (service: Service) => {
    const segment = serviceMeta[service.category]?.routeSegment;
    if (workspaceId && projectId && segment) {
      void navigate({
        to: `/dashboard/w/$workspaceId/p/$projectId/${segment}`,
        params: { workspaceId, projectId },
      });
    }
  };

  const toggleService = (serviceId: string) => {
    if (!currentProject) return;
    const next = enabledServices.includes(serviceId)
      ? enabledServices.filter((id) => id !== serviceId)
      : [...enabledServices, serviceId];
    projectStore.updateProject(currentProject.id, { enabledServices: next });
  };

  const primaryActionLabel = selectedService?.category === 'nft'
    ? 'Open collections'
    : selectedService?.category === 'depin'
      ? 'Open gateway'
      : selectedService?.category === 'privacy'
        ? 'Open Zer0'
        : selectedService?.category === 'transformation'
          ? 'Open agent'
          : selectedService?.category === 'auth'
            ? 'Open gate'
            : meta?.routeSegment
              ? 'Open service'
              : 'Unavailable';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-950 dark:text-white">
          <Blocks className="h-5 w-5 text-brand-blue" />
          Services
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Web3 infrastructure on Stellar mainnet. Enable services, open dashboards, and build.
        </p>
      </div>

      <section className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Catalog</p>
          </div>
          <div className="p-2">
            {catalog.map((service) => {
              const isSelected = selectedServiceId === service.id;
              const enabled = enabledServices.includes(service.id);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-white'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <ServiceBrandIcon category={service.category} className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{service.name}</span>
                  {enabled ? (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">On</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {selectedService && meta && (
          <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <ServiceBrandIcon category={selectedService.category} className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">{selectedService.name}</h2>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${stateTone(isSelectedEnabled ? 'enabled' : selectedService.status)}`}>
                        {isSelectedEnabled ? 'Enabled' : meta.state}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{meta.purpose}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {currentProject ? (
                    <button
                      type="button"
                      onClick={() => toggleService(selectedService.id)}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition ${
                        isSelectedEnabled
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {isSelectedEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      {isSelectedEnabled ? 'Disable' : 'Enable'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!meta.routeSegment || !projectId}
                    onClick={() => openService(selectedService)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {primaryActionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {!currentProject ? (
                <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">
                  Open Services Manager from inside a project to enable services and open routes.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
