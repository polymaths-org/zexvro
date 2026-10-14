import { useEffect, useRef } from 'react'
import { MARK_LEFT, MARK_RIGHT, MARK_VIEWBOX } from './mark'

const GRID = 46
const FLIGHT_MS = 640
const STAGGER_MS = 720

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

interface Particle {
  sx: number
  sy: number
  tx: number
  ty: number
  delay: number
}

/**
 * First-launch intro: Morph's mark assembles from pixels drifting in from the top right,
 * the logo's pixel dissolve played in reverse. Draws on a canvas twice the mark's size so
 * pixels can fly in from outside it; calls onDone once every pixel has landed.
 */
export function PixelAssemble({ size, onDone }: { size: number; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pad = size / 2
    const full = size + pad * 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = full * dpr
    canvas.height = full * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    // Rasterise the mark at grid resolution; every filled cell becomes one pixel.
    const grid = document.createElement('canvas')
    grid.width = grid.height = GRID
    const g = grid.getContext('2d', { willReadFrequently: true })
    if (!g) return
    const k = GRID / MARK_VIEWBOX.size
    g.setTransform(k, 0, 0, k, -MARK_VIEWBOX.x * k, -MARK_VIEWBOX.y * k)
    g.fill(new Path2D(MARK_LEFT))
    g.fill(new Path2D(MARK_RIGHT))
    const alpha = g.getImageData(0, 0, GRID, GRID).data

    const cell = size / GRID
    const particles: Particle[] = []
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        if (alpha[(gy * GRID + gx) * 4 + 3] < 110) continue
        const tx = pad + gx * cell
        const ty = pad + gy * cell
        // Bottom-left lands first, top-right last: the reverse of the logo's dissolve.
        const order = (gx - gy + GRID) / (2 * GRID)
        const drift = 0.15 + Math.random() * 0.3
        particles.push({
          tx,
          ty,
          sx: tx + size * drift,
          sy: ty - size * drift * (0.7 + Math.random() * 0.6),
          delay: order * STAGGER_MS + Math.random() * 160
        })
      }
    }

    const styles = getComputedStyle(document.documentElement)
    const fill = ctx.createLinearGradient(0, pad, 0, pad + size)
    fill.addColorStop(0, styles.getPropertyValue('--morph-hi').trim())
    fill.addColorStop(1, styles.getPropertyValue('--morph-deep').trim())

    let frame = 0
    const start = performance.now()
    const draw = (now: number) => {
      ctx.clearRect(0, 0, full, full)
      ctx.fillStyle = fill
      let landed = 0
      for (const p of particles) {
        const t = Math.min(1, Math.max(0, (now - start - p.delay) / FLIGHT_MS))
        if (t === 0) continue
        if (t === 1) landed++
        const e = easeOutCubic(t)
        const s = cell * (0.4 + 0.46 * e)
        ctx.globalAlpha = Math.min(1, t * 1.6)
        ctx.fillRect(p.sx + (p.tx - p.sx) * e, p.sy + (p.ty - p.sy) * e, s, s)
      }
      if (landed === particles.length) {
        doneRef.current()
        return
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ width: size * 2, height: size * 2, left: -size / 2, top: -size / 2 }}
    />
  )
}
