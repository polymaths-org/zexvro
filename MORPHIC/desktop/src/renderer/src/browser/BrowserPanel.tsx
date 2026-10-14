import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, BookOpen, Globe, Hand, Lock, RotateCw, X } from 'lucide-react'
import { MorphMark } from '@/components/MorphMark'
import { useSessions } from '@/chat/sessions'
import { browser, useBrowser } from './browser'

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Browser mode's centre stage: one toolbar row, then the page in a 16:9 frame that fills the space it
 * has. The page itself is a native view drawn by the main process exactly over the frame's placeholder.
 */
export function BrowserStage() {
  const state = useBrowser()
  const { send, stop, current, thinking } = useSessions()
  const area = useRef<HTMLDivElement>(null)
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setAddress(state.url)
  }, [state.url, editing])

  // Keep the native view glued to the 16:9 placeholder as the layout changes.
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const report = () => {
      const r = el.getBoundingClientRect()
      browser.setBounds({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    addEventListener('resize', report)
    // The stage animates in; report again once it has settled.
    const t = setTimeout(report, 450)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      removeEventListener('resize', report)
      browser.setBounds(null)
    }
  }, [])

  const secure = state.url.startsWith('https://')
  const busy = current ? thinking.has(current.id) : false

  return (
    <motion.section
      aria-label="Morph's browser"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="@container flex min-w-0 flex-1 flex-col gap-3"
    >
      {/* One row: who is in control (always clear), page controls, address. */}
      {/* Two rows when narrow (status + buttons, then address), one row when there's room. */}
      <div role="status" className={`glass flex flex-wrap items-center gap-2 rounded-[1.25rem] px-3 py-2 ${state.driving ? 'border-[var(--morph)]' : ''}`}>
        <span className="mr-auto flex items-center gap-2.5 pr-1 text-[1rem] font-bold @min-[52rem]:mr-0">
          {state.driving ? <MorphMark size={28} thinking /> : <Globe aria-hidden="true" className="size-5 text-morph" />}
          {state.driving ? 'Morph is browsing' : "You're browsing"}
        </span>
        <button type="button" className="order-2 btn btn-quiet min-h-10 shrink-0 px-2.5 @min-[52rem]:order-none" disabled={!state.canGoBack} onClick={() => browser.back()} aria-label="Back">
          <ArrowLeft aria-hidden="true" />
        </button>
        <button type="button" className="order-2 btn btn-quiet min-h-10 shrink-0 px-2.5 @min-[52rem]:order-none" disabled={!state.canGoForward} onClick={() => browser.forward()} aria-label="Forward">
          <ArrowRight aria-hidden="true" />
        </button>
        <button type="button" className="order-2 btn btn-quiet min-h-10 shrink-0 px-2.5 @min-[52rem]:order-none" onClick={() => browser.reload()} aria-label="Reload">
          <RotateCw aria-hidden="true" className={state.loading ? 'animate-spin' : ''} />
        </button>
        <form
          className="relative order-2 min-w-[10rem] flex-1 @min-[52rem]:order-none"
          onSubmit={(e) => {
            e.preventDefault()
            setEditing(false)
            if (address.trim()) browser.navigate(address.trim())
          }}
        >
          {secure && !editing && <Lock aria-label="Secure connection" className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />}
          <label htmlFor="browser-address" className="sr-only">
            Web address
          </label>
          <input
            id="browser-address"
            className={`field min-h-10 rounded-full text-[0.98rem] ${secure && !editing ? 'pl-9' : ''}`}
            value={editing ? address : hostOf(state.url) || ''}
            placeholder="Type a website or a question"
            onFocus={(e) => {
              setEditing(true)
              setAddress(state.url)
              requestAnimationFrame(() => e.target.select())
            }}
            onBlur={() => setEditing(false)}
            onChange={(e) => setAddress(e.target.value)}
          />
        </form>
        {state.driving && busy ? (
          <button type="button" className="btn btn-quiet min-h-10 px-3.5 text-[0.9rem]" onClick={stop}>
            <Hand aria-hidden="true" />
            Take over
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-quiet min-h-10 px-3.5 text-[0.9rem]"
            aria-label="Explain this page"
            disabled={!state.url || busy}
            onClick={async () => {
              // Hand the page's words to Morph so it can explain them simply.
              const page = await browser.snapshot()
              if (page) send(`Please explain this web page to me in simple words.\n${page.title}\n${page.url}\n\n${page.text.slice(0, 3000)}`)
            }}
          >
            <BookOpen aria-hidden="true" />
            Explain<span className="-ml-1.5 @max-[40rem]:hidden">&nbsp;this page</span>
          </button>
        )}
        <button type="button" className="btn btn-quiet min-h-10 px-3 text-[0.9rem]" onClick={() => browser.close()} aria-label="Close the browser">
          <X aria-hidden="true" />
          <span className="@max-[34rem]:hidden">Close</span>
        </button>
      </div>

      {/* The 16:9 frame: as large as fits, centred. cq units = the size of this container. */}
      <div className="grid min-h-0 flex-1 content-start justify-items-center [container-type:size]">
        <div
          ref={area}
          className="aspect-video rounded-[1.25rem] bg-[var(--field)] shadow-[0_30px_80px_-30px_var(--glass-shadow)] ring-1 ring-[var(--glass-border)]"
          style={{ width: 'min(100cqw, calc(100cqh * 16 / 9))' }}
        >
          {/* While an in-app window covers the browser, a still picture stands in for it. */}
          {state.still && <img src={state.still} alt="" className="size-full rounded-[1.25rem] object-cover object-top opacity-80" />}
        </div>
      </div>
    </motion.section>
  )
}
