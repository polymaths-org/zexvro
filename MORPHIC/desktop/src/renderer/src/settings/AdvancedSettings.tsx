import { useId } from 'react'
import { RotateCcw } from 'lucide-react'
import { ADVANCED_RANGES, DEFAULT_ADVANCED, type Advanced, type Animations, type BgMotion } from '@shared/settings'
import { useSettings } from '@/settings'
import { Choice } from '@/components/Choice'
import { MorphMark } from '@/components/MorphMark'

type NumericKey = keyof typeof ADVANCED_RANGES

const blurWord = (v: number) => (v === 0 ? 'None' : v <= 10 ? 'Light' : v <= 26 ? 'Medium' : 'Strong')
const tintWord = (v: number) => (v === 0 ? 'Clear' : v <= 30 ? 'Light' : v <= 60 ? 'Medium' : 'Almost solid')

const MOTION_OPTIONS: { value: BgMotion; label: string }[] = [
  { value: 'still', label: 'Still' },
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'lively', label: 'Lively' }
]
const ANIMATION_OPTIONS: { value: Animations; label: string }[] = [
  { value: 'full', label: 'All animations' },
  { value: 'reduced', label: 'Fewer animations' }
]

function Slider({ field, label, describe }: { field: NumericKey; label: string; describe: (v: number) => string }) {
  const id = useId()
  const { settings, update } = useSettings()
  const value = settings.advanced[field]
  const [min, max] = ADVANCED_RANGES[field]
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[1rem] font-bold">
          {label}
        </label>
        <span className="text-[0.95rem] text-fg-muted">{describe(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={field === 'bgBrightness' ? 10 : 1}
        value={value}
        aria-valuetext={describe(value)}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => update({ advanced: { ...settings.advanced, [field]: Number(e.target.value) } })}
      />
    </div>
  )
}

function Options<T extends string>({ name, legend, value, options, onSelect }: { name: string; legend: string; value: T; options: { value: T; label: string }[]; onSelect: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[1rem] font-bold">{legend}</legend>
      <div className={`grid gap-3 ${options.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {options.map((o) => (
          <Choice key={o.value} name={name} value={o.value} checked={value === o.value} onSelect={() => onSelect(o.value)} className="min-h-14 items-center justify-center px-2 pt-2">
            <span className="text-center text-[0.95rem] leading-tight font-bold">{o.label}</span>
          </Choice>
        ))}
      </div>
    </fieldset>
  )
}

/** Shows the current glass, blur and background settings on a busy little scene, so changes are visible. */
function Preview() {
  return (
    <div aria-hidden="true" className="relative h-44 overflow-hidden rounded-[1.25rem] border border-[var(--glass-border)]">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 20% 30%, var(--morph) 0 14%, transparent 15%), radial-gradient(circle at 75% 70%, var(--haze) 0 18%, transparent 19%), linear-gradient(135deg, var(--bg-top), var(--bg))' }}
      />
      <div className="absolute inset-0 flex flex-col justify-around px-4 font-display text-[1.6rem] font-bold text-fg opacity-40 select-none">
        <span>Hello there</span>
        <span className="self-end">Morph</span>
      </div>
      <div className="absolute top-5 left-4 flex items-start gap-2">
        <MorphMark size={26} still />
        <div className="glass bubble rounded-[1rem] rounded-tl-sm px-4 py-2.5 text-[1rem]">This is how answers look.</div>
      </div>
      <div className="bubble absolute right-4 bottom-5 rounded-[1rem] rounded-tr-sm border border-[var(--field-border)] bg-[var(--selected)] px-4 py-2.5 text-[1rem]">
        And this is you.
      </div>
    </div>
  )
}

export function AdvancedSettings() {
  const { settings, update } = useSettings()
  const advanced = settings.advanced
  const set = (patch: Partial<Advanced>) => update({ advanced: { ...advanced, ...patch } })
  const isDefault = (Object.keys(DEFAULT_ADVANCED) as (keyof Advanced)[]).every((k) => advanced[k] === DEFAULT_ADVANCED[k])

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Preview />
      <Slider field="bubbleBlur" label="Chat bubble blur" describe={blurWord} />
      <Slider field="panelBlur" label="Panel blur" describe={blurWord} />
      <Slider field="glassTint" label="Glass tint" describe={tintWord} />
      <Slider field="bgBrightness" label="Background strength" describe={(v) => `${v}%`} />
      <Options name="bg-motion" legend="Background movement" value={advanced.bgMotion} options={MOTION_OPTIONS} onSelect={(bgMotion) => set({ bgMotion })} />
      <Options name="animations" legend="Animations" value={advanced.animations} options={ANIMATION_OPTIONS} onSelect={(animations) => set({ animations })} />
      <button type="button" className="btn btn-quiet self-start" disabled={isDefault} onClick={() => update({ advanced: DEFAULT_ADVANCED })}>
        <RotateCcw aria-hidden="true" />
        Reset advanced settings
      </button>
    </div>
  )
}
