import { AnimatePresence, motion } from 'motion/react'
import { MorphMark } from './MorphMark'
import { PixelAssemble } from './PixelAssemble'
import { EYE_BOTTOM } from './mark'

interface Props {
  size: number
  lookAt?: HTMLElement | null
  lookKey?: unknown
  /** Play the pixel-assembly intro first; calls onIntroDone when Morph is fully formed. */
  intro?: boolean
  onIntroDone?: () => void
  awake?: boolean
  thinking?: boolean
  /** Shared-layout id: Morph glides between screens that use the same id. */
  layoutId?: string
}

/**
 * Morph standing behind the glass panel that follows it, like the M rising over the planet in the
 * brand film: the panel's top edge sits just under the eyes, so the legs show through the frosted glass.
 * Render this directly before the panel; the panel needs a higher z-index.
 */
export function PeekingMorph({ size, lookAt, lookKey, intro = false, onIntroDone, awake = true, thinking = false, layoutId }: Props) {
  const overlap = size * (1 - EYE_BOTTOM - 0.035)
  return (
    <motion.div
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      className="relative z-0 shrink-0"
      style={{ width: size, height: size, marginBottom: -overlap }}
    >
      <motion.div initial={false} animate={{ opacity: intro ? 0 : 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <MorphMark size={size} lookAt={lookAt} lookKey={lookKey} awake={awake && !intro} thinking={thinking} />
      </motion.div>
      <AnimatePresence>
        {intro && (
          <motion.div key="pixels" exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeIn' }}>
            <PixelAssemble size={size} onDone={() => onIntroDone?.()} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
