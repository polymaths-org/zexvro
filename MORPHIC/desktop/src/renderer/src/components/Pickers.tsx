import { Monitor, Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import { PALETTES, TEXT_SIZES, type ThemeChoice } from '@shared/settings'
import { useSettings } from '@/settings'
import { PALETTE_LABELS } from '@/palettes'
import { SIZE_LABELS, SIZE_SAMPLE_PX } from '@/textSize'
import { speak, stopSpeaking } from '@/speech'
import { Choice } from './Choice'
import { MorphMark } from './MorphMark'

const MODES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match my computer', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]

/** Colour themes. Each swatch carries its own data-palette, so it previews that theme in place. */
export function PalettePicker({ name, columns = 3, compact = false }: { name: string; columns?: 3 | 4; compact?: boolean }) {
  const { settings, update } = useSettings()
  return (
    <div className={`grid gap-3 pt-1 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {PALETTES.map((palette) => (
        <Choice
          key={palette}
          name={name}
          value={palette}
          checked={settings.palette === palette}
          onSelect={() => update({ palette })}
          className="flex-col items-stretch gap-2 p-2"
        >
          {/* Just Morph in the theme's own colours, on that theme's background glow. */}
          <span
            data-palette={palette}
            aria-hidden="true"
            className={`grid place-items-center rounded-[0.9rem] border border-[var(--glass-border)] ${compact ? 'h-16' : 'h-20'}`}
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 115%, var(--haze), transparent 70%), linear-gradient(180deg, var(--bg-top), var(--bg))' }}
          >
            <MorphMark size={compact ? 44 : 52} still />
          </span>
          <span className="pb-1 text-center text-[0.9rem] leading-tight font-bold">{PALETTE_LABELS[palette]}</span>
        </Choice>
      ))}
    </div>
  )
}

export function ModePicker({ name, layout = 'stack' }: { name: string; layout?: 'stack' | 'row' }) {
  const { settings, update } = useSettings()
  return (
    <div className={layout === 'row' ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-4'}>
      {MODES.map(({ value, label, icon: Icon }) => (
        <Choice
          key={value}
          name={name}
          value={value}
          checked={settings.theme === value}
          onSelect={() => update({ theme: value })}
          // Row cards leave room at the top for the "Chosen" badge that sits on the border.
          className={layout === 'row' ? 'min-h-[4.5rem] items-center justify-center gap-2.5 px-3 pt-2.5 pb-1.5' : 'min-h-16 items-center gap-3 px-4'}
        >
          <Icon aria-hidden="true" className="size-6 shrink-0 text-morph" />
          <span className="text-[1rem] leading-tight font-bold">{label}</span>
        </Choice>
      ))}
    </div>
  )
}

/** Text size. Choosing applies instantly to the whole app (everything is sized in rem). */
export function TextSizePicker({ name, compact = false }: { name: string; compact?: boolean }) {
  const { settings, update } = useSettings()
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEXT_SIZES.map((size) => (
        <Choice
          key={size}
          name={name}
          value={size}
          checked={settings.textSize === size}
          onSelect={() => update({ textSize: size })}
          className={`flex-col items-center justify-center gap-1 px-2 pb-3 ${compact ? 'min-h-24 pt-4' : 'min-h-28 pt-5'}`}
        >
          {/* Fixed pixel samples so the three options always look different, whatever size is active. */}
          <span aria-hidden="true" className="font-display leading-none font-semibold" style={{ fontSize: SIZE_SAMPLE_PX[size] }}>
            Aa
          </span>
          <span className="text-center text-[0.95rem] font-bold">{SIZE_LABELS[size]}</span>
        </Choice>
      ))}
    </div>
  )
}

/** Read out loud yes/no. Choosing "Yes" says a short confirmation so people hear what it sounds like. */
export function ReadAloudPicker({ name, tall = false }: { name: string; tall?: boolean }) {
  const { settings, update } = useSettings()
  const shape = tall ? 'min-h-28 flex-col justify-end gap-3 p-5' : 'min-h-20 items-center gap-3 px-4'
  return (
    <div className="grid grid-cols-2 gap-3">
      <Choice
        name={name}
        value="yes"
        checked={settings.readAloud}
        onSelect={() => {
          update({ readAloud: true })
          speak("Okay. I'll read things out loud for you.")
        }}
        className={shape}
      >
        <Volume2 aria-hidden="true" className={`${tall ? 'size-8' : 'size-6'} shrink-0 text-morph`} />
        <span className="text-[1.05rem] font-bold">{tall ? 'Yes, read out loud' : 'Yes'}</span>
      </Choice>
      <Choice
        name={name}
        value="no"
        checked={!settings.readAloud}
        onSelect={() => {
          stopSpeaking()
          update({ readAloud: false })
        }}
        className={shape}
      >
        <VolumeX aria-hidden="true" className={`${tall ? 'size-8' : 'size-6'} shrink-0 text-morph`} />
        <span className="text-[1.05rem] font-bold">{tall ? 'No, just show the words' : 'No'}</span>
      </Choice>
    </div>
  )
}
