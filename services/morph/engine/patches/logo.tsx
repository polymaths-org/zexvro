import { RGBA, TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { tint, useTheme } from "../context/theme"
import { logoArt, logoArtCompact, logoArtFull } from "../logo"

const INTRO_MS = 1100
const IDLE_FPS = 24

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

function pickArt(height: number, width: number): readonly string[] {
  // Leave room for prompt + chrome (~12 rows, ~8 cols padding).
  if (height < 28 || width < 52) return logoArtCompact
  if (height >= 52 && width >= 100) return logoArtFull
  return logoArt
}

function maskLine(
  line: string,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  edge: number,
): string {
  if (radius <= 0) return " ".repeat(line.length)
  let out = ""
  for (let x = 0; x < line.length; x++) {
    const ch = line[x]!
    if (ch === " ") {
      out += " "
      continue
    }
    const d = Math.hypot(x - cx, (y - cy) * 2)
    if (d <= radius - edge) out += ch
    else if (d <= radius) {
      const frac = (radius - d) / edge
      out += frac > 0.45 ? ch : "░"
    } else out += " "
  }
  return out
}

/**
 * Morph brand mark from assets/ascii-art.txt.
 * Startup: radial reveal from center. Idle: soft cyan shimmer.
 */
export function Logo() {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const [progress, setProgress] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const [introDone, setIntroDone] = createSignal(false)

  onMount(() => {
    const start = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const t = now - start
      if (!introDone()) {
        const p = easeOutCubic(t / INTRO_MS)
        setProgress(p)
        if (t >= INTRO_MS) {
          setProgress(1)
          setIntroDone(true)
        }
      }
      setElapsed(t)
    }, 1000 / IDLE_FPS)

    onCleanup(() => clearInterval(timer))
  })

  // Stable art selection (only changes on terminal resize)
  const art = createMemo(() => pickArt(dimensions().height, dimensions().width))

  const geometry = createMemo(() => {
    const lines = art()
    const h = lines.length
    const w = Math.max(0, ...lines.map((l) => l.length))
    const cx = (w - 1) / 2
    const cy = (h - 1) / 2
    const maxR = Math.hypot(cx, cy * 2) + 1.5
    return { lines, h, w, cx, cy, maxR }
  })

  // Stable row keys so Solid For does not remount every frame
  const rows = createMemo(() =>
    geometry().lines.map((line, y) => ({
      y,
      line,
      key: `${geometry().h}x${geometry().w}:${y}`,
    })),
  )

  const baseFg = createMemo(() => theme.primary ?? theme.text)

  const displayLine = (y: number, line: string) => {
    const p = progress()
    if (p >= 1) return line
    const { cx, cy, maxR } = geometry()
    return maskLine(line, y, cx, cy, p * maxR, 2.2)
  }

  const lineColor = (index: number): RGBA => {
    const base = baseFg()
    const t = elapsed() / 1000
    if (!introDone()) {
      const glow = 0.55 + 0.45 * progress()
      return tint(theme.background, base, glow)
    }
    // Idle: traveling vertical shimmer + gentle breath
    const wave = 0.5 + 0.5 * Math.sin(t * 2.1 - index * 0.38)
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9)
    const amount = 0.72 + 0.18 * wave + 0.1 * breath
    return tint(theme.background, base, amount)
  }

  return (
    <box flexDirection="column" alignItems="center">
      <For each={rows()}>
        {(row) => (
          <text fg={lineColor(row.y)} attributes={TextAttributes.BOLD} selectable={false}>
            {displayLine(row.y, row.line)}
          </text>
        )}
      </For>
    </box>
  )
}
