import { useEffect, useRef, useState } from 'react';

const GIF = '/zexvro-laoding-ani-nobg.gif';
const INTRO = '/watermark-removed-Brand_intro_animation_logo_assembly_202607162304.mp4';

const ASSETS = [
  '/cubes.webp',
  '/deploy-nfts-clicks.webp',
  '/mobile_statue.webp',
  '/logo-transparent.png',
  '/wordmark-transparent.png',
  '/brand-mark.png',
  '/paris1.png',
  '/paris2.png',
  '/rushi1.png',
  '/rushi2.png',
  '/services/morph-64.png',
  '/services/morph.svg',
  '/services/zer0-64.png',
  '/services/reqwid-64.png',
  '/services/nfto-64.png',
  '/services/dedsec-64.png',
];

export function Preloader({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'intro'>('loading');
  const videoRef = useRef<HTMLVideoElement>(null);
  const settledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let imagesLoaded = 0;
    let fontsReady = false;
    const total = ASSETS.length;

    function proceed() {
      if (settledRef.current) return;
      settledRef.current = true;
      timerRef.current = setTimeout(() => setPhase('intro'), 1200);
    }

    function checkBoth() {
      if (imagesLoaded >= total && fontsReady) proceed();
    }

    ASSETS.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        imagesLoaded++;
        checkBoth();
      };
      img.src = src;
    });

    document.fonts.ready
      .then(() => {
        fontsReady = true;
        checkBoth();
      })
      .catch(() => {
        fontsReady = true;
        checkBoth();
      });

    const vid = document.createElement('video');
    vid.preload = 'auto';
    vid.src = INTRO;
    vid.load();

    const fallback = setTimeout(proceed, 6000);

    return () => {
      clearTimeout(fallback);
      clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'intro' && videoRef.current) {
      const v = videoRef.current;
      v.playbackRate = 2;
      v.play().catch(() => onDone());
    }
  }, [phase, onDone]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black overflow-hidden">
      {phase === 'loading' ? (
        <img
          src={GIF}
          alt=""
          className="w-32 h-32 md:w-40 md:h-40 object-contain pointer-events-none select-none"
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          onEnded={onDone}
          className="w-full h-full object-contain"
        >
          <source src={INTRO} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
