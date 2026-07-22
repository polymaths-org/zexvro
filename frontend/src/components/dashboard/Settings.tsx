import React, { useEffect, useState } from 'react';
import {
  Settings, ShieldAlert, CheckCircle2, ToggleLeft, ToggleRight, Sparkles, Save
} from 'lucide-react';
import { ThemeType, DensityType } from '../../types';
import {
  OPENCODE_MODEL,
  OPENCODE_PROVIDER,
  buildAgentChatPayload,
  defaultAgentSettings,
  loadAgentSettings,
  loadAgentSettingsFromAWS,
  saveAgentSettings,
  type AgentSettings,
} from '../../agent/settings';

const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (IS_LOCAL_HOST
    ? 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');
const AGENT_CHAT_URL = IS_LOCAL_HOST ? '/api/agent/chat' : `${API_BASE_URL}/api/chat`;

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

  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => loadAgentSettings());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    let mounted = true;
    loadAgentSettingsFromAWS().then(settings => {
      if (!mounted) return;
      setAgentSettings(settings);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateAgentSetting = (key: keyof AgentSettings, value: string) => {
    const updated = { ...agentSettings, [key]: value };
    setAgentSettings(updated);
    setSaveStatus('dirty');
    setTestStatus('idle');
  };

  const saveAgentProviderSettings = async () => {
    setSaveStatus('saving');
    try {
      await saveAgentSettings(agentSettings);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save agent settings to AWS:', err);
      setSaveStatus('error');
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const response = await fetch(AGENT_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAgentChatPayload(
          'Settings',
          [
            {
              role: 'user',
              content: 'Reply with one short sentence confirming Morph provider connectivity.',
            },
          ],
          agentSettings,
        )),
      });
      if (!response.ok) {
        setTestStatus('error');
        return;
      }
      setTestStatus('success');
    } catch {
      setTestStatus('error');
    }
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

          {/* Client-facing workspace / Web3 summary (no cloud infra IDs) */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block font-sans">Workspace defaults</span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              What matters for your Web3 work: network, privacy mode, and agent chat provider. Cloud regions and auth pools are managed by ZEXVRO — not configured here.
            </p>
            <div className="space-y-3 font-sans text-xs">
              {[
                { name: 'Stellar network', value: 'Testnet', type: 'Chain' },
                { name: 'Privacy proof mode', value: 'Draft / ZK pool', type: 'Zer0' },
                { name: 'Agent provider', value: agentSettings.provider || '—', type: 'Agent' },
                { name: 'Agent model', value: agentSettings.model || '—', type: 'Agent' },
                { name: 'Agent API key', value: agentSettings.apiKey ? 'Saved for your account' : 'Not set', type: 'Agent' },
              ].map((env) => (
                <div key={env.name} className="flex items-center justify-between p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-850 dark:text-zinc-200 block truncate">{env.name}</span>
                    <span className="text-[10px] text-zinc-400">{env.type}</span>
                  </div>
                  <span className="text-zinc-500 text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded shrink-0 max-w-[50%] truncate">{env.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Operational Settings Section */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide block font-sans">
                Agent provider
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-brand-blue/15 text-brand-blue px-2 py-0.5 rounded font-semibold font-mono uppercase">
                <Sparkles className="h-3 w-3" /> MVP Active
              </span>
            </div>

            <p className="text-xs text-zinc-550 dark:text-zinc-400 font-sans leading-normal">
              Morph / OpenCode settings for your account. Provider, model, and key stay private to your signed-in session.
            </p>

            <div className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider select */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block mb-1.5 uppercase">
                    Provider
                  </label>
                  <input
                    type="text"
                    value={agentSettings.provider}
                    onChange={(e) => updateAgentSetting('provider', e.target.value)}
                    placeholder={OPENCODE_PROVIDER}
                    spellCheck={false}
                    className="w-full rounded border border-zinc-200 bg-zinc-55/30 px-3 py-2 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-250 focus:outline-none focus:border-brand-blue transition-colors font-mono"
                  />
                </div>

                {/* Model Name */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block mb-1.5 uppercase">
                    Model
                  </label>
                  <input
                    type="text"
                    value={agentSettings.model}
                    onChange={(e) => updateAgentSetting('model', e.target.value)}
                    placeholder={OPENCODE_MODEL}
                    spellCheck={false}
                    className="w-full rounded border border-zinc-200 bg-zinc-55/30 px-3 py-2 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-250 focus:outline-none focus:border-brand-blue transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block mb-1.5 uppercase">
                  Opencode API key
                </label>
                <input
                  type="password"
                  value={agentSettings.apiKey}
                  onChange={(e) => updateAgentSetting('apiKey', e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded border border-zinc-200 bg-zinc-55/30 px-3 py-2 text-xs text-zinc-850 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 focus:outline-none focus:border-brand-blue transition-colors font-mono disabled:opacity-50"
                />
                <p className="mt-1.5 text-[10px] leading-normal text-zinc-400">
                  Saved to your account for Morph agent chat. Never share this key publicly.
                </p>
              </div>

              {/* Base URL override */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block mb-1.5 uppercase">
                  Model API base URL (optional)
                </label>
                <input
                  type="text"
                  value={agentSettings.baseUrl}
                  onChange={(e) => updateAgentSetting('baseUrl', e.target.value)}
                  placeholder="https://api.opencode.ai/v1"
                  className="w-full rounded border border-zinc-200 bg-zinc-55/30 px-3 py-2 text-xs text-zinc-850 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 focus:outline-none focus:border-brand-blue transition-colors font-mono"
                />
              </div>

              {/* Test Button & Status */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveAgentProviderSettings}
                  disabled={saveStatus === 'saving'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-brand-blue text-white font-semibold cursor-pointer hover:bg-brand-blue/90 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {saveStatus === 'saving' ? 'Saving...' : 'Save settings'}
                </button>

                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testStatus === 'testing'}
                  className="px-4 py-2 rounded border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 font-semibold cursor-pointer hover:border-brand-blue/50 transition-colors disabled:opacity-50"
                >
                  {testStatus === 'testing' ? 'Testing opencode...' : 'Test opencode'}
                </button>

                {saveStatus === 'saved' && (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-rose-500 font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4" /> Save failed
                  </span>
                )}
                {saveStatus === 'dirty' && (
                  <span className="text-amber-500 font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4" /> unsaved changes
                  </span>
                )}
                {testStatus === 'success' && (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> opencode proxy responded
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="text-rose-500 font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4" /> Check saved key/proxy
                  </span>
                )}
              </div>
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
