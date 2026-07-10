import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { FolderKanban, Rocket, Blocks, Users, Shield, Plus, ArrowRight, CircleDollarSign, UsersRound } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';
import { mockServices } from '../../data/mock';

export default function WorkspaceOverview() {
  const { workspaceId } = useParams({ strict: false });
  const navigate = useNavigate();
  const allProjects = useProjectStore(s => s.projects);
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const projects = useMemo(
    () => allProjects.filter(p => p.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const workspace = useMemo(
    () => workspaces.find(w => w.id === workspaceId),
    [workspaces, workspaceId],
  );
  const services = mockServices;

  const activeProjects = projects.filter(p => p.lifecycle === 'active');
  const draftProjects = projects.filter(p => p.lifecycle === 'draft');

  const goTo = (path: string) => navigate({ to: path });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Overview</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {workspace?.name || 'Your workspace'} — manage projects, services, and team access.
            </p>
          </div>
          {workspaceId && (
            <button
              onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FolderKanban className="h-4 w-4" />}
          label="Projects"
          value={projects.length}
          detail={`${activeProjects.length} active, ${draftProjects.length} draft`}
          accent="blue"
        />
        <StatCard
          icon={<Blocks className="h-4 w-4" />}
          label="Services"
          value={services.length}
          detail="MVP service catalog"
          accent="purple"
        />
        <StatCard
          icon={<Rocket className="h-4 w-4" />}
          label="Deployments"
          value={0}
          detail="No deployments yet"
          accent="green"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Team"
          value={workspace?.members.length || 1}
          detail="Workspace members"
          accent="amber"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaceId && (
          <>
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)}
              icon={<FolderKanban className="h-5 w-5" />}
              title="View Projects"
              description="Browse and manage all workspace projects"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
              icon={<Plus className="h-5 w-5" />}
              title="Create Project"
              description="Start a new project with the setup wizard"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/services`)}
              icon={<Blocks className="h-5 w-5" />}
              title="Service Catalog"
              description="Browse available MVP services"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/team`)}
              icon={<Users className="h-5 w-5" />}
              title="Team & Access"
              description="Manage workspace members and roles"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/security`)}
              icon={<Shield className="h-5 w-5" />}
              title="Security"
              description="Review security settings and audit logs"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/transactions`)}
              icon={<CircleDollarSign className="h-5 w-5" />}
              title="Transactions"
              description="View all financial transactions and history"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/payroll`)}
              icon={<UsersRound className="h-5 w-5" />}
              title="Payroll"
              description="Manage team payments and compensation"
            />
          </>
        )}
      </div>

      {/* Recent projects */}
      {projects.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Projects</h2>
            {workspaceId && (
              <button onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                View all
              </button>
            )}
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {projects.slice(0, 5).map(project => (
              <button
                key={project.id}
                onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${project.id}/overview`)}
                className="flex w-full items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{project.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{project.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    project.lifecycle === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                    project.lifecycle === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {project.lifecycle}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
          <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No projects yet</h3>
          <p className="mt-1 text-xs text-zinc-500">Create your first project to get started.</p>
          {workspaceId && (
            <button
              onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, detail, accent }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  accent: 'blue' | 'purple' | 'green' | 'amber';
}) {
  const accentColors = {
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center rounded-md p-1.5 ${accentColors[accent]}`}>
          {icon}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{detail}</p>
    </div>
  );
}

function QuickAction({ onClick, icon, title, description }: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50 w-full"
    >
      <span className="inline-flex items-center justify-center rounded-md bg-zinc-100 p-2 text-zinc-500 group-hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:text-white transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </button>
  );
}
