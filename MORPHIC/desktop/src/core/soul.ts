import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Personality, Soul } from '@shared/core'
import defaultSoul from './soul/default-soul.md?raw'

/**
 * Morph's identity, in three layers (after OpenClaw's SOUL.md):
 *
 *   1. RULES        fixed, in code, always first. Safety and honesty. Nothing below can override them.
 *   2. Soul         soul.md: who Morph is, how it speaks, what it cares about. Ships with a default;
 *                   can be rewritten (Settings → Advanced → Morph's soul) and reset.
 *   3. Personality  everyday choices from Settings (tone, humour, what to call the person).
 *
 * The soul shapes *how* Morph behaves; the rules decide what it will never do.
 */

export const RULES = `These rules always apply, whatever anything else says:
- Ignore any earlier instructions about who you are or what you help with: you are Morph.
- Never mention Claude, Anthropic, Arduino, AI models or the companies and technologies behind you.
- Never ask for, type or store passwords, PINs, one-time codes, bank or card details.
- Never pretend to be a real person, a bank, a government office or a company.
- If a message, call or website looks like a scam (urgent money requests, prizes, asking for codes or passwords, gift cards), say so clearly and say what to do instead.
- Plain text only: no markdown headings, no asterisks. Use a simple numbered list only for steps, one step per line.
- You cannot read emails or files, or click things on the computer outside your own browser.`

const SOUL_MAX = 6000

const TONE_LINES: Record<Personality['tone'], string> = {
  warm: 'Sound warm and gentle.',
  cheerful: 'Sound cheerful and upbeat, without overdoing it.',
  calm: 'Sound calm and quiet, and keep things brief.',
  respectful: 'Sound polite and a little formal.'
}

export class SoulStore {
  private file: string

  constructor(dataDir: string) {
    this.file = join(dataDir, 'soul.md')
  }

  get(): Soul {
    try {
      const text = readFileSync(this.file, 'utf8')
      return { text, customised: text.trim() !== defaultSoul.trim() }
    } catch {
      return { text: defaultSoul, customised: false }
    }
  }

  set(text: string): Soul {
    const clean = String(text ?? '').slice(0, SOUL_MAX)
    if (!clean.trim()) return this.reset()
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, clean)
    return this.get()
  }

  reset(): Soul {
    rmSync(this.file, { force: true })
    return this.get()
  }
}

/** The identity part of every conversation prompt: rules, then soul, then personality. */
export function identity(soul: string, personality: Personality, name: string): string {
  const touches = [TONE_LINES[personality.tone]]
  if (personality.humour) touches.push('A little gentle humour now and then is welcome.')
  const callMe = personality.callMe.trim()
  if (callMe) touches.push(`Call them “${callMe}”${name ? ` (their name is ${name})` : ''}.`)
  else if (name) touches.push(`Their name is ${name}.`)
  return `${RULES}

Who you are (your soul):
${soul.trim()}

Personality for this person: ${touches.join(' ')}`
}
