import React, { useEffect, useRef } from 'react';

interface MatrixDotsProps {
  /** origin of the expand wave, 0..1 (default center) */
  origin?: { x: number; y: number };
  /** dot spacing in px */
  gap?: number;
  /** accent color for the wave */
  accent?: string;
  className?: string;
}

/**
 * MatrixDots — dynamic dot-matrix expand animation.
 * A grid of dots ripples outward from `origin`: dots light up as the
 * wavefront passes, then settle into a faint static field.
 * Canvas-based, cheap (~60fps, no libs), unmount to stop.
 */
export const MatrixDots: React.FC<MatrixDotsProps> = ({
  origin = { x: 0.5, y: 0.32 },
  gap = 22,
  accent = '#3B82F6',
  className = '',
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const t0 = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // deterministic pseudo-random per dot so flicker is stable, not noisy
    const hash = (ix: number, iy: number) => {
      let n = ix * 374761393 + iy * 668265263;
      n = (n ^ (n >> 13)) * 1274126177;
      return ((n ^ (n >> 16)) >>> 0) / 4294967295;
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000; // seconds
      ctx.clearRect(0, 0, w, h);

      const ox = origin.x * w;
      const oy = origin.y * h;
      const maxDist = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
      // wave expands fast then lingers; ring thickness ~140px
      const front = Math.min(1, t / 1.1) * (maxDist + 180);
      const fade = t > 1.6 ? Math.max(0, 1 - (t - 1.6) / 0.9) : 1;

      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const ix = Math.round(x / gap);
          const iy = Math.round(y / gap);
          const d = Math.hypot(x - ox, y - oy);
          const band = Math.exp(-Math.pow((d - front) / 130, 2)); // 0..1 wavefront
          const settled = d < front - 130 ? 0.5 : 0; // area already swept
          const flick = 0.55 + 0.45 * Math.sin(t * 2.2 + hash(ix, iy) * Math.PI * 2);
          const glow = Math.min(1, band * 1.15 + settled * 0.55);
          if (glow < 0.03) {
            // faint base grid
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }
          const r = 1.1 + glow * 1.9 * flick;
          const a = (0.08 + glow * 0.75) * fade;
          // accent core with white hot center on the wavefront
          const hot = band > 0.75;
          ctx.fillStyle = hot
            ? `rgba(255,255,255,${Math.min(1, a + 0.25)})`
            : hexA(accent, a);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [origin.x, origin.y, gap, accent]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
