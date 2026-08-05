import React from 'react';
import { OperationsView } from '../components/OperationsView';
import { useLabs } from '../state/labs';

export const OperationsPage: React.FC = () => {
  const { labs, submissions, handleUpdateSubmission } = useLabs();
  return (
    <OperationsView
      labs={labs}
      submissions={submissions}
      onUpdateSubmission={handleUpdateSubmission}
    />
  );
};
