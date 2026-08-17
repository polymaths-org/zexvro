import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

type FooterItem = { label: string; href: string; plain?: boolean };

const LINKS: Record<string, FooterItem[]> = {
  Product: [
    { label: 'Platform', href: '#about' },
    { label: 'Services', href: '#about' },
    { label: 'Web3 Labs', href: 'https://labs.zexvro.in' },
    { label: 'Waitlist', href: '#waitlist' },
  ],
  Company: [
    { label: 'Team', href: '#team' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ],
  Contact: [
    { label: 'support@zexvro.in', href: 'mailto:support@zexvro.in' },
    { label: 'GM@zexvro.in', href: 'mailto:gm@zexvro.in' },
    { label: 'Pune, IN', href: '', plain: true },
  ],
};

export const Footer: React.FC = () => {
  const [logoError, setLogoError] = useState(false);

  return (
    <footer
      id="contact"
      className="relative w-full px-6 md:px-12 xl:px-24 pt-16 pb-10 bg-black border-t border-white/5 overflow-hidden"
    >
      {/* Glass shell */}
      <div className="max-w-6xl mx-auto relative">
        <div
          className="relative rounded-3xl border border-white/12 overflow-hidden"
          style={{
            background:
              'linear-gradient(155deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            boxShadow:
              '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.12) 0%, transparent 35%, transparent 70%, rgba(255,255,255,0.04) 100%)',
            }}
          />

          <div className="relative z-10 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
              {/* Brand */}
              <div className="md:col-span-5 space-y-5">
                <div className="flex items-center gap-3">
                  {!logoError && (
                    <img
                      src="/logo-transparent.png"
                      alt="Zexvro"
                      className="h-9 w-9 object-contain"
                      onError={() => setLogoError(true)}
                    />
                  )}
                  <span className="font-pixel text-sm tracking-[0.28em] text-white uppercase">
                    ZEXVRO
                  </span>
                </div>
                <p className="text-sm font-medium text-white/60 leading-relaxed max-w-xs">
                  Web3 infrastructure that feels like normal software. Connect, pay, and scale —
                  without the noise.
                </p>
                <a
                  href="https://x.com/zexvr0"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/10 px-4 py-2 text-xs font-medium text-white/70 hover:text-white transition-colors"
                >
                  {/* X logo */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                  </svg>
                  Follow on X
                </a>
              </div>

              {/* Link columns */}
              <div className="md:col-span-7 grid grid-cols-3 gap-6">
                {Object.entries(LINKS).map(([group, items]) => (
                  <div key={group}>
                    <h4 className="font-pixel text-[9px] tracking-[0.28em] uppercase text-white/40 mb-4">
                      {group}
                    </h4>
                    <ul className="space-y-2.5">
                      {items.map((item) => (
                        <li key={item.label}>
                          {item.plain ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/55">
                              <MapPin size={13} className="text-white/40" />
                              {item.label}
                            </span>
                          ) : (
                            <a
                              href={item.href}
                              className="text-sm font-medium text-white/55 hover:text-white transition-colors break-all"
                            >
                              {item.label}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <p className="text-[11px] font-medium text-white/40">
                © {new Date().getFullYear()} ZEXVRO. All rights reserved.
              </p>
              <div className="flex flex-col items-center sm:items-end gap-1.5">
                <span className="font-pixel text-[9px] tracking-[0.28em] uppercase text-white/40">
                  Have something to discuss?
                </span>
                <a
                  href="mailto:gm@zexvro.in"
                  aria-label="Email GM@zexvro.in"
                  className="group inline-block"
                >
                  <span className="font-pixel text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-all group-hover:text-blue-200 transition-colors drop-shadow-[0_0_24px_rgba(255,255,255,0.1)]">
                    GM@zexvro.in
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};