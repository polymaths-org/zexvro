import React, { useState } from 'react';
import { 
  Settings, User, Sliders, Laptop, Globe, ShieldAlert, CheckCircle2, 
  HelpCircle, CreditCard, ToggleLeft, ToggleRight, Sparkles 
} from 'lucide-react';
import { ThemeType, DensityType } from '../../types';
import { motion } from 'motion/react';

interface SettingsProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  density: DensityType;
  setDensity: (density: DensityType) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
}

export default function SettingsView({
  theme,
  setTheme,
  density,
  setDensity,
  reducedMotion,
  setReducedMotion
}: SettingsProps) {
  
  // Custom states for mocking flags
  const [flags, setFlags] = useState({
    'service-readiness-checks': true,
    'agent-git-commits': false,
    'high-frequency-arbitrage': true,
    'stellar-mainnet-beta': false
  });

  const toggleFlag = (flagKey: keyof typeof flags) => {
    setFlags(prev => ({
      ...prev,
      [flagKey]: !prev[flagKey]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-blue" />
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Configure platform behavior, appearance, prototype flags, and workspace defaults
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols Wide): Core configuration */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Appearance Section */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block font-sans">Appearance & Density</span>
            
            <div className="space-y-4 text-xs font-sans">
              {/* Theme selection */}
              <div>
                <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block mb-2 uppercase">Core Theme Strategy</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'system', label: 'System theme', desc: 'Syncs with OS' },
                    { id: 'light', label: 'Light theme', desc: 'Clean high contrast' },
                    { id: 'dark', label: 'Dark theme', desc: 'Eye safe slate' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as ThemeType)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        theme === t.id
                          ? 'border-brand-blue bg-brand-blue/5'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-800 dark:text-zinc-200">{t.label}</span>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Density selection */}
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-800/60 pt-3.5">
                <div>
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block mb-2 uppercase">UI Density</span>
                  <div className="flex gap-2">
                    {[
                      { id: 'comfortable', label: 'Comfortable' },
                      { id: 'compact', label: 'Compact dense' }
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setDensity(d.id as DensityType)}
                        className={`flex-1 py-1.5 rounded text-center border font-semibold cursor-pointer transition-colors text-xs ${
                          density === d.id
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduced Motion Toggle */}
                <div>
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 block mb-2 uppercase">Reduced Motion</span>
                  <button
                    onClick={() => setReducedMotion(!reducedMotion)}
                    className="w-full flex items-center justify-between p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 hover:border-zinc-300 cursor-pointer text-xs"
                  >
                    <span className="text-zinc-500">Enable reduced motion</span>
                    {reducedMotion ? (
                      <ToggleRight className="h-5 w-5 text-brand-blue" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-zinc-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Environment Variables Pane */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block font-sans">Environment parameters</span>
            
            <div className="p-3 border border-red-500/20 bg-red-500/5 rounded text-red-500 text-xs flex items-start gap-2.5 font-sans">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold uppercase">Secret Exposure Warning</span>
                <p className="text-xs mt-0.5 leading-relaxed text-zinc-500">
                  Never commit Stellar secret seeds, API keys, wallet seeds, or real credentials. Use placeholders until a secrets manager is designed.
                </p>
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs">
              {[
                { name: 'STELLAR_NETWORK', value: 'testnet', type: 'Config' },
                { name: 'PRIVACY_PROOF_MODE', value: 'draft', type: 'Config' },
                { name: 'GEMINI_API_KEY', value: '••••••••••••••••••••••••••••••••', type: 'Secret Proxy' }
              ].map((env) => (
                <div key={env.name} className="flex items-center justify-between p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-850 dark:text-zinc-200 block truncate">{env.name}</span>
                    <span className="text-[10px] text-zinc-400">Class: {env.type}</span>
                  </div>
                  <span className="text-zinc-500 text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded shrink-0">{env.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Feature flags and billing */}
        <div className="space-y-6 font-sans">
          
          {/* Feature Flags Toggle Panel */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4 h-fit">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block">Active feature flags</span>
            
            <div className="space-y-3 text-xs">
              {[
                { key: 'service-readiness-checks', label: 'Service readiness checks', desc: 'Show setup checks before enabling a service' },
                { key: 'agent-git-commits', label: 'Agent Git proposals', desc: 'Allows agents to draft changes for human review' },
                { key: 'high-frequency-arbitrage', label: 'Trade safety guards', desc: 'Shows planned limits for A-2-A trading flows' },
                { key: 'stellar-mainnet-beta', label: 'Stellar Mainnet Bridge', desc: 'Connects mainnet Horizon endpoints' }
              ].map((flag) => {
                const isActive = flags[flag.key as keyof typeof flags];
                return (
                  <div key={flag.key} className="p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate">{flag.label}</span>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-normal">{flag.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleFlag(flag.key as any)}
                      className="shrink-0 pt-0.5 cursor-pointer"
                    >
                      {isActive ? (
                        <ToggleRight className="h-5 w-5 text-brand-blue" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-zinc-400" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing / Subscription Card Placeholder */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block">Usage & Quotas</span>
            <div className="p-3 rounded border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-850 dark:text-zinc-200 uppercase">Developer tier</span>
                <span className="text-brand-blue font-semibold">FREE</span>
              </div>
              <p className="text-xs text-zinc-400 leading-normal">
                This prototype is running locally. Billing, usage limits, and agent cycle quotas are placeholders until backend scope is defined.
              </p>
              
              <div className="space-y-1 text-xs text-zinc-400 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/60">
                <div className="flex justify-between">
                  <span>Services Configured</span>
                  <span>4 / 5</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full">
                  <div className="bg-brand-blue h-1 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
