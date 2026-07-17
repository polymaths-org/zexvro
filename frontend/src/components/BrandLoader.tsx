import { useEffect, useState } from 'react';
import {
  BRAND_LOADER_GIF,
  BRAND_SURFACE,
  ensureBrandAssetsCached,
  getBrandLoaderSrc,
} from '../lib/brandAssets';

type BrandLoaderSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<BrandLoaderSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

type BrandLoaderProps = {
  size?: BrandLoaderSize;
  label?: string;
  className?: string;
  /** Full-viewport centered shell (platform / route loading). */
  fullscreen?: boolean;
  /** Section-height centered shell on dark grey. */
  section?: boolean;
  /** Inline chip (e.g. payment modal badge) — no surface bg. */
  bare?: boolean;
};

export default function BrandLoader({
  size = 'md',
  label,
  className = '',
  fullscreen = false,
  section = false,
  bare = false,
}: BrandLoaderProps) {
  const [src, setSrc] = useState(() => getBrandLoaderSrc());

  useEffect(() => {
    let active = true;
    void ensureBrandAssetsCached().then(() => {
      if (active) setSrc(getBrandLoaderSrc());
    });
    return () => {
      active = false;
    };
  }, []);

  const media = (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <img
        src={src || BRAND_LOADER_GIF}
        alt=""
        aria-hidden="true"
        className={`${SIZE_CLASS[size]} object-contain select-none`}
        draggable={false}
      />
      {label ? (
        <p className="text-sm text-zinc-400">{label}</p>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center"
        style={{ backgroundColor: BRAND_SURFACE }}
        role="status"
        aria-label={label || 'Loading'}
      >
        {media}
      </div>
    );
  }

  if (section) {
    return (
      <div
        className="flex min-h-56 w-full items-center justify-center rounded-xl"
        style={{ backgroundColor: BRAND_SURFACE }}
        role="status"
        aria-label={label || 'Loading'}
      >
        {media}
      </div>
    );
  }

  if (bare) {
    return (
      <span role="status" aria-label={label || 'Loading'} className="inline-flex">
        {media}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center justify-center rounded-lg px-3 py-2"
      style={{ backgroundColor: BRAND_SURFACE }}
      role="status"
      aria-label={label || 'Loading'}
    >
      {media}
    </div>
  );
}
