import { useEffect, useId, useState } from 'react'
import { motion, useReducedMotionConfig } from 'motion/react'
import { EYE_CENTER, MARK_EYES, MARK_LEFT, MARK_RIGHT, MARK_VIEWBOX } from './mark'

interface Props {
  size: number
  /** Morph's eyes turn toward this element: usually the next thing the person should press. */
  lookAt?: HTMLElement | null
  /** Change this to make Morph look again after the layout moves (e.g. a new step). */
  lookKey?: unknown
  /** Eyes off while the mark is still assembling. */
  awake?: boolean
  /** Waiting for an answer: the eyes narrow and scan side to side. */
  thinking?: boolean
  /** Eyes open but motionless: for small icons and previews where movement would distract. */
  still?: boolean
  className?: string
}

const GAZE_X = 30
const GAZE_Y = 18

function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const blinkOnce = (then: () => void) => {
      setClosed(true)
      timer = setTimeout(() => {
        setClosed(false)
        then()
      }, 130)
    }
    const schedule = () => {
      timer = setTimeout(
        () => {
          const twice = Math.random() < 0.2
          blinkOnce(() => (twice ? (timer = setTimeout(() => blinkOnce(schedule), 170)) : schedule()))
        },
        3000 + Math.random() * 3500
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled])
  return closed
}

/** With nothing to look at, Morph glances around now and then, like the idle animation. */
function useGlance(enabled: boolean) {
  const [glance, setGlance] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!enabled) {
      setGlance({ x: 0, y: 0 })
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(
        () => {
          setGlance({ x: Math.random() < 0.5 ? -0.9 : 0.9, y: (Math.random() - 0.5) * 0.5 })
          timer = setTimeout(() => {
            setGlance({ x: 0, y: 0 })
            schedule()
          }, 1400)
        },
        5000 + Math.random() * 4000
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled])
  return glance
}

function useGaze(svg: SVGSVGElement | null, target: HTMLElement | null | undefined, key: unknown) {
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!svg || !target) {
      setGaze(null)
      return
    }
    const update = () => {
      const a = svg.getBoundingClientRect()
      const b = target.getBoundingClientRect()
      const dx = b.left + b.width / 2 - (a.left + a.width * EYE_CENTER.x)
      const dy = b.top + b.height / 2 - (a.top + a.height * EYE_CENTER.y)
      const dist = Math.hypot(dx, dy) || 1
      const reach = Math.min(1, dist / 260)
      setGaze({ x: (dx / dist) * reach, y: (dy / dist) * reach })
    }
    update()
    // Targets often slide in with an animation; look again once they've settled.
    const settle = setTimeout(update, 320)
    const ro = new ResizeObserver(update)
    ro.observe(target)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(settle)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [svg, target, key])
  return gaze
}

export function MorphMark({ size, lookAt, lookKey, awake = true, thinking = false, still = false, className }: Props) {
  const id = useId()
  const reduced = useReducedMotionConfig() ?? false
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)

  const lively = awake && !reduced && !still
  const scanning = lively && thinking
  const closed = useBlink(lively && !thinking)
  const gaze = useGaze(svg, lookAt, lookKey)
  const glance = useGlance(lively && !lookAt && !thinking)
  const look = gaze ?? glance

  const { x, y, size: vb } = MARK_VIEWBOX
  return (
    <svg
      ref={setSvg}
      className={className}
      width={size}
      height={size}
      viewBox={`${x} ${y} ${vb} ${vb}`}
      role="img"
      aria-label="Morph"
    >
      <defs>
        <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1="113" x2="0" y2="1056">
          <stop offset="0" style={{ stopColor: 'var(--mark-fill-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mark-fill-bottom)' }} />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1="0" y1="113" x2="0" y2="1056">
          <stop offset="0" style={{ stopColor: 'var(--mark-stroke-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mark-stroke-bottom)' }} />
        </linearGradient>
      </defs>

      <g fill={`url(#${id}-fill)`} stroke={`url(#${id}-stroke)`} strokeWidth={1.5} strokeLinejoin="round">
        <path d={MARK_LEFT} vectorEffect="non-scaling-stroke" />
        <path d={MARK_RIGHT} vectorEffect="non-scaling-stroke" />
      </g>

      <motion.g
        initial={false}
        animate={
          scanning
            ? { opacity: 1, x: [-GAZE_X, GAZE_X, -GAZE_X], y: -GAZE_Y / 3 }
            : { opacity: awake ? 1 : 0, x: look.x * GAZE_X, y: look.y * GAZE_Y }
        }
        transition={
          scanning
            ? { x: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 0.3 } }
            : { opacity: { duration: 0.25, ease: 'easeOut' }, default: { type: 'spring', stiffness: 170, damping: 20 } }
        }
        style={{ filter: 'drop-shadow(0 0 3px var(--eye-glow)) drop-shadow(0 0 12px var(--eye-glow))' }}
      >
        {MARK_EYES.map((eye) => (
          <motion.rect
            key={eye.x}
            {...eye}
            fill="var(--eye)"
            initial={false}
            animate={{ scaleY: closed ? 0.1 : thinking ? 0.7 : 1 }}
            transition={{ duration: 0.07, ease: 'easeInOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        ))}
      </motion.g>
    </svg>
  )
}
