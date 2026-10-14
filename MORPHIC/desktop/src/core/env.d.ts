/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set in desktop/.env (see .env.example). VROAI_URL in the process environment overrides it. */
  readonly MAIN_VITE_VROAI_URL?: string
  /** Optional OpenRouter provider (desktop/.env, never committed). */
  readonly MAIN_VITE_OPENROUTER_API_KEY?: string
  /** One model id, or several separated by commas (the rest are fallbacks). */
  readonly MAIN_VITE_OPENROUTER_MODEL?: string
}
