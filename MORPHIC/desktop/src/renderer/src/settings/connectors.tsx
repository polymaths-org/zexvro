import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Globe, LogOut, Plug, Plus, Power, RotateCw, Terminal, Trash2 } from 'lucide-react'
import type { ConnectorStatus } from '@shared/core'
import { useSettings } from '@/settings'
import { core, useCoreEvent } from '@/lib/core'
import { browser } from '@/browser/browser'
import { Choice } from '@/components/Choice'
import { Section } from './sections'

function YesNo({ name, value, yes, no, onChange }: { name: string; value: boolean; yes: string; no: string; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((v) => (
        <Choice key={String(v)} name={name} value={v ? 'yes' : 'no'} checked={value === v} onSelect={() => onChange(v)} className="min-h-14 items-center justify-center px-3 pt-2">
          <span className="text-center text-[1rem] font-bold">{v ? yes : no}</span>
        </Choice>
      ))}
    </div>
  )
}

function BrowserConnector() {
  const { settings, update } = useSettings()
  const [signOut, setSignOut] = useState<'idle' | 'confirm' | 'done'>('idle')
  return (
    <Section title="Morph's browser" hint="Morph can use its own web browser to look things up and fill things in while you watch. It always asks before anything important.">
      <YesNo name="connector-browser" value={settings.browser} yes="Yes, Morph may browse" no="No browsing" onChange={(browser) => update({ browser })} />
      {settings.browser && (
        <>
          <p className="text-[1rem] font-bold">Ask me before Morph starts browsing?</p>
          <p className="-mt-2 text-[0.95rem] text-fg-muted">Either way, Morph always asks before paying, booking, sending or anything like that.</p>
          <YesNo name="connector-browser-ask" value={settings.askBeforeBrowsing} yes="Yes, ask me first" no="No, just start" onChange={(askBeforeBrowsing) => update({ askBeforeBrowsing })} />
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-quiet" onClick={() => browser.show()}>
          <Globe aria-hidden="true" />
          Open the browser
        </button>
        {signOut === 'confirm' ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              await browser.clearData()
              setSignOut('done')
            }}
          >
            <LogOut aria-hidden="true" />
            Yes, sign out of every website
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setSignOut('confirm')} disabled={signOut === 'done'}>
            {signOut === 'done' ? <Check aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            {signOut === 'done' ? 'Signed out everywhere' : 'Sign Morph’s browser out of all websites'}
          </button>
        )}
      </div>
    </Section>
  )
}

const STATE_TEXT: Record<ConnectorStatus['state'], string> = { off: 'Switched off', connecting: 'Connecting…', ready: 'Connected', error: "Couldn't connect" }

function ConnectorCard({ c }: { c: ConnectorStatus }) {
  const dot = c.state === 'ready' ? 'bg-emerald-400' : c.state === 'error' ? 'bg-[var(--ask)]' : 'bg-[var(--fg-muted)]'
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--field-border)] bg-[var(--field)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--selected)]">
          {c.kind === 'program' ? <Terminal aria-hidden="true" className="size-5 text-morph" /> : <Globe aria-hidden="true" className="size-5 text-morph" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[1.08rem] font-bold">{c.name}</span>
          <span className="flex items-center gap-2 text-[0.92rem] text-fg-muted">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
            {STATE_TEXT[c.state]}
            {c.state === 'ready' && ` · ${c.tools.length} ${c.tools.length === 1 ? 'tool' : 'tools'}`}
          </span>
          <span className="truncate font-mono text-[0.8rem] text-fg-muted">{c.kind === 'program' ? [c.command, ...(c.args ?? [])].join(' ') : c.url}</span>
        </div>
      </div>
      {c.error && <p className="text-[0.95rem] text-ask">{c.error}</p>}
      {c.tools.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${c.name} tools`}>
          {c.tools.map((t) => (
            <li key={t.name} title={t.description} className="rounded-full border border-[var(--field-border)] px-2.5 py-0.5 font-mono text-[0.82rem]">
              {t.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={() => core('connectors.setEnabled', c.id, !c.enabled)}>
          <Power aria-hidden="true" />
          {c.enabled ? 'Switch off' : 'Switch on'}
        </button>
        {c.state === 'error' && (
          <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={() => core('connectors.reconnect', c.id)}>
            <RotateCw aria-hidden="true" />
            Try again
          </button>
        )}
        <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" aria-label={`Remove ${c.name}`} onClick={() => core('connectors.remove', c.id)}>
          <Trash2 aria-hidden="true" />
          Remove
        </button>
      </div>
    </li>
  )
}

/** Splits "npx -y @scope/server --flag 'two words'" into command + args (quotes keep spaces). */
function splitCommand(line: string): string[] {
  return (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((part) => part.replace(/^["']|["']$/g, ''))
}

function AddConnector({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'program' | 'web'>('web')
  const [target, setTarget] = useState('')
  const [problem, setProblem] = useState('')
  if (!open) {
    return (
      <button type="button" className="btn btn-quiet self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Add a connector
      </button>
    )
  }
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border-2 border-[var(--morph)] p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const parts = splitCommand(target)
        const added = await core(
          'connectors.add',
          kind === 'program' ? { name, kind, command: parts[0], args: parts.slice(1) } : { name, kind, url: target.trim() }
        )
        if (!added) return setProblem('Please check the name (it must be new) and the address or program.')
        setProblem('')
        setName('')
        setTarget('')
        setOpen(false)
        onAdded()
      }}
    >
      <p className="flex items-start gap-2 text-[1rem]">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ask" />
        Only add connectors from people you trust. Morph will always ask you before using any of their tools.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="connector-name" className="text-[1rem] font-bold">
          Name
        </label>
        <input id="connector-name" className="field" value={name} maxLength={40} placeholder="For example, Pharmacy" onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[1rem] font-bold">What kind?</legend>
        <div className="grid grid-cols-2 gap-3">
          <Choice name="connector-kind" value="web" checked={kind === 'web'} onSelect={() => setKind('web')} className="min-h-14 items-center justify-center px-3 pt-2">
            <span className="text-center text-[1rem] font-bold">A web address</span>
          </Choice>
          <Choice name="connector-kind" value="program" checked={kind === 'program'} onSelect={() => setKind('program')} className="min-h-14 items-center justify-center px-3 pt-2">
            <span className="text-center text-[1rem] font-bold">A program on this computer</span>
          </Choice>
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="connector-target" className="text-[1rem] font-bold">
          {kind === 'web' ? 'Web address' : 'Program and what to give it'}
        </label>
        <input
          id="connector-target"
          className="field font-mono text-[1rem]"
          value={target}
          placeholder={kind === 'web' ? 'https://example.com/mcp' : 'npx -y @example/mcp-server'}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      {problem && <p className="text-[1rem] font-bold text-ask">{problem}</p>}
      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary">
          <Plug aria-hidden="true" />
          Connect
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function ConnectorsSection() {
  const [list, setList] = useState<ConnectorStatus[]>([])
  const refresh = useCallback(async () => setList(await core('connectors.list')), [])
  useEffect(() => {
    refresh()
  }, [refresh])
  useCoreEvent('connectors.changed', refresh)

  return (
    <>
      <BrowserConnector />
      <Section title="Connected apps" hint="Connect other apps and services to Morph using MCP, the open standard for this. Morph lists what each one can do, and asks you every time before using it.">
        {list.length === 0 ? (
          <p className="text-[1rem] text-fg-muted">No apps connected yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((c) => (
              <ConnectorCard key={c.id} c={c} />
            ))}
          </ul>
        )}
        <AddConnector onAdded={refresh} />
      </Section>
    </>
  )
}
