import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'

/** Smoothly animates its height to fit whatever is inside, so swapping content doesn't jump. */
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      // clip (not hidden) so it doesn't become a scroll container and break sticky children.
      style={{ overflow: 'clip' }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}
