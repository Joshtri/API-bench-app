import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { bytes, ms, num } from '@/lib/format'
import type { Run, Side, StatKey, Stats } from '@/lib/types'
import { CheckTag, Delta, MethodTag, SectionHead, Swatch } from './bits'
import { axisLine, axisTick, ChartKey, ChartTooltip, tickMs, type TooltipRow } from './chartParts'
import DiffTable from './DiffTable'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from './ui/utils'

const ROWS: [StatKey, string][] = [
  ['min', 'Fastest'],
  ['p50', 'p50 (median)'],
  ['p75', 'p75'],
  ['p90', 'p90'],
  ['p95', 'p95'],
  ['p99', 'p99'],
  ['max', 'Slowest'],
  ['mean', 'Mean'],
  ['stddev', 'Std. deviation'],
]

type Labels = Record<Side, string>

function Distribution({ before, after, labels }: { before?: Stats; after?: Stats; labels: Labels }) {
  const pts = (s?: Stats) => (s?.cdf ?? []).map((v, i) => ({ x: v, y: i }))
  const series = [
    { side: 'before' as const, data: pts(before), color: 'var(--before)', label: labels.before },
    { side: 'after' as const, data: pts(after), color: 'var(--after)', label: labels.after },
  ]
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 6, right: 12, bottom: 18, left: -8 }}>
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 'auto']}
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            tickFormatter={tickMs}
            label={{ value: 'response time, ms', position: 'insideBottomRight', offset: -12, style: { ...axisTick, fill: 'var(--muted)' } }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 90, 100]}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={44}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: 'var(--rule-strong)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const rows: TooltipRow[] = payload.map((p) => ({
                side: p.name as Side,
                label: series.find((s) => s.side === p.name)?.label,
                value: `${p.payload.y}% ≤ ${ms(p.payload.x)}`,
              }))
              return <ChartTooltip rows={rows} />
            }}
          />
          {series.map((s) => (
            <Line
              key={s.side}
              name={s.side}
              data={s.data}
              dataKey="y"
              type="monotone"
              stroke={s.color}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Codes({ s }: { s?: Stats }) {
  const entries = Object.entries(s?.statuses ?? {})
  const errs = Object.entries(s?.errorMessages ?? {})
  if (!entries.length && !errs.length) return <span className="font-mono text-xs text-faint">–</span>
  const tag = 'inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-2xs'
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([code, n]) => (
        <span key={code} className={cn(tag, code.startsWith('2') ? 'bg-hover text-ink-2 border-transparent' : 'border-worse text-worse')}>
          {code} × {n}
        </span>
      ))}
      {errs.map(([m, n]) => (
        <span key={m} className={cn(tag, 'h-auto min-h-5 border-worse [overflow-wrap:anywhere] text-worse')}>
          {m} × {n}
        </span>
      ))}
    </div>
  )
}

export default function EndpointDetail({ run, id, onHide }: { run: Run | null; id: string | null; onHide: () => void }) {
  const ep = id == null ? undefined : run?.config.endpoints.find((e) => e.id === id)
  const r = id == null ? undefined : run?.results[id]
  const chk = id == null ? undefined : run?.checks[id]
  const labels: Labels = { before: run?.config.before.label ?? '', after: run?.config.after.label ?? '' }
  const td = 'py-1.5 text-right font-mono text-sm whitespace-nowrap'

  return (
    <Dialog open={Boolean(ep)} onOpenChange={(o) => !o && onHide()}>
      {ep && (
        <DialogContent
          className="max-w-3xl"
          title={
            <span className="flex min-w-0 items-start gap-2">
              <MethodTag method={ep.method} className="mt-0.5" />
              <span dir="ltr" className="min-w-0 text-left font-mono text-sm [overflow-wrap:anywhere]">
                {ep.path || '/'}
                {ep.afterPath && <span className="text-muted"> → {ep.afterPath}</span>}
              </span>
            </span>
          }
          description="Full breakdown for this endpoint"
        >
          <div className="selectable space-y-7 p-5">
            {!r?.before ? (
              <p className="text-sm text-muted">This endpoint has no timing results yet.</p>
            ) : (
              <>
                <section>
                  <SectionHead>How response times are spread</SectionHead>
                  <p className="mb-3 text-xs text-muted">Read across: the further left a line reaches 100%, the faster that API answers nearly all requests.</p>
                  <ChartKey before={labels.before} after={labels.after} />
                  <Distribution before={r.before} after={r.after} labels={labels} />
                </section>

                <section className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full min-w-[360px] border-collapse">
                      <thead>
                        <tr className="shadow-[inset_0_-1px_0_var(--rule-strong)]">
                          <th className="pb-2 text-xs font-medium text-subtle text-left">Reading</th>
                          <th className="pb-2 text-xs font-medium text-subtle text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <Swatch side="before" />
                              Before
                            </span>
                          </th>
                          <th className="pb-2 text-xs font-medium text-subtle text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <Swatch side="after" />
                              After
                            </span>
                          </th>
                          <th className="pb-2 text-xs font-medium text-subtle pl-4 text-left">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROWS.map(([k, label]) => (
                          <tr key={k} className={cn('shadow-[inset_0_-1px_0_var(--rule)]', k === 'p50' && 'bg-hover')}>
                            <td className="py-1.5 pr-3 text-sm text-ink-2">{label}</td>
                            <td className={cn(td, 'text-before')}>{r.before.count === 0 ? '–' : ms(r.before[k])}</td>
                            <td className={cn(td, 'pl-3 font-semibold text-after')}>{r.after?.count === 0 ? '–' : ms(r.after?.[k])}</td>
                            <td className="py-1.5 pl-4">{k === 'stddev' ? '' : <Delta before={r.before.count ? r.before[k] : null} after={r.after?.count ? r.after[k] : null} />}</td>
                          </tr>
                        ))}
                        <tr className="shadow-[inset_0_-1px_0_var(--rule)]">
                          <td className="py-1.5 pr-3 text-sm text-ink-2">Requests / second</td>
                          <td className={cn(td, 'text-before')}>{num(r.before.rps, 1)}</td>
                          <td className={cn(td, 'pl-3 font-semibold text-after')}>{num(r.after?.rps, 1)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td className="py-1.5 pr-3 text-sm text-ink-2">Response size</td>
                          <td className={cn(td, 'text-before')}>{bytes(r.before.avgBytes)}</td>
                          <td className={cn(td, 'pl-3 font-semibold text-after')}>{bytes(r.after?.avgBytes)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-xs font-medium text-subtle flex items-center gap-1.5">
                        <Swatch side="before" />
                        Before responses
                      </div>
                      <Codes s={r.before} />
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium text-subtle flex items-center gap-1.5">
                        <Swatch side="after" />
                        After responses
                      </div>
                      <Codes s={r.after} />
                    </div>
                    <p className="text-xs text-muted">
                      <span className="font-mono text-ink-2">{r.before.count}</span> timed OK requests on Before,{' '}
                      <span className="font-mono text-ink-2">{r.after?.count ?? 0}</span> on After. Only 2xx answers are timed; anything else counts as an error.
                    </p>
                  </div>
                </section>
              </>
            )}

            {chk && (
              <section>
                <SectionHead aside={<CheckTag check={chk} />}>Same data?</SectionHead>
                {chk.status === 'error' && <p className="font-mono text-xs break-words text-worse">{chk.error}</p>}
                {chk.status === 'same' && <p className="text-xs text-muted">Both APIs returned the same status and the same JSON.</p>}
                {chk.status === 'diff' && <DiffTable diffs={chk.diffs ?? []} />}
              </section>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
