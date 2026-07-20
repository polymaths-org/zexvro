import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useScroll } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SafeShader } from './SafeShader';

const ease = [0.16, 1, 0.3, 1] as const;

export const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [statueError, setStatueError] = useState(false);
  const [cubesError, setCubesError] = useState(false);
  const [inView, setInView] = useState(true);
  const [playKey, setPlayKey] = useState(0);
  const [shaderFromRight, setShaderFromRight] = useState(true);
  const wasAway = useRef(false);

  // Re-run intro when hero re-enters — shader always from right
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          if (wasAway.current) {
            // Snap off-screen right, then slide in
            setShaderFromRight(false);
            requestAnimationFrame(() => {
              setShaderFromRight(true);
              setPlayKey((k) => k + 1);
            });
            wasAway.current = false;
          } else {
            setShaderFromRight(true);
          }
          setInView(true);
        } else if (entry.intersectionRatio < 0.12) {
          setInView(false);
          setShaderFromRight(false);
          wasAway.current = true;
        }
      },
      { threshold: [0, 0.12, 0.35, 0.6] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);

  const mouseConfig = { damping: 40, stiffness: 180, mass: 1.2 };
  const mouseX = useSpring(rawMouseX, mouseConfig);
  const mouseY = useSpring(rawMouseY, mouseConfig);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = containerRef.current.getBoundingClientRect();
    rawMouseX.set((clientX - left) / width - 0.5);
    rawMouseY.set((clientY - top) / height - 0.5);
  };

  const handleMouseLeave = () => {
    rawMouseX.set(0);
    rawMouseY.set(0);
  };

  const statueParallaxX = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);
  const statueParallaxY = useTransform(mouseY, [-0.5, 0.5], [-8, 8]);
  const statueScrollY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const statueY = useTransform([statueParallaxY, statueScrollY], ([a, b]) => (a as number) + (b as number));

  const cubesParallaxX = useTransform(mouseX, [-0.5, 0.5], [-32, 32]);
  const cubesParallaxY = useTransform(mouseY, [-0.5, 0.5], [-26, 26]);
  const cubesScrollY = useTransform(scrollYProgress, [0, 1], [0, -55]);
  const cubesY = useTransform([cubesParallaxY, cubesScrollY], ([a, b]) => (a as number) + (b as number));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      id="home"
      className="relative w-full h-[100vh] bg-black overflow-hidden flex items-center"
    >
      {/* Shader — always enters from the right */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0 h-full w-full"
          initial={{ x: '100%' }}
          animate={{
            x: inView && shaderFromRight ? '0%' : '100%',
          }}
          transition={{
            duration: inView && shaderFromRight ? 1.8 : 0.01,
            ease,
          }}
        >
          <SafeShader
            fov={30}
            pixelDensity={0.9}
            veilClassName="absolute inset-0 bg-black/15 pointer-events-none"
            gradient={{
              animate: 'on',
              brightness: 1.2,
              cAzimuthAngle: 180,
              cDistance: 8.5,
              cPolarAngle: 115,
              cameraZoom: 5.21,
              color1: '#264eff',
              color2: '#000000',
              color3: '#000000',
              envPreset: 'city',
              grain: 'on',
              lightType: '3d',
              positionX: -1.2,
              positionY: 0.1,
              positionZ: 2.1,
              range: 'disabled',
              rangeEnd: 40,
              rangeStart: 0,
              reflection: 0.1,
              rotationX: 0,
              rotationY: 0,
              rotationZ: 235,
              shader: 'defaults',
              type: 'sphere',
              uAmplitude: 0,
              uDensity: 1.1,
              uFrequency: 5.5,
              uSpeed: 0.2,
              uStrength: 2.4,
              uTime: 0.2,
              wireframe: false,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 pointer-events-none" />
        </motion.div>
      </div>

      {/* Cubes — top layer so nothing overlaps */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-30">
        {!cubesError && (
          <motion.div
            key={`cubes-${playKey}`}
            initial={{ opacity: 0, x: '48vw', y: '52vh', scale: 0.72 }}
            animate={
              inView
                ? { opacity: 1, x: 0, y: 0, scale: 1 }
                : { opacity: 0, x: '48vw', y: '52vh', scale: 0.72 }
            }
            transition={{ duration: 2.05, ease, delay: inView ? 0.05 : 0 }}
            className="absolute left-[2vw] md:left-[5vw] top-[6vh] md:top-[7vh] w-[min(32vw,280px)] md:w-[min(28vw,320px)]"
          >
            <motion.div
              style={{
                x: cubesParallaxX,
                y: cubesY,
                rotateX: 10,
                scaleY: 0.94,
                transformPerspective: 1000,
              }}
            >
              <img
                src="/cubes.png"
                alt="Prism glass cubes"
                className="w-full max-h-[48vh] md:max-h-[54vh] h-auto object-contain object-left-top"
                onError={() => setCubesError(true)}
              />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Text + buttons — under statue so arm/torso can overlap */}
      <div className="container mx-auto px-6 md:px-12 xl:px-24 h-full flex items-end pb-16 md:pb-24 xl:pb-32 relative z-10">
        <div className="w-full lg:w-[52%] flex flex-col text-left pointer-events-auto">
          <motion.div
            key={`copy-${playKey}`}
            initial={{ opacity: 0, x: -90 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -90 }}
            transition={{ duration: 1.45, ease, delay: inView ? 0.6 : 0 }}
            className="flex flex-col space-y-5 max-w-xl"
          >
            <p className="font-pixel text-[11px] sm:text-xs tracking-[0.32em] uppercase text-white/50 font-bold">
              Built for builders
            </p>

            <h1 className="font-pixel text-[1.75rem] sm:text-3xl md:text-4xl lg:text-[2.75rem] leading-[1.15] tracking-wide text-white font-bold">
              ZEXVRO makes shifting
              <br />
              your business to Web3
              <br />
              simple.
            </h1>

            <p className="text-sm sm:text-base text-white/55 font-medium leading-relaxed max-w-md">
              Catching up to Web3 is hard right now — wallets, gas, chains, and
              endless tooling. ZEXVRO strips that away so you can launch, pay,
              and scale without drowning in the stack.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 pt-1">
              <a
                href="https://console.zexvro.in"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative px-8 py-4 rounded-full overflow-hidden bg-white text-black font-bold text-sm transition-transform active:scale-95 duration-300 shadow-[0_0_35px_rgba(255,255,255,0.45)] hover:shadow-[0_0_50px_rgba(255,255,255,0.7)]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-100 via-white to-pink-100 group-hover:opacity-95 transition-opacity" />
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  <span>Explore Platform</span>
                  <ArrowRight size={16} className="transform group-hover:translate-x-1.5 transition-transform" />
                </span>
              </a>
              <a
                href="https://console.zexvro.in"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative px-8 py-4 rounded-full overflow-hidden border border-white/10 hover:border-white/20 bg-transparent text-white font-bold text-sm transition-transform active:scale-95 duration-300 text-center"
              >
                <span className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                <span className="relative z-10">Book Demo</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Statue — above text so it overlaps the copy */}
      <motion.div
        key={`statue-${playKey}`}
        initial={{ opacity: 0, x: 140, y: 200 }}
        animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 140, y: 200 }}
        transition={{ duration: 2.2, ease, delay: inView ? 0.2 : 0 }}
        className="absolute top-[2vh] sm:top-0 md:top-auto bottom-auto md:bottom-[-6vh] right-[-6vw] sm:right-0 z-20 w-[92vw] sm:w-[90vw] md:w-[82vw] lg:w-[74vw] h-[68vh] sm:h-[78vh] md:h-full origin-bottom-right pointer-events-none select-none"
      >
        <motion.div
          style={{ x: statueParallaxX, y: statueY }}
          className="w-full h-full flex items-center md:items-end justify-end origin-bottom-right"
        >
          {!statueError ? (
            <>
              <img
                src="/mobile_statue.png"
                alt="Classical Greek Statue"
                className="w-full h-full object-contain object-right-center md:hidden"
                referrerPolicy="no-referrer"
                onError={() => setStatueError(true)}
              />
              <img
                src="/Deploy NTFs with just some clicks.png"
                alt="Classical Greek Statue"
                className="hidden md:block w-full h-full object-contain object-right-bottom"
                referrerPolicy="no-referrer"
                onError={() => setStatueError(true)}
              />
            </>
          ) : null}
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 w-full h-44 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none z-[25]" />
    </div>
  );
};
