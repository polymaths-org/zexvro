import React from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { Certificate } from '../types';

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

export const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  design,
  studentName,
  labTitle,
  issuedAt,
  certNumber,
}) => {
  const d = design && design.elements && design.elements.length > 0 ? design : fallbackDesign;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden aspect-[16/9] border-2 select-none"
      style={{ background: d.background, borderColor: d.borderColor }}
    >
      {(d.elements || []).map((el) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${el.x}%`,
          top: `${el.y}%`,
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
            <div key={el.id} style={{ ...style, width: el.size, height: el.size }} className="p-1 rounded" >
              <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-px" style={{ backgroundColor: el.color }}>
                {Array.from({ length: 25 }).map((_, i) => {
                  const on = [0, 1, 2, 5, 10, 11, 12, 15, 20, 21, 22, 6, 8, 16, 18, 24].includes(i) || i % 7 === 0;
                  return <div key={i} className={on ? 'bg-black' : 'bg-transparent'} />;
                })}
              </div>
            </div>
          );
        }
        if (el.kind === 'line') {
          return (
            <div key={el.id} style={{ ...style, width: `${el.width || 24}%`, height: 2, background: `linear-gradient(90deg, transparent, ${el.color}, transparent)` }} />
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
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 border border-zinc-700 rounded text-[9px] font-mono text-zinc-400">
          {certNumber}
        </div>
      )}
    </div>
  );
};
