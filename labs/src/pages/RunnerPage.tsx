import React from 'react';
import { LabRunnerView } from '../components/LabRunnerView';
import { useLabs } from '../state/labs';
import { navigate, paths } from '../lib/router';

export const RunnerPage: React.FC<{ labId: string }> = ({ labId }) => {
  const {
    labs,
    activeLab,
    user,
    labProgress,
    handleProgressChange,
    handleExitLab,
    handleLabCompleted,
    handleAddSubmission,
  } = useLabs();

  const lab = activeLab && activeLab.id === labId ? activeLab : labs.find((l) => l.id === labId);

  if (!lab) {
    return (
      <div className="p-16 text-center">
        <p className="text-4xl font-black text-white font-heading">404</p>
        <p className="text-sm text-zinc-500 font-mono mt-2">This lab is no longer available.</p>
        <button
          onClick={() => navigate(paths.labs)}
          className="inline-block mt-4 px-4 py-2 btn-primary-blue text-white text-sm font-extrabold rounded-xl font-heading"
        >
          Back to Labs
        </button>
      </div>
    );
  }

  return (
    <LabRunnerView
      lab={lab}
      user={user}
      progress={labProgress[lab.id]}
      onProgressChange={(patch) => handleProgressChange(lab.id, patch)}
      onExitLab={handleExitLab}
      onLabCompleted={handleLabCompleted}
      onAddSubmission={handleAddSubmission}
    />
  );
};
