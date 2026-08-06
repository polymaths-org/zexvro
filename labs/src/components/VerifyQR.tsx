import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface VerifyQRProps {
  value: string; // URL / text to encode
  size?: number;
  className?: string;
}

// Renders a REAL scannable QR code from the given value. In the credential
// canvas this previews the code that will be baked onto issued certificates.
export const VerifyQR: React.FC<VerifyQRProps> = ({ value, size = 128, className }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center ${className || ''}`}
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full rounded bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center text-[9px] font-mono text-zinc-500">
          QR
        </div>
      </div>
    );
  }

  return <img src={dataUrl} alt="Verification QR" className={className} style={{ width: size, height: size }} />;
};
