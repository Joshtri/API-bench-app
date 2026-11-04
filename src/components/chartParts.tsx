import { useSyncExternalStore, type ReactNode } from 'react'
import type { Side } from '@/lib/types'
import { Swatch } from './bits'

export function useNarrow(query = '(max-width: 639px)') {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
  )
}

// Shared Recharts styling: hairline grid on the value axis only, mono ticks,
// series colors straight from the channel tokens (so themes just work).
export const axisTick = { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--muted)' }
export const axisLine = { stroke: 'var(--rule-strong)' }
// Compact axis numbers; the unit is printed once next to the axis instead.
export const tickMs = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}s` : `${+v.toFixed(v > 0 && v < 10 ? 1 : 0)}`)
export const gridProps = { stroke: 'var(--rule)', strokeDasharray: '0', vertical: true, horizontal: false }

export interface TooltipRow {
  side: Side
  label: ReactNode
  value: ReactNode
}

export function ChartTooltip({ title, rows, footer }: { title?: ReactNode; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-44 rounded-sm bg-pop px-2.5 py-2 text-xs shadow-(--shadow-pop)">
      {title && <div dir="ltr" className="mb-1.5 font-mono text-2xs [overflow-wrap:anywhere] text-muted">{title}</div>}
      {rows.map((r) => (
        <div key={r.side} className="flex items-center gap-2 py-px">
          <Swatch side={r.side} />
          <span className="min-w-0 flex-1 truncate text-ink-2">{r.label}</span>
          <span className={`font-mono font-semibold ${r.side === 'before' ? 'text-before' : 'text-after'}`}>{r.value}</span>
        </div>
      ))}
      {footer && <div className="mt-1.5 border-t border-rule pt-1.5">{footer}</div>}
    </div>
  )
}

export function ChartKey({ before, after, children }: { before: ReactNode; after: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <Swatch side="before" />
        {before}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch side="after" />
        {after}
      </span>
      <div className="ml-auto">{children}</div>
    </div>
  )
}
