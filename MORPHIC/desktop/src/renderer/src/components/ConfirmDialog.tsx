import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useAnimatedDialog } from './useAnimatedDialog'

interface Props {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** Asks before anything that can't be undone. The safe choice is focused first. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onClose }: Props) {
  const confirmed = useRef(false)
  const cancel = useRef<HTMLButtonElement>(null)
  const { closing, close, finish, dialogProps } = useAnimatedDialog(() => {
    onClose()
    if (confirmed.current) onConfirm()
  })

  useEffect(() => {
    cancel.current?.focus()
  }, [])

  return (
    <dialog {...dialogProps} className="confirm" aria-labelledby="confirm-title">
      <motion.div
        className="glass glass-strong flex flex-col gap-4 p-8"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={closing ? { opacity: 0, scale: 0.97, y: 6 } : { opacity: 1, scale: 1, y: 0 }}
        transition={closing ? { duration: 0.16, ease: 'easeIn' } : { type: 'spring', stiffness: 380, damping: 30 }}
        onAnimationComplete={finish}
      >
        <h2 id="confirm-title" className="text-[1.6rem] font-semibold">
          {title}
        </h2>
        <p className="text-[1.1rem] text-fg-muted">{body}</p>
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <button ref={cancel} type="button" className="btn btn-quiet" onClick={close}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              confirmed.current = true
              close()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </dialog>
  )
}
