import { useEffect, useRef, useState } from 'react';
import {
  ensureBrandAssetsCached,
  getPlatformBootupSrc,
  hasSeenPlatformBootup,
  markPlatformBootupSeen,
} from '../lib/brandAssets';

type PlatformBootupProps = {
  /** When true, attempt to show if not yet seen this browser. */
  active: boolean;
};

/**
 * One-time fullscreen platform boot after login → dashboard.
 * Stored in localStorage so it does not replay every route change.
 */
export default function PlatformBootup({ active }: PlatformBootupProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);
  const [open, setOpen] = useState(() => active && !hasSeenPlatformBootup());
  const [src, setSrc] = useState(() => getPlatformBootupSrc());

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markPlatformBootupSeen();
    setOpen(false);
  };

  useEffect(() => {
    if (!active || hasSeenPlatformBootup()) {
      setOpen(false);
      return;
    }
    setOpen(true);
    let alive = true;
    void ensureBrandAssetsCached().then(() => {
      if (alive) setSrc(getPlatformBootupSrc());
    });
    return () => {
      alive = false;
    };
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1.05;
    video.currentTime = 0;
    const play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => {
        // Autoplay blocked — user can skip.
      });
    }
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black"
      role="dialog"
      aria-label="Platform boot"
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
