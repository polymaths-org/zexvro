import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { activeServices } from '../data/services';
import { ServiceLogo } from './ServiceLogo';
import { Terminal, Copy, Check, ChevronRight, ChevronLeft } from 'lucide-react';

/** Claim-safe integration samples keyed by real service ids */
const serviceCodeSnippets: Record<string, string> = {
  zer0: `// Zer0 — private settlement with verifiable proof
import { Zer0 } from "@zexvro/zer0";

const pool = new Zer0({ network: "testnet" });
const receipt = await pool.shieldPay({
  to: "G…recipient",
  amountXlm: 10,
});
// proof + nullifier stay private; settlement is verifiable
console.log(receipt.txHash);`,
  morph: `// Morph — Web2 → Web3 transformation agent
// CLI: morph migrate --path ./app
import { Morph } from "@zexvro/morph";

const job = await Morph.inspect({
  repo: process.cwd(),
  target: "stellar",
});
console.log(job.plan); // migration steps, not a wallet tutorial`,
  reqwid: `// REQWID / Gate — human vs agent classification
import { Gate } from "@zexvro/gate";

const gate = new Gate({ siteKey: process.env.GATE_SITE_KEY! });
const verdict = await gate.classify(request);
// verdict: human | agent + confidence — not "guaranteed detection"
if (verdict.kind === "agent") {
  await gate.challenge(request); // captcha / policy path
}`,
  nfto: `// NFTo — embedded NFT infrastructure
import { Nfto } from "@zexvro/nfto";

const collection = await Nfto.createCollection({
  name: "Studio Drop",
  network: "public",
});
// Embed checkout in product UX — not a wallet-first flow
const embed = collection.checkoutEmbed({ theme: "dark" });`,
  dedsec: `// DEDSEC — x402 paid access for APIs & compute
// Unpaid GET/HEAD → HTTP 402 challenge
// After Stellar payment verification → one request unlocked
import { Dedsec } from "@zexvro/dedsec";

app.use(Dedsec.middleware({
  price: "0.01",
  asset: "USDC",
  onPaid: (ctx) => ctx.next(),
}));`,
};

export const ServiceShowcase: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedService = activeServices[activeIdx];

  const handleCopyCode = () => {
    const snippet = serviceCodeSnippets[selectedService.id] || '';
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slideLeft = () => {
    if (activeIdx > 0) setActiveIdx(activeIdx - 1);
  };

  const slideRight = () => {
    if (activeIdx < activeServices.length - 1) setActiveIdx(activeIdx + 1);
  };

  return (
    <section id="platform" className="relative w-full py-32 px-6 md:px-12 xl:px-24 bg-black border-t border-white/5">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-radial from-indigo-950/5 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-radial from-cyan-950/5 via-transparent to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center md:text-left mb-16">
          <span className="font-mono text-xs tracking-[0.4em] text-gray-500 uppercase block mb-4">
            Unified Protocol Stack
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-6">
            The ZEXVRO Service Matrix
          </h2>
          <p className="text-gray-400 font-light text-base md:text-lg max-w-2xl leading-relaxed">
            Five MVP services engineered for businesses shipping private, verifiable, agent-ready product surfaces on Stellar.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="flex justify-between items-center lg:hidden mb-4">
              <span className="font-mono text-[10px] text-gray-500 uppercase">
                Service {activeIdx + 1} of {activeServices.length}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={slideLeft}
                  disabled={activeIdx === 0}
                  className="p-2 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={slideRight}
                  disabled={activeIdx === activeServices.length - 1}
                  className="p-2 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 gap-4 no-scrollbar snap-x snap-mandatory"
            >
              {activeServices.map((service, index) => {
                const isActive = activeIdx === index;
                return (
                  <motion.div
                    key={service.id}
                    onClick={() => setActiveIdx(index)}
                    whileHover={{ x: isActive ? 0 : 4 }}
                    className={`flex-shrink-0 w-[280px] lg:w-full snap-center p-6 rounded-2xl border transition-all duration-500 cursor-pointer text-left ${
                      isActive
                        ? 'bg-neutral-950 border-white/15 shadow-[inset_0_0_12px_rgba(255,255,255,0.02)]'
                        : 'bg-transparent border-white/5 hover:border-white/10 hover:bg-neutral-950/20'
                    }`}
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <ServiceLogo
                        id={service.id}
                        name={service.name}
                        size={40}
                        state={
                          isActive
                            ? service.id === 'morph'
                              ? 'morph'
                              : 'active'
                            : 'idle'
                        }
                        className="border border-white/10 bg-white/[0.04]"
                      />
                      <div>
                        <h3
                          className={`text-sm font-bold tracking-wider transition-colors duration-300 ${
                            isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                          }`}
                        >
                          {service.name}
                        </h3>
                        <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
                          0{index + 1} / Component
                        </span>
                      </div>
                    </div>
                    <p
                      className={`text-xs font-light leading-relaxed line-clamp-2 transition-colors duration-300 ${
                        isActive ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {service.shortDesc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedService.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full rounded-2xl border border-white/10 bg-neutral-950/40 backdrop-blur-xl p-8 md:p-10 relative overflow-hidden text-left"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-tr ${selectedService.hologramColor} opacity-25 pointer-events-none filter blur-2xl`}
                />

                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-white/5 relative z-10 gap-4">
                  <div className="flex items-center gap-4">
                    <ServiceLogo
                      id={selectedService.id}
                      name={selectedService.name}
                      size={72}
                      state={selectedService.id === 'morph' ? 'morph' : 'focus'}
                      priority
                      className="border border-white/15 bg-black/40"
                    />
                    <div>
                      <span className="font-mono text-[9px] tracking-[0.3em] text-blue-400 uppercase">
                        Component Stack
                      </span>
                      <h3 className="text-2xl font-bold text-white mt-1">{selectedService.name}</h3>
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-full border border-white/5 bg-black/40 backdrop-blur-md flex items-center space-x-2 self-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-[10px] text-gray-400 tracking-wider">MVP surface</span>
                  </div>
                </div>

                <p className="text-gray-300 font-light text-sm md:text-base leading-relaxed mb-8 relative z-10">
                  {selectedService.fullDesc}
                </p>

                <div className="mb-8 relative z-10">
                  <h4 className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-4">
                    Capabilities
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedService.techDetails.map((detail, idx) => (
                      <div key={idx} className="flex items-center space-x-3 text-xs text-gray-400">
                        <span className="w-1 h-1 rounded-full bg-blue-500" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative z-10 rounded-xl border border-white/10 bg-black overflow-hidden font-mono text-xs text-left">
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-950/80 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                      <Terminal size={14} className="text-gray-500" />
                      <span className="text-[10px] text-gray-500 font-mono tracking-wider">
                        {selectedService.id}_sample.ts
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center space-x-1.5 text-gray-500 hover:text-white transition-colors py-1 px-2.5 rounded-md hover:bg-white/5"
                    >
                      {copied ? (
                        <>
                          <Check size={12} className="text-emerald-500" />
                          <span className="text-[10px] text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-5 overflow-x-auto max-h-[250px] no-scrollbar leading-relaxed">
                    <pre className="text-gray-400 selection:bg-blue-500/25">
                      <code>{serviceCodeSnippets[selectedService.id]}</code>
                    </pre>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
