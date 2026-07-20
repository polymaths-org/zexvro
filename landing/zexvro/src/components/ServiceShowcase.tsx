import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { activeServices } from '../data/services';
import { UserCheck, Coins, CreditCard, Zap, RefreshCw, ShieldCheck, Terminal, Copy, Check, ChevronRight, ChevronLeft } from 'lucide-react';

const IconRenderer: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  switch (name) {
    case 'UserCheck': return <UserCheck className={className} />;
    case 'Coins': return <Coins className={className} />;
    case 'CreditCard': return <CreditCard className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'RefreshCw': return <RefreshCw className={className} />;
    case 'ShieldCheck': return <ShieldCheck className={className} />;
    default: return <Zap className={className} />;
  }
};

// Simulated beautiful code implementation blocks for Vercel/Stripe style credibility
const serviceCodeSnippets: Record<string, string> = {
  connect: `import { ZexvroConnect } from "@zexvro/sdk-react";

export default function App() {
  return (
    <ZexvroConnect
      clientId="zex_live_7aef239"
      onOnboard={({ user, wallet }) => {
        console.log("Web2 User Verified:", user.email);
        console.log("Sub-ledger Wallet:", wallet.address);
      }}
      providers={["google", "apple", "passkey"]}
    />
  );
}`,
  mint: `import { ZexvroClient } from "@zexvro/sdk-node";

const zex = new ZexvroClient({ apiKey: "zex_sk_9481b0" });

const receipt = await zex.mint.deploy({
  chainId: 137, // Polygon
  standard: "ERC-721A",
  name: "ZEXVRO Genesis",
  symbol: "ZEXV",
  metadata: {
    name: "Member #01",
    attributes: [{ trait_type: "Tier", value: "Elite" }]
  }
});`,
  pay: `import { ZexvroPay } from "@zexvro/sdk-react";

export function CheckoutButton() {
  return (
    <ZexvroPay
      sessionToken="pay_session_2f84a"
      allowedMethods={["card", "applepay", "sepa"]}
      onSuccess={(txHash) => {
        alert(\`Settled instantly! Tx: \${txHash}\`);
      }}
    />
  );
}`,
  scale: `// Automatic account abstraction & gas sponsorship
const tx = await zex.scale.executeGasless({
  contractAddress: "0x367f...289a",
  abi: CONTRACT_ABI,
  functionName: "claimReward",
  args: [userId],
  sponsor: true // sponsored via paymaster
});`,
  sync: `// Real-time block stream webhooks
const indexer = zex.sync.createListener({
  address: "0x7a250...92b4",
  topic: "Transfer(address,address,uint256)",
  onEvent: (event) => {
    console.log("Sub-second ledger hit:", event.args);
  }
});`,
  guard: `// AI-powered pre-transaction threat check
const audit = await zex.guard.screenTransaction({
  from: "0x1b74...3291",
  to: "0x98f2...014c",
  payload: "0xa9059cbb...",
  value: "2500000000"
});

if (audit.score > 85) {
  throw new Error("Automated guard triggered: Suspicious asset drain trace detected.");
}`
};

export const ServiceShowcase: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedService = activeServices[activeIdx];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(serviceCodeSnippets[selectedService.id]);
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
      {/* Background gradients */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-radial from-indigo-950/5 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-radial from-cyan-950/5 via-transparent to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Title */}
        <div className="text-center md:text-left mb-16">
          <span className="font-mono text-xs tracking-[0.4em] text-gray-500 uppercase block mb-4">
            Unified Protocol Stack
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-6">
            The ZEXVRO Service Matrix
          </h2>
          <p className="text-gray-400 font-light text-base md:text-lg max-w-2xl leading-relaxed">
            Six enterprise components engineered to abstract complete Web3 operations. Integration takes minutes; execution runs instantly.
          </p>
        </div>

        {/* Carousel & Code Grid Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* LEFT SIDE: Interactive Selector Cards (Scrollable List on Mobile, Stacked on Desktop) */}
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
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-500 ${
                        isActive 
                          ? 'bg-white/5 border-white/25 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                          : 'bg-transparent border-white/5 text-gray-500'
                      }`}>
                        <IconRenderer name={service.iconName} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold tracking-wider transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                          {service.name}
                        </h3>
                        <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
                          0{index + 1} / Component
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs font-light leading-relaxed line-clamp-2 transition-colors duration-300 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                      {service.shortDesc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE: Interactive Glass Detail Panel & IDE Code Stream */}
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
                {/* Iridescent background glow matching the component */}
                <div className={`absolute inset-0 bg-gradient-to-tr ${selectedService.hologramColor} opacity-25 pointer-events-none filter blur-2xl`} />

                {/* Service Header Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-white/5 relative z-10">
                  <div className="mb-4 md:mb-0">
                    <span className="font-mono text-[9px] tracking-[0.3em] text-blue-400 uppercase">
                      Component Stack
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {selectedService.name}
                    </h3>
                  </div>
                  <div className="px-4 py-2 rounded-full border border-white/5 bg-black/40 backdrop-blur-md flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-[10px] text-gray-400 tracking-wider">
                      Ready to Integrate
                    </span>
                  </div>
                </div>

                {/* Full Description */}
                <p className="text-gray-300 font-light text-sm md:text-base leading-relaxed mb-8 relative z-10">
                  {selectedService.fullDesc}
                </p>

                {/* Sub-capabilities bullet points */}
                <div className="mb-8 relative z-10">
                  <h4 className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-4">
                    Sub-ledger Capabilities
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

                {/* IDE Code Terminal */}
                <div className="relative z-10 rounded-xl border border-white/10 bg-black overflow-hidden font-mono text-xs text-left">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-950/80 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                      <Terminal size={14} className="text-gray-500" />
                      <span className="text-[10px] text-gray-500 font-mono tracking-wider">
                        integration_sample.tsx
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
                  {/* Terminal Code Body */}
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
