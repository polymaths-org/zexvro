import React from 'react';

type GlassProps = {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  radius?: number | string;
};

/**
 * Liquid-glass shell for UI (navbar, chips).
 * CSS-only: blur + layered speculars. No SVG displacement on children
 * (that warps text and clips pill edges).
 */
export const Glass: React.FC<GlassProps> = ({
  children,
  className = '',
  active = true,
  radius = 999,
}) => {
  if (!active) {
    return <div className={`relative ${className}`}>{children}</div>;
  }

  return (
    <div
      className={`relative ${className}`}
      style={{
        borderRadius: radius,
        WebkitBackdropFilter: 'blur(22px) saturate(1.55)',
        backdropFilter: 'blur(22px) saturate(1.55)',
        background:
          'linear-gradient(155deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.09) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: `
          0 10px 40px rgba(0,0,0,0.35),
          0 1px 0 rgba(255,255,255,0.12),
          inset 0 1px 0 rgba(255,255,255,0.28),
          inset 0 -1px 0 rgba(255,255,255,0.04)
        `,
      }}
    >
      {/* top specular sheen */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 18%, transparent 42%)',
            opacity: 0.85,
          }}
        />
        {/* soft liquid highlight drift */}
        <div
          className="absolute -left-1/4 top-0 h-full w-1/2 liquid-glass-shimmer"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
            mixBlendMode: 'soft-light',
          }}
        />
        {/* bottom inner glass edge */}
        <div
          className="absolute inset-x-3 bottom-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
          }}
        />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
};
