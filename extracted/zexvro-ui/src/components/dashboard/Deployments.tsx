import React, { useState, useEffect } from 'react';
import { 
  Rocket, Search, RotateCcw, ScrollText, CheckCircle2, 
  XCircle, Loader2, Play, ChevronRight, Terminal, Clock, GitBranch 
} from 'lucide-react';
import { Deployment } from '../../types';
import { mockDeployments } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';

interface DeploymentsProps {
  deployments: Deployment[];
  setDeployments: React.Dispatch<React.SetStateAction<Deployment[]>>;
}

export default function Deployments({ deployments, setDeployments }: DeploymentsProps) {
  const [selectedDepId, setSelectedDepId] = useState<string>(deployments[0]?.id || '');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackProgress, setRollbackProgress] = useState(0);

  const selectedDeployment = deployments.find(d => d.id === selectedDepId) || deployments[0];

  // Rollback function
  const triggerRollback = () => {
    if (!selectedDeployment || selectedDeployment.status === 'Building' || selectedDeployment.status === 'Pending') return;
    
    setIsRollingBack(true);
    setRollbackProgress(10);
  };

  useEffect(() => {
    if (!isRollingBack) return;

    const interval = setInterval(() => {
      setRollbackProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Add a new mock deployment to the top that mimics the rollback
          const rolledBackDeployment: Deployment = {
            id: `dep-${Date.now().toString().slice(-3)}`,
            projectName: selectedDeployment.projectName,
            commitHash: 'rollback',
            commitMessage: `Rollback to ${selectedDeployment.commitHash} (${selectedDeployment.commitMessage.slice(0, 30)}...)`,
            status: 'Live',
            timestamp: 'Just now',
            duration: '1m 20s',
            author: 'Workspace',
            logs: [
              '[SYSTEM] Rollback request initiated...',
              `[SYSTEM] Restoring container image from historical build: ${selectedDeployment.commitHash}`,
              '[DEPLOY] Re-allocating ingress proxy pathways to historical hash...',
              '[MONITOR] Placeholder health check completed',
              `[SYSTEM] Rollback completed. Project ${selectedDeployment.projectName} is now running historical build.`
            ]
          };

          setDeployments([rolledBackDeployment, ...deployments]);
          setSelectedDepId(rolledBackDeployment.id);
          setIsRollingBack(false);
          return 0;
        }
        return prev + 15;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isRollingBack, selectedDeployment, deployments, setDeployments]);

  // Determine active pipeline stage based on deployment status
  const getPipelineStageClass = (stage: string, status: string) => {
    if (status === 'Live') {
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
    }
    if (status === 'Failed') {
      if (stage === 'Verify' || stage === 'Deploy' || stage === 'Monitor') {
        return 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400';
      }
      return 'bg-red-500/10 border-red-500/30 text-red-500';
    }
    if (status === 'Building') {
      if (stage === 'Source') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
      if (stage === 'Build') return 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue animate-pulse';
      if (stage === 'Verify') return 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse';
      return 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400';
    }
    return 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
            <Rocket className="h-5 w-5 text-brand-blue" />
            Deployment Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Prepare builds, checks, logs, and deployment trails before real infrastructure is connected
          </p>
        </div>
      </div>

      {/* Pipeline Diagram */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] overflow-x-auto">
        <div className="flex items-center justify-between min-w-[640px] gap-2">
          {[
            { id: 'src', label: 'Source', desc: 'Repository input', stage: 'Source' },
            { id: 'bld', label: 'Build', desc: 'Local app build', stage: 'Build' },
            { id: 'vrf', label: 'Verify', desc: 'Type and UX checks', stage: 'Verify' },
            { id: 'dep', label: 'Deploy', desc: 'Release approval', stage: 'Deploy' },
            { id: 'mon', label: 'Monitor', desc: 'Review logs', stage: 'Monitor' }
          ].map((stage, idx, arr) => (
            <React.Fragment key={stage.id}>
              <div className={`flex-1 p-3 rounded-lg border text-center transition-all ${getPipelineStageClass(stage.stage, selectedDeployment?.status || 'Pending')}`}>
                <div className="flex items-center justify-center gap-1.5 font-sans text-xs font-medium">
                  {selectedDeployment?.status === 'Building' && stage.stage === 'Build' && (
                    <Loader2 className="h-3 w-3 animate-spin text-brand-blue" />
                  )}
                  {selectedDeployment?.status === 'Failed' && stage.stage === 'Verify' && (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  {selectedDeployment?.status === 'Live' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  {stage.label}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">{stage.desc}</p>
              </div>
              {idx < arr.length - 1 && (
                <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-700 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Deployments List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Release History</span>
            <span className="text-xs text-zinc-400">{deployments.length} runs total</span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {deployments.map((dep) => {
              const isSelected = dep.id === selectedDepId;
              return (
                <div
                  key={dep.id}
                  onClick={() => {
                    if (!isRollingBack) setSelectedDepId(dep.id);
                  }}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-brand-blue bg-brand-blue/5'
                      : 'border-zinc-100 dark:border-[#27272A] bg-zinc-50/20 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">{dep.projectName}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      dep.status === 'Live'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : dep.status === 'Building'
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : dep.status === 'Failed'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-zinc-500/10 text-zinc-500'
                    }`}>
                      {dep.status}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 truncate leading-relaxed">
                    {dep.commitMessage}
                  </p>

                  <div className="flex items-center justify-between text-xs text-zinc-400 mt-2 border-t border-zinc-100 dark:border-zinc-800/50 pt-1.5">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <GitBranch className="h-3 w-3" />
                      {dep.commitHash}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dep.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Active Logs and rollback controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] flex flex-col h-[495px]">
            {/* Log Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-brand-blue" />
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wide">Consolidated Build Logs</h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Hash: <span className="font-mono text-[11px]">{selectedDeployment?.commitHash || 'Pending'}</span></p>
                </div>
              </div>
              
              {/* Rollback button */}
              <button
                disabled={isRollingBack || !selectedDeployment || selectedDeployment.status === 'Building' || selectedDeployment.status === 'Failed'}
                onClick={triggerRollback}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedDeployment?.status === 'Live' && !isRollingBack
                    ? 'border border-brand-blue/30 bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10'
                    : 'border border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/20 cursor-not-allowed'
                }`}
              >
                {isRollingBack ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-brand-blue" />
                    <span>Rollback ({rollbackProgress}%)</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Rollback deployment</span>
                  </>
                )}
              </button>
            </div>

            {/* Rolling back overlay / indicator */}
            <AnimatePresence>
              {isRollingBack && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 p-3 rounded bg-brand-blue/5 border border-brand-blue/20 text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5 text-brand-blue">
                    <span className="font-medium">Preparing rollback simulation...</span>
                    <span>{rollbackProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1">
                    <div className="bg-brand-blue h-1 rounded-full transition-all duration-300" style={{ width: `${rollbackProgress}%` }}></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logs output console */}
            <div className="flex-1 bg-zinc-950 rounded p-4 font-mono text-[11px] text-zinc-300 overflow-y-auto space-y-2 border border-zinc-800/80 shadow-inner">
              {selectedDeployment?.logs.map((logLine, idx) => (
                <div key={idx} className="leading-relaxed hover:bg-zinc-900/50 px-1 py-0.5 rounded">
                  {logLine.includes('[ERROR]') ? (
                    <span className="text-red-500">{logLine}</span>
                  ) : logLine.includes('[SYSTEM]') ? (
                    <span className="text-emerald-400 font-semibold">{logLine}</span>
                  ) : logLine.includes('[VERIFY]') ? (
                    <span className="text-amber-400">{logLine}</span>
                  ) : (
                    <span>{logLine}</span>
                  )}
                </div>
              ))}
              {selectedDeployment?.status === 'Building' && (
                <div className="flex items-center gap-2 text-brand-blue italic animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Waiting for sandbox verify loop...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
