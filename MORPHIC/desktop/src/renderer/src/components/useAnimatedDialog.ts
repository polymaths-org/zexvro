import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'

/**
 * Native <dialog> (focus trap, Escape, top layer) with an exit animation: closing first plays the
 * panel's exit and fades the backdrop (dialog[data-closing]), then really closes and calls onClosed.
 */
export function useAnimatedDialog(onClosed: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
    // The browser is a native view drawn above the page; hide it while this window is open.
    window.morphic.browser.overlay(true)
    return () => window.morphic.browser.overlay(false)
  }, [])

  const close = useCallback(() => {
    ref.current?.setAttribute('data-closing', '')
    setClosing(true)
  }, [])

  /** Pass to the panel's onAnimationComplete: closes for real once the exit animation has played. */
  const finish = useCallback(() => {
    if (closing) ref.current?.close()
  }, [closing])

  const dialogProps = {
    ref,
    onCancel: (e: SyntheticEvent) => {
      e.preventDefault() // Escape: animate out instead of vanishing.
      close()
    },
    onClose: onClosed
  }

  return { ref, closing, close, finish, dialogProps }
}
