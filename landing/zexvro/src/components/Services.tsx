import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CircleHelp, Target, Sparkles, GraduationCap } from 'lucide-react';
import { activeServices, labsService } from '../data/services';
import { ServiceLogo } from './ServiceLogo';
import { Glass } from './Glass';

const ease = [0.16, 1, 0.3, 1] as const;

const BLOCKS = [
  { key: 'what', label: 'What', Icon: CircleHelp, text: (s: (typeof activeServices)[number]) => s.what },
  { key: 'for', label: 'For', Icon: Target, text: (s: (typeof activeServices)[number]) => s.forWho },
  { key: 'why', label: 'Why', Icon: Sparkles, text: (s: (typeof activeServices)[number]) => s.why },
] as const;

/** ZEXVRO Labs — learning track card (uses graduation glyph, links out). */
const LabsGlyph: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <div
    className="relative flex items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-500/25 via-indigo-500/10 to-transparent"
    style={{ width: size, height: size }}
  >
    <GraduationCap size={Math.round(size * 0.55)} className="text-white" strokeWidth={1.5} />
  </div>
);

export const Services: React.FC = () => {
  const services = [...activeServices, labsService];

  return (
    <section id="about" className="relative w-full py-24 md:py-32 px-6 md:px-12 bg-black">
      <div className="absolute inset-0 bg-radial from-blue-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease }}
          className="text-center mb-14 md:mb-20 max-w-2xl mx-auto"
        >
          <p className="font-pixel text-[11px] sm:text-xs tracking-[0.32em] uppercase text-white/50 font-bold mb-4">
            Web3 on ZEXVRO
          </p>
          <h2 className="font-pixel text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-wide mb-4">
            Five services.
            <span className="font-sans italic font-black"> One way in.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/60 font-medium leading-relaxed">
            Private, verifiable, agent-ready infrastructure — without raw chain
            complexity. Here is what each service does, who it is for, and why
            teams use it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {services.map((s, i) => {
            const isLabs = s.id === 'labs';
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 36, scale: 0.96, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7, delay: (i % 3) * 0.12, ease }}
                whileHover={{ y: -6 }}
                className="flex"
              >
                <div className="group w-full rounded-[22px] border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20 transition-colors duration-300 p-6 md:p-7 flex flex-col">
                  <div className="flex items-center gap-3.5 mb-5">
                    {isLabs ? (
                      <LabsGlyph />
                    ) : (
                      <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 transition-transform duration-300 group-hover:scale-105">
                        <ServiceLogo id={s.id} name={s.name} size={36} state="idle" priority={i < 3} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-pixel text-sm sm:text-base font-bold text-white tracking-wide truncate">
                        {s.name}
                      </h3>
                      <p className="text-xs text-white/50 font-medium truncate">{s.shortDesc}</p>
                    </div>
                  </div>

                  <p className="font-sans text-base md:text-lg font-black text-white tracking-tight leading-snug mb-5">
                    {s.headline}
                  </p>

                  <div className="space-y-4 flex-1">
                    {BLOCKS.map(({ key, label, Icon, text }, bi) => (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.25 }}
                        transition={{ duration: 0.5, delay: 0.25 + (i % 3) * 0.12 + bi * 0.1, ease }}
                        className="flex gap-3"
                      >
                        <div className="shrink-0 flex items-start gap-2 w-14 pt-0.5">
                          <Icon size={14} className="text-blue-300/80 mt-1 shrink-0" />
                          <span className="font-pixel text-[9px] tracking-[0.18em] uppercase text-white/50 font-bold">
                            {label}
                          </span>
                        </div>
                        <p className="text-sm md:text-[15px] text-white/80 font-medium leading-relaxed">
                          {text(s)}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {s.href && (
                    <motion.a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ duration: 0.2, ease }}
                      className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 bg-white/[0.05] text-white px-4 py-2 text-[11px] font-bold hover:bg-white/10 transition-colors"
                    >
                      Visit Labs
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </motion.a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, delay: 0.15, ease }}
          className="mt-12 md:mt-16 text-center"
        >
          <motion.a
            href="/services/"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease }}
            className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-xs font-bold hover:bg-white/90 transition-colors"
          >
            Browse the full catalog
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};
