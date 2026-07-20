import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, Twitter, Linkedin } from 'lucide-react';
import { SafeShader } from './SafeShader';

const MEMBERS = [
  {
    name: 'Paris',
    role: 'Founder · Product',
    bio: 'Ships the rails. Obsessed with making Web3 feel like normal software for real businesses.',
    img: '/paris1.png',
    imgHover: '/paris2.png',
    side: 'left' as const,
    socials: [
      { icon: Twitter, href: '#', label: 'X' },
      { icon: Github, href: '#', label: 'GitHub' },
      { icon: Linkedin, href: '#', label: 'LinkedIn' },
    ],
  },
  {
    name: 'Rushi',
    role: 'Founder · Protocol',
    bio: 'Infrastructure, security, and the boring stuff that has to work at 3am — every time.',
    img: '/rushi1.png',
    imgHover: '/rushi2.png',
    side: 'right' as const,
    socials: [
      { icon: Twitter, href: '#', label: 'X' },
      { icon: Github, href: '#', label: 'GitHub' },
      { icon: Linkedin, href: '#', label: 'LinkedIn' },
    ],
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export const Team: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section
      id="team"
      className="relative w-full py-28 md:py-36 px-6 md:px-12 xl:px-24 bg-black border-t border-white/5 overflow-hidden"
    >
      <SafeShader
        fov={45}
        pixelDensity={0.85}
        veilClassName="absolute inset-0 bg-black/40 pointer-events-none"
        gradient={{
          animate: 'on',
          brightness: 1.2,
          cAzimuthAngle: 180,
          cDistance: 3.59,
          cPolarAngle: 90,
          cameraZoom: 2.01,
          color1: '#3029ff',
          color2: '#3553db',
          color3: '#000000',
          envPreset: 'city',
          grain: 'on',
          lightType: '3d',
          positionX: -0.1,
          positionY: -0.2,
          positionZ: 0,
          range: 'disabled',
          rangeEnd: 40,
          rangeStart: 0,
          reflection: 0.1,
          rotationX: 40,
          rotationY: 100,
          rotationZ: 50,
          shader: 'defaults',
          type: 'sphere',
          uAmplitude: 1,
          uDensity: 1.3,
          uFrequency: 5.5,
          uSpeed: 0.4,
          uStrength: 4,
          uTime: 0,
          wireframe: false,
        }}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black via-transparent to-black pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.8, ease }}
          className="mb-14 md:mb-16"
        >
          <span className="font-pixel text-[10px] tracking-[0.32em] uppercase text-white/35 block mb-4">
            The people
          </span>
          <h2 className="mb-4">
            <span className="font-pixel text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-wide">
              Built by{' '}
            </span>
            <span className="font-sans text-3xl sm:text-4xl md:text-5xl font-light text-white/90">
              people who <span className="font-semibold italic">ship</span>.
            </span>
          </h2>
          <p className="text-white/45 text-sm md:text-base max-w-lg leading-relaxed font-light">
            Small team. Full stack. One obsession — make shifting your business to Web3 feel obvious.
          </p>
        </motion.div>

        {/* Side-by-side, tight gap; text expands toward center */}
        <div className="relative flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4 md:gap-5 min-h-[420px] md:min-h-[500px]">
          {MEMBERS.map((m, i) => {
            const isActive = active === i;
            const isLeft = m.side === 'left';

            return (
              <motion.article
                key={m.name}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.7, delay: i * 0.1, ease }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={`relative flex items-stretch ${
                  isLeft ? 'flex-row' : 'flex-row-reverse'
                } ${isActive ? 'z-20' : 'z-10'}`}
              >
                {/* Photo — stays on outer edge */}
                <div className="relative shrink-0 w-[min(42vw,220px)] sm:w-[240px] md:w-[280px] aspect-[3/4] sm:aspect-auto sm:h-[420px] md:h-[500px] overflow-hidden rounded-3xl border border-white/10 bg-neutral-950">
                  <img
                    src={m.img}
                    alt={m.name}
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
                      isActive ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <img
                    src={m.imgHover}
                    alt={`${m.name} alternate`}
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Name chip when collapsed */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${
                      isActive ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <p className="font-pixel text-[9px] tracking-[0.28em] uppercase text-white/45 mb-1">
                      {m.role}
                    </p>
                    <h3 className="font-sans text-lg font-semibold text-white tracking-tight">
                      {m.name}
                    </h3>
                  </div>
                </div>

                {/* Text panel — expands toward center (opposite of image side) */}
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      initial={{
                        width: 0,
                        opacity: 0,
                      }}
                      animate={{
                        width: 'auto',
                        opacity: 1,
                      }}
                      exit={{
                        width: 0,
                        opacity: 0,
                      }}
                      transition={{ duration: 0.4, ease }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`h-full flex flex-col justify-center py-6 sm:py-8 w-[min(70vw,280px)] sm:w-[260px] md:w-[300px] ${
                          isLeft ? 'pl-5 md:pl-8 pr-2' : 'pr-5 md:pr-8 pl-2'
                        }`}
                      >
                        <p className="font-pixel text-[10px] tracking-[0.28em] uppercase text-white/40 mb-2">
                          {m.role}
                        </p>
                        <h3 className="font-sans text-2xl md:text-3xl font-semibold text-white tracking-tight mb-3">
                          {m.name}
                        </h3>
                        <p className="text-sm font-light text-white/55 leading-relaxed mb-6">
                          {m.bio}
                        </p>
                        <div className={`flex gap-2.5 ${isLeft ? '' : 'flex-row-reverse self-end'}`}>
                          {m.socials.map((s) => {
                            const Icon = s.icon;
                            return (
                              <a
                                key={s.label}
                                href={s.href}
                                aria-label={s.label}
                                className="h-9 w-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/55 hover:text-white transition-colors"
                              >
                                <Icon size={14} />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
