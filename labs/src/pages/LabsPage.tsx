import React from 'react';
import { CatalogView } from '../components/CatalogView';
import { useLabs } from '../state/labs';
import { navigate, paths } from '../lib/router';

export const LabsPage: React.FC = () => {
  const {
    labs,
    user,
    handleStartLab,
    handleOpenDetails,
    searchQuery,
    setSearchQuery,
  } = useLabs();

  return (
    <CatalogView
      labs={labs}
      onStartLab={handleStartLab}
      onOpenDetails={handleOpenDetails}
      user={user}
      onOpenCreateLab={() => navigate(paths.admin('labs'))}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    />
  );
};
