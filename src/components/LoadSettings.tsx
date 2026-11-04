import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LOAD_PRESETS } from '@/lib/defaults'
import type { LoadSettings as Load, NumInput, RunOptions } from '@/lib/types'
import { StepHead } from './bits'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { fieldClass } from './ui/input'
import { Switch } from './ui/switch'
import { cn } from './ui/utils'

type NumFieldProps = {
  id: string
  label: string
  unit: string
  hint: string
  value: NumInput
  min: number
  max: number
  onChange: (v: NumInput) => void
  disabled?: boolean
}

function NumField({ id, label, unit, hint, value, min, max, onChange, disabled }: NumFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted" title={hint}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          title={hint}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={cn(fieldClass, 'h-9 pr-11 text-right font-mono')}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-2xs text-faint">{unit}</span>
      </div>
    </div>
  )
}

function Toggle({ id, label, checked, onChange, disabled, className }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      <label htmlFor={id} className={cn('text-sm text-ink-2', disabled && 'text-faint')}>
        {label}
      </label>
    </div>
  )
}

type Props = {
  load: Load
  options: RunOptions
  onLoad: (load: Load) => void
  onOptions: (options: RunOptions) => void
  disabled?: boolean
}

export default function LoadSettings({ load, options, onLoad, onOptions, disabled }: Props) {
  const set = (k: keyof Load) => (v: NumInput) => onLoad({ ...load, [k]: v })
  const active = LOAD_PRESETS.find((p) => p.n === load.n && p.c === load.c && p.warmup === load.warmup)
  const [custom, setCustom] = useState(!active)
  const hint = active?.hint ?? 'Custom load. Adjust the numbers below.'

  return (
    <section className="flex flex-col gap-3.5 p-5">
      <StepHead n="02" title="Load" />
      <div role="radiogroup" aria-label="Load preset" className="segmented grid! grid-cols-4">
        {LOAD_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={active === p}
            disabled={disabled}
            onClick={() => onLoad({ ...load, n: p.n, c: p.c, warmup: p.warmup })}
            className="segment press h-[34px] px-1 text-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      <Collapsible open={custom} onOpenChange={setCustom} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 font-mono text-xs text-muted">
            {load.n || 0} req · {load.c || 0} at a time · {options.check ? 'data check on' : 'no data check'}
          </p>
          <CollapsibleTrigger className="press group flex h-[30px] shrink-0 items-center gap-1 rounded-[7px] px-2 text-sm text-muted hover:bg-hover hover:text-ink-strong aria-expanded:text-ink-strong">
            Customize
            <ChevronDown className="size-[13px] transition-transform duration-(--dur-2) group-aria-expanded:rotate-180" strokeWidth={2} />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 rounded-[10px] bg-surface-2 p-3.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <NumField id="ld-n" label="Requests" unit="req" hint="Timed requests per endpoint, for each side." value={load.n} min={1} max={100000} onChange={set('n')} disabled={disabled} />
              <NumField id="ld-c" label="At a time" unit="conc" hint="How many requests are in flight at once." value={load.c} min={1} max={500} onChange={set('c')} disabled={disabled} />
              <NumField id="ld-w" label="Warm-up" unit="req" hint="Untimed requests first, so connections and caches are ready." value={load.warmup} min={0} max={10000} onChange={set('warmup')} disabled={disabled} />
              <NumField id="ld-t" label="Timeout" unit="ms" hint="A request slower than this counts as an error." value={load.timeoutMs} min={100} max={600000} onChange={set('timeoutMs')} disabled={disabled} />
            </div>
            <div className="flex flex-col gap-2.5">
              <Toggle id="opt-check" label="Check both return the same data first" checked={options.check} disabled={disabled} onChange={(v) => onOptions({ ...options, check: v })} />
              <Toggle
                id="opt-order"
                className="pl-[42px]"
                label="Ignore list order (sort by id)"
                checked={options.ignoreOrder}
                disabled={disabled || !options.check}
                onChange={(v) => onOptions({ ...options, ignoreOrder: v })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <p className="text-sm text-subtle">{hint}</p>
    </section>
  )
}
