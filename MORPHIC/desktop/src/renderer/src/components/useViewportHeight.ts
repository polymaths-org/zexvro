import { useEffect, useState } from 'react'

export function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return height
}

/** Morph shrinks on short windows (small laptops) so the next button never falls below the fold. */
export function useMascotSize(max: number, min: number, share: number) {
  const height = useViewportHeight()
  return Math.round(Math.min(max, Math.max(min, height * share)))
}
