import { useState } from 'react'
import { Check, PenLine, Trash2, X } from 'lucide-react'
import { useSessions } from '@/chat/sessions'
import { ConfirmDialog } from '@/components/ConfirmDialog'

/** The open conversation's name, with Rename and Delete as visible, labelled buttons (never hidden menus). */
export function ConversationHeader() {
  const { current, rename, remove } = useSessions()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [confirming, setConfirming] = useState(false)
  if (!current) return null

  if (editing) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          rename(title)
          setEditing(false)
        }}
      >
        <label htmlFor="rename" className="sr-only">
          Conversation name
        </label>
        <input
          id="rename"
          autoFocus
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          className="field min-h-11 max-w-[28rem] flex-1 text-[1.05rem]"
        />
        <button type="submit" className="btn btn-primary min-h-11 px-4 text-[0.95rem]">
          <Check aria-hidden="true" />
          Save
        </button>
        <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={() => setEditing(false)}>
          <X aria-hidden="true" />
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1 className="mr-2 min-w-0 truncate font-display text-[1.2rem] font-semibold">{current.title}</h1>
      <button
        type="button"
        className="btn btn-quiet min-h-11 shrink-0 px-4 text-[0.95rem]"
        onClick={() => {
          setTitle(current.title)
          setEditing(true)
        }}
      >
        <PenLine aria-hidden="true" />
        Rename
      </button>
      <button type="button" className="btn btn-quiet min-h-11 shrink-0 px-4 text-[0.95rem]" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" />
        Delete
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this conversation?"
          body={`“${current.title}” will be removed from this computer. This can't be undone.`}
          confirmLabel="Delete conversation"
          cancelLabel="Keep it"
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
