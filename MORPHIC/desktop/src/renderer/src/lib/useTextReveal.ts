import type { RefObject } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(SplitText, useGSAP)

interface Options {
  /** 'rise': words slide up out of a mask (headings). 'settle': words fade and drift into place (Morph's answers). */
  style?: 'rise' | 'settle'
  delay?: number
  enabled?: boolean
}

/**
 * Word-by-word text entrance with GSAP SplitText. The split is reverted as soon as the animation ends,
 * so screen readers, selection and copy see plain text again. Give the element a `key` tied to its text:
 * React must not update text that SplitText has rearranged.
 */
export function useTextReveal(ref: RefObject<HTMLElement | null>, { style = 'rise', delay = 0, enabled = true }: Options = {}) {
  useGSAP(
    () => {
      const el = ref.current
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'
      if (!el || !enabled || reduced) return
      const rise = style === 'rise'
      const split = SplitText.create(el, { type: 'words', mask: rise ? 'words' : undefined })
      // Long answers shouldn't take ages to appear: the whole reveal stays under ~1.4s.
      const stagger = Math.min(rise ? 0.06 : 0.025, 1.2 / Math.max(1, split.words.length))
      gsap.from(split.words, {
        ...(rise ? { yPercent: 105 } : { opacity: 0, y: 6, filter: 'blur(3px)' }),
        duration: rise ? 0.7 : 0.45,
        ease: rise ? 'power4.out' : 'power2.out',
        stagger,
        delay,
        onComplete: () => split.revert()
      })
    },
    { scope: ref, dependencies: [enabled] }
  )
}
