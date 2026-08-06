import { LabCredential } from '../types';

// Renders a skill badge to a crisp square PNG at native resolution so the
// learner can download/share the actual badge image. The badge's background
// image IS the badge — exported as-is, no extra glyphs.

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
