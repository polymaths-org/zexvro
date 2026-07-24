import React, { useState } from 'react'
import { ArrowUpRight, Check, Copy, Sparkles } from 'lucide-react'
import type { MorphAction } from './morphActions'

/** Inline: **bold**, *italic*, `code`, [links](url) — order matters */
function renderInline(text: string, dark?: boolean, keyPrefix = 'i'): React.ReactNode[] {
  // Split on code, links, bold, italic (non-greedy)
  const re =
    /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(<span key={`${keyPrefix}-t${k++}`}>{text.slice(last, m.index)}</span>)
    }
    const token = m[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${k++}`}
          className={`rounded px-1 py-0.5 font-mono text-[0.8em] ${
            dark ? 'bg-white/10 text-violet-200' : 'bg-zinc-200/80 text-violet-800'
          }`}
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (lm) {
        nodes.push(
          <a
            key={`${keyPrefix}-a${k++}`}
            href={lm[2]}
            target="_blank"
            rel="noreferrer"
            className={
              dark
                ? 'text-violet-300 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200'
                : 'text-violet-600 underline decoration-violet-300 underline-offset-2 hover:text-violet-700'
            }
          >
            {lm[1]}
          </a>,
        )
      } else {
        nodes.push(<span key={`${keyPrefix}-x${k++}`}>{token}</span>)
      }
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b${k++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      // *italic* or _italic_
      const inner = token.startsWith('_') ? token.slice(1, -1) : token.slice(1, -1)
      nodes.push(
        <em key={`${keyPrefix}-e${k++}`} className="italic opacity-90">
          {inner}
        </em>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) {
    nodes.push(<span key={`${keyPrefix}-t${k++}`}>{text.slice(last)}</span>)
  }
  return nodes.length ? nodes : [<span key={`${keyPrefix}-empty`}>{text}</span>]
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'hr' }
  | { type: 'blank' }

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    // fenced code
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trimStart().startsWith('```')) {
        body.push(lines[i]!)
        i++
      }
      i++ // closing fence
      blocks.push({ type: 'code', lang, lines: body })
      continue
    }

    // blank
    if (!line.trim()) {
      blocks.push({ type: 'blank' })
      i++
      continue
    }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // heading
    const hm = line.match(/^(#{1,4})\s+(.*)$/)
    if (hm) {
      blocks.push({ type: 'h', level: hm[1]!.length, text: hm[2]!.trim() })
      i++
      continue
    }

    // unordered list run
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // ordered list run
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // paragraph: merge soft-wrapped lines until blank / special
    let para = line
    i++
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !lines[i]!.trimStart().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]!) &&
      !/^\s*[-*•]\s+/.test(lines[i]!) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]!) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i]!.trim())
    ) {
      para += ' ' + lines[i]!.trim()
      i++
    }
    blocks.push({ type: 'p', text: para })
  }

  return blocks
}

/** Subtle markdown for chat bubbles — not a full docs site */
export function MorphText({ text, dark }: { text: string; dark?: boolean }) {
  const blocks = parseBlocks(text)
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500'
  const border = dark ? 'border-white/10' : 'border-zinc-200/80'
  const codeBg = dark ? 'bg-black/35 text-zinc-200' : 'bg-zinc-100 text-zinc-800'

  return (
    <div className="space-y-2 text-[13px] leading-relaxed sm:text-sm">
      {blocks.map((b, idx) => {
        if (b.type === 'blank') {
          return <div key={idx} className="h-0.5" aria-hidden />
        }
        if (b.type === 'hr') {
          return <hr key={idx} className={`my-2 border-0 border-t ${border}`} />
        }
        if (b.type === 'h') {
          // Chat-scale headings: never huge
          const cls =
            b.level <= 1
              ? 'text-[15px] font-semibold tracking-tight'
              : b.level === 2
                ? 'text-[14px] font-semibold tracking-tight'
                : 'text-[13px] font-semibold tracking-tight'
          return (
            <div
              key={idx}
              className={`${cls} ${idx > 0 ? 'pt-1' : ''} ${dark ? 'text-white' : 'text-zinc-900'}`}
            >
              {renderInline(b.text, dark, `h${idx}`)}
            </div>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={idx} className={`my-0.5 list-none space-y-1 pl-0 ${muted}`}>
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span
                    className={`mt-[0.55em] h-1 w-1 shrink-0 rounded-full ${
                      dark ? 'bg-violet-400/80' : 'bg-violet-500/70'
                    }`}
                    aria-hidden
                  />
                  <span className={dark ? 'text-zinc-100' : 'text-zinc-800'}>
                    {renderInline(item, dark, `u${idx}-${j}`)}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={idx} className="my-0.5 list-none space-y-1 pl-0">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span
                    className={`w-4 shrink-0 pt-px text-right font-mono text-[11px] tabular-nums ${muted}`}
                  >
                    {j + 1}.
                  </span>
                  <span className={dark ? 'text-zinc-100' : 'text-zinc-800'}>
                    {renderInline(item, dark, `o${idx}-${j}`)}
                  </span>
                </li>
              ))}
            </ol>
          )
        }
        if (b.type === 'code') {
          return (
            <pre
              key={idx}
              className={`my-1.5 overflow-x-auto rounded-lg border px-2.5 py-2 font-mono text-[11px] leading-5 ${border} ${codeBg}`}
            >
              {b.lang ? (
                <div className={`mb-1 text-[10px] uppercase tracking-wide ${muted}`}>{b.lang}</div>
              ) : null}
              <code>{b.lines.join('\n')}</code>
            </pre>
          )
        }
        // paragraph
        return (
          <p key={idx} className={`m-0 ${dark ? 'text-zinc-100' : 'text-zinc-800'}`}>
            {renderInline(b.text, dark, `p${idx}`)}
          </p>
        )
      })}
    </div>
  )
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  if (!actions.length) return null

  const run = async (a: MorphAction) => {
    if (a.kind === 'copy' && a.copyText) {
      try {
        await navigator.clipboard.writeText(a.copyText)
        setCopiedId(a.id)
        window.setTimeout(() => setCopiedId(null), 1600)
      } catch {
        /* ignore */
      }
      return
    }
    if (a.path) onNavigate(a.path)
  }

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <p
        className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${
          dark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        Do this next
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => {
          const primary = i === 0 && a.kind !== 'copy'
          const isCopy = a.kind === 'copy' || Boolean(a.copyText)
          const done = copiedId === a.id
          return (
            <button
              key={`${a.id}-${a.path || a.copyText || i}`}
              type="button"
              onClick={() => void run(a)}
              className={
                primary
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-400'
                  : dark
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/10'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50'
              }
            >
              {isCopy ? (
                done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />
              ) : primary ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <ArrowUpRight className="h-3 w-3" />
              )}
              {done ? 'Copied' : a.label}
            </button>
          )
        })}
      </div>
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
    <div className="min-w-0">
      <MorphText text={text} dark={dark} />
      <MorphActionButtons actions={actions} onNavigate={onNavigate} dark={dark} />
    </div>
  )
}
