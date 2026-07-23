import { useEffect, useRef, useState } from 'react';
import {
  ensureBrandAssetsCached,
  getBrandIntroSrc,
} from '../lib/brandAssets';

type BrandIntroProps = {
  onFinished: () => void;
};

/**
 * Fullscreen brand intro — only for marketing `/` first visit.
 * Parent decides when to mount (skipped for ?code= CLI links and return visits).
 * Skip with click, Escape, Enter, or Space.
 */
export default function BrandIntro({ onFinished }: BrandIntroProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState(() => getBrandIntroSrc());
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  };

  useEffect(() => {
    let active = true;
    void ensureBrandAssetsCached().then(() => {
      if (active) setSrc(getBrandIntroSrc());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.load();
    const play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => {
        // Autoplay blocked — user can skip.
      });
    }
  }, [src]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
      role="dialog"
      aria-label="ZEXVRO intro"
      onClick={finish}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain bg-black"
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button
        type="button"
        className="absolute bottom-6 right-6 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white/80 backdrop-blur hover:bg-black/70"
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
      >
        Skip
      </button>
    </div>
  );
}
