import { useEffect } from 'react';
import type Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScroll } from './ScrollProvider';

// Smooth-scrolls to an in-page target and keeps it in place while the page settles. Lazy images and
// fonts can change the page height after the scroll starts, so the target is re-aimed. If the page
// stops moving short of the target (a pinned section can hold a smooth scroll), the rest is jumped.
// Any wheel, touch or key input hands control back to the reader.
function scrollToTarget(lenis: Lenis, target: HTMLElement): () => void {
  let checks = 0;
  let lastY = -1;
  let timer = 0;
  const cancel = () => {
    window.clearTimeout(timer);
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('keydown', cancel);
  };
  const reaim = () => {
    if (Math.abs(target.getBoundingClientRect().top) <= 2 || ++checks > 12) return cancel();
    if (window.scrollY === lastY) {
      ScrollTrigger.refresh();
      lenis.scrollTo(target, { offset: 0, immediate: true });
      if (Math.abs(target.getBoundingClientRect().top) > 2) {
        window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top, behavior: 'auto' });
      }
    } else {
      lenis.scrollTo(target, { offset: 0, duration: 0.4 });
    }
    lastY = window.scrollY;
    timer = window.setTimeout(reaim, 700);
  };
  lenis.scrollTo(target, { offset: 0, duration: 1.2 });
  timer = window.setTimeout(reaim, 1300);
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', cancel);
  return cancel;
}

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

    let stop = () => {};
    let inner = 0;
    // Two frames let the preloader unmount and GSAP pins settle before the target is measured.
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        stop = scrollToTarget(lenis, target);
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      stop();
    };
  }, [ready, lenis]);

  // In-page links (navbar, hero, footer) scroll through Lenis. The browser's own hash jump races
  // Lenis's wheel and easing animation, and it measures the target before late layout settles.
  useEffect(() => {
    if (!lenis) return;

    let stop = () => {};
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = (event.target as Element | null)?.closest?.('a[href^="#"]')?.getAttribute('href') ?? '';
      let id: string;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      stop();
      // Pin positions depend on the layout, so align them with the page before the target is measured.
      ScrollTrigger.refresh();
      stop = scrollToTarget(lenis, target);
      window.history.pushState(null, '', href);
    };

    document.addEventListener('click', onClick);
    return () => {
      stop();
      document.removeEventListener('click', onClick);
    };
  }, [lenis]);

  return null;
}
