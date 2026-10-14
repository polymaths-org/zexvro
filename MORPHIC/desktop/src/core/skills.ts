import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Skills in the SKILL.md style (Claude Code / OpenClaw / Hermes): markdown with frontmatter.
 * Progressive disclosure: only a skill whose triggers match the person's message is put in the prompt,
 * so the prompt stays small. Built-in skills ship with the app; people (or family) can add their own
 * as .md files in <data>/skills.
 */

export interface Skill {
  name: string
  description: string
  triggers: string[]
  body: string
}

const builtIn = import.meta.glob('./skills/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function parseSkill(source: string): Skill | null {
  const m = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!m) return null
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  if (!meta.name) return null
  return {
    name: meta.name,
    description: meta.description ?? '',
    triggers: (meta.triggers ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    body: m[2].trim()
  }
}

export class Skills {
  readonly all: Skill[]

  constructor(dataDir: string) {
    const skills = Object.values(builtIn).flatMap((src) => parseSkill(src) ?? [])
    try {
      const dir = join(dataDir, 'skills')
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue
        const skill = parseSkill(readFileSync(join(dir, file), 'utf8'))
        if (skill) skills.push(skill)
      }
    } catch {
      // No personal skills folder yet.
    }
    this.all = skills
  }

  /** Skills whose trigger words or phrases appear in the text (whole-word match), best match first. */
  match(text: string, limit = 2): Skill[] {
    const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ')} `
    return this.all
      .map((skill) => ({ skill, hits: skill.triggers.filter((t) => lower.includes(` ${t} `) || lower.includes(` ${t}s `)).length }))
      .filter((r) => r.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map((r) => r.skill)
  }
}
