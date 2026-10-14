import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MEMORY_CATEGORIES,
  NOTE_MAX,
  PROFILE_MAX,
  type MemoryCategory,
  type MemoryNote,
  type MemoryProfile,
  type MemorySource
} from '@shared/core'
import { newId, readJson, writeJson } from './store'

/**
 * Morph's memory (design notes: docs/MEMORY.md). Three layers, after Letta / Hermes / OpenClaw:
 *
 *   profile   "About you": a short block the person writes, always in the prompt.
 *   notes     single facts with a category, importance, where they came from, and optional expiry or
 *             date. Recalled by relevance (BM25 + importance + recency + usefulness); pinned notes are
 *             always included; upcoming dates are surfaced a couple of weeks ahead.
 *   episodes  one-line summaries of past conversations, recalled when relevant.
 *
 * Lifecycle: capture (the person tells Morph, or reflection learns it while idle) → recall (each
 * answer) → tidy (expired facts dropped, near-duplicates merged; no AI calls) → forget (person's choice).
 * Stored as JSON, mirrored to a human-readable MEMORY.md. Passwords, codes and account numbers are
 * never stored.
 */

export interface Episode {
  sessionId: string
  summary: string
  at: number
}

// ── Sensitive data filter ───────────────────────────────────────────────────────────────────

const SENSITIVE = [
  /\b(password|passcode|passwd|pin|otp|cvv|upi\s*pin|security\s*code)\b\s*(is|was|=|:)/i,
  /\b(otp|pin|cvv|code)\b[^.]{0,20}\b\d{3,8}\b/i,
  /\b\d{3,8}\b[^.]{0,20}\b(otp|pin|cvv)\b/i,
  /\b(?:\d[ -]?){13,19}\b/, // card numbers
  /\b\d{4}\s?\d{4}\s?\d{4}\b/, // 12-digit ID numbers (e.g. Aadhaar)
  /\b(account|a\/c|acct)\s*(no\.?|number)?\s*(is|:)?\s*\d{6,}/i,
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/ // IFSC
]

/** True for text that looks like a password, one-time code, card, ID or bank account number. */
export function looksSensitive(text: string): boolean {
  return SENSITIVE.some((pattern) => pattern.test(text))
}

// ── Keyword search (BM25) ───────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  'a an and are as at be but by can do for from has have he her his how i if in is it its me my of on or our she so that the their them they this to was we what when where which who will with you your am im ive dont please tell about'.split(
    ' '
  )
)

/** A very light English stemmer, so "gardening", "tablets" and "visited" match "garden", "tablet", "visit". */
export function stem(word: string): string {
  if (!/^[a-z]+$/.test(word)) return word
  if (word.length >= 6 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length >= 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length >= 5 && word.endsWith('ed')) return word.slice(0, -2)
  if (word.length >= 4 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
  return word
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem)
}

/** Okapi BM25 over a small in-memory collection (personal memory stays in the hundreds/thousands). */
export function bm25(query: string, docs: string[], k1 = 1.4, b = 0.75): number[] {
  const q = [...new Set(tokenize(query))]
  if (q.length === 0 || docs.length === 0) return docs.map(() => 0)
  const tokenized = docs.map(tokenize)
  const avg = tokenized.reduce((n, d) => n + d.length, 0) / tokenized.length || 1
  const df = new Map<string, number>()
  for (const doc of tokenized) for (const t of new Set(doc)) df.set(t, (df.get(t) ?? 0) + 1)
  return tokenized.map((doc) => {
    let score = 0
    for (const term of q) {
      const tf = doc.filter((t) => t === term).length
      if (!tf) continue
      const n = df.get(term) ?? 0
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5))
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avg)))
    }
    return score
  })
}

/** Share of the smaller text's words that also appear in the other (for spotting duplicates). */
export function overlap(a: string, b: string): number {
  const ta = new Set(tokenize(a))
  const tb = new Set(tokenize(b))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.min(ta.size, tb.size)
}

// ── Categories and dates ────────────────────────────────────────────────────────────────────

const CATEGORY_HINTS: [MemoryCategory, RegExp][] = [
  ['dates', /\b(birthday|anniversary|wedding day|death anniversary|puja|festival)\b/i],
  ['health', /\b(tablets?|medicines?|pills?|doctor|diabetes|sugar|blood pressure|bp|allerg\w*|insulin|exercise|walk(s|ing)?|sleep|knee|heart|eyes?|hearing)\b/i],
  ['people', /\b(son|daughter|grand(son|daughter|child|children|kids)|wife|husband|brother|sister|mother|father|mum|dad|friend|neighbou?r|aunt|uncle|nephew|niece|cousin|is called|named)\b/i],
  ['preferences', /\b(likes?|loves?|prefers?|favou?rite|enjoys?|hates?|doesn't like|does not like|dislikes?)\b/i],
  ['tech', /\b(phone|android|iphone|whatsapp|laptop|computer|tablet computer|email|wi-?fi|password manager|printer|tv|youtube)\b/i],
  ['places', /\b(lives? in|comes? from|city|town|village|moved to|house|flat|apartment)\b/i]
]

const isCategory = (value: unknown): value is MemoryCategory => MEMORY_CATEGORIES.some((c) => c.id === value)

/** Best-effort category when Morph or the person didn't give one. */
export function guessCategory(text: string): MemoryCategory {
  return CATEGORY_HINTS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other'
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** Finds a day in text: "12 March", "March 12th", "12/03" → "MM-DD"; "2026-11-02" → "YYYY-MM-DD". */
export function findDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const month = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase()) + 1
  const dm = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b/i)
  const md = text.match(/\b(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)
  const [d, m] = dm ? [Number(dm[1]), month(dm[2])] : md ? [Number(md[2]), month(md[1])] : [0, 0]
  if (m >= 1 && d >= 1 && d <= 31) return `${pad(m)}-${pad(d)}`
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (slash && Number(slash[2]) <= 12 && Number(slash[1]) <= 31) return `${pad(Number(slash[2]))}-${pad(Number(slash[1]))}`
  return undefined
}

/** Days until a "MM-DD" (next occurrence) or "YYYY-MM-DD" date; negative if a one-off date has passed. */
export function daysUntil(date: string, now = Date.now()): number {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const parts = date.split('-').map(Number)
  let target: Date
  if (parts.length === 3) target = new Date(parts[0], parts[1] - 1, parts[2])
  else {
    target = new Date(today.getFullYear(), parts[0] - 1, parts[1])
    if (target < today) target = new Date(today.getFullYear() + 1, parts[0] - 1, parts[1])
  }
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// ── The store ───────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000
const DUPLICATE = 0.85
const MERGE = 0.8
const RECALL_LIMIT = 6
const PINNED_LIMIT = 8

export interface AddOptions {
  sessionId?: string
  category?: MemoryCategory
  importance?: number
  expiresAt?: number
  date?: string
}

/** Fills in fields added in memory v2 for notes saved by older versions. */
function upgrade(note: Partial<MemoryNote> & { id: string; text: string }): MemoryNote {
  const now = Date.now()
  return {
    source: 'learned',
    createdAt: now,
    updatedAt: now,
    ...note,
    category: isCategory(note.category) ? note.category : guessCategory(note.text),
    importance: note.importance === 1 || note.importance === 3 ? note.importance : 2,
    pinned: note.pinned === true,
    uses: typeof note.uses === 'number' ? note.uses : 0,
    date: note.date ?? (guessCategory(note.text) === 'dates' ? findDate(note.text) : undefined)
  } as MemoryNote
}

export interface Recalled {
  /** "Always remember" notes: in every prompt. */
  pinned: MemoryNote[]
  /** The notes most relevant to what's being discussed. */
  relevant: MemoryNote[]
  /** Important dates in the next couple of weeks. */
  upcoming: { note: MemoryNote; inDays: number }[]
}

export class Memory {
  private dir: string
  private notesFile: string
  private profileFile: string
  private episodesFile: string
  notes: MemoryNote[]
  profile: MemoryProfile
  episodes: Episode[]

  constructor(dataDir: string) {
    this.dir = join(dataDir, 'memory')
    this.notesFile = join(this.dir, 'notes.json')
    this.profileFile = join(this.dir, 'profile.json')
    this.episodesFile = join(this.dir, 'episodes.json')
    this.notes = readJson<MemoryNote[]>(this.notesFile, []).map(upgrade)
    this.profile = readJson<MemoryProfile>(this.profileFile, { about: '', updatedAt: 0 })
    this.episodes = readJson<Episode[]>(this.episodesFile, [])
  }

  private save() {
    writeJson(this.notesFile, this.notes)
    this.exportMarkdown()
  }

  /** Newest first, or ranked by relevance when there's a query. */
  list(query?: string): MemoryNote[] {
    const live = this.notes.filter((n) => !this.expired(n))
    if (!query?.trim()) return [...live].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
    const scores = bm25(query, live.map((n) => n.text))
    return live
      .map((note, i) => ({ note, score: scores[i] }))
      .filter((r) => r.score > 0 || r.note.text.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.note)
  }

  /** Adds a fact, or refreshes a near-duplicate instead of storing it twice. Null if empty or sensitive. */
  add(text: string, source: MemorySource, options: AddOptions | string = {}): MemoryNote | null {
    const opts: AddOptions = typeof options === 'string' ? { sessionId: options } : options
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)
    if (!clean || looksSensitive(clean)) return null
    const now = Date.now()
    const category = isCategory(opts.category) ? opts.category : guessCategory(clean)
    const importance = (opts.importance === 1 || opts.importance === 3 ? opts.importance : 2) as MemoryNote['importance']
    const date = opts.date && /^(\d{4}-)?\d{2}-\d{2}$/.test(opts.date) ? opts.date : category === 'dates' ? findDate(clean) : undefined
    const twin = this.notes.find((n) => overlap(n.text, clean) >= DUPLICATE)
    if (twin) {
      // Keep whichever wording carries more detail, and the higher importance.
      if (clean.length > twin.text.length) twin.text = clean
      twin.importance = Math.max(twin.importance, importance) as MemoryNote['importance']
      twin.updatedAt = now
      twin.date ??= date
      if (opts.expiresAt) twin.expiresAt = opts.expiresAt
      this.save()
      return twin
    }
    const note: MemoryNote = {
      id: newId(),
      text: clean,
      source,
      category,
      importance,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      uses: 0,
      ...(opts.expiresAt && opts.expiresAt > now ? { expiresAt: opts.expiresAt } : {}),
      ...(date ? { date } : {}),
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {})
    }
    this.notes.push(note)
    this.save()
    return note
  }

  update(id: string, text: string): MemoryNote | null {
    const note = this.notes.find((n) => n.id === id)
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)
    if (!note || !clean || looksSensitive(clean)) return null
    note.text = clean
    note.updatedAt = Date.now()
    if (note.category === 'dates') note.date = findDate(clean) ?? note.date
    this.save()
    return note
  }

  pin(id: string, pinned: boolean): MemoryNote | null {
    const note = this.notes.find((n) => n.id === id)
    if (!note) return null
    note.pinned = pinned
    if (pinned) note.expiresAt = undefined
    this.save()
    return note
  }

  delete(id: string) {
    this.notes = this.notes.filter((n) => n.id !== id)
    this.save()
  }

  /** "Forget about my sister's address": removes the notes that clearly match. Returns what was removed. */
  forgetMatching(about: string): MemoryNote[] {
    const scores = bm25(about, this.notes.map((n) => n.text))
    const best = Math.max(0, ...scores)
    if (best <= 0) return []
    const removed = this.notes.filter((_, i) => scores[i] >= best * 0.6)
    const ids = new Set(removed.map((n) => n.id))
    this.notes = this.notes.filter((n) => !ids.has(n.id))
    this.save()
    return removed
  }

  clear() {
    this.notes = []
    this.episodes = []
    this.profile = { about: '', updatedAt: Date.now() }
    writeJson(this.episodesFile, this.episodes)
    writeJson(this.profileFile, this.profile)
    this.save()
  }

  setProfile(about: string): MemoryProfile {
    const clean = about.trim().slice(0, PROFILE_MAX)
    // Lines that look sensitive are dropped rather than rejecting the whole profile.
    const safe = clean
      .split('\n')
      .filter((line) => !looksSensitive(line))
      .join('\n')
    this.profile = { about: safe, updatedAt: Date.now() }
    writeJson(this.profileFile, this.profile)
    this.exportMarkdown()
    return this.profile
  }

  private expired(note: MemoryNote, now = Date.now()) {
    return !note.pinned && !!note.expiresAt && note.expiresAt <= now
  }

  /**
   * What to put in Morph's mind for this turn. Relevance score per note:
   *   BM25 (normalised to the best match) + importance + recency + usefulness, and only notes that
   *   actually match the topic. Pinned notes and upcoming dates are added regardless of the topic.
   */
  recall(query: string, limit = RECALL_LIMIT, now = Date.now()): Recalled {
    const live = this.notes.filter((n) => !this.expired(n, now))
    const pinned = live.filter((n) => n.pinned).slice(0, PINNED_LIMIT)
    const others = live.filter((n) => !n.pinned)
    const scores = bm25(query, others.map((n) => n.text))
    const best = Math.max(0, ...scores)
    const relevant = others
      .map((note, i) => {
        if (scores[i] <= 0) return { note, score: 0 }
        const match = best > 0 ? scores[i] / best : 0
        const recency = Math.exp(-(now - note.updatedAt) / (60 * DAY))
        const useful = Math.min(note.uses, 10) / 10
        const told = note.source === 'learned' ? 0 : 0.1
        return { note, score: match + 0.25 * (note.importance / 3) + 0.2 * recency + 0.1 * useful + told }
      })
      .filter((r) => r.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.note)
    return { pinned, relevant, upcoming: this.upcoming(14, now) }
  }

  /** Important dates in the next `days` days, soonest first. */
  upcoming(days = 14, now = Date.now()): { note: MemoryNote; inDays: number }[] {
    return this.notes
      .filter((n) => n.date && !this.expired(n, now))
      .map((note) => ({ note, inDays: daysUntil(note.date!, now) }))
      .filter((r) => r.inDays >= 0 && r.inDays <= days)
      .sort((a, b) => a.inDays - b.inDays)
  }

  /** The most recent notes, for when nothing matches the topic (e.g. "hello"): Morph still knows the basics. */
  recent(limit = 4): MemoryNote[] {
    return this.notes
      .filter((n) => !this.expired(n) && !n.pinned)
      .sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt)
      .slice(0, limit)
  }

  /** Counts notes that made it into an answer (useful notes rank a little higher next time). */
  markUsed(ids: string[], now = Date.now()) {
    if (!ids.length) return
    const set = new Set(ids)
    for (const n of this.notes) {
      if (!set.has(n.id)) continue
      n.uses += 1
      n.lastUsedAt = now
    }
    writeJson(this.notesFile, this.notes)
  }

  /**
   * Housekeeping, no AI needed: drops expired facts and one-off dates that have passed, and merges
   * near-duplicates in the same category (keeping the more detailed, more important one).
   * Returns how many notes were removed.
   */
  tidy(now = Date.now()): number {
    const before = this.notes.length
    let notes = this.notes.filter((n) => !this.expired(n, now) && !(n.date?.length === 10 && !n.pinned && daysUntil(n.date, now) < -1))
    const kept: MemoryNote[] = []
    for (const note of [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.importance - a.importance || b.text.length - a.text.length)) {
      const twin = kept.find((k) => k.category === note.category && overlap(k.text, note.text) >= MERGE)
      if (twin) {
        twin.uses += note.uses
        twin.createdAt = Math.min(twin.createdAt, note.createdAt)
        continue
      }
      kept.push(note)
    }
    notes = kept
    if (notes.length !== before) {
      this.notes = notes
      this.save()
    }
    return before - notes.length
  }

  setEpisode(sessionId: string, summary: string) {
    const clean = summary.replace(/\s+/g, ' ').trim().slice(0, 400)
    if (!clean || looksSensitive(clean)) return
    this.episodes = this.episodes.filter((e) => e.sessionId !== sessionId)
    this.episodes.push({ sessionId, summary: clean, at: Date.now() })
    writeJson(this.episodesFile, this.episodes)
  }

  removeEpisode(sessionId: string) {
    this.episodes = this.episodes.filter((e) => e.sessionId !== sessionId)
    writeJson(this.episodesFile, this.episodes)
  }

  recallEpisodes(query: string, exceptSession: string, limit = 2): Episode[] {
    const candidates = this.episodes.filter((e) => e.sessionId !== exceptSession)
    const scores = bm25(query, candidates.map((e) => e.summary))
    return candidates
      .map((episode, i) => ({ episode, score: scores[i] }))
      .filter((r) => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.episode)
  }

  /**
   * A human-readable copy (memory/MEMORY.md, like OpenClaw's), so the person or a family member can
   * read exactly what Morph remembers without opening the app. Rewritten after every change.
   */
  exportMarkdown(now = Date.now()) {
    const lines = ['# What Morph remembers', '', `_Updated ${new Date(now).toLocaleString('en-GB')}. This file is a copy; change memories in Morph._`, '']
    if (this.profile.about.trim()) lines.push('## About you', '', this.profile.about.trim(), '')
    const pinned = this.notes.filter((n) => n.pinned)
    if (pinned.length) lines.push('## Always remember', '', ...pinned.map((n) => `- ${n.text}`), '')
    for (const { id, label } of MEMORY_CATEGORIES) {
      const inCategory = this.notes.filter((n) => !n.pinned && n.category === id && !this.expired(n, now))
      if (inCategory.length) lines.push(`## ${label}`, '', ...inCategory.map((n) => `- ${n.text}${n.importance === 3 ? ' (important)' : ''}`), '')
    }
    try {
      writeFileSync(join(this.dir, 'MEMORY.md'), lines.join('\n'))
    } catch {
      // The JSON files are the source of truth; the mirror is a convenience.
    }
  }
}
