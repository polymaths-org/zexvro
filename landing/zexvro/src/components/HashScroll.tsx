import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScroll } from './ScrollProvider';

// Lenis owns scrolling on this page, and the preloader holds it while the intro plays.
// The browser's own #hash jump runs before React has rendered the target, so a direct link
// such as /#waitlist stayed at the top. Scroll to the target once the preloader is done.
export function HashScroll({ ready }: { ready: boolean }) {
  const lenis = useScroll();

  useEffect(() => {
    if (!ready || !lenis) return;

    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    let inner = 0;
    // Two frames let the preloader unmount and GSAP pins settle before the target is measured.
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [ready, lenis]);

  return null;
}
