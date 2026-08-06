import { LabCredential } from '../types';

// Renders a skill badge to a crisp square PNG at native resolution so the
// learner can download/share the actual badge image. Layout mirrors the badge
// art shown in the gallery (background + centered white award glyph).

const SIZE = 1024;

export type BadgeArt = {
  background?: string;
  backgroundImage?: string;
  bgSize?: 'cover' | 'contain';
  bgPosX?: number;
  bgPosY?: number;
  bgZoom?: number;
  color?: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image load failed'));
    im.src = src;
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  badge: BadgeArt,
) {
  if (img) {
    const zoom = badge.bgZoom && badge.bgZoom !== 1 ? badge.bgZoom : 1;
    const cover = badge.bgSize !== 'contain';
    const scale = cover
      ? Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight) * zoom
      : Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight) * zoom;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const px = (badge.bgPosX ?? 50) / 100;
    const py = (badge.bgPosY ?? 50) / 100;
    ctx.drawImage(img, (SIZE - w) * px, (SIZE - h) * py, w, h);
  } else {
    ctx.fillStyle = badge.background || badge.color || '#0b0b0d';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
}

function drawBadgeGlyph(ctx: CanvasRenderingContext2D, badge: BadgeArt) {
  const accent = badge.color || '#3b82f6';
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Soft accent ring behind the glyph
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = SIZE * 0.12;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // White ribbon award (lucide "award") centered
  ctx.fillStyle = '#ffffff';
  const s = SIZE / 96;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-48, -48);
  ctx.beginPath();
  ctx.arc(48, 34, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  const ribbon = new Path2D(
    'M61.9 50.5 L68 88 L48 76 L28 88 L34.1 50.5',
  );
  ctx.fill(ribbon);
  ctx.restore();
}

export async function exportBadgePng(badge: BadgeArt): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');

  let bg: HTMLImageElement | null = null;
  if (badge.backgroundImage) {
    try {
      bg = await loadImage(badge.backgroundImage);
    } catch {
      bg = null;
    }
  }

  drawBackground(ctx, bg, badge);
  drawBadgeGlyph(ctx, badge);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
