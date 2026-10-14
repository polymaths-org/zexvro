import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { MotionConfig } from 'motion/react'
import { TEXT_SIZE_PX, type Settings } from '@shared/settings'
import { cssToHex } from '@/lib/color'
import { setVoicePrefs } from '@/speech'

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)')

function useSystemDark() {
  const [dark, setDark] = useState(() => darkQuery().matches)
  useEffect(() => {
    const mq = darkQuery()
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

// Where the theme-change reveal starts: the last click, or the focused control when using the keyboard.
let revealFrom = { x: innerWidth / 2, y: innerHeight / 2 }
addEventListener('pointerdown', (e) => (revealFrom = { x: e.clientX, y: e.clientY }), { capture: true })
addEventListener(
  'keydown',
  () => {
    const r = document.activeElement?.getBoundingClientRect()
    if (r) revealFrom = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  },
  { capture: true }
)

/** The native window buttons and background only take #rrggbb, so resolve the theme's colours for them. */
function reportWindowColors() {
  const styles = getComputedStyle(document.documentElement)
  window.morphic.setWindowColors(cssToHex(styles.getPropertyValue('--bg-top')), cssToHex(styles.getPropertyValue('--fg')))
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const systemDark = useSystemDark()
  // Sliders fire many saves; only the newest reply may overwrite local state, or values jitter back.
  const latest = useRef(0)

  useEffect(() => {
    window.morphic.settings.get().then(setSettings)
  }, [])

  const update = useCallback(async (patch: Partial<Settings>) => {
    const changesLook = 'theme' in patch || 'palette' in patch
    const apply = () => setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'
    if (changesLook && document.startViewTransition && !reduced) {
      const root = document.documentElement.style
      const { x, y } = revealFrom
      root.setProperty('--reveal-x', `${x}px`)
      root.setProperty('--reveal-y', `${y}px`)
      root.setProperty('--reveal-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`)
      // flushSync so the new theme attributes are on the page before the browser takes the "after" snapshot.
      document.startViewTransition(() => flushSync(apply))
    } else {
      // Apply locally first so choices like text size feel instant, then persist.
      apply()
    }
    const seq = ++latest.current
    const saved = await window.morphic.settings.set(patch)
    if (seq === latest.current) setSettings(saved)
  }, [])

  const theme = settings?.theme ?? 'system'
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Layout effects run inside flushSync, which the theme reveal relies on.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.dataset.palette = settings?.palette ?? 'lavender'
    reportWindowColors()
  }, [resolved, settings?.palette])

  useLayoutEffect(() => {
    if (settings) document.documentElement.style.fontSize = `${TEXT_SIZE_PX[settings.textSize]}px`
  }, [settings?.textSize])

  // Advanced look settings become CSS variables / data attributes (read by CSS and the shader backdrop).
  const advanced = settings?.advanced
  useLayoutEffect(() => {
    if (!advanced) return
    const root = document.documentElement
    root.style.setProperty('--bubble-blur', `${advanced.bubbleBlur}px`)
    root.style.setProperty('--panel-blur', `${advanced.panelBlur}px`)
    root.style.setProperty('--glass-fill', `${advanced.glassTint}%`)
    root.dataset.bgMotion = advanced.bgMotion
    root.dataset.bgBrightness = String(advanced.bgBrightness / 100)
    root.dataset.motion = advanced.animations
  }, [advanced])

  useEffect(() => {
    if (settings) setVoicePrefs({ voice: settings.voice, rate: settings.voiceRate })
  }, [settings?.voice, settings?.voiceRate])

  if (!settings) return null
  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {/* "Fewer animations" forces reduced motion everywhere, on top of the computer's own setting. */}
      <MotionConfig reducedMotion={settings.advanced.animations === 'reduced' ? 'always' : 'user'}>{children}</MotionConfig>
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
