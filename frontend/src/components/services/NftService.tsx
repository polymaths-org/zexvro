import { useState } from 'react';
import { Plus, Image, RefreshCw, Send, CheckCircle } from 'lucide-react';

export default function NftService() {
  const [nftName, setNftName] = useState('');
  const [nftSymbol, setNftSymbol] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [minted, setMinted] = useState<string | null>(null);

  const handleMint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nftName || !nftSymbol) return;

    setLoading(true);
    setMinted(null);

    setTimeout(() => {
      setLoading(false);
      setMinted(`stellar_tx_${Math.random().toString(16).slice(2, 10)}`);
      setNftName('');
      setNftSymbol('');
      setImageUrl('');
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">NFT Creator & Service</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create, mint, and distribute digital collectibles on the Stellar network.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Mint Form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Mint Digital Collectible</h2>

          <form onSubmit={handleMint} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Asset Name</label>
              <input
                type="text"
                required
                value={nftName}
                onChange={e => setNftName(e.target.value)}
                placeholder="My Special Token"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Symbol</label>
              <input
                type="text"
                required
                value={nftSymbol}
                onChange={e => setNftSymbol(e.target.value)}
                placeholder="MST"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 mb-1.5">Metadata/Image URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-zinc-900 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Deploying asset contract...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Mint Asset
                </>
              )}
            </button>
          </form>

          {minted && (
            <div className="mt-5 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
              <span className="text-green-800 dark:text-green-400 font-bold block mb-1 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" /> Asset Minted Successfully!
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 block mb-1">Stellar transaction reference:</span>
              <code className="text-zinc-800 dark:text-zinc-200 font-mono break-all">{minted}</code>
            </div>
          )}
        </div>

        {/* Visual Preview */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col justify-center items-center">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4 self-start">Live Asset Preview</h2>
          <div className="w-full max-w-[240px] aspect-square rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col items-center justify-center text-zinc-405 relative overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="NFT Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <Image className="h-10 w-10 text-zinc-400 mb-2" />
                <span className="text-xs text-zinc-400">Preview details</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
