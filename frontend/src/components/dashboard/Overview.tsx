import React, { useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  Database,
  FolderKanban,
  KeyRound,
  ListChecks,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Service } from '../../types';

const MORPH_LOGO = '/morph/morph-logo.svg';

interface OverviewProps {
  setActiveTab: (tab: string) => void;
  setOpenNewProjectModal: (open: boolean) => void;
  setOpenInviteTeammateModal: (open: boolean) => void;
  setOpenNewMemoryModal: (open: boolean) => void;
  isDark: boolean;
  services: Service[];
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
}) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-950/[0.03] dark:border-zinc-800 dark:bg-[#0A0A0B] ${className}`}>
      {children}
    </div>
  );
}

export default function Overview({
  setActiveTab,
  setOpenNewProjectModal,
  setOpenInviteTeammateModal,
  services,
}: OverviewProps) {
  const configuringServices = useMemo(() => services.filter((service) => service.status === 'configuring').length, [services]);
  const activeServices = useMemo(() => services.filter((service) => service.status === 'active').length, [services]);
  const scopedServices = useMemo(() => services.filter((service) => service.category !== 'depin').length, [services]);
  const readinessScore = 78;
  const completedSteps = 2;
  const totalSteps = 6;

  const systemStatus = [
    {
      label: 'Services',
      value: scopedServices,
      meta: `${activeServices} ready`,
      icon: Boxes,
      dot: 'bg-emerald-500',
    },
    {
      label: 'Security',
      value: 'Draft',
      meta: 'Policy pending',
      icon: ShieldCheck,
      dot: 'bg-amber-500',
    },
    {
      label: 'Memory',
      value: 'Ready',
      meta: 'Workspace context',
      icon: Database,
      dot: 'bg-emerald-500',
    },
    {
      label: 'Projects',
      value: 0,
      meta: 'No live projects',
      icon: FolderKanban,
      dot: 'bg-zinc-400',
    },
  ];

  const focusItems = [
    {
      title: 'Connect workspace data',
      detail: 'Link your backend and enable data sync.',
      icon: Boxes,
      onClick: () => setActiveTab('projects'),
    },
    {
      title: 'Configure authentication',
      detail: 'Set up agent auth and secure your services.',
      icon: KeyRound,
      onClick: () => setActiveTab('security'),
    },
    {
      title: 'Invite team members',
      detail: 'Collaborate by inviting your team.',
      icon: Users,
      onClick: () => setOpenInviteTeammateModal(true),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Overview</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">A quick summary of your workspace and next steps.</p>
        </div>
        <button
          onClick={() => setActiveTab('agent')}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <img src={MORPH_LOGO} alt="" aria-hidden="true" className="h-5 w-5 object-contain invert dark:invert-0" />
          Open Operations
          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </section>

      <Card className="overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-1.5"
              style={{ background: `conic-gradient(rgb(255 255 255) ${readinessScore * 3.6}deg, rgba(113,113,122,0.18) 0deg)` }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl font-semibold text-zinc-950 dark:bg-[#0A0A0B] dark:text-white">
                {readinessScore}%
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Workspace Ready</h2>
                <span className="rounded-full border border-zinc-200 bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white dark:border-white/15 dark:bg-white/10">
                  Getting there
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span><strong className="font-semibold text-zinc-950 dark:text-white">{scopedServices}</strong> Services</span>
                <span><strong className="font-semibold text-zinc-950 dark:text-white">{configuringServices}</strong> Pending</span>
                <span><strong className="font-semibold text-zinc-950 dark:text-white">0</strong> Live</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            <button
              onClick={() => setOpenNewProjectModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm shadow-white/10 transition hover:bg-zinc-100 dark:border-white/15 dark:bg-white dark:hover:bg-zinc-200"
            >
              New Project
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-1 py-1 text-xs font-semibold text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              Open existing project
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-950 dark:text-white">System Status</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {systemStatus.map((item) => (
            <Card key={item.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
              </div>
              <p className="mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-semibold text-zinc-950 dark:text-white">{item.value}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Today's Focus</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Complete these steps to get your workspace fully operational.</p>
          </div>
          <div className="space-y-3">
            {focusItems.map((item) => (
              <button
                key={item.title}
                onClick={item.onClick}
                className="group flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                  <item.icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</span>
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand-blue" />
              </button>
            ))}
          </div>
          <button
            onClick={() => setActiveTab('services')}
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            View all actions
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Setup Progress</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{completedSteps} of {totalSteps} steps completed</p>
              </div>
              <button
                onClick={() => setActiveTab('services')}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Continue Setup
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div className="h-full rounded-full bg-brand-blue" style={{ width: `${(completedSteps / totalSteps) * 100}%` }} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Telemetry</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No telemetry data yet</p>
              </div>
              <ChartNoAxesCombined className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Connect your backend to start collecting metrics.</p>
            <button
              onClick={() => setActiveTab('settings')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Go to Integrations
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <ListChecks className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Agent Operations</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Use Morph for workspace chat and operational planning without covering the dashboard.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
