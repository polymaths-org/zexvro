import React, { useState } from 'react';
import { X, Play, Zap, CheckCircle2, ShieldCheck, Radio, Database, RefreshCw, Terminal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChainBadge } from '../common/ChainBadge';

export const DryRunModal: React.FC = () => {
  const { isDryRunOpen, setIsDryRunOpen, activeDryRun } = useApp();
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    status: 'success' | 'reverted';
    returnValue: string;
    gasUsed: number;
    events: Array<{ topic: string; data: string }>;
    storageDelta: Array<{ key: string; change: string }>;
    trace: string[];
  } | null>(null);

  if (!isDryRunOpen || !activeDryRun) return null;

  const { contract, fn } = activeDryRun;

  const handleArgChange = (name: string, val: string) => {
    setArgValues((prev) => ({ ...prev, [name]: val }));
  };

  const executeDryRun = () => {
    setIsSimulating(true);
    setSimulationResult(null);

    setTimeout(() => {
      setIsSimulating(false);
      // Construct dynamic simulation response
      if (fn.name === 'swap') {
        const inVal = Number(argValues['amount_in'] || '10000000');
        const calculatedOut = Math.floor(inVal * 0.997 * 1.85);
        setSimulationResult({
          status: 'success',
          returnValue: `${calculatedOut.toLocaleString()} stroops`,
          gasUsed: 13840,
          events: [
            { topic: 'swap(user, token_in, amount_in, amount_out)', data: `user=${argValues['user'] || 'GBZX...44AL'}, amount_out=${calculatedOut}` },
          ],
          storageDelta: [
            { key: 'DataKey::ReserveA', change: `+${inVal}` },
            { key: 'DataKey::ReserveB', change: `-${calculatedOut}` },
          ],
          trace: [
            '1. [HOST] verify_auth(user) -> OK (Ed25519 signature valid)',
            '2. [STORAGE] instance.get(TokenA) -> Address(CA3D...)',
            '3. [MATH] fee = amount_in * 30 / 10000 -> 30,000 units',
            '4. [STORAGE] instance.set(ReserveA, ReserveB) -> OK',
            '5. [HOST] emit_event("swap") -> OK',
          ],
        });
      } else if (fn.name === 'deposit') {
        const desiredA = Number(argValues['desired_a'] || '100000');
        setSimulationResult({
          status: 'success',
          returnValue: `${(desiredA * 2).toLocaleString()} LP shares`,
          gasUsed: 17200,
          events: [{ topic: 'deposit', data: `shares_minted=${desiredA * 2}` }],
          storageDelta: [
            { key: 'DataKey::ReserveA', change: `+${desiredA}` },
            { key: 'DataKey::TotalShares', change: `+${desiredA * 2}` },
          ],
          trace: [
            '1. [HOST] require_auth(user) -> OK',
            '2. [STORAGE] instance.get(TotalShares) -> 0 (Bootstrap pool)',
            '3. [STORAGE] instance.set(TotalShares) -> OK',
          ],
        });
      } else if (fn.name === 'get_reserves') {
        setSimulationResult({
          status: 'success',
          returnValue: '(ReserveA: 1,450,000, ReserveB: 2,900,000, TotalShares: 2,050,000)',
          gasUsed: 2040,
          events: [],
          storageDelta: [],
          trace: [
            '1. [STORAGE] read(ReserveA) -> 1450000',
            '2. [STORAGE] read(ReserveB) -> 2900000',
            '3. [STORAGE] read(TotalShares) -> 2050000',
          ],
        });
      } else {
        setSimulationResult({
          status: 'success',
          returnValue: 'Success (void/executed)',
          gasUsed: fn.gasEstimate || 10000,
          events: [{ topic: fn.eventsEmitted[0] || 'call_executed', data: 'data=0x' }],
          storageDelta: [{ key: 'ContractStorage', change: 'Updated' }],
          trace: ['1. [HOST] invoke entrypoint -> OK', '2. [RETURN] completed with zero errors'],
        });
      }
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl rounded-[8px] border border-[#3F3F46] bg-[#0A0A0B] shadow-2xl overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272A] bg-[#111113]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">
              Dry-Run Invoke Sandbox <span className="text-[#71717A] font-normal text-xs">(Zero Gas Cost)</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDryRunOpen(false)}
            className="p-1 text-[#71717A] hover:text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contract & Function Banner */}
        <div className="px-5 py-3 border-b border-[#27272A] bg-[#0E0E10] flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A1A1AA] font-mono">{contract.name}</span>
              <span className="text-xs font-semibold text-[#FAFAFA] font-mono">::{fn.name}()</span>
            </div>
            <p className="text-[11px] text-[#71717A] font-mono truncate max-w-md mt-0.5">
              {fn.signature}
            </p>
          </div>
          <ChainBadge
            chain={contract.chain}
            network={contract.network}
            contractId={contract.contractId}
            truncateId={true}
            showCopy={true}
          />
        </div>

        {/* Form Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-mono font-medium text-[#A1A1AA] block mb-2">
              Function Arguments ({fn.arguments.length}):
            </label>

            {fn.arguments.length === 0 ? (
              <div className="p-3 text-xs font-mono text-[#71717A] bg-[#111113] border border-[#27272A] rounded">
                This function takes zero arguments. Ready to dry-run invoke.
              </div>
            ) : (
              <div className="space-y-3">
                {fn.arguments.map((arg) => (
                  <div key={arg.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#FAFAFA] font-semibold">{arg.name}</span>
                      <span className="text-[#3B82F6]">{arg.type}</span>
                    </div>
                    <input
                      type="text"
                      value={argValues[arg.name] || ''}
                      onChange={(e) => handleArgChange(arg.name, e.target.value)}
                      placeholder={
                        arg.type.includes('Address')
                          ? 'GBZXW4... or 0x71C...'
                          : arg.type.includes('i128') || arg.type.includes('uint')
                          ? '1000000'
                          : 'Argument value'
                      }
                      className="w-full px-3 py-1.5 rounded-[6px] bg-[#111113] border border-[#27272A] font-mono text-xs text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#3B82F6] focus:outline-none"
                    />
                    <p className="text-[10px] text-[#71717A]">{arg.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#71717A] font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Simulates state against local mock RPC</span>
            </div>

            <button
              type="button"
              onClick={executeDryRun}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Dry-Run Invoke</span>
                </>
              )}
            </button>
          </div>

          {/* Simulation Output Panel */}
          {simulationResult && (
            <div className="mt-4 rounded-[6px] border border-[#27272A] bg-[#0E0E10] p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                <span className="flex items-center gap-1.5 text-xs font-mono text-[#22C55E] font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Simulation Succeeded
                </span>
                <span className="text-xs font-mono text-[#A1A1AA]">
                  Gas Consumed: <strong className="text-[#FAFAFA]">{simulationResult.gasUsed.toLocaleString()}</strong>
                </span>
              </div>

              {/* Return value */}
              <div>
                <span className="text-[11px] font-mono text-[#71717A] uppercase block mb-1">
                  Return Value:
                </span>
                <pre className="p-2 rounded bg-[#050505] border border-[#27272A] text-xs font-mono text-[#22C55E] overflow-x-auto">
                  {simulationResult.returnValue}
                </pre>
              </div>

              {/* Storage Delta */}
              {simulationResult.storageDelta.length > 0 && (
                <div>
                  <span className="text-[11px] font-mono text-[#71717A] uppercase flex items-center gap-1 mb-1">
                    <Database className="w-3 h-3 text-[#F59E0B]" />
                    Storage Delta:
                  </span>
                  <div className="space-y-1">
                    {simulationResult.storageDelta.map((sd, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-[#050505] border border-[#27272A]"
                      >
                        <span className="text-[#A1A1AA]">{sd.key}</span>
                        <span className="text-[#F59E0B] font-semibold">{sd.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {simulationResult.events.length > 0 && (
                <div>
                  <span className="text-[11px] font-mono text-[#71717A] uppercase flex items-center gap-1 mb-1">
                    <Radio className="w-3 h-3 text-[#3B82F6]" />
                    Emitted Events ({simulationResult.events.length}):
                  </span>
                  <div className="space-y-1">
                    {simulationResult.events.map((ev, i) => (
                      <div key={i} className="p-1.5 rounded bg-[#050505] border border-[#27272A] text-xs font-mono">
                        <div className="text-[#3B82F6]">{ev.topic}</div>
                        <div className="text-[#71717A] text-[11px] truncate">{ev.data}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VM Execution Trace */}
              <div>
                <span className="text-[11px] font-mono text-[#71717A] uppercase flex items-center gap-1 mb-1">
                  <Terminal className="w-3 h-3 text-[#A1A1AA]" />
                  Execution Trace:
                </span>
                <div className="p-2 rounded bg-[#050505] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA] space-y-0.5">
                  {simulationResult.trace.map((tr, i) => (
                    <div key={i} className="text-[#A1A1AA]">
                      {tr}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
