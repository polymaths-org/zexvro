import { FolderKanban, Rocket, Blocks, Users, Shield, Settings, Brain, Bot, ScrollText, KeyRound, BarChart3 } from 'lucide-react';

const placeholders: Record<string, { icon: React.ReactNode; title: string; description: string }> = {
  'instances': { icon: <Blocks className="h-10 w-10" />, title: 'All Instances', description: 'Service instances across all projects will appear here.' },
  'deployments': { icon: <Rocket className="h-10 w-10" />, title: 'Deployments', description: 'Deployment history across all projects will appear here.' },
  'activity': { icon: <ScrollText className="h-10 w-10" />, title: 'Activity', description: 'Workspace activity feed will appear here.' },
  'services': { icon: <Blocks className="h-10 w-10" />, title: 'Service Catalog', description: 'Browse and configure available MVP services.' },
  'team': { icon: <Users className="h-10 w-10" />, title: 'Team & Access', description: 'Manage workspace members, roles, and permissions.' },
  'security': { icon: <Shield className="h-10 w-10" />, title: 'Security', description: 'Security settings and audit logs.' },
  'analytics': { icon: <BarChart3 className="h-10 w-10" />, title: 'Analytics', description: 'Usage analytics and metrics will appear here.' },
  'settings': { icon: <Settings className="h-10 w-10" />, title: 'Settings', description: 'Workspace configuration and preferences.' },
  'agent': { icon: <Bot className="h-10 w-10" />, title: 'Agentic Operations', description: 'Morph agent studio and operation logs.' },
  'memory': { icon: <Brain className="h-10 w-10" />, title: 'Memory', description: 'Agent memory entries and collaboration notes.' },
  'environments': { icon: <Rocket className="h-10 w-10" />, title: 'Environments', description: 'Manage project environments (dev, staging, production).' },
  'logs': { icon: <ScrollText className="h-10 w-10" />, title: 'Logs', description: 'Project logs will appear here.' },
  'agents': { icon: <Bot className="h-10 w-10" />, title: 'Project Agents', description: 'Agents installed in this project.' },
  'members': { icon: <Users className="h-10 w-10" />, title: 'Project Members', description: 'Team members with access to this project.' },
  'audit': { icon: <ScrollText className="h-10 w-10" />, title: 'Project Audit', description: 'Audit trail for this project.' },
  'secrets': { icon: <KeyRound className="h-10 w-10" />, title: 'API Keys & Secrets', description: 'Manage API keys and secret references.' },
};

export default function PlaceholderScreen({ section }: { section: string }) {
  const config = placeholders[section] || {
    icon: <FolderKanban className="h-10 w-10" />,
    title: section.charAt(0).toUpperCase() + section.slice(1).replace(/-/g, ' '),
    description: 'This screen is planned and will be available soon.',
  };

  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        {config.icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">{config.title}</h3>
      <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">{config.description}</p>
      <span className="mt-3 inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        Planned
      </span>
    </div>
  );
}
