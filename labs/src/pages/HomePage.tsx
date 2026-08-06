import React from 'react';
import { DashboardView } from '../components/DashboardView';
import { useLabs } from '../state/labs';

export const HomePage: React.FC = () => {
  const {
    user,
    labs: visibleLabs,
    certificates,
    handleStartLab,
    handleOpenDetails,
    goToTab,
  } = useLabs();

  return (
    <DashboardView
      user={user}
      labs={visibleLabs}
      certificates={certificates}
      onStartLab={handleStartLab}
      onOpenDetails={handleOpenDetails}
      onNavigateTab={goToTab}
    />
  );
};
