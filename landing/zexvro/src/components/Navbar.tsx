import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { Glass } from './Glass';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Team', href: '#team' },
  { label: 'Platform', href: '#platform' },
  { label: 'Contact', href: '#contact' },
];

const ease = [0.16, 1, 0.3, 1] as const;

export const Navbar: React.FC = () => {
  const [logoError, setLogoError] = useState(false);
  const [wordmarkError, setWordmarkError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    const threshold = typeof window !== 'undefined' ? window.innerHeight * 0.72 : 600;
    setExpanded(y > threshold);
    if (y <= threshold) setMobileOpen(false);
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -48 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease, delay: 0.08 }}
      className="fixed top-0 left-0 w-full z-50 flex justify-center px-4 md:px-6 pointer-events-none"
      style={{ paddingTop: expanded ? 12 : 28 }}
    >
      <motion.div
        layout
        transition={{ layout: { duration: 0.5, ease } }}
        className="pointer-events-auto max-w-full"
        style={{ width: expanded ? 'min(880px, calc(100vw - 2rem))' : 'auto' }}
      >
        <Glass active={expanded} radius={999} className={expanded ? 'w-full' : ''}>
          <nav
            className={`flex items-center gap-3 md:gap-5 ${
              expanded
                ? 'justify-between pl-3 pr-2.5 md:pl-4 md:pr-3 py-2'
                : 'justify-center px-3 py-2'
            }`}
          >
            <a href="#home" className="flex items-center gap-2.5 shrink-0 min-w-0">
              <div
                className={`relative flex items-center justify-center rounded-full overflow-hidden transition-all duration-400 ${
                  expanded ? 'h-8 w-8 bg-white/[0.08]' : 'h-8 w-8'
                }`}
              >
                {!logoError ? (
                  <img
                    src="/logo-transparent.png"
                    alt="ZEXVRO"
                    className="h-6 w-6 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span className="font-pixel text-[10px]">Z</span>
                )}
              </div>

              {!wordmarkError ? (
                <img
                  src="/wordmark-transparent.png"
                  alt="ZEXVRO"
                  className={`object-contain transition-all duration-400 ${
                    expanded ? 'h-3.5 opacity-100' : 'h-5'
                  }`}
                  onError={() => setWordmarkError(true)}
                />
              ) : (
                <span className="font-pixel text-xs tracking-[0.28em]">ZEXVRO</span>
              )}
            </a>

            <AnimatePresence>
              {expanded && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35, ease }}
                  className="hidden md:flex items-center gap-0.5"
                >
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="relative px-3 py-1.5 text-[12px] font-medium tracking-wide text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/[0.07]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.3, ease }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <a
                    href="https://console.zexvro.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide bg-white text-black hover:bg-white/90 transition-colors"
                  >
                    Get Started
                  </a>
                  <button
                    type="button"
                    className="md:hidden flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.08] text-white"
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    onClick={() => setMobileOpen((v) => !v)}
                  >
                    {mobileOpen ? <X size={15} /> : <Menu size={15} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </Glass>

        <AnimatePresence>
          {expanded && mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease }}
              className="md:hidden mt-2"
            >
              <Glass active radius={20} className="w-full">
                <ul className="flex flex-col p-1.5">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="block px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/[0.07] rounded-xl transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                  <li className="p-1.5">
                    <a
                      href="https://console.zexvro.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full py-2.5 rounded-full bg-white text-black text-xs font-bold"
                    >
                      Get Started
                    </a>
                  </li>
                </ul>
              </Glass>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.header>
  );
};
