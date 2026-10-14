import { useLayoutEffect, type Ref, type RefObject } from 'react'
import { motion } from 'motion/react'
import { ArrowUp, Square } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  /** Morph is answering: the send button becomes a Stop button. */
  busy: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  placeholder?: string
  onFocusChange?: (el: HTMLElement | null) => void
}

const MAX_HEIGHT_REM = 9

/**
 * The ask box. It keeps the same layoutId on the home screen and in a conversation, so when the
 * first question is sent it glides from the middle of the screen down to its place at the bottom.
 */
export function Composer({ value, onChange, onSend, onStop, busy, inputRef, placeholder, onFocusChange }: Props) {
  // Grow with the text (handy for pasting a whole letter), up to a limit, then scroll.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = MAX_HEIGHT_REM * parseFloat(getComputedStyle(document.documentElement).fontSize)
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [value, inputRef])

  return (
    <motion.form
      layoutId="composer"
      transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      // flex-wrap: in a narrow column the button moves under the text box instead of squeezing it.
      className="glass z-10 flex w-full flex-wrap items-end justify-end gap-x-3 gap-y-1 rounded-[1.5rem] p-2.5 pl-6 focus-within:border-[var(--focus)]"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) onSend()
      }}
    >
      <label htmlFor="ask" className="sr-only">
        What do you need help with?
      </label>
      <textarea
        id="ask"
        ref={inputRef as Ref<HTMLTextAreaElement>}
        rows={1}
        value={value}
        placeholder={placeholder ?? 'Tell Morph what you need…'}
        className="min-h-14 min-w-[12rem] flex-1 resize-none bg-transparent py-3.5 text-[1.25rem] leading-snug text-fg outline-none placeholder:text-fg-muted"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter adds a line. Never send mid-composition (Hindi and other IMEs).
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (!busy) onSend()
          }
        }}
        onFocus={(e) => onFocusChange?.(e.currentTarget)}
        onBlur={() => onFocusChange?.(null)}
      />
      {busy ? (
        <button type="button" className="btn btn-quiet shrink-0" onClick={onStop}>
          <Square aria-hidden="true" />
          Stop
        </button>
      ) : (
        <button type="submit" className="btn btn-primary shrink-0">
          <ArrowUp aria-hidden="true" />
          Ask Morph
        </button>
      )}
    </motion.form>
  )
}
