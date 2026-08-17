import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';

gsap.registerPlugin(ScrollTrigger);

const ease = [0.16, 1, 0.3, 1] as const;

const REPEAT = Array.from({ length: 10 });

export const Team: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLDivElement>('.founders-row', rowsRef.current);
      rows.forEach((row, i) => {
        // even rows →-→, odd rows ←-← : neighbours always move opposite
        const right = i % 2 === 0;
        gsap.fromTo(
          row,
          { xPercent: right ? -50 : 0 },
          { xPercent: right ? 0 : -50, duration: 22, ease: 'none', repeat: -1 }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="team"
      className="relative w-full overflow-hidden bg-black border-t border-white/5"
    >
      {/* ——— Repeating "FOUNDERS" wallpaper — alternately drifts left/right on scroll ——— */}
      <div
        ref={rowsRef}
        aria-hidden
        className="absolute inset-0 flex flex-col justify-center gap-5 select-none pointer-events-none"
      >
        {REPEAT.map((_, i) => (
          <div
            key={i}
            className={
              'founders-row whitespace-nowrap font-sans font-black uppercase text-white/[0.05] leading-none'
            }
            style={{ fontSize: 'clamp(2.5rem, 9vw, 8rem)' }}
          >
            Founders · Founders · Founders · Founders · Founders · Founders ·
          </div>
        ))}
      </div>

      {/* Top / bottom blur to blend into neighbouring sections */}
      <div className="absolute top-0 left-0 right-0 h-12 md:h-16 z-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 backdrop-blur-[10px]" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-44 z-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 backdrop-blur-[10px]" />
      </div>

      {/* ——— Giant "The Team" title spanning the section ——— */}
      <div className="relative z-10 flex items-center justify-center min-h-[42vh] md:min-h-[48vh] w-full px-6 text-center overflow-hidden">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.9, ease }}
          className="font-sans font-black uppercase text-white leading-none tracking-tight whitespace-nowrap flex items-baseline justify-center gap-2"
          style={{ fontSize: 'clamp(4rem, 17vw, 16rem)' }}
        >
          The&nbsp;Tea
          <img
            src="/services/morph.svg"
            alt=""
            role="presentation"
            loading="lazy"
            className="inline-block align-baseline"
            style={{ height: '1.02em', width: 'auto', transform: 'translateY(0.06em)' }}
          />
        </motion.h2>
      </div>

      {/* ——— Founders image: full-bleed band, overlapping the title ——— */}
      <motion.img
        src="/founders.png"
        alt="The Zexvro founders"
        loading="lazy"
        decoding="async"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.9, ease }}
        className="relative z-20 block w-full h-[56vh] md:h-[60vh] object-contain -mt-[34vh] md:-mt-[32vh]"
      />
    </section>
  );
};