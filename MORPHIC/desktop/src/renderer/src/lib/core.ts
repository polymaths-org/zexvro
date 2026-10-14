import { useEffect, useRef } from 'react'
import type { CoreEvent } from '@shared/core'

/** Calls MORPHIC Core (through the host's allow-listed bridge). */
export const core = window.morphic.core

/** Runs `handler` for every Core event of the given type while the component is mounted. */
export function useCoreEvent<T extends CoreEvent['type']>(type: T, handler: (event: Extract<CoreEvent, { type: T }>) => void) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(
    () =>
      window.morphic.onCoreEvent((event) => {
        if (event.type === type) latest.current(event as Extract<CoreEvent, { type: T }>)
      }),
    [type]
  )
}
