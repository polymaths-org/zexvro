import type { ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import type { Permission } from './permissions';
import { useWorkspaceRbac } from './useWorkspaceRbac';

type Props = {
  permission: Permission;
  workspaceId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
};

export function AccessDenied({
  title = 'Access restricted',
  detail = 'Your workspace role does not include this action. Ask an Owner or Admin to update your permissions.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-[#080809]">
      <div className="rounded-full border border-amber-500/20 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
        <ShieldOff className="h-5 w-5" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

export default function RequirePermission({
  permission,
  workspaceId,
  children,
  fallback,
}: Props) {
  const { can } = useWorkspaceRbac(workspaceId);
  if (!can(permission)) {
    return <>{fallback ?? <AccessDenied />}</>;
  }
  return <>{children}</>;
}
