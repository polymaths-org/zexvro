import QRCode from 'qrcode';
import { Certificate } from '../types';

// Renders the certificate design to a high-res PNG (clean image, no borders /
// outlines / letterboxing) so "download" gives the actual certificate file.
// The layout math mirrors CertificatePreview: elements are re-projected from
// the editor's 16:9 canvas into the template image's own coordinate space.

const EDITOR_CANVAS_W = 1600;
const EDITOR_CANVAS_H = 900;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image load failed'));
    im.src = src;
  });
}

function drawText(
  ctx: CanvasRenderingContext2D,
  el: Certificate['design'] extends { elements: (infer E)[] } ? E : never,
  text: string,
  x: number,
  y: number,
  widthPct: number,
  canvasW: number,
  canvasH: number,
) {
  const fontSize = (Number(el.size) || 14) * (canvasH / 900);
  ctx.font = `${el.bold ? '800 ' : ''}${el.italic ? 'italic ' : ''}${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = el.color || '#fff';

  const maxWidth = (widthPct / 100) * canvasW;
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;
  const rendered: string[] = [];
  for (const line of lines) {
    if (ctx.measureText(line).width <= maxWidth) {
      rendered.push(line);
    } else {
      let cur = '';
      for (const ch of line) {
        if (ctx.measureText(cur + ch).width > maxWidth) {
          rendered.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      if (cur) rendered.push(cur);
    }
  }
  const totalH = rendered.length * lineHeight;
  const startY = y - totalH / 2 + lineHeight / 2;
  rendered.forEach((ln, i) => {
    ctx.fillText(ln, x, startY + i * lineHeight);
  });
}

export async function exportCertificatePng(cert: Certificate): Promise<string> {
  const design = cert.design;
  const hasBg = !!(design && design.backgroundImage);
  const elList = design && design.elements && design.elements.length > 0 ? design.elements : [];
  const bg = hasBg ? await loadImage(design!.backgroundImage!) : null;

  const canvasW = bg ? bg.naturalWidth : 2000;
  const canvasH = bg ? bg.naturalHeight : canvasW * (9 / 16);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');

  // Background
  if (bg) {
    ctx.drawImage(bg, 0, 0, canvasW, canvasH);
  } else {
    ctx.fillStyle = design?.background || '#0b0b0d';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const fillVars = (text: string) =>
    (text || '')
      .replaceAll('{username}', cert.studentName)
      .replaceAll('{student}', cert.studentName)
      .replaceAll('{labname}', cert.labTitle)
      .replaceAll('{date}', cert.issuedAt || new Date().toLocaleDateString());

  const zoom = design?.bgZoom && design.bgZoom !== 1 ? design.bgZoom : 1;
  const hasImage = !!bg;
  const mapPos = (x: number, y: number) => {
    if (!hasImage || !bg) return { x: (x / 100) * canvasW, y: (y / 100) * canvasH };
    const scale = Math.min(EDITOR_CANVAS_W / bg.naturalWidth, EDITOR_CANVAS_H / bg.naturalHeight) * zoom;
    const dispW = bg.naturalWidth * scale;
    const dispH = bg.naturalHeight * scale;
    const offX = (EDITOR_CANVAS_W - dispW) / 2;
    const offY = (EDITOR_CANVAS_H - dispH) / 2;
    const px = (x / 100) * EDITOR_CANVAS_W;
    const py = (y / 100) * EDITOR_CANVAS_H;
    return { x: ((px - offX) / dispW) * canvasW, y: ((py - offY) / dispH) * canvasH };
  };

  for (const el of elList as any[]) {
    const { x, y } = mapPos(Number(el.x) || 0, Number(el.y) || 0);
    const size = (Number(el.size) || 16) * (canvasH / 900);

    if (el.kind === 'text') {
      drawText(ctx, el, fillVars(el.text || ''), x, y, Number(el.width) || 70, canvasW, canvasH);
    } else if (el.kind === 'line') {
      ctx.strokeStyle = el.color || '#52525b';
      ctx.lineWidth = Math.max(1, size);
      const w = ((Number(el.width) || 24) / 100) * canvasW;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x + w / 2, y);
      ctx.stroke();
    } else if (el.kind === 'logo' || el.kind === 'image') {
      const src = el.kind === 'logo' ? design?.logoUrl : el.imageUrl;
      if (src) {
        try {
          const im = await loadImage(src);
          ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
        } catch {
          /* skip */
        }
      }
    } else if (el.kind === 'qr') {
      try {
        const url = await QRCode.toDataURL(`${window.location.origin}/verify/${cert.certificateNumber}`, {
          width: 512,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        const im = await loadImage(url);
        ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
      } catch {
        /* skip */
      }
    } else if (el.kind === 'icon') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
