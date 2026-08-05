import React from 'react';
import { LabDetailsView } from '../components/LabDetailsView';
import { useLabs } from '../state/labs';
import { navigate, paths } from '../lib/router';

export const LabDetailsPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { labs, user, handleStartLab } = useLabs();
  const lab = labs.find((l) => l.slug === slug || l.id === slug);

  // Draft labs are only reachable by admins/editors — anyone else sees 404.
  if (!lab || (lab.status === 'draft' || lab.isPublished === false) && user.role !== 'admin') {
    return (
      <div className="p-16 text-center">
        <p className="text-4xl font-black text-white font-heading">404</p>
        <p className="text-sm text-zinc-500 font-mono mt-2">
          This lab does not exist or is no longer published.
        </p>
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
    <LabDetailsView
      lab={lab}
      user={user}
      onBack={() => navigate(paths.labs)}
      onStartLab={handleStartLab}
    />
  );
};
