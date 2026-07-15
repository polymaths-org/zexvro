import { useState } from 'react';
import { ArrowLeftRight, TrendingUp, ShieldCheck, Play, HelpCircle } from 'lucide-react';

type TradeOffer = {
  id: string;
  senderAgent: string;
  receiverAgent: string;
  assetSent: string;
  assetRecv: string;
  status: 'negotiating' | 'settled' | 'declined';
  value: string;
};

export default function TradePipeline() {
  const [trades, setTrades] = useState<TradeOffer[]>([
    { id: 'tr-1', senderAgent: 'ArbitrageBot-0x', receiverAgent: 'MarketMaker-Stellar', assetSent: '100 XLM', assetRecv: '8.40 USDC', status: 'settled', value: '$8.40' },
    { id: 'tr-2', senderAgent: 'StellarMarket-Pro', receiverAgent: 'LiquidityPool-01', assetSent: '500 yXLM', assetRecv: '505 XLM', status: 'negotiating', value: '$42.20' }
  ]);

  const [loading, setLoading] = useState(false);

  const simulateTrade = () => {
    setLoading(true);
    setTimeout(() => {
      const newTrade: TradeOffer = {
        id: `tr-${Date.now()}`,
        senderAgent: 'ArbitrageBot-0x',
        receiverAgent: 'MarketMaker-Stellar',
        assetSent: '50 XLM',
        assetRecv: '4.20 USDC',
        status: 'settled',
        value: '$4.20'
      };
      setTrades(prev => [newTrade, ...prev]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">A-2-A Trade Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Automated negotiations, arbitrage triggers, and liquidity settlements between platform agents.
          </p>
        </div>

        <button
          onClick={simulateTrade}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Executing swap...' : 'Trigger Swap Negotiation'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Pipeline Deals</h2>
          <div className="space-y-3">
            {trades.map(t => (
              <div key={t.id} className="p-4 border border-zinc-100 dark:border-zinc-850 rounded-lg flex items-center justify-between gap-4 bg-zinc-50/20 dark:bg-zinc-900/10">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">{t.senderAgent}</span>
                    <ArrowLeftRight className="h-3 w-3 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">{t.receiverAgent}</span>
                  </div>

                  <div className="mt-1 text-[11px] text-zinc-500 font-semibold flex gap-2">
                    <span>Swapping {t.assetSent} ➔ {t.assetRecv}</span>
                    <span>•</span>
                    <span className="text-zinc-400">Estimated value: {t.value}</span>
                  </div>
                </div>

                <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  t.status === 'settled' ? 'bg-green-500/10 text-green-500' :
                  t.status === 'negotiating' ? 'bg-amber-500/10 text-amber-500 animate-pulse' :
                  'bg-zinc-100 text-zinc-505'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Analytics */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Swap Validation</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-450">Verification Engine</span>
                <span className="text-green-500 font-bold flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Slippage Threshold</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">0.5% (Max)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Gas Optimization</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">On (Soroban fees)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-850 pt-4 flex gap-2 items-start text-[11px] text-zinc-400">
            <HelpCircle className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
            <span>Trades automatically settle through escrow pools on the Stellar testnet. All swaps utilize ZK routing.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
