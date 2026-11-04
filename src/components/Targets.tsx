import { useState } from 'react'
import { ArrowDownUp, SlidersHorizontal } from 'lucide-react'
import { parseHeaders } from '@/lib/format'
import type { Side, TargetSettings } from '@/lib/types'
import { cleanBase } from '@/lib/url'
import { CH, StepHead } from './bits'
import { Collapsible, CollapsibleContent } from './ui/collapsible'
import { fieldClass, Label, Textarea } from './ui/input'
import { cn } from './ui/utils'

type FieldProps = {
  side: Side
  value: TargetSettings
  onChange: (value: TargetSettings) => void
  disabled?: boolean
}

function TargetField({ side, value, onChange, disabled }: FieldProps) {
  const [open, setOpen] = useState(false)
  const set = (k: keyof TargetSettings) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  const { headers, bad } = parseHeaders(value.headers)
  const count = Object.keys(headers).length
  const title = side === 'before' ? 'Before' : 'After'
  const id = `target-${side}`
  const color = side === 'before' ? 'bg-before' : 'bg-after'
  const text = side === 'before' ? 'text-before' : 'text-after'
  const custom = value.label && value.label !== title ? value.label : null

  // Fix paste mistakes (trailing "/", URL pasted twice) when leaving the field.
  const tidy = () => {
    const clean = cleanBase(value.baseUrl)
    if (clean !== value.baseUrl) onChange({ ...value, baseUrl: clean })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-2">
        <span aria-hidden className={cn('swatch', color)} />
        {title}
        <span className={cn('font-mono text-2xs', text)}>{CH[side]}</span>
        {custom && <span className="min-w-0 truncate font-normal text-subtle">· {custom}</span>}
      </label>
      <div className="field flex h-10 items-center rounded-[9px]">
        <span aria-hidden className={cn('my-2 ml-1.5 w-[3px] self-stretch rounded-[2px]', color)} />
        <input
          id={id}
          placeholder={side === 'before' ? 'https://old-api.example.com' : 'https://new-api.example.com'}
          value={value.baseUrl}
          onChange={set('baseUrl')}
          onBlur={tidy}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="url"
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 font-mono text-sm text-ink-strong outline-none placeholder:text-faint disabled:opacity-55"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${title} options: name and headers`}
          title={count ? `${count} header${count > 1 ? 's' : ''}` : 'Name and headers'}
          className="press relative mr-1 grid size-8 place-items-center rounded-[7px] text-icon hover:bg-hover hover:text-ink-strong aria-expanded:bg-hover aria-expanded:text-ink-strong"
        >
          <SlidersHorizontal className="size-[15px]" />
          {count > 0 && <span aria-hidden className={cn('absolute top-1.5 right-1.5 size-1.5 rounded-full', color)} />}
        </button>
      </div>
      <CollapsibleContent>
        <div className="mt-1 flex flex-col gap-3 rounded-[9px] bg-surface-2 p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-label`}>Name shown in results</Label>
            <input id={`${id}-label`} value={value.label} onChange={set('label')} placeholder={title} disabled={disabled} className={cn(fieldClass, 'h-8')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-headers`}>Headers, one "Name: value" per line</Label>
            <Textarea
              id={`${id}-headers`}
              rows={2}
              className="font-mono text-xs"
              placeholder={'Authorization: Bearer …\nX-Api-Key: …'}
              value={value.headers}
              onChange={set('headers')}
              disabled={disabled}
              spellCheck={false}
              aria-invalid={bad.length > 0 || undefined}
            />
            {bad.length > 0 && <p className="text-xs text-worse">Use one "Name: value" per line.</p>}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

type Props = {
  before: TargetSettings
  after: TargetSettings
  onChange: (side: Side, value: TargetSettings) => void
  onSwap: () => void
  disabled?: boolean
}

export default function Targets({ before, after, onChange, onSwap, disabled }: Props) {
  return (
    <section className="flex flex-col gap-3.5 p-5">
      <StepHead n="01" title="Targets" aside="Base URLs" />
      <div className="flex flex-col gap-2.5">
        <TargetField side="before" value={before} onChange={(v) => onChange('before', v)} disabled={disabled} />
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-px flex-1 bg-rule" />
          <button
            type="button"
            onClick={onSwap}
            disabled={disabled}
            className="press flex h-7 items-center gap-1.5 rounded-full bg-tint px-2.5 text-xs font-medium text-muted hover:bg-hover hover:text-ink-strong disabled:opacity-45"
          >
            <ArrowDownUp className="size-[13px]" strokeWidth={2} />
            Swap
          </button>
          <span aria-hidden className="h-px flex-1 bg-rule" />
        </div>
        <TargetField side="after" value={after} onChange={(v) => onChange('after', v)} disabled={disabled} />
      </div>
    </section>
  )
}
