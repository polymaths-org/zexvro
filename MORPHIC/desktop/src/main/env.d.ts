interface ImportMetaEnv {
  /** Set in desktop/.env (see .env.example). VROAI_URL in the process environment overrides it. */
  readonly MAIN_VITE_VROAI_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
