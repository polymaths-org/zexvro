import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react'
import { SettingsProvider, useSettings } from './settings'
import { Onboarding } from './onboarding/Onboarding'
import { SessionsProvider } from './chat/sessions'
import { AppShell } from './shell/AppShell'
import { ViewProvider } from './shell/view'
import { RemindersProvider } from './reminders/reminders'
import { BrowserProvider } from './browser/browser'
import { ShaderBackdrop } from './components/ShaderBackdrop'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SplashIntro } from './components/SplashIntro'

/** Onboarding and the main app hand over with a soft fade-and-settle instead of a hard cut. */
/** The opening plays once per start, for people who have been set up (first launch has its own pixel intro). */
function Opening() {
  const { settings } = useSettings()
  const reduced = useReducedMotionConfig() ?? false
  const [show, setShow] = useState(() => settings.onboarded && settings.introAnimation && !reduced)
  return show ? <SplashIntro onDone={() => setShow(false)} /> : null
}

function Screens() {
  const { settings } = useSettings()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={settings.onboarded ? 'app' : 'onboarding'}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, scale: 1.01, transition: { duration: 0.22, ease: 'easeIn' } }}
      >
        {settings.onboarded ? (
          <SessionsProvider>
            <RemindersProvider>
              <ViewProvider>
                <BrowserProvider>
                  <AppShell />
                </BrowserProvider>
              </ViewProvider>
            </RemindersProvider>
          </SessionsProvider>
        ) : (
          <Onboarding />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export function App() {
  return (
    <>
      {/* CSS horizon underneath as the fallback if WebGL isn't available. */}
      <div className="backdrop" aria-hidden="true" />
      <ShaderBackdrop />
      <ErrorBoundary>
        <SettingsProvider>
          <Screens />
          <Opening />
        </SettingsProvider>
      </ErrorBoundary>
    </>
  )
}
