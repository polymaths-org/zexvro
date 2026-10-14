import type { ActionRecord, Approval, Plan, Task } from './core'

export type Speaker = 'you' | 'morph'

export interface Message {
  id: string
  role: Speaker
  text: string
  at: number
  /** Morph couldn't answer (VROAI unreachable or errored). Shown with a "Try again" button. */
  failed?: boolean
  /** The person pressed Stop before Morph answered. */
  stopped?: boolean
  /** What Morph did alongside this answer (reminders set, things remembered…). */
  actions?: ActionRecord[]
  /** A step-by-step checklist the person can tick off. */
  plan?: Plan
  /** Something Morph wants to do that needs the person's OK first. */
  approval?: Approval
  /** A browsing task Morph is doing (or did) in its built-in browser. */
  task?: Task
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  /** Compaction: a summary of messages before `summarizedUpTo`, used instead of them in prompts. */
  summary?: string
  summarizedUpTo?: number
  /** Memory: messages before this index have already been reflected on. */
  reflectedUpTo?: number
}

export interface SessionSummary {
  id: string
  title: string
  updatedAt: number
}

export const UNTITLED = 'New conversation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Session ids become file names, so only accept real UUIDs. */
export const isSessionId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

/** A conversation is named after the first thing the person asked, cut at a word boundary. */
export function titleFrom(text: string, max = 48): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean || UNTITLED
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.:;!?-]+$/, '')}…`
}
