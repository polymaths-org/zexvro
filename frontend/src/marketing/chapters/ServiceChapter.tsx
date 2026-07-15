import { Suspense, lazy, useEffect, useRef, type ComponentType, type CSSProperties, type SVGProps } from 'react';
import SplitType from 'split-type';
import { animate, stagger } from 'animejs';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/smoothScroll';

type IllustrationImport = () => Promise<{ default: ComponentType<SVGProps<SVGSVGElement>> }>;

type ServiceChapterProps = {
  id: string;
  index: string;
  service: string;
  headline: string;
  body: string;
  status: string;
  statusDetail: string;
  accent: string;
  animation: 'privacy' | 'morph' | 'a2a' | 'auth' | 'nft' | 'depin';
  illustration: IllustrationImport;
};

function drawSvgPaths(svg: SVGSVGElement) {
  const paths = Array.from(svg.querySelectorAll('path'))
    .filter((path): path is SVGPathElement => typeof path.getTotalLength === 'function');

  paths.forEach(path => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
  });

  animate(paths, {
    strokeDashoffset: 0,
    duration: 900,
    delay: stagger(38),
    ease: 'out(3)',
  });
}

function runTriggeredMicroAnimation(root: HTMLElement, animation: ServiceChapterProps['animation']) {
  const svg = root.querySelector('svg');
  if (!svg) return;

  if (animation === 'a2a') {
    const pulses = svg.querySelectorAll('circle');
    animate(pulses, {
      scale: [0.72, 1.22, 0.72],
      opacity: [0.42, 1, 0.42],
      duration: 1250,
      delay: stagger(120),
      loop: true,
      ease: 'inOut(2)',
    });
    return;
  }

  if (animation === 'depin') {
    animate(svg.querySelectorAll('[class*="depin-node"], [class*="depin-line"]'), {
      opacity: [0.18, 0.76],
      duration: 1200,
      delay: stagger(80),
      ease: 'out(3)',
    });
    return;
  }

  drawSvgPaths(svg);
}

export default function ServiceChapter({
  id,
  index,
  service,
  headline,
  body,
  status,
  statusDetail,
  accent,
  animation,
  illustration,
}: ServiceChapterProps) {
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const Illustration = lazy(illustration);

  useEffect(() => {
    const root = rootRef.current;
    const title = titleRef.current;
    const sticky = stickyRef.current;
    if (!root || !title || !sticky) return undefined;

    if (prefersReducedMotion()) {
      return undefined;
    }

    let split: SplitType | null = null;
    let microPlayed = false;

    const ctx = gsap.context(() => {
      split = new SplitType(title, { types: 'words' });

      gsap.fromTo(
        split.words || [],
        { yPercent: 115, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.045,
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: 'top 62%',
          },
        },
      );

      const svg = root.querySelector('svg');
      if (svg) {
        const elements = svg.querySelectorAll('rect, path, circle, text');
        gsap.fromTo(
          elements,
          { opacity: 0.2, y: 18 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.006,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top 70%',
              end: 'bottom 38%',
              scrub: true,
              onEnter: () => {
                if (microPlayed) return;
                microPlayed = true;
                runTriggeredMicroAnimation(root, animation);
              },
            },
          },
        );

        if (animation === 'auth') {
          gsap.fromTo(
            svg.querySelectorAll('[class*="auth-dot"]'),
            {
              x: () => gsap.utils.random(-120, 120),
              y: () => gsap.utils.random(-95, 95),
              opacity: 0.46,
            },
            {
              x: 0,
              y: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: root,
                start: 'top 68%',
                end: 'bottom 35%',
                scrub: true,
              },
            },
          );
        }

        if (animation === 'nft') {
          const groups = svg.querySelectorAll('g');
          gsap.to(groups[0], {
            opacity: 0.18,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top 65%',
              end: 'bottom 38%',
              scrub: true,
            },
          });
          gsap.to(groups[1], {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top 65%',
              end: 'bottom 38%',
              scrub: true,
            },
          });
        }
      }

      gsap.matchMedia().add('(min-width: 981px)', () => {
          const pin = ScrollTrigger.create({
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            pin: sticky,
            pinSpacing: false,
            anticipatePin: 1,
          });
          return () => pin.kill();
      });
    }, root);

    return () => {
      split?.revert();
      ctx.revert();
    };
  }, [animation]);

  return (
    <section
      ref={rootRef}
      className={`marketing-chapter chapter-${id}`}
      data-chapter={index}
      id={id}
      style={{ '--chapter-accent': accent } as CSSProperties}
      aria-labelledby={`${id}-title`}
    >
      <div ref={stickyRef} className="chapter-sticky">
        <div className="chapter-shell">
          <div className="chapter-copy">
            <div className="chapter-index">{index} / {service}</div>
            <h2 ref={titleRef} className="chapter-title" id={`${id}-title`}>
              {headline}
            </h2>
            <p className="chapter-body">{body}</p>
            <div className="metadata-strip">
              <span className="chapter-status">{status}</span>
              <span>{statusDetail}</span>
            </div>
          </div>
          <div className="illustration-frame" aria-hidden="true">
            <Suspense fallback={<div className="illustration-fallback" />}>
              <Illustration />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
