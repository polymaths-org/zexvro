let ctx: CanvasRenderingContext2D | null = null

/** Resolves any CSS colour (oklch, color-mix, …) to sRGB 0–255 by painting one pixel. Alpha is dropped. */
export function cssToRgb(cssColor: string): [number, number, number] {
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return [0, 0, 0]
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000'
  ctx.fillStyle = cssColor.trim() || '#000'
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

export function cssToHex(cssColor: string): string {
  return `#${cssToRgb(cssColor)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

/** Reads a custom property from the root element (e.g. "--bg") as sRGB 0–1, ready for a shader uniform. */
export function tokenRgb(name: string): [number, number, number] {
  const [r, g, b] = cssToRgb(getComputedStyle(document.documentElement).getPropertyValue(name))
  return [r / 255, g / 255, b / 255]
}
