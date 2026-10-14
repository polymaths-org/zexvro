import { useId, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useTextReveal } from '@/lib/useTextReveal'

/** Shared layout for the Reminders / Memory / Activity pages: a big title, a plain intro, content. */
export function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useTextReveal(heading, { style: 'rise' })
  return (
    <div className="chat-scroll h-full overflow-y-auto px-6">
      <motion.div
        className="mx-auto flex max-w-[46rem] flex-col gap-6 pt-4 pb-12"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <header className="flex flex-col gap-2">
          <h1 ref={heading} key={title} className="text-[2.2rem] font-semibold">
            {title}
          </h1>
          <p className="text-[1.1rem] text-fg-muted">{intro}</p>
        </header>
        {children}
      </motion.div>
    </div>
  )
}

/** A titled glass block inside a page. */
export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={`glass flex flex-col gap-4 p-6 ${className}`}>
      {title && (
        <h2 id={id} className="font-display text-[1.25rem] font-semibold">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
