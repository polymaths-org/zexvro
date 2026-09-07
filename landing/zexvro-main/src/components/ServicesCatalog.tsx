import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, CircleHelp, Target, Sparkles, GraduationCap } from 'lucide-react';
import { activeServices, labsService } from '../data/services';
import { ServiceLogo } from './ServiceLogo';
import { Glass } from './Glass';
import { Navbar } from './Navbar';
import { WaitlistModal } from './WaitlistModal';
import { useState } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;

const BLOCKS = [
  { key: 'what', label: 'What it does', Icon: CircleHelp, text: (s: (typeof activeServices)[number]) => s.what },
  { key: 'for', label: 'Who it is for', Icon: Target, text: (s: (typeof activeServices)[number]) => s.forWho },
  { key: 'why', label: 'Why use it', Icon: Sparkles, text: (s: (typeof activeServices)[number]) => s.why },
] as const;

export const ServicesCatalog: React.FC = () => {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const services = [...activeServices, labsService];

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-blue-500/30 selection:text-white">
      <div className="grain-overlay" />
      <div className="vignette" />

      {/* Nav */}
      <Navbar forceExpanded />

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 pt-32 md:pt-36 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease }}
          className="mb-14 md:mb-20"
        >          <motion.a
            href="/"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={13} />
            Back to home
          </motion.a>
          <motion.h1
            initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="font-pixel text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-wide mb-4"
          >
            Service catalog
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
            className="text-sm sm:text-base text-white/60 font-medium leading-relaxed max-w-xl"
          >
            Everything ZEXVRO ships — what each service does, who it is built
            for, and why teams choose it.
          </motion.p>
        </motion.div>

        <div className="space-y-6 md:space-y-8">
          {services.map((s, i) => {
            const isLabs = s.id === 'labs';
            return (
              <motion.article
                key={s.id}
                id={s.id}
                initial={{ opacity: 0, y: 36, scale: 0.97, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, ease }}
                whileHover={{ y: -4 }}
              >
                <div className="group w-full rounded-[24px] border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20 transition-colors duration-300 p-7 md:p-10">
                  <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
                    <div className="shrink-0 flex flex-col items-center gap-3">
                      {isLabs ? (
                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500/25 via-indigo-500/10 to-transparent transition-transform duration-300 group-hover:scale-105">
                          <GraduationCap size={36} className="text-white" strokeWidth={1.5} />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 transition-transform duration-300 group-hover:scale-105">
                          <ServiceLogo id={s.id} name={s.name} size={48} state="idle" priority={i < 3} />
                        </div>
                      )}
                      <span className="font-pixel text-[8px] tracking-[0.28em] uppercase text-white/45 font-bold">
                        {`0${i + 1}`}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-[9px] tracking-[0.28em] uppercase text-blue-200/80 mb-2">
                        {isLabs ? 'ZEXVRO Labs · Learning' : s.shortDesc}
                      </p>
                      <h2 className="font-sans text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-3">
                        {s.name}
                        <span className="text-white/30 mx-2">—</span>
                        <span className="text-white/80">{s.headline}</span>
                      </h2>
                      <p className="text-sm md:text-[15px] text-white/65 font-medium leading-relaxed mb-7 max-w-2xl">
                        {s.fullDesc}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
                        {BLOCKS.map(({ key, label, Icon, text }, bi) => (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, x: -12 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.5, delay: 0.2 + bi * 0.12, ease }}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                          >
                            <div className="flex items-center gap-2 mb-2.5">
                              <Icon size={13} className="text-blue-300/80" />
                              <span className="font-pixel text-[8px] tracking-[0.2em] uppercase text-white/45 font-bold">
                                {label}
                              </span>
                            </div>
                            <p className="text-[12.5px] text-white/75 font-medium leading-relaxed">
                              {text(s)}
                            </p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {s.techDetails.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-full border border-white/12 bg-white/[0.05] text-[10px] font-medium text-white/60"
                          >
                            {t}
                          </span>
                        ))}
                        {s.href ? (
                          <motion.a
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2, ease }}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-[11px] font-bold hover:bg-white/90 transition-colors"
                          >
                            Visit Labs
                            <ArrowRight size={13} />
                          </motion.a>
                        ) : (
                          <motion.button
                            type="button"
                            onClick={() => setWaitlistOpen(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2, ease }}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-[11px] font-bold hover:bg-white/90 transition-colors"
                          >
                            Join waitlist
                            <ArrowRight size={13} />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </main>

      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} />
    </div>
  );
};
