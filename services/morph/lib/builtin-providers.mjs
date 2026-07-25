/**
 * Morph built-in OpenAI-compatible providers.
 * Seeded into ~/.config/morph/morph.jsonc so they appear in /connect + /models.
 * API keys stay in ~/.local/share/morph/auth.json (user /connect or morph providers add).
 */

/** @type {Record<string, {
 *   npm: string
 *   name: string
 *   options: { baseURL: string }
 *   models: Record<string, { name: string }>
 *   defaultModel?: string
 * }>} */
export const BUILTIN_PROVIDERS = {
  codexin: {
    npm: '@ai-sdk/openai-compatible',
    name: 'CodexIn',
    options: { baseURL: 'https://api.codexin.lol/v1' },
    models: {
      'grok-4.5': { name: 'Grok 4.5' },
    },
    defaultModel: 'codexin/grok-4.5',
  },
}
