/** Read-aloud via the operating system's own voices (Windows/macOS ship them; many Linux installs don't). */

let prefs = { voice: '', rate: 0.95 }

/** Set from Settings → Reading & voice; used by every speak() call. */
export function setVoicePrefs(next: { voice: string; rate: number }) {
  prefs = next
}

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = prefs.rate
  const voice = prefs.voice ? speechSynthesis.getVoices().find((v) => v.voiceURI === prefs.voice) : undefined
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

/** Voices load asynchronously, so wait briefly before deciding there are none. */
export function listVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length > 0) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(speechSynthesis.getVoices())
    }
    const timer = setTimeout(done, timeoutMs)
    speechSynthesis.addEventListener('voiceschanged', done)
  })
}

export const hasVoices = async () => (await listVoices()).length > 0
