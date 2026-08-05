import React from 'react';
import { DashboardView } from '../components/DashboardView';
import { useLabs } from '../state/labs';

export const HomePage: React.FC = () => {
  const {
    user,
    labs,
    badges,
    certificates,
    handleStartLab,
    handleOpenDetails,
    goToTab,
  } = useLabs();

  return (
    <DashboardView
      user={user}
      labs={labs}
      badges={badges}
      certificates={certificates}
      onStartLab={handleStartLab}
      onOpenDetails={handleOpenDetails}
      onNavigateTab={goToTab}
    />
  );
};
