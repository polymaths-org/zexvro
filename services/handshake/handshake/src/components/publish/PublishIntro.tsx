import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MatrixDots } from './MatrixDots';

interface PublishIntroProps {
  onDone: () => void;
  durationMs?: number;
}

/**
 * PublishIntro — full-screen "button expands into a screen" moment.
 * Matrix dots ripple outward, title types in, then the overlay lifts
 * to reveal the publish canvas underneath.
 */
export const PublishIntro: React.FC<PublishIntroProps> = ({ onDone, durationMs = 1500 }) => {
  const [visible, setVisible] = useState(true);
  const [typed, setTyped] = useState('');

  const full = 'opening publish canvas';

  useEffect(() => {
    let i = 0;
    const typeTimer = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(typeTimer);
    }, 42);
    const hideTimer = window.setTimeout(() => setVisible(false), durationMs);
    const doneTimer = window.setTimeout(onDone, durationMs + 450);
    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
    };
  }, [durationMs, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[80] bg-[#050506] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        >
          <MatrixDots className="absolute inset-0 w-full h-full" origin={{ x: 0.5, y: 0.38 }} />
          {/* expanding ring from the "button" origin */}
          <motion.div
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#3B82F6]/60"
            initial={{ width: 12, height: 12, opacity: 0.9 }}
            animate={{ width: 560, height: 560, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"
            initial={{ width: 12, height: 12, opacity: 0.7 }}
            animate={{ width: 340, height: 340, opacity: 0 }}
            transition={{ duration: 1.0, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <motion.img
              src="/handshake-logo.png"
              alt="Handshake"
              initial={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="w-14 h-14 rounded-[10px] object-cover shadow-[0_8px_32px_rgba(59,130,246,0.35)] border border-white/10"
            />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#3B82F6]"
            >
              Handshake
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#FAFAFA]"
            >
              Publish a Smart Contract
            </motion.h1>
            <p className="text-xs font-mono text-[#A1A1AA] h-4">
              {typed}
              <span className="animate-pulse text-[#3B82F6]">▍</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
