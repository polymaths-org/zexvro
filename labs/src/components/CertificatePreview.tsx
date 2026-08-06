import React, { useEffect, useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { Certificate } from '../types';
import { VerifyQR } from './VerifyQR';

interface CertificatePreviewProps {
  design?: Certificate['design'];
  studentName: string;
  labTitle: string;
  issuedAt: string;
  certNumber?: string;
}

const replaceVars = (text: string, studentName: string, labTitle: string, issuedAt: string) =>
  (text || '')
    .replaceAll('{username}', studentName)
    .replaceAll('{student}', studentName)
    .replaceAll('{labname}', labTitle)
    .replaceAll('{date}', issuedAt || new Date().toLocaleDateString());

const fallbackDesign: NonNullable<Certificate['design']> = {
  background: '#0b0b0d',
  borderColor: '#3b82f6',
  accent: '#3b82f6',
  logoUrl: '',
  qrUrl: '',
  elements: [
    { id: 'f_logo', kind: 'logo', x: 50, y: 16, size: 40, color: '#ffffff', align: 'center' },
    { id: 'f_title', kind: 'text', x: 50, y: 28, size: 15, color: '#3b82f6', text: 'ZEXVRO CERTIFIES', align: 'center', bold: true, width: 80 },
    { id: 'f_name', kind: 'text', x: 50, y: 46, size: 30, color: '#ffffff', text: '{username}', align: 'center', bold: true, width: 80 },
    { id: 'f_line', kind: 'text', x: 50, y: 60, size: 13, color: '#a1a1aa', text: 'has successfully completed', align: 'center', width: 80 },
    { id: 'f_lab', kind: 'text', x: 50, y: 71, size: 20, color: '#3b82f6', text: '{labname}', align: 'center', bold: true, width: 80 },
    { id: 'f_sign', kind: 'line', x: 50, y: 82, size: 1, color: '#52525b', align: 'center', width: 24 },
    { id: 'f_date', kind: 'text', x: 30, y: 90, size: 11, color: '#71717a', text: 'Issued {date}', align: 'center', width: 40 },
    { id: 'f_qr', kind: 'qr', x: 82, y: 90, size: 36, color: '#ffffff', align: 'center' },
  ],
};

// The credential editor places elements on a 16:9 canvas where the template
// image is letterboxed with `contain`. To render the certificate so the text
// sits EXACTLY on the template's fields (no drift, no letterbox bars), we match
// the container's aspect ratio to the image's native ratio and re-project each
// element from canvas space into image space.
const EDITOR_CANVAS_W = 1600;
const EDITOR_CANVAS_H = 900;

export const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  design,
  studentName,
  labTitle,
  issuedAt,
  certNumber,
}) => {
  const d = design && design.elements && design.elements.length > 0 ? design : fallbackDesign;
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!d.backgroundImage) {
      setImgSize(null);
      return;
    }
    const im = new Image();
    let alive = true;
    im.onload = () => alive && setImgSize({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = d.backgroundImage;
    return () => {
      alive = false;
    };
  }, [d.backgroundImage]);

  // Re-project an element from editor-canvas space (16:9 + contain + bgZoom)
  // into the image's own coordinate space so it lands on the template field.
  const mapPos = (x: number, y: number) => {
    if (!imgSize || !d.backgroundImage) return { x, y };
    const zoom = d.bgZoom && d.bgZoom !== 1 ? d.bgZoom : 1;
    const scale = Math.min(EDITOR_CANVAS_W / imgSize.w, EDITOR_CANVAS_H / imgSize.h) * zoom;
    const dispW = imgSize.w * scale;
    const dispH = imgSize.h * scale;
    const offX = (EDITOR_CANVAS_W - dispW) / 2;
    const offY = (EDITOR_CANVAS_H - dispH) / 2;
    const px = (x / 100) * EDITOR_CANVAS_W;
    const py = (y / 100) * EDITOR_CANVAS_H;
    return { x: ((px - offX) / dispW) * 100, y: ((py - offY) / dispH) * 100 };
  };

  const hasBgImage = !!d.backgroundImage;
  const containerAspect = hasBgImage && imgSize ? `${imgSize.w} / ${imgSize.h}` : '16 / 9';
  const bgStyle: React.CSSProperties = hasBgImage
    ? {
        backgroundImage: `url("${d.backgroundImage}")`,
        // Container aspect now matches the image, so cover/contain are identical
        // and the image fills the box edge-to-edge — no letterbox bars.
        backgroundSize: imgSize ? 'cover' : d.bgSize === 'contain' ? 'contain' : 'cover',
        backgroundPosition: `${d.bgPosX ?? 50}% ${d.bgPosY ?? 50}%`,
        backgroundRepeat: 'no-repeat',
      }
    : { background: d.background };

  return (
    <div
      className="relative w-full overflow-hidden select-none print:rounded-none print:border-0"
      style={{
        ...bgStyle,
        aspectRatio: containerAspect,
      }}
    >
      {(d.elements || []).map((el) => {
        const { x, y } = mapPos(Number(el.x) || 0, Number(el.y) || 0);
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: 'translate(-50%, -50%)',
          color: el.color,
          textAlign: el.align,
        };

        if (el.kind === 'icon') {
          return (
            <div key={el.id} style={{ ...style, width: el.size, height: el.size }} className="flex items-center justify-center text-white">
              <ShieldCheck className="w-full h-full" />
            </div>
          );
        }
        if (el.kind === 'logo') {
          return (
            <div key={el.id} style={{ ...style, width: el.size, height: el.size }}>
              {d.logoUrl ? (
                <img src={d.logoUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full rounded-lg bg-zinc-800/80 border border-dashed border-zinc-600 flex items-center justify-center">
                  <BadgeCheck className="w-1/2 h-1/2 text-zinc-500" />
                </div>
              )}
            </div>
          );
        }
        if (el.kind === 'image') {
          return el.imageUrl ? (
            <img key={el.id} src={el.imageUrl} alt="block" style={{ ...style, width: el.size, height: el.size }} className="object-contain" />
          ) : null;
        }
        if (el.kind === 'qr') {
          return (
            <div key={el.id} style={{ ...style, width: el.size, height: el.size }}>
              <VerifyQR
                value={`${window.location.origin}/verify/${certNumber || ''}`}
                size={Math.max(16, Number(el.size) || 36)}
                className="w-full h-full"
              />
            </div>
          );
        }
        if (el.kind === 'line') {
          return (
            <div
              key={el.id}
              style={{
                ...style,
                width: `${el.width || 24}%`,
                height: 2,
                background: el.color,
              }}
            />
          );
        }
        return (
          <div
            key={el.id}
            style={{
              ...style,
              width: `${el.width || 70}%`,
              fontSize: el.size,
              fontWeight: el.bold ? 800 : 500,
              fontStyle: el.italic ? 'italic' : 'normal',
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
            }}
          >
            {replaceVars(el.text || '', studentName, labTitle, issuedAt)}
          </div>
        );
      })}

      {certNumber && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 border border-zinc-700 rounded text-[9px] font-mono text-zinc-400 print:hidden">
          {certNumber}
        </div>
      )}
    </div>
  );
};
