import type { ReactNode } from 'react'

type Block = { kind: 'p'; lines: string[] } | { kind: 'ol' | 'ul'; items: string[]; start: number }

const NUMBERED = /^(\d+)[.)]\s+(.*)$/
const BULLET = /^[-•*]\s+(.*)$/

/**
 * Groups lines into paragraphs and lists. List items stay in one list even when the model puts blank
 * lines between them (it often does), so steps read 1, 2, 3 instead of 1, 1, 1.
 */
function parse(text: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', lines: paragraph })
    paragraph = []
  }
  for (const raw of text.trim().split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const numbered = line.match(NUMBERED)
    const bullet = numbered ? null : line.match(BULLET)
    if (!numbered && !bullet) {
      paragraph.push(line)
      continue
    }
    flush()
    const kind = numbered ? 'ol' : 'ul'
    const item = numbered ? numbered[2] : bullet![1]
    const last = blocks.at(-1)
    if (last && last.kind === kind) last.items.push(item)
    else blocks.push({ kind, items: [item], start: numbered ? Number(numbered[1]) : 1 })
  }
  flush()
  return blocks
}

/** **bold** → <strong>; everything else stays plain text (no HTML is ever injected). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  )
}

/** Morph is asked for plain text, but models still slip into lists and bold; render those readably. */
export function MessageText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {parse(text).map((block, b) => {
        if (block.kind === 'p') {
          return (
            <p key={b} className="whitespace-pre-line">
              {inline(block.lines.join('\n'))}
            </p>
          )
        }
        const List = block.kind
        return (
          <List
            key={b}
            start={block.kind === 'ol' ? block.start : undefined}
            className={`flex flex-col gap-1.5 pl-6 ${block.kind === 'ol' ? 'list-decimal' : 'list-disc'}`}
          >
            {block.items.map((item, i) => (
              <li key={i} className="pl-1">
                {inline(item)}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
