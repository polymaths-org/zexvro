import React, { useState } from 'react';
import { Settings, Save, Check, Shield, Server, Bell, Key } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useApp();
  const [stellarRpc, setStellarRpc] = useState('https://soroban-testnet.stellar.org');
  const [ethRpc, setEthRpc] = useState('https://rpc.sepolia.org');
  const [gasThreshold, setGasThreshold] = useState('5000000');
  const [autoCompile, setAutoCompile] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-8 font-sans text-xs">
      <div>
        <h1 className="text-2xl font-bold text-[#FAFAFA] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#3B82F6]" />
          Platform Settings
        </h1>
        <p className="text-xs text-[#A1A1AA] font-mono mt-1">
          Manage local RPC endpoints, Contract Studio preferences, and testnet credentials
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* RPC Endpoints Section */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-2 font-mono">
            <Server className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Custom RPC Providers</h3>
          </div>

          <div className="space-y-3 font-mono">
            <div>
              <label className="text-xs text-[#A1A1AA] block mb-1">Stellar Soroban RPC Endpoint</label>
              <input
                type="text"
                value={stellarRpc}
                onChange={(e) => setStellarRpc(e.target.value)}
                className="w-full p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-xs text-[#FAFAFA] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div>
              <label className="text-xs text-[#A1A1AA] block mb-1">Ethereum / Sepolia RPC</label>
              <input
                type="text"
                value={ethRpc}
                onChange={(e) => setEthRpc(e.target.value)}
                className="w-full p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-xs text-[#FAFAFA] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        {/* Studio Preferences */}
        <div className="p-5 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#27272A] pb-2">
            <Key className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Contract Studio Preferences</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCompile}
                onChange={(e) => setAutoCompile(e.target.checked)}
                className="rounded bg-[#111113] border-[#27272A] text-[#3B82F6]"
              />
              <span className="text-xs text-[#FAFAFA]">
                Auto-compile with WASM checker on file save
              </span>
            </label>

            <div>
              <label className="text-xs text-[#A1A1AA] block mb-1 font-mono">
                Gas warning limit (CPU instructions alert threshold)
              </label>
              <input
                type="text"
                value={gasThreshold}
                onChange={(e) => setGasThreshold(e.target.value)}
                className="w-full p-2.5 rounded-[6px] bg-[#111113] border border-[#27272A] text-xs text-[#FAFAFA] font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all shadow-sm active:scale-95"
          >
            {saved ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Preferences Saved' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
