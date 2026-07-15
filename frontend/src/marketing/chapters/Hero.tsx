import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  Blocks,
  ScanSearch,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { gsap, prefersReducedMotion } from '../lib/smoothScroll';

type TransformMode = 'source' | 'inspect' | 'transform';

type TransformStage = {
  id: TransformMode;
  label: string;
  eyebrow: string;
  title: string;
  detail: string;
  icon: LucideIcon;
};

const transformStages: TransformStage[] = [
  {
    id: 'source',
    label: 'Source',
    eyebrow: '01 / Existing system',
    title: 'Map what already works.',
    detail: 'Start from the repository, deployment shape, and constraints your team already owns.',
    icon: Server,
  },
  {
    id: 'inspect',
    label: 'Inspect',
    eyebrow: '02 / Visible path',
    title: 'Make the change legible.',
    detail: 'Turn infrastructure decisions into a reviewable plan before any authority is granted.',
    icon: ScanSearch,
  },
  {
    id: 'transform',
    label: 'Transform',
    eyebrow: '03 / Verifiable state',
    title: 'Move with proof, not hype.',
    detail: 'Adopt private, agent-ready services in controlled steps with human approval kept in view.',
    icon: Blocks,
  },
];

export default function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState<TransformMode>('inspect');
  const activeStage = transformStages.find(stage => stage.id === mode) ?? transformStages[1];

  useEffect(() => {
    const root = rootRef.current;
    const title = titleRef.current;
    if (!root || !title || prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      const titleLines = title.querySelectorAll('.hero-product-name, .hero-title-line');
      gsap.set(titleLines, { yPercent: 38, opacity: 0 });
      gsap.timeline()
        .from('.hero-art-image', { scale: 1.08, duration: 1.45, ease: 'power3.out' })
        .from('.hero-edition-lockup', { opacity: 0, y: 18, duration: 0.62 }, 0.18)
        .to(titleLines, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.09 }, 0.3)
        .from('.hero-lede, .hero-actions', { opacity: 0, y: 22, duration: 0.68, stagger: 0.08 }, 0.58)
        .from('.hero-transform-console', { opacity: 0, x: 24, duration: 0.72 }, 0.62)
        .from('.hero-scene-index', { opacity: 0, y: 14, duration: 0.58 }, 0.82);

      gsap.to('.hero-art-image', {
        yPercent: 8,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.hero-copy', {
        yPercent: 10,
        opacity: 0.46,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: '55% top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, root);

    return () => {
      ctx.revert();
    };
  }, []);

  const updateLens = (event: PointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--lens-x', `${event.clientX - rect.left}px`);
    root.style.setProperty('--lens-y', `${event.clientY - rect.top}px`);
  };

  return (
    <section
      ref={rootRef}
      className="marketing-hero"
      id="top"
      data-mode={mode}
      aria-labelledby="hero-title"
      onPointerMove={updateLens}
    >
      <div className="hero-art" aria-hidden="true">
        <img
          className="hero-art-image"
          src="/marketing/zexvro-renaissance-hero.webp"
          alt=""
          fetchPriority="high"
        />
        <div className="hero-art-verified" />
        <div className="hero-coordinate-grid" />
        <div className="hero-lens-ring">
          <span>VERIFY</span>
        </div>
        <div className="hero-art-shade" />
      </div>

      <div className="hero-stage">
        <div className="hero-copy">
          <div className="hero-edition-lockup">
            <img className="hero-mark" src="/brand/logo-transparent.png" alt="" />
            <span>Manifest 01 / The Infrastructure Renaissance</span>
          </div>
          <h1 ref={titleRef} className="hero-title" id="hero-title">
            <span className="hero-product-name">ZEXVRO</span>
            <span className="hero-title-line">Infrastructure, transformed.</span>
          </h1>
          <p className="hero-lede">
            A unified Web3 platform for teams moving toward private, verifiable,
            agent-ready infrastructure without inheriting raw chain complexity.
          </p>
          <div className="hero-actions">
            <motion.a
              className="marketing-button primary"
              href="#privacy"
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -1 }}
            >
              Explore the stack
              <ArrowDownRight size={16} aria-hidden="true" />
            </motion.a>
            <motion.a
              className="marketing-button hero-secondary-action"
              href="/dashboard"
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -1 }}
            >
              Open prototype
              <ArrowRight size={16} aria-hidden="true" />
            </motion.a>
          </div>
        </div>

        <aside className="hero-transform-console" aria-label="Transformation preview">
          <div className="transform-console-header">
            <span>Transformation field</span>
            <span>Interactive preview</span>
          </div>
          <div className="transform-mode-switch" aria-label="Transformation state">
            {transformStages.map(stage => {
              const Icon = stage.icon;
              return (
                <button
                  type="button"
                  key={stage.id}
                  className={mode === stage.id ? 'is-active' : undefined}
                  aria-pressed={mode === stage.id}
                  onClick={() => setMode(stage.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </div>
          <motion.div
            className="transform-stage-copy"
            key={activeStage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span>{activeStage.eyebrow}</span>
            <strong>{activeStage.title}</strong>
            <p>{activeStage.detail}</p>
          </motion.div>
          <div className="transform-stage-track" aria-hidden="true">
            {transformStages.map((stage, index) => (
              <span
                key={stage.id}
                className={transformStages.findIndex(item => item.id === mode) >= index ? 'is-complete' : undefined}
              />
            ))}
          </div>
        </aside>
      </div>

      <a className="hero-scene-index" href="#privacy">
        <span>Next chapter</span>
        <strong>01 / Private by design</strong>
        <ArrowDownRight size={17} aria-hidden="true" />
      </a>
    </section>
  );
}
