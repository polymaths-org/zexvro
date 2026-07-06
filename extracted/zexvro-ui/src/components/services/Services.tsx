import React, { useState } from 'react';
import { 
  Blocks, ShieldAlert, ArrowRight, Play, CheckCircle2, 
  HelpCircle, Sparkles, User, Clock, Lock, Cpu, Key, BadgeAlert, Layers, Laptop 
} from 'lucide-react';
import { Service } from '../../types';
import { mockServices } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';

interface ServicesProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
}

export default function Services({ services, setServices }: ServicesProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  
  // Custom checklist items state for each service
  const [checklistState, setChecklistState] = useState<Record<string, boolean[]>>({
    'srv-1': [true, true, true, false, false], // ZK Privacy Pool
    'srv-2': [true, true, false, false, false], // Transformation Agent
    'srv-3': [true, true, true, true, false], // A-2-A Trade Pipeline
    'srv-4': [true, false, false, false, false], // Agent Auth
    'srv-5': [false, false, false, false, false], // NFT Service
    'srv-6': [true, true, false, false, false]  // De-pin
  });

  const selectedService = services.find(s => s.id === selectedServiceId);

  // Toggle single checklist step
  const toggleChecklistStep = (serviceId: string, stepIdx: number) => {
    const currentSteps = checklistState[serviceId] || [false, false, false, false, false];
    const updatedSteps = [...currentSteps];
    updatedSteps[stepIdx] = !updatedSteps[stepIdx];
    
    // Update state
    const newChecklistState = { ...checklistState, [serviceId]: updatedSteps };
    setChecklistState(newChecklistState);

    // Compute new progress value based on checked steps
    const checkedCount = updatedSteps.filter(Boolean).length;
    const newProgress = Math.round((checkedCount / updatedSteps.length) * 100);

    // Update main services list
    setServices(prev => prev.map(s => {
      if (s.id === serviceId) {
        return {
          ...s,
          progress: newProgress,
          status: newProgress === 100 ? 'active' : newProgress > 0 ? 'configuring' : 'inactive'
        };
      }
      return s;
    }));
  };

  // Map service category to custom icon
  const getServiceIcon = (category: string) => {
    switch (category) {
      case 'privacy': return Lock;
      case 'transformation': return Cpu;
      case 'trade': return Sparkles;
      case 'auth': return Key;
      case 'nft': return Blocks;
      case 'depin': return Layers;
      default: return Blocks;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'configuring': return 'bg-brand-blue/10 text-brand-blue border-brand-blue/20';
      case 'inactive': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  };

  const checklistLabels = [
    'Configure project directory',
    'Connect cryptographic identity',
    'Generate service API keys',
    'Run sandbox test request',
    'Review setup notes'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <Blocks className="h-5 w-5 text-brand-blue" />
          Service Catalog
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Provision decentralized cryptographic primitives and agentic microservices
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc) => {
          const IconComponent = getServiceIcon(svc.category);
          return (
            <motion.div
              key={svc.id}
              whileHover={{ y: -2 }}
              onClick={() => setSelectedServiceId(svc.id)}
              className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] hover:border-zinc-300 dark:hover:border-[#3F3F46] hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3.5">
                {/* Icon & Status */}
                <div className="flex items-center justify-between gap-3">
                  <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:text-brand-blue transition-colors">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border uppercase tracking-wider ${getStatusColor(svc.status)}`}>
                    {svc.status}
                  </span>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-brand-blue transition-colors font-mono">{svc.name}</h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                    {svc.description}
                  </p>
                </div>
              </div>

              {/* Progress and metadata */}
              <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2.5">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-[9px] text-zinc-400">
                    <span>Setup progress</span>
                    <span>{svc.progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full">
                    <div 
                      className="bg-brand-blue h-1 rounded-full transition-all duration-300" 
                      style={{ width: `${svc.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Owner and time */}
                <div className="flex items-center justify-between font-mono text-[9px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-zinc-500" />
                    Owner: {svc.owner}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-zinc-500" />
                    {svc.lastActivity}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Side Detail Panel (Context Sheet) */}
      <AnimatePresence>
        {selectedServiceId && selectedService && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedServiceId(null)}
              className="absolute inset-0 bg-black"
            ></motion.div>

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full border-l border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] shadow-2xl p-6 flex flex-col justify-between"
            >
              <div className="space-y-6 overflow-y-auto pr-1">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-brand-blue">
                      {React.createElement(getServiceIcon(selectedService.category), { className: 'h-5 w-5' })}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950 dark:text-white font-mono">{selectedService.name}</h3>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">ID: {selectedService.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedServiceId(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 rounded"
                  >
                    Close
                  </button>
                </div>

                {/* High-level service metadata */}
                <div className="grid grid-cols-2 gap-3.5 bg-zinc-50/50 dark:bg-zinc-900/30 p-3.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80">
                  <div className="font-mono text-[10px] space-y-0.5">
                    <span className="text-zinc-400">MODULE OWNER</span>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedService.owner}</p>
                  </div>
                  <div className="font-mono text-[10px] space-y-0.5">
                    <span className="text-zinc-400">STATE STATUS</span>
                    <p className={`font-semibold uppercase ${
                      selectedService.status === 'active' ? 'text-emerald-500' : 'text-brand-blue'
                    }`}>{selectedService.status}</p>
                  </div>
                  <div className="font-mono text-[10px] space-y-0.5 col-span-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-2.5">
                    <span className="text-zinc-400">SERVICE SCOPE PURPOSE</span>
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mt-0.5">{selectedService.description}</p>
                  </div>
                </div>

                {/* Setup Progress Checklist */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase font-mono tracking-wider">Operational checklist</h4>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Toggle steps below to setup or teardown services dynamically.</p>
                  
                  <div className="space-y-2">
                    {checklistLabels.map((label, stepIdx) => {
                      const isChecked = (checklistState[selectedService.id] || [false, false, false, false, false])[stepIdx];
                      return (
                        <div
                          key={stepIdx}
                          onClick={() => toggleChecklistStep(selectedService.id, stepIdx)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'border-emerald-500/30 bg-emerald-500/5 text-zinc-900 dark:text-zinc-100'
                              : 'border-zinc-100 dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-800 bg-white dark:bg-[#0A0A0B]'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className={`text-xs ${isChecked ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex items-center justify-between gap-3 font-mono text-xs">
                <span className="text-zinc-400">Module configuration is local prototype data</span>
                <button
                  onClick={() => setSelectedServiceId(null)}
                  className="px-4 py-2 rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
