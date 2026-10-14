import type { TextSize } from '@shared/settings'

export const SIZE_LABELS: Record<TextSize, string> = {
  regular: 'Regular',
  large: 'Large',
  'extra-large': 'Extra large'
}

/** Fixed pixel samples so the three options always look different, whatever size is active. */
export const SIZE_SAMPLE_PX: Record<TextSize, number> = { regular: 26, large: 32, 'extra-large': 39 }
