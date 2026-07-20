import React, { Component, useEffect, useRef, useState } from 'react';
import { ShaderGradientCanvas, ShaderGradient, type GradientT } from '@shadergradient/react';

type Props = {
  className?: string;
  fov?: number;
  pixelDensity?: number;
  gradient: GradientT;
  veilClassName?: string;
  /** Keep mounted once seen (smoother re-entry) */
  keepAlive?: boolean;
};

class ShaderErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // swallow WebGL crashes so the page stays up
  }
  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/** Lazy WebGL gradient with fade-in + crash isolation. */
export const SafeShader: React.FC<Props> = ({
  className = '',
  fov = 45,
  pixelDensity = 0.85,
  gradient,
  veilClassName = 'absolute inset-0 bg-black/35',
  keepAlive = true,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const seen = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let t: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          seen.current = true;
          setActive(true);
          // small delay so layout settles before WebGL init
          window.clearTimeout(t);
          t = window.setTimeout(() => setReady(true), 80);
        } else if (!keepAlive || !seen.current) {
          setActive(false);
          setReady(false);
        }
      },
      { rootMargin: '25% 0px', threshold: 0.02 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [keepAlive]);

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
    >
      {/* CSS fallback while loading / if WebGL dies */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a18] via-black to-[#050510]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(38,78,255,0.22),transparent_55%)]" />

      <ShaderErrorBoundary>
        {active && ready && (
          <div
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: 1 }}
          >
            <ShaderGradientCanvas
              className="absolute inset-0 h-full w-full"
              style={{ width: '100%', height: '100%' }}
              pixelDensity={Math.min(pixelDensity, 1.2)}
              fov={fov}
              pointerEvents="none"
              powerPreference="high-performance"
            >
              <ShaderGradient {...gradient} />
            </ShaderGradientCanvas>
          </div>
        )}
      </ShaderErrorBoundary>

      <div className={veilClassName} />
    </div>
  );
};
