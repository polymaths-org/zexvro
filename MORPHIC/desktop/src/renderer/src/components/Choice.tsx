import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  name: string
  value: string
  checked: boolean
  onSelect: () => void
  children: ReactNode
  className?: string
}

/** A large radio option. Selection is shown with a border, a tint and the word "Chosen", never colour alone. */
export function Choice({ name, value, checked, onSelect, children, className = '' }: Props) {
  return (
    <label className={`choice ${className}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      {children}
      <span className="choice-tick absolute -top-3.5 right-4 items-center gap-1 rounded-full bg-[var(--action)] px-2.5 py-0.5 text-[0.8rem] font-bold text-[var(--action-fg)]">
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
        Chosen
      </span>
    </label>
  )
}
