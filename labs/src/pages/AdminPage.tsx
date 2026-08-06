import React from 'react';
import { AdminPanel } from '../components/AdminPanel';
import { useLabs } from '../state/labs';
import { navigate, paths, AdminTab } from '../lib/router';

export const AdminPage: React.FC<{ tab: AdminTab }> = ({ tab }) => {
  const {
    labs,
    badges,
    users,
    submissions,
    user,
    handleCreateLab,
    handleUpdateLab,
    handleDeleteLab,
    handleStartLab,
    handleUpdateBadge,
    handleCreateBadge,
    handleDeleteBadge,
    handleUpdateSubmission,
    handleUpdateUserRole,
  } = useLabs();

  return (
    <AdminPanel
      labs={labs}
      badges={badges}
      users={users.length > 0 ? users : [user]}
      currentUser={user}
      submissions={submissions}
      tab={tab}
      onTabChange={(t) => navigate(paths.admin(t as AdminTab))}
      onUpdateUserRole={handleUpdateUserRole}
      onInviteUser={(username) =>
        fetch('/api/admin/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }).catch(() => {})
      }
      onCreateLab={handleCreateLab}
      onUpdateLab={handleUpdateLab}
      onDeleteLab={handleDeleteLab}
      onPreviewLab={handleStartLab}
      onUpdateBadge={handleUpdateBadge}
      onCreateBadge={handleCreateBadge}
      onDeleteBadge={handleDeleteBadge}
      onUpdateSubmission={handleUpdateSubmission}
    />
  );
};
