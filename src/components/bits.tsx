import type { ReactNode } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import type { CheckResult, Side } from '@/lib/types'
import { cn } from './ui/utils'

// ── Channels ────────────────────────────────────────────────────────────────

export const CH: Record<Side, string> = { before: 'CH1', after: 'CH2' }

export function Swatch({ side, className }: { side: Side; className?: string }) {
  return <span aria-hidden className={cn('swatch', side === 'before' ? 'bg-before' : 'bg-after', className)} />
}

// ── HTTP methods ────────────────────────────────────────────────────────────

export const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function methodColor(method: string) {
  return WRITE_METHODS.has(method) ? 'text-warn' : 'text-ink-2'
}

export function MethodTag({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] w-[52px] shrink-0 items-center justify-center rounded-xs bg-hover font-mono text-2xs font-medium',
        methodColor(method),
        className,
      )}
    >
      {method}
    </span>
  )
}

// ── Change between Before and After ─────────────────────────────────────────

/** Percent change from Before to After, or null if it can't be computed. */
export function pctChange(before: number | null | undefined, after: number | null | undefined): number | null {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null
  return ((after - before) / before) * 100
}

/** "+12%", "−34%", "±0%". Compact past 1,000 so extreme changes still fit. */
export function signed(pct: number): string {
  const r = Math.round(pct)
  const a = Math.abs(r)
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + (a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a) + '%'
}

export type Tone = 'better' | 'worse' | 'same'

export function toneOf(pct: number | null, lowerIsBetter = true): Tone {
  if (pct == null || Math.round(pct) === 0) return 'same'
  return (lowerIsBetter ? pct < 0 : pct > 0) ? 'better' : 'worse'
}

export const toneText: Record<Tone, string> = { better: 'text-better', worse: 'text-worse', same: 'text-muted' }
export const toneBg: Record<Tone, string> = { better: 'bg-better-soft', worse: 'bg-worse-soft', same: 'bg-hover' }

// Rounded delta chip: green when After is better, red when worse.
export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('pill', toneText[tone], toneBg[tone], className)}>{children}</span>
}

// Change in a timing (lower is better) as a pill, e.g. "−33%".
export function Delta({ before, after, className }: { before: number | null | undefined; after: number | null | undefined; className?: string }) {
  const p = pctChange(before, after)
  if (p == null) return <span className="font-mono text-xs text-faint">–</span>
  return (
    <Pill tone={toneOf(p)} className={className}>
      {signed(p)}
    </Pill>
  )
}

// ── Data-check status ───────────────────────────────────────────────────────

export function diffWord(check: CheckResult): string {
  if (check.status === 'same') return 'Same'
  if (check.status === 'error') return 'Error'
  const n = check.diffs?.length ?? 0
  if (n === 0) return 'Differs'
  return `${n >= 200 ? '200+' : n} field${n === 1 ? ' differs' : 's differ'}`
}

export function CheckIcon({ check, className }: { check: CheckResult; className?: string }) {
  if (check.status === 'same') return <Check aria-hidden className={cn('size-4 shrink-0 text-better', className)} strokeWidth={2.4} />
  if (check.status === 'diff') return <TriangleAlert aria-hidden className={cn('size-4 shrink-0 text-warn', className)} strokeWidth={2} />
  return <X aria-hidden className={cn('size-4 shrink-0 text-worse', className)} strokeWidth={2.4} />
}

export function CheckTag({ check, className }: { check: CheckResult | undefined; className?: string }) {
  if (!check) return <span className="font-mono text-xs text-faint">–</span>
  const color = check.status === 'same' ? 'text-muted' : check.status === 'diff' ? 'text-warn' : 'text-worse'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm whitespace-nowrap', color, className)}>
      <CheckIcon check={check} className="size-3.5" />
      {diffWord(check)}
    </span>
  )
}

// Numbered step heading in the setup rail: "01  Targets        Base URLs".
export function StepHead({ n, title, aside }: { n: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-mono text-xs text-subtle">{n}</span>
      <h2 className="text-md font-semibold tracking-[-0.01em] text-ink-strong">{title}</h2>
      {aside && <span className="ml-auto text-sm text-subtle">{aside}</span>}
    </div>
  )
}

// A section heading inside a card or dialog.
export function SectionHead({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex min-h-7 items-center gap-2', className)}>
      <h2 className="text-md font-semibold tracking-[-0.01em] text-ink-strong">{children}</h2>
      {aside && <div className="ml-auto flex items-center gap-1">{aside}</div>}
    </div>
  )
}
