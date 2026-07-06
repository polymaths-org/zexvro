import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Blocks,
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  FolderKanban,
  GitBranch,
  KeyRound,
  ListChecks,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { Service } from '../../types';

interface OverviewProps {
  setActiveTab: (tab: string) => void;
  setOpenNewProjectModal: (open: boolean) => void;
  setOpenInviteTeammateModal: (open: boolean) => void;
  setOpenNewMemoryModal: (open: boolean) => void;
  isDark: boolean;
  services: Service[];
}

const setupSteps = [
  { label: 'Brand and design system captured', status: 'done' },
  { label: 'Frontend shell generated from AI Studio prompt', status: 'done' },
  { label: 'Replace generated demo content with product placeholders', status: 'active' },
  { label: 'Map service routes and ownership boundaries', status: 'next' },
  { label: 'Connect auth, workspace, and agent memory APIs', status: 'next' },
];

const activity = [
  {
    title: 'Design system added',
    meta: 'Dark-first tokens, light theme, typography, motion, and component rules are ready.',
    time: 'Today',
  },
  {
    title: 'Frontend prompt created',
    meta: 'Google AI Studio prompt generated the first construction UI.',
    time: 'Today',
  },
  {
    title: 'De-pin scope still pending',
    meta: 'Capture product scope before creating implementation or final UX flows.',
    time: 'Open',
  },
];

function statusTone(status: Service['status']) {
  if (status === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (status === 'configuring') return 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
  return 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
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
  setOpenNewMemoryModal,
  services,
}: OverviewProps) {
  const activeServices = useMemo(() => services.filter((service) => service.status === 'active').length, [services]);
  const configuringServices = useMemo(() => services.filter((service) => service.status === 'configuring').length, [services]);
  const scopedServices = useMemo(() => services.filter((service) => service.category !== 'depin').length, [services]);

  return (
    <div className="space-y-6">
      {/* AI NOTE: Overview is the product workspace home. Keep it focused on setup readiness, next actions, and honest placeholders. Do not add production metrics. */}
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.03] dark:border-zinc-800 dark:bg-[#080809] sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Sparkles className="h-3.5 w-3.5" />
              MVP workspace
            </span>
            <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Stellar Testnet
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
            Build the ZEXVRO platform without losing team context.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Start with service setup, agent memory, team handoffs, and security readiness. Backend data is not connected yet, so this dashboard shows product placeholders and setup state.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <button
            onClick={() => setOpenNewProjectModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            New project
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Bot className="h-4 w-4" />
            Open agent
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Service readiness', value: 'Setup', meta: `${activeServices} active, ${configuringServices} configuring, ${scopedServices} scoped`, icon: Blocks },
          { label: 'Projects', value: '0 live', meta: 'Create the first real project', icon: FolderKanban },
          { label: 'Agent memory', value: 'Ready', meta: 'Shared memory format exists', icon: Workflow },
          { label: 'Security setup', value: 'Draft', meta: 'API keys and auth are placeholders', icon: ShieldCheck },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{item.label}</span>
              <item.icon className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{item.value}</div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.meta}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Platform setup flow</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Use this as the construction checklist before real backend integrations.</p>
            </div>
            <button
              onClick={() => setOpenNewMemoryModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <ListChecks className="h-4 w-4" />
              Add memory note
            </button>
          </div>
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-zinc-200 p-5 dark:border-zinc-800 lg:border-b-0 lg:border-r">
              <div className="space-y-4">
                {setupSteps.map((step, index) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                        step.status === 'done'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                          : step.status === 'active'
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-500'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900'
                      }`}>
                        {step.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      {index < setupSteps.length - 1 && <div className="mt-2 h-7 w-px bg-zinc-200 dark:bg-zinc-800" />}
                    </div>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{step.label}</p>
                      <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{step.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Readiness trend</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Placeholder data until services send real telemetry.</p>
                </div>
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 dark:border-zinc-800">7 days</span>
              </div>
              <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/20">
                <div className="max-w-xs text-center">
                  <ChartNoAxesCombined className="mx-auto h-6 w-6 text-zinc-400" />
                  <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">No service telemetry yet</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Charts will appear after the backend sends setup and usage events.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Recommended next actions</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Small steps that move the platform from prototype to usable MVP.</p>
            </div>
            <Clock3 className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="mt-5 space-y-3">
            {[
              { title: 'Connect the UI to workspace data', action: 'Projects', tab: 'projects' },
              { title: 'Review service ownership and setup state', action: 'Services', tab: 'services' },
              { title: 'Invite service owners into the workspace', action: 'Team', tab: 'team' },
              { title: 'Create the first API key policy draft', action: 'Security', tab: 'security' },
            ].map((item) => (
              <button
                key={item.title}
                onClick={() => setActiveTab(item.tab)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Open {item.action}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Service setup</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">MVP services are represented as setup cards, not live products.</p>
            </div>
            <button onClick={() => setActiveTab('services')} className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {services.slice(0, 4).map((service) => (
              <motion.button
                key={service.id}
                whileHover={{ y: -1 }}
                onClick={() => setActiveTab('services')}
                className="w-full rounded-lg border border-zinc-200 p-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{service.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{service.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${statusTone(service.status)}`}>
                    {service.status}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${service.progress}%` }} />
                </div>
              </motion.button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Team activity and handoffs</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Recent project context future agents should see first.</p>
            </div>
            <button
              onClick={() => setOpenInviteTeammateModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Users className="h-4 w-4" />
              Invite
            </button>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {activity.map((item) => (
              <div key={item.title} className="flex gap-3 p-5">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{item.time}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Where users will spend time</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Planning placeholder for dashboard information architecture.</p>
            </div>
            <GitBranch className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="grid h-56 gap-3 sm:grid-cols-2">
            {['Service setup', 'Agent memory', 'Deployments', 'Security'].map((label) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/20">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-800">No data</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <KeyRound className="h-5 w-5 text-blue-500" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">Security starts as policy</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                API keys, secrets, and human/agent access controls should stay as placeholders until the backend contract is agreed.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('security')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Review security
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </section>
    </div>
  );
}
