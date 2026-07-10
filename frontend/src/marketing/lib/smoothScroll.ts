import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let activeLenis: Lenis | null = null;
let tickerHandler: ((time: number) => void) | null = null;

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initSmoothScroll() {
  if (typeof window === 'undefined' || prefersReducedMotion()) {
    ScrollTrigger.config({ ignoreMobileResize: true });
    return () => ScrollTrigger.killAll();
  }

  if (activeLenis) {
    return () => undefined;
  }

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    anchors: { offset: -72 },
  });

  lenis.on('scroll', ScrollTrigger.update);

  tickerHandler = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(tickerHandler);
  gsap.ticker.lagSmoothing(0);
  activeLenis = lenis;

  return () => {
    if (tickerHandler) {
      gsap.ticker.remove(tickerHandler);
      tickerHandler = null;
    }
    lenis.destroy();
    activeLenis = null;
    ScrollTrigger.killAll();
  };
}

export function refreshScrollTriggers() {
  window.requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
}

export { gsap, ScrollTrigger };
