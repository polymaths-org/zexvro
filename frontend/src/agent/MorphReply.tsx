import React from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import type { MorphAction } from './morphActions'

/** Lightweight markdown-ish rendering for Morph replies */
export function MorphText({ text, dark }: { text: string; dark?: boolean }) {
  const parts: React.ReactNode[] = []
  const lines = text.split('\n')
  let inCode = false
  let code: string[] = []

  lines.forEach((line, lineIdx) => {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true
        code = []
      } else {
        parts.push(
          <pre
            key={`c-${lineIdx}`}
            className={`my-2 overflow-x-auto rounded-md border p-3 text-xs leading-5 ${
              dark
                ? 'border-white/10 bg-black/40 text-zinc-200'
                : 'border-zinc-200 bg-zinc-100 text-zinc-800'
            }`}
          >
            <code className="font-mono">{code.join('\n')}</code>
          </pre>,
        )
        inCode = false
        code = []
      }
      return
    }
    if (inCode) {
      code.push(line)
      return
    }

    let node: React.ReactNode = line
    if (line.includes('`')) {
      const segs = line.split(/`([^`]+)`/)
      node = segs.map((seg, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
              dark ? 'bg-white/10' : 'bg-zinc-200'
            }`}
          >
            {seg}
          </code>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )
    } else if (line.includes('**')) {
      const segs = line.split(/\*\*([^*]+)\*\*/)
      node = segs.map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {seg}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )
    }

    parts.push(
      <span key={`l-${lineIdx}`} className="block leading-6">
        {node || '\u00A0'}
      </span>,
    )
  })

  if (inCode && code.length) {
    parts.push(
      <pre
        key="c-final"
        className={`my-2 overflow-x-auto rounded-md border p-3 text-xs ${
          dark ? 'border-white/10 bg-black/40' : 'border-zinc-200 bg-zinc-100'
        }`}
      >
        <code className="font-mono">{code.join('\n')}</code>
      </pre>,
    )
  }

  return <div className="text-sm">{parts}</div>
}

export function MorphActionButtons({
  actions,
  onNavigate,
  dark,
  compact,
}: {
  actions: MorphAction[]
  onNavigate: (path: string) => void
  dark?: boolean
  compact?: boolean
}) {
  if (!actions.length) return null
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
      {actions.map((a, i) => {
        const primary = i === 0
        return (
          <button
            key={`${a.id}-${a.path}`}
            type="button"
            onClick={() => onNavigate(a.path)}
            className={
              primary
                ? 'inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-400'
                : dark
                  ? 'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/10'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50'
            }
          >
            {primary ? <Sparkles className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

export function MorphReply({
  text,
  actions,
  onNavigate,
  dark,
}: {
  text: string
  actions: MorphAction[]
  onNavigate: (path: string) => void
  dark?: boolean
}) {
  return (
    <div>
      <MorphText text={text} dark={dark} />
      <MorphActionButtons actions={actions} onNavigate={onNavigate} dark={dark} />
    </div>
  )
}
