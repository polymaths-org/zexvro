import { ScrollTrigger, gsap } from './smoothScroll';

export function configureScrollTriggers() {
  ScrollTrigger.defaults({
    toggleActions: 'play none none reverse',
  });

  gsap.defaults({
    ease: 'power3.out',
  });
}
