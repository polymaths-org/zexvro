/** Aave-style displacement map: R = bend X, G = bend Y (neutral 128). */

export type LensMapParams = {
  width: number;
  height: number;
  borderRadius: number;
  depth?: number;
  curvature?: number;
};

export function generateLensMap({
  width,
  height,
  borderRadius,
  depth = 12,
  curvature = 42,
}: LensMapParams): string {
  const w = Math.max(4, Math.round(width));
  const h = Math.max(4, Math.round(height));
  const r = Math.min(borderRadius, w / 2, h / 2);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const invDepth = depth / 100;
  const curve = curvature / 100;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Distance to rounded-rect interior edge (approx SDF)
      const qx = Math.abs(x - cx) - (cx - r);
      const qy = Math.abs(y - cy) - (cy - r);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      const inside = Math.max(0, -outside);
      const t = Math.min(1, inside / Math.max(r * 0.85, 1));
      const falloff = Math.pow(t, 0.65 + curve);

      // Bend toward edges (lens)
      const nx = (x - cx) / Math.max(cx, 1);
      const ny = (y - cy) / Math.max(cy, 1);
      const bendX = nx * falloff * invDepth * 40;
      const bendY = ny * falloff * invDepth * 40;

      data[i] = Math.max(0, Math.min(255, 128 + bendX));
      data[i + 1] = Math.max(0, Math.min(255, 128 + bendY));
      data[i + 2] = 128;
      data[i + 3] = outside > 0 ? 0 : 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
