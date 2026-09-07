import React, { useState } from 'react';
import { motion } from 'motion/react';
import { serviceLogoSrcSet, serviceLogoUrl, type ServiceLogoSize } from '../lib/serviceAssets';

export type ServiceLogoState = 'idle' | 'active' | 'morph' | 'focus';

type Props = {
  id: string;
  name: string;
  size?: ServiceLogoSize | number;
  state?: ServiceLogoState;
  className?: string;
  imgClassName?: string;
  /** Morph logo is already white-on-transparent — do NOT invert (default false) */
  invertMorph?: boolean;
  priority?: boolean;
};

/**
 * Product service mark with morphic states (idle / active / morph / focus).
 * Uses real /services/* assets (CDN-cached via Cloudflare Pages).
 */
export const ServiceLogo: React.FC<Props> = ({
  id,
  name,
  size = 64,
  state = 'idle',
  className = '',
  imgClassName = '',
  invertMorph = false,
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);
  const px = typeof size === 'number' ? size : size;
  const assetSize: ServiceLogoSize = px <= 40 ? 32 : px <= 96 ? 64 : 256;
  const src = serviceLogoUrl(id, assetSize);
  const isMorph = id === 'morph';
  const invert = isMorph && invertMorph;

  const ring =
    state === 'focus' || state === 'active'
      ? 'ring-1 ring-white/25 shadow-[0_0_24px_rgba(124,58,237,0.25)]'
      : state === 'morph'
        ? 'ring-1 ring-amber-400/30 shadow-[0_0_28px_rgba(245,158,11,0.28)]'
        : 'ring-0';

  const animate =
    state === 'morph'
      ? { scale: [1, 1.06, 0.98, 1.04, 1], rotate: [0, -4, 3, -2, 0], filter: ['blur(0px)', 'blur(1px)', 'blur(0px)'] }
      : state === 'focus'
        ? { scale: 1.08, y: 0 }
        : state === 'active'
          ? { scale: 1.04 }
          : { scale: 1 };

  if (failed) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] text-white/70 ${className}`}
        style={{ width: px, height: px }}
        aria-label={name}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl ${ring} ${className}`}
      style={{ width: px, height: px }}
      animate={animate}
      transition={
        state === 'morph'
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 320, damping: 22 }
      }
    >
      {(state === 'active' || state === 'focus' || state === 'morph') && (
        <span
          className={`pointer-events-none absolute inset-0 rounded-xl opacity-40 blur-md ${
            isMorph ? 'bg-amber-400/30' : 'bg-violet-500/25'
          }`}
          aria-hidden
        />
      )}
      {state === 'morph' && (
        <span
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-amber-400/20 via-transparent to-orange-500/20 liquid-glass-shimmer"
          aria-hidden
        />
      )}
      <img
        src={src}
        srcSet={serviceLogoSrcSet(id)}
        sizes={`${px}px`}
        width={px}
        height={px}
        alt=""
        role="presentation"
        decoding={priority ? 'sync' : 'async'}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`relative z-[1] h-[78%] w-[78%] object-contain select-none ${
          invert ? 'invert brightness-110' : ''
        } ${imgClassName}`}
        onError={() => setFailed(true)}
        draggable={false}
      />
      <span className="sr-only">{name}</span>
    </motion.div>
  );
};
