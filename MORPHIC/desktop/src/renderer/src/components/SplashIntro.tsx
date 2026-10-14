import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MorphMark } from './MorphMark'

const LETTERS = 'MORPH'.split('')
const LENGTH_MS = 1750

/**
 * The opening each time Morph starts (the pixel assembly is kept for the very first launch): Morph's light
 * swells, the glass M settles in out of a blur, its eyes switch on, the name rises letter by letter, and
 * the whole thing opens up into the app. Any click or key skips it.
 */
export function SplashIntro({ onDone }: { onDone: () => void }) {
  const [awake, setAwake] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const eyes = setTimeout(() => setAwake(true), 650)
    const leave = setTimeout(() => setLeaving(true), LENGTH_MS)
    const skip = () => setLeaving(true)
    addEventListener('pointerdown', skip, { once: true })
    addEventListener('keydown', skip, { once: true })
    return () => {
      clearTimeout(eyes)
      clearTimeout(leave)
      removeEventListener('pointerdown', skip)
      removeEventListener('keydown', skip)
    }
  }, [])

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div
          key="splash"
          aria-hidden="true"
          className="fixed inset-0 z-50 grid place-items-center"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 55%, color-mix(in oklab, var(--bg-top) 70%, var(--morph-deep)), var(--bg) 70%)' }}
          exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
        >
          <div className="relative flex flex-col items-center gap-7">
            {/* Morph's light switching on. */}
            <motion.div
              className="absolute top-[18%] size-[22rem] rounded-full"
              style={{ background: 'radial-gradient(circle, var(--haze), transparent 65%)' }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 0.9, 0.55], scale: [0.3, 1.25, 1.1] }}
              transition={{ duration: 1.3, ease: 'easeOut' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.86, y: 18, filter: 'blur(14px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <MorphMark size={170} awake={awake} />
            </motion.div>
            <div className="wordmark relative flex gap-[0.55em] text-[1.6rem] text-fg">
              {LETTERS.map((letter, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
