import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { activeServices, labsService } from '../data/services';
import { ServiceLogo } from './ServiceLogo';
import { Glass } from './Glass';
import { GraduationCap, ArrowRight } from 'lucide-react';

const SafeShader = lazy(() => import('./SafeShader').then((m) => ({ default: m.SafeShader })));

gsap.registerPlugin(ScrollTrigger);

/** Spaced 2×3 grid — clear gaps, centered */
const BUBBLE_POS = [
  { x: -34, y: -26 },
  { x: 0, y: -26 },
  { x: 34, y: -26 },
  { x: -34, y: 22 },
  { x: 0, y: 22 },
  { x: 34, y: 22 },
];

export const Web3Grid: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  const morphBlockRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const web2Ref = useRef<HTMLDivElement>(null);
  const web3LineRef = useRef<HTMLDivElement>(null);
  const digit2Ref = useRef<HTMLSpanElement>(null);
  const digit3Ref = useRef<HTMLSpanElement>(null);
  const onSlotRef = useRef<HTMLSpanElement>(null);
  const onRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const subMorphRef = useRef<HTMLParagraphElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const bubblesBlockRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const magicLineRef = useRef<HTMLParagraphElement>(null);
  const magicSubRef = useRef<HTMLParagraphElement>(null);
  const bubblesWrapRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const qMarkRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeLineRef = useRef<HTMLParagraphElement>(null);

  const showcaseRef = useRef<HTMLDivElement>(null);
  const carStageRef = useRef<HTMLDivElement>(null);
  const carTitleRef = useRef<HTMLHeadingElement>(null);
  const carSubRef = useRef<HTMLParagraphElement>(null);

  const [brandError, setBrandError] = useState(false);
  const [typed, setTyped] = useState('');
  const typeFull = '5 unique services — just for the MVP.';

  const n = activeServices.length;

  /** Horizontal showcase shows the 5 MVP services plus ZEXVRO Labs learning track. */
  const carouselServices: typeof activeServices = [...activeServices, labsService];

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return;

    const ctx = gsap.context(() => {
      // Both Web2 & Web3 stack in the same centered stage
      gsap.set(web2Ref.current, {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        y: 0,
        letterSpacing: '0.18em',
      });
      gsap.set(web3LineRef.current, {
        opacity: 0,
        filter: 'blur(18px)',
        scale: 0.96,
      });
      gsap.set(digit2Ref.current, { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 });
      gsap.set(digit3Ref.current, { opacity: 0, filter: 'blur(16px)', y: 20, scale: 0.75 });
      // "on" starts collapsed width so Web3 stays centered until open
      gsap.set(onSlotRef.current, { width: 0, opacity: 1, marginLeft: 0, marginRight: 0 });
      gsap.set(onRef.current, {
        opacity: 0,
        filter: 'blur(12px)',
        scaleX: 1.4,
        scaleY: 0.6,
      });
      gsap.set(logoRef.current, {
        opacity: 0,
        filter: 'blur(16px)',
        y: 36,
        scaleY: 0.5,
        scaleX: 1.25,
      });
      gsap.set(subMorphRef.current, { opacity: 0, y: 18 });
      gsap.set(glowRef.current, { opacity: 0.25, scale: 0.85 });
      gsap.set(morphBlockRef.current, { opacity: 1, filter: 'blur(0px)', scale: 1 });
      gsap.set(stageRef.current, { x: 0 });

      gsap.set(bubblesBlockRef.current, { opacity: 0, pointerEvents: 'none', visibility: 'hidden' });
      gsap.set(titleRef.current, { opacity: 0, filter: 'blur(12px)', y: 16 });
      gsap.set(magicLineRef.current, { opacity: 0, filter: 'blur(10px)', y: 14 });
      gsap.set(magicSubRef.current, { opacity: 0, filter: 'blur(8px)', y: 10 });
      gsap.set(typeLineRef.current, { opacity: 0 });
      gsap.set(carTitleRef.current, { opacity: 0, filter: 'blur(12px)', y: 12 });
      gsap.set(carSubRef.current, { opacity: 0, y: 10 });

      bubbleRefs.current.forEach((el, i) => {
        if (!el) return;
        const p = BUBBLE_POS[i];
        gsap.set(el, { opacity: 0, scale: 0.5, x: `${p.x}%`, y: `${p.y}%` });
      });
      qMarkRefs.current.forEach((el) => {
        if (el) gsap.set(el, { opacity: 1, filter: 'blur(0px)', scale: 1 });
      });
      iconRefs.current.forEach((el) => {
        if (el) gsap.set(el, { opacity: 0, filter: 'blur(8px)', scale: 0.65 });
      });

      gsap.set(showcaseRef.current, { opacity: 0, pointerEvents: 'none', y: 40 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=950%',
          scrub: 1.6,
          pin: pin,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            // type during line phase only (tl ≈2.4-2.6 of total ~13.65 ⇒ ~0.18 progress)
            if (p >= 0.17 && p < 0.2) {
              const t = Math.min(1, (p - 0.17) / 0.03);
              setTyped(typeFull.slice(0, Math.floor(t * typeFull.length)));
            } else if (p >= 0.2 && p < 0.3) {
              setTyped(typeFull);
            } else if (p < 0.17) {
              setTyped('');
            }
          },
        },
        defaults: { ease: 'power2.inOut' },
      });

      // ——— Morph: Web2 → Web3 (same center) ———
      tl.to(glowRef.current, { opacity: 0.4, scale: 1, duration: 0.1 }, 0);

      tl.to(
        web2Ref.current,
        {
          opacity: 0,
          filter: 'blur(26px)',
          scale: 1.08,
          y: -20,
          letterSpacing: '0.4em',
          duration: 0.28,
        },
        0.12
      );

      // Web3 appears in exact same centered slot
      tl.to(
        web3LineRef.current,
        {
          opacity: 1,
          filter: 'blur(0px)',
          scale: 1,
          duration: 0.3,
          ease: 'power3.out',
        },
        0.26
      );
      tl.to(
        digit2Ref.current,
        { opacity: 0, filter: 'blur(14px)', y: -24, scale: 1.2, duration: 0.18, ease: 'power2.in' },
        0.28
      );
      tl.to(
        digit3Ref.current,
        { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1, duration: 0.26, ease: 'power3.out' },
        0.32
      );

      // Open "on" slot + shift composition slightly left so it still feels balanced
      tl.to(
        onSlotRef.current,
        {
          width: 'auto',
          marginLeft: '0.65rem',
          duration: 0.32,
          ease: 'power3.out',
        },
        0.52
      );
      tl.to(
        onRef.current,
        {
          opacity: 1,
          filter: 'blur(0px)',
          scaleX: 1,
          scaleY: 1,
          duration: 0.28,
          ease: 'power3.out',
        },
        0.54
      );
      tl.to(stageRef.current, { x: -12, duration: 0.32, ease: 'power2.out' }, 0.52);

      tl.to(
        logoRef.current,
        {
          opacity: 1,
          filter: 'blur(0px)',
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.3,
          ease: 'power3.out',
        },
        0.68
      );
      tl.to(subMorphRef.current, { opacity: 0.7, y: 0, duration: 0.16 }, 0.82);

      // Hold morph a beat, then blur out
      tl.to({}, { duration: 0.18 }, 0.95);
      tl.to(
        morphBlockRef.current,
        { opacity: 0, filter: 'blur(22px)', scale: 0.96, duration: 0.28, ease: 'power2.in' },
        1.1
      );

      // ——— Bubbles (spaced) ———
      tl.set(bubblesBlockRef.current, { opacity: 1, pointerEvents: 'auto', visibility: 'visible' }, 1.28);
      bubbleRefs.current.forEach((el, i) => {
        if (!el) return;
        tl.to(
          el,
          { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(1.2)' },
          1.32 + i * 0.05
        );
      });

      tl.to(
        titleRef.current,
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.35, ease: 'power3.out' },
        1.55
      );
      tl.to(
        magicLineRef.current,
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.32, ease: 'power3.out' },
        1.62
      );

      // ? → icons
      qMarkRefs.current.forEach((el, i) => {
        if (!el) return;
        tl.to(
          el,
          { opacity: 0, filter: 'blur(10px)', scale: 0.5, duration: 0.28, ease: 'power2.in' },
          1.7 + i * 0.05
        );
      });
      iconRefs.current.forEach((el, i) => {
        if (!el) return;
        tl.to(
          el,
          { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.32, ease: 'power3.out' },
          1.76 + i * 0.05
        );
      });

      // Magic sub-copy after icons land
      tl.to(
        magicSubRef.current,
        { opacity: 0.75, filter: 'blur(0px)', y: 0, duration: 0.3, ease: 'power2.out' },
        2.05
      );

      // Line
      bubbleRefs.current.forEach((el, i) => {
        if (!el) return;
        const lineX = (i - 2.5) * 16;
        tl.to(el, { x: `${lineX}%`, y: '0%', duration: 0.45, ease: 'power3.inOut' }, 2.25);
      });
      tl.to(typeLineRef.current, { opacity: 1, duration: 0.22 }, 2.4);

      // ——— DISTANCE: long hold / travel before carousel ———
      tl.to({}, { duration: 0.5 }, 2.6);

      // Kill entire bubbles layer so no leftover copy sits under the carousel
      tl.to(
        bubblesBlockRef.current,
        { opacity: 0, filter: 'blur(14px)', y: -24, duration: 0.4, ease: 'power2.in' },
        3.05
      );
      tl.set(bubblesBlockRef.current, { pointerEvents: 'none', visibility: 'hidden' }, 3.35);

      // ——— Horizontal scroll showcase enter ———
      tl.set(showcaseRef.current, { pointerEvents: 'auto' }, 3.25);
      tl.fromTo(
        showcaseRef.current,
        { opacity: 0, y: 56, filter: 'blur(14px)', scale: 0.94 },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
        },
        3.25
      );
      tl.to(
        carTitleRef.current,
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.35, ease: 'power3.out' },
        3.4
      );
      tl.to(carSubRef.current, { opacity: 0.7, y: 0, duration: 0.28 }, 3.5);

      // ——— Carousel: focused card holds centre, next card's edge peeks in from the right ———
      const stage = carStageRef.current;
      const cards = stage ? Array.from(stage.children) : [];
      const vw = () => window.innerWidth;
      const cardW = () => cards[0]?.getBoundingClientRect().width || 400;
      const peekX = () => {
        const p = Math.min(90, Math.max(56, vw() * 0.05));
        return vw() / 2 - p - cardW() / 2;
      };
      gsap.set(cards, {
        x: vw,
        xPercent: -50,
        yPercent: -50,
        scale: 0.85,
        opacity: 0,
        pointerEvents: 'none',
      });

      const MOVE = 0.5;
      const HOLD = 0.6;
      let t = 3.55;
      cards.forEach((el, i) => {
        // if this card hasn't been revealed yet, keep it hidden off the right
        if (i > 0) {
          gsap.set(el, { x: vw, scale: 0.8, opacity: 0 });
        }
        // slide to centre and become the focused card
        tl.to(el, { x: 0, scale: 1, opacity: 1, duration: MOVE, ease: 'power4.out', pointerEvents: 'auto' }, t);
        t += MOVE;
        // during the hold, reveal the next card's edge peeking off the right
        if (cards[i + 1]) {
          tl.set(cards[i + 1], { x: peekX(), scale: 0.8, opacity: 0.4 }, t);
        }
        tl.to({}, { duration: HOLD }, t);
        t += HOLD;
        // exit left
        tl.to(el, { x: () => -vw(), scale: 0.85, opacity: 0, duration: MOVE, ease: 'power2.in', pointerEvents: 'none' }, t);
        t += MOVE;
      });
      tl.to({}, { duration: 0.5 }, t);
    }, section);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, []);

  const LabsGlyph = ({ size = 88 }: { size?: number }) => (
    <div
      className="relative flex items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500/30 via-indigo-500/15 to-transparent shadow-[0_0_32px_rgba(124,58,237,0.25)]"
      style={{ width: size, height: size }}
    >
      <GraduationCap size={Math.round(size * 0.5)} className="text-white" strokeWidth={1.5} />
    </div>
  );

  return (
    <section ref={sectionRef} id="about" className="relative w-full bg-black select-none">
      <div
        ref={pinRef}
        className="relative w-full h-[100vh] overflow-hidden flex flex-col items-center justify-center"
      >
        <div
          ref={glowRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-[640px] max-h-[640px] rounded-full bg-radial from-blue-500/15 via-indigo-900/5 to-transparent blur-3xl pointer-events-none"
        />

        {/* ——— MORPH: shared center stage ——— */}
        <div
          ref={morphBlockRef}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 will-change-[transform,filter,opacity]"
        >
          <div
            ref={stageRef}
            className="relative flex flex-col items-center justify-center w-full max-w-5xl min-h-[160px] md:min-h-[200px] will-change-transform"
          >
            {/* Web2 — absolute center */}
            <div
              ref={web2Ref}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <h2 className="font-pixel text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-[0.18em] uppercase text-center text-white/85 drop-shadow-[0_0_40px_rgba(255,255,255,0.22)]">
                Web2
              </h2>
            </div>

            {/* Web3 on — same vertical center; horizontal opens when "on" expands */}
            <div
              ref={web3LineRef}
              className="relative flex flex-col items-center gap-6 md:gap-8"
            >
              <div className="flex items-baseline justify-center">
                <span className="font-pixel text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-[0.1em] uppercase text-white inline-flex items-baseline">
                  Web
                  <span className="relative inline-grid place-items-center w-[0.72em]">
                    <span ref={digit2Ref} className="col-start-1 row-start-1">
                      2
                    </span>
                    <span ref={digit3Ref} className="col-start-1 row-start-1">
                      3
                    </span>
                  </span>
                </span>
                <span
                  ref={onSlotRef}
                  className="inline-flex overflow-hidden items-baseline"
                  style={{ width: 0 }}
                >
                  <span
                    ref={onRef}
                    className="font-pixel text-2xl sm:text-3xl md:text-5xl tracking-[0.22em] uppercase text-white/55 whitespace-nowrap pl-1"
                  >
                    on
                  </span>
                </span>
              </div>

              <div ref={logoRef} className="flex items-center gap-3 md:gap-4">
                {!brandError && (
                  <img
                    src="/logo-transparent.png"
                    width={48}
                    height={48}
                    decoding="async"
                    loading="lazy"
                    alt=""
                    className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 object-contain"
                    onError={() => setBrandError(true)}
                  />
                )}
                <img
                  src="/wordmark-transparent.png"
                  decoding="async"
                  loading="lazy"
                  alt="ZEXVRO"
                  className="h-6 sm:h-7 md:h-10 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          <p
            ref={subMorphRef}
            className="mt-10 text-center text-sm sm:text-base text-white/70 font-medium tracking-wide max-w-md leading-relaxed"
          >
            Private, verifiable, agent-ready infrastructure — without raw chain complexity.
          </p>
        </div>

        {/* ——— BUBBLES ——— */}
        <div
          ref={bubblesBlockRef}
          className="absolute inset-0 z-[15] flex flex-col items-center justify-center px-6"
        >
          <div className="text-center mb-6 md:mb-8 max-w-2xl px-4 space-y-3">
            <h2 ref={titleRef} className="leading-tight">
              <span className="font-pixel text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-wide">
                There is no{' '}
              </span>
              <span className="font-sans text-3xl sm:text-4xl md:text-5xl font-black italic text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.2)]">
                100%
              </span>
              <span className="font-pixel text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                .
              </span>
            </h2>
            <p
              ref={magicLineRef}
              className="font-sans text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight"
            >
              Demand shapes the stack.
              <span className="text-blue-300"> We ship the rails.</span>
            </p>
            <p
              ref={magicSubRef}
              className="text-sm font-semibold text-white/60 max-w-md mx-auto leading-relaxed"
            >
              Zer0 · Morph · REQWID · NFTo · DEDSEC
            </p>
          </div>

          <div
            ref={bubblesWrapRef}
            className="relative w-full max-w-3xl h-[280px] sm:h-[320px] md:h-[360px] overflow-visible"
          >
            {activeServices.map((s, i) => (
                <div
                  key={s.id}
                  ref={(el) => {
                    bubbleRefs.current[i] = el;
                  }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
                >
                  <div className="relative flex h-[4.25rem] w-[4.25rem] sm:h-20 sm:w-20 md:h-[5.25rem] md:w-[5.25rem] items-center justify-center rounded-full border border-white/20 bg-white/[0.07] backdrop-blur-md shadow-[0_0_28px_rgba(38,78,255,0.14)]">
                    <span
                      ref={(el) => {
                        qMarkRefs.current[i] = el;
                      }}
                      className="absolute font-pixel text-2xl text-white/70"
                    >
                      ?
                    </span>
                    <div
                      ref={(el) => {
                        iconRefs.current[i] = el;
                      }}
                      className="absolute flex flex-col items-center justify-center gap-0.5"
                    >
                      <ServiceLogo
                        id={s.id}
                        name={s.name}
                        size={36}
                        state={s.id === 'morph' ? 'morph' : 'idle'}
                        className="!rounded-full bg-transparent"
                      />
                      <span className="font-pixel text-[7px] tracking-wider text-white/55 uppercase hidden sm:block">
                        {s.name}
                      </span>
                    </div>
                  </div>
                </div>
            ))}
          </div>

          <p
            ref={typeLineRef}
            className="mt-10 font-sans text-base sm:text-lg md:text-xl font-black tracking-tight text-white text-center min-h-[1.5em] drop-shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          >
            {typed}
            <span className="inline-block w-[2px] h-[1em] ml-1 align-middle bg-white animate-pulse" />
          </p>
        </div>

        {/* ——— HORIZONTAL SCROLL SHOWCASE ——— */}
        <div
          ref={showcaseRef}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black overflow-hidden px-0"
        >
          <Suspense fallback={null}>
            <SafeShader
              fov={45}
              pixelDensity={0.85}
              veilClassName="absolute inset-0 bg-black/25 pointer-events-none"
              gradient={{
                animate: 'on',
                brightness: 1.15,
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
          </Suspense>
          <div className="text-center mb-8 md:mb-10 max-w-xl px-6">
            <h3
              ref={carTitleRef}
              className="font-sans text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight"
            >
              Five services.
              <span className="block sm:inline"> One way in.</span>
            </h3>
            <p
              ref={carSubRef}
              className="mt-3 text-sm font-semibold text-white/60 leading-relaxed max-w-md mx-auto"
            >
              Keep scrolling — each service enters, holds in the centre, then drifts off left.
            </p>
          </div>

          <div
            ref={carStageRef}
            className="relative w-full flex-1"
            style={{ perspective: '1600px' }}
          >
            {carouselServices.map((s, i) => {
              const isLabs = s.id === 'labs';
              return (
                <div
                  key={s.id}
                  className="absolute w-[min(86vw,430px)]"
                  style={{ left: '50%', top: '50%' }}
                >
                  <div className="rounded-[24px] overflow-hidden backdrop-blur-[40px] backdrop-saturate-150">
                <Glass active radius={24} className="overflow-hidden shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
                    <div className="relative aspect-[16/10] flex items-center justify-center">
                      <div className="relative z-10 flex flex-col items-center gap-3">
                        {isLabs ? (
                          <Glass active radius={18} className="p-4">
                            <LabsGlyph size={64} />
                          </Glass>
                        ) : (
                          <Glass active radius={18} className="p-4">
                            <ServiceLogo
                              id={s.id}
                              name={s.name}
                              size={64}
                              state="idle"
                              priority
                            />
                          </Glass>
                        )}
                        <p className="font-pixel text-[9px] tracking-[0.3em] uppercase text-white/60">
                          {s.name}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 md:p-7 text-left">
                      <p className="font-pixel text-[9px] tracking-[0.28em] uppercase text-blue-200/80 mb-2">
                        {isLabs ? '06 · ZEXVRO Labs' : `0${i + 1} · ${s.name}`}
                      </p>
                      <h3 className="font-sans text-xl md:text-2xl font-black text-white tracking-tight leading-tight mb-2">
                        {s.headline}
                      </h3>
                      <p className="text-sm md:text-base font-semibold text-white/95 leading-snug mb-2">
                        {s.shortDesc}
                      </p>
                      <p className="text-sm font-medium text-white/60 leading-relaxed">
                        {s.fullDesc}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {s.techDetails.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-full border border-white/12 bg-white/[0.05] text-[10px] font-medium text-white/60"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {s.href && (
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white text-black px-5 py-2.5 text-xs font-bold hover:bg-white/90 transition-colors"
                        >
                          Open Web3 Labs
                          <ArrowRight size={14} />
                        </a>
                      )}
                    </div>
                  </Glass>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
