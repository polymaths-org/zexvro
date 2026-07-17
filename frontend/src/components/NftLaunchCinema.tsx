import { useEffect, useRef, useState } from 'react';
import {
  NFT_CINEMA,
  ensureBrandAssetsCached,
  getNftCinemaSrc,
  type NftCinemaStage,
} from '../lib/brandAssets';

type NftLaunchCinemaProps = {
  open: boolean;
  /** Create/deploy pipeline stage. */
  stage?: NftCinemaStage;
  label?: string;
  /** Called when a non-looping stage ends (e.g. final launch). */
  onEnded?: () => void;
};

/**
 * Fullscreen NFT cinema. Stage maps to brief / fuel / assemble / launch videos
 * with per-stage playback rates (speed up fuel, slow assemble, etc.).
 */
export default function NftLaunchCinema({
  open,
  stage = 'assemble',
  label,
  onEnded,
}: NftLaunchCinemaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageMeta = NFT_CINEMA[stage];
  const [src, setSrc] = useState(() => getNftCinemaSrc(stage));
  const displayLabel = label || stageMeta.label;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void ensureBrandAssetsCached().then(() => {
      if (active) setSrc(getNftCinemaSrc(stage));
    });
    return () => {
      active = false;
    };
  }, [open, stage]);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = stageMeta.rate;
    video.currentTime = 0;
    let fallbackTimer: number | undefined;
    const play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => {
        // Autoplay blocked / jsdom — finish non-loop stages so navigation still works.
        if (!stageMeta.loop && onEnded) {
          fallbackTimer = window.setTimeout(() => onEnded(), 400);
        }
      });
    }
    return () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [open, src, stage, stageMeta.rate, stageMeta.loop, onEnded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex flex-col items-center justify-center bg-black"
      role="dialog"
      aria-label={displayLabel}
      aria-busy="true"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain bg-black"
        src={src}
        autoPlay
        muted
        loop={stageMeta.loop}
        playsInline
        preload="auto"
        onEnded={() => {
          if (!stageMeta.loop) onEnded?.();
        }}
      />
      <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-sm font-medium tracking-wide text-white/80">
        {displayLabel}
      </p>
    </div>
  );
}
