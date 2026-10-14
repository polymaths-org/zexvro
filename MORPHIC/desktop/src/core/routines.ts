import { join } from 'node:path'
import type { Routine, Task } from '@shared/core'
import { looksSensitive, overlap } from './memory'
import { newId, readJson, writeJson } from './store'

/**
 * Learned routines ("things I've learned to do"): when a browsing task goes well, Morph keeps the steps
 * that worked, keyed by website and goal. Next time a similar task starts, the steps are given to the
 * model as a guide, so it needs fewer guesses (and fewer calls) on a site it already knows.
 *
 * Steps are stored without what was typed ("Typed into “Name”", never the name itself), and nothing that
 * looks private is kept. The person can delete routines on the memory page.
 */

const MAX_ROUTINES = 50
const MAX_STEPS = 12
/** How alike two goals must be to count as the same routine. */
const SAME_GOAL = 0.6
const SIMILAR_GOAL = 0.5

/** Turns a task's step log into reusable, private-free steps. */
export function generalise(steps: Task['steps']): string[] {
  return steps
    .filter((s) => s.status === 'done' && !/^You (did a step|typed something)/.test(s.text))
    .map((s) => s.text.replace(/^Typed “[^”]*” into/, 'Typed into').replace(/^Chose “[^”]*” in/, 'Chose an option in'))
    .filter((text) => !looksSensitive(text))
    .slice(0, MAX_STEPS)
}

export class Routines {
  private file: string
  private items: Routine[]

  constructor(dataDir: string) {
    this.file = join(dataDir, 'routines.json')
    this.items = readJson<Routine[]>(this.file, [])
  }

  private save() {
    writeJson(this.file, this.items)
  }

  /** Most used first. */
  list(): Routine[] {
    return [...this.items].sort((a, b) => b.uses - a.uses || b.updatedAt - a.updatedAt)
  }

  delete(id: string) {
    this.items = this.items.filter((r) => r.id !== id)
    this.save()
  }

  clear() {
    this.items = []
    this.save()
  }

  /** Saves (or refreshes) a routine after a task finished well. Needs at least two useful steps. */
  learn(goal: string, site: string, steps: Task['steps'], now = Date.now()): Routine | null {
    const clean = generalise(steps)
    const cleanGoal = goal.replace(/\s+/g, ' ').trim().slice(0, 200)
    if (clean.length < 2 || !cleanGoal || !site || looksSensitive(cleanGoal)) return null
    const same = this.items.find((r) => r.site === site && overlap(r.goal, cleanGoal) >= SAME_GOAL)
    if (same) {
      same.steps = clean
      same.uses += 1
      same.updatedAt = now
      this.save()
      return same
    }
    const routine: Routine = { id: newId(), goal: cleanGoal, site, steps: clean, uses: 1, createdAt: now, updatedAt: now }
    this.items.push(routine)
    // Keep the list small: drop the least used, oldest routines first.
    if (this.items.length > MAX_ROUTINES) {
      this.items.sort((a, b) => b.uses - a.uses || b.updatedAt - a.updatedAt)
      this.items.length = MAX_ROUTINES
    }
    this.save()
    return routine
  }

  /** The best routine for a goal (and website, if known), or null if nothing is close enough. */
  find(goal: string, site?: string): Routine | null {
    let best: { routine: Routine; score: number } | null = null
    for (const routine of this.items) {
      if (site && routine.site !== site) continue
      const score = overlap(routine.goal, goal)
      if (score >= SIMILAR_GOAL && (!best || score > best.score)) best = { routine, score }
    }
    return best?.routine ?? null
  }
}
