import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { MorphMark } from '@/components/MorphMark'

/** Browser mode: Morph's chat as a rounded panel on the right. Solid enough to read; can be made wider. */
export function ChatSide({ wide, onToggleWide, thinking, children }: { wide: boolean; onToggleWide: () => void; thinking: boolean; children: ReactNode }) {
  return (
    <motion.aside
      aria-label="Chat with Morph"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="glass glass-strong flex shrink-0 flex-col overflow-hidden rounded-[2.25rem] transition-[width] duration-300 ease-out"
      style={{ width: wide ? 'clamp(26rem, 58%, 48rem)' : 'clamp(20rem, 36%, 30rem)' }}
    >
      <header className="flex items-center gap-3 border-b border-[var(--glass-border)] px-5 py-3">
        <MorphMark size={30} thinking={thinking} />
        <span className="flex-1 font-display text-[1.1rem] font-semibold">Morph</span>
        <button type="button" className="btn btn-quiet min-h-10 px-3.5 text-[0.9rem]" onClick={onToggleWide}>
          {wide ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          {wide ? 'Narrower chat' : 'Wider chat'}
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.aside>
  )
}
