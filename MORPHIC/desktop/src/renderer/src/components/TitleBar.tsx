import type { ReactNode } from 'react'

/**
 * Draggable top strip. On Windows/Linux the native window buttons are drawn over its right edge
 * (window controls overlay), on macOS the traffic lights sit at its left, so both sides leave room.
 */
export function TitleBar({ children }: { children?: ReactNode }) {
  return (
    <header
      className="titlebar relative z-20 flex h-14 shrink-0 items-center gap-4 pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)+1rem)] pl-6 in-data-[platform=darwin]:pl-24"
    >
      <span className="wordmark select-none text-fg-muted">MORPH</span>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  )
}
