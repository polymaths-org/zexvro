import React from 'react';
import { motion } from 'motion/react';
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

  // Lab is already submitted/completed by this user → show the completed state
  // instead of letting them re-run it.
  const isCompleted = (user.completedLabIds || []).includes(lab?.id || '');

  if (isCompleted && lab) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-100 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-10 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center mb-5">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h1 className="text-xl font-black text-white font-heading">Lab Completed</h1>
          <p className="text-sm text-zinc-400 mt-2">
            You've already submitted <span className="text-white font-bold">{lab.title}</span>. Your certificate and badge are saved in your profile.
          </p>
          <button
            onClick={() => navigate(paths.labs)}
            className="mt-6 w-full px-4 py-2.5 btn-primary-blue text-white text-sm font-extrabold rounded-xl font-heading"
          >
            Back to Labs
          </button>
        </motion.div>
      </div>
    );
  }

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[calc(100vh-57px)]"
    >
      <LabRunnerView
        lab={lab}
        user={user}
        progress={labProgress[lab.id]}
        onProgressChange={(patch) => handleProgressChange(lab.id, patch)}
        onExitLab={handleExitLab}
        onLabCompleted={handleLabCompleted}
        onAddSubmission={handleAddSubmission}
      />
    </motion.div>
  );
};
