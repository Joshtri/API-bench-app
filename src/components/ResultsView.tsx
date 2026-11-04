import { useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { geoMean, num, ratio } from '@/lib/format'
import { stamp } from '@/lib/report'
import type { Endpoint, EndpointResult, Run, Side, SideProgress, StatKey } from '@/lib/types'
import { CheckIcon, diffWord, Pill, pctChange, signed, toneOf, type Tone } from './bits'
import { Button } from './ui/button'
import { cn } from './ui/utils'

// ── Numbers ──────────────────────────────────────────────────────────────────

/** Compact number for big readouts: 1,204 · 42 · 8.4 · 0.62 */
function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const a = Math.abs(v)
  if (a >= 100) return Math.round(v).toLocaleString('en-US')
  if (a >= 10) return v.toFixed(1).replace(/\.0$/, '')
  if (a >= 1) return v.toFixed(1)
  return v.toFixed(2)
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

type Row = { ep: Endpoint; r: EndpointResult }

function useRows(run: Run) {
  const rows = run.config.endpoints
    .map((ep) => ({ ep, r: run.results[ep.id] }))
    .filter((x): x is Row => Boolean(x.r?.before && x.r?.after))
  // A side with no 2xx answers has no timings; leave it out of the averages.
  const timed = rows.filter((x) => x.r.before.count > 0 && x.r.after.count > 0)
  const avg = (side: Side, k: StatKey | 'rps') => mean(timed.map((x) => x.r[side][k]))
  return { rows, timed, avg }
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const count = (n: number) => NUMBER_WORDS[n] ?? String(n)

// One sentence a reader gets in a second: speed first, then data.
function headline(run: Run, timed: Row[]): ReactNode {
  const after = <span className="text-after">After</span>
  if (run.status === 'running') return <>Comparing <span className="text-before">Before</span> and {after}…</>
  const checks = Object.values(run.checks)
  const diffs = checks.filter((c) => c.status === 'diff').length
  const errors = checks.filter((c) => c.status === 'error').length

  if (!timed.length) {
    if (!checks.length) return 'No timings yet.'
    if (diffs) return `${count(diffs)[0].toUpperCase()}${count(diffs).slice(1)} endpoint${diffs > 1 ? 's' : ''} changed data. No timings yet.`
    return 'Same data so far. No timings yet.'
  }

  const r = geoMean(timed.map((x) => ratio(x.r.before.p50, x.r.after.p50)))
  const tone = toneOf(r == null ? null : (1 / r - 1) * 100)
  const speed = tone === 'better' ? ' is faster' : tone === 'worse' ? ' is slower' : ' is about as fast'
  const joiner = tone === 'better' ? ', but ' : ', and '

  let data = '.'
  if (run.config.options.check && checks.length) {
    if (diffs) data = `${joiner}${count(diffs)} endpoint${diffs > 1 ? 's changed their' : ' changed its'} data.`
    else if (errors) data = `${joiner}${count(errors)} endpoint${errors > 1 ? 's' : ''} could not be checked.`
    else data = tone === 'worse' ? ', but returns the same data.' : ', and returns the same data.'
  }
  return (
    <>
      {after}
      {speed}
      {data}
    </>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const card = 'card min-w-0'

function barStyle(v: number | null, max: number) {
  return { width: `${v == null || !max ? 0 : Math.max(0, Math.min(100, (v / max) * 100))}%` }
}

type TileProps = {
  label: string
  unit: string
  before: number | null
  after: number | null
  lowerIsBetter: boolean
  /** Errors: show counts, and "+2 new" when Before had none. */
  counts?: boolean
}

function Tile({ label, unit, before, after, lowerIsBetter, counts }: TileProps) {
  const max = Math.max(before ?? 0, after ?? 0) || 1
  const show = counts ? (v: number | null) => (v == null ? '–' : v.toLocaleString('en-US')) : fmt
  let delta: string
  let tone: Tone
  if (counts && before === 0) {
    delta = after ? `+${after.toLocaleString('en-US')} new` : 'none'
    tone = after ? 'worse' : 'same'
  } else {
    const p = pctChange(before, after)
    delta = p == null ? '–' : signed(p)
    tone = toneOf(p, lowerIsBetter)
  }

  return (
    <div className={cn(card, 'flex flex-col gap-3.5 p-[18px]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <Pill tone={tone}>{delta}</Pill>
      </div>
      <div className="flex items-baseline gap-2.5 tabular-nums">
        <span className="text-[30px] leading-none font-semibold tracking-[-0.03em] text-ink-strong">{show(after)}</span>
        <span className="text-sm text-subtle">{unit}</span>
      </div>
      <div className="flex flex-col gap-[5px] font-mono text-xs">
        {(['before', 'after'] as const).map((side) => (
          <div key={side} className="grid grid-cols-[44px_1fr_64px] items-center gap-2">
            <span className={side === 'before' ? 'text-before' : 'text-after'}>{side === 'before' ? 'Before' : 'After'}</span>
            <span className="h-1 overflow-hidden rounded-full bg-hover">
              <span className={cn('block h-full rounded-full transition-[width] duration-(--dur-3)', side === 'before' ? 'bg-before' : 'bg-after')} style={barStyle(side === 'before' ? before : after, max)} />
            </span>
            <span className={cn('text-right', side === 'before' ? 'text-muted' : 'text-ink')}>{show(side === 'before' ? before : after)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PCTS: ['p50' | 'p75' | 'p90' | 'p95' | 'p99', string][] = [
  ['p50', 'p50'],
  ['p75', 'p75'],
  ['p90', 'p90'],
  ['p95', 'p95'],
  ['p99', 'p99'],
]

function Percentiles({ avg, empty }: { avg: (side: Side, k: StatKey) => number | null; empty: boolean }) {
  const vals = PCTS.map(([k, label]) => ({ k, label, b: avg('before', k), a: avg('after', k) }))
  const max = Math.max(0, ...vals.flatMap((v) => [v.b ?? 0, v.a ?? 0])) || 1
  const bar = (v: number | null, color: string) => (
    <span className={cn('block h-2 shrink-0 rounded-[2px_99px_99px_2px] transition-[width] duration-(--dur-3)', color)} style={{ width: `${v == null ? 0 : (v / max) * 88}%` }} />
  )

  return (
    <section aria-labelledby="pct-h" className={cn(card, 'flex flex-[999_1_560px] flex-col gap-5 p-[22px]')}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="pct-h" className="text-md font-semibold text-ink-strong">
          Latency by percentile <span className="font-normal text-subtle">· all endpoints, ms</span>
        </h2>
        <div className="flex gap-3.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-2.5 rounded-full bg-before" />
            Before
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-2.5 rounded-full bg-after" />
            After
          </span>
        </div>
      </div>
      {empty ? (
        <p className="py-10 text-center font-mono text-xs text-subtle">Fills in as endpoints finish.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {vals.map(({ k, label, b, a }) => {
            const p = pctChange(b, a)
            const tone = toneOf(p)
            const text = p == null ? '–' : tone === 'same' ? 'same' : `${Math.abs(Math.round(p))}% ${p < 0 ? 'faster' : 'slower'}`
            return (
              <div key={k} className="grid grid-cols-[40px_minmax(0,1fr)_120px] items-center gap-4 tabular-nums">
                <span className="font-mono text-xs text-muted">{label}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {bar(b, 'bg-before')}
                    <span className="font-mono text-2xs text-muted">{fmt(b)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {bar(a, 'bg-after')}
                    <span className="font-mono text-2xs text-ink">{fmt(a)}</span>
                  </div>
                </div>
                <Pill tone={tone} className="justify-self-end">
                  {text}
                </Pill>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function DataCheck({ run, onOpen }: { run: Run; onOpen: (id: string) => void }) {
  const eps = run.config.endpoints.filter((ep) => run.checks[ep.id])
  const firstOff = eps.find((ep) => run.checks[ep.id].status !== 'same')
  const [picked, setPicked] = useState<string | null>(null)
  const sel = eps.find((ep) => ep.id === picked) ?? firstOff
  const same = eps.filter((ep) => run.checks[ep.id].status === 'same').length
  const shell = cn(card, 'flex flex-[1_1_340px] flex-col gap-4 p-[22px]')

  if (!run.config.options.check) {
    return (
      <section className={shell}>
        <h2 className="text-md font-semibold text-ink-strong">Data check</h2>
        <p className="text-sm text-muted">The data check was off for this run. Turn it on under Load → Customize to compare the JSON both APIs return.</p>
      </section>
    )
  }

  const chk = sel ? run.checks[sel.id] : undefined
  const diff = chk?.status === 'diff' ? chk.diffs?.[0] : undefined

  return (
    <section aria-labelledby="dc-h" className={shell}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="dc-h" className="text-md font-semibold text-ink-strong">
          Data check
        </h2>
        {eps.length > 0 && (
          <span className="text-sm text-muted">
            <span className="text-ink">
              {same} of {eps.length}
            </span>{' '}
            identical
          </span>
        )}
      </div>

      {eps.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-subtle">Checking responses…</p>
      ) : (
        <>
          <div className="-mx-2 flex max-h-[180px] flex-col overflow-y-auto">
            {eps.map((ep) => {
              const c = run.checks[ep.id]
              const off = c.status !== 'same'
              const active = sel?.id === ep.id
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => (off ? setPicked(ep.id) : onOpen(ep.id))}
                  className={cn('flex min-h-[30px] items-center gap-2.5 rounded-[7px] px-2 text-left text-sm hover:bg-hover', active && 'bg-hover')}
                >
                  <CheckIcon check={c} />
                  <span className={cn('min-w-0 truncate font-mono text-xs', off ? 'text-ink-strong' : 'text-ink-2')}>
                    {ep.method} {ep.path || '/'}
                  </span>
                  <span className={cn('ml-auto shrink-0', c.status === 'same' ? 'text-subtle' : c.status === 'diff' ? 'text-warn' : 'text-worse')}>{diffWord(c)}</span>
                </button>
              )
            })}
          </div>

          {!sel ? (
            <p className="text-sm text-muted">Both APIs returned the same status and the same JSON on every endpoint.</p>
          ) : chk?.status === 'error' ? (
            <div className="well selectable rounded-[10px] px-3 py-2.5 font-mono text-xs break-words text-worse">{chk.error}</div>
          ) : diff ? (
            <>
              <div className="well selectable flex flex-col overflow-hidden rounded-[10px] font-mono text-xs leading-[1.7]">
                <div className="truncate px-3 py-2 text-subtle shadow-[inset_0_-1px_0_var(--rule)]" title={diff.path}>
                  {diff.path}
                </div>
                <div className="flex gap-2.5 bg-before-soft/60 px-3 py-2">
                  <span className="text-before">−</span>
                  <span className="min-w-0 break-all whitespace-pre-wrap text-before-text">{diff.before}</span>
                </div>
                <div className="flex gap-2.5 bg-after-soft/60 px-3 py-2">
                  <span className="text-after">+</span>
                  <span className="min-w-0 break-all whitespace-pre-wrap text-after-text">{diff.after}</span>
                </div>
              </div>
              <p className="text-sm text-muted">
                {diff.note || ((chk?.diffs?.length ?? 0) > 1 ? `${(chk?.diffs?.length ?? 0) - 1} more field${(chk?.diffs?.length ?? 0) > 2 ? 's differ' : ' differs'} on this endpoint.` : 'Clients that read this field will see a different value.')}
              </p>
            </>
          ) : null}

          {sel && (
            <div className="mt-auto flex gap-2">
              <Button variant="outline" size="md" className="h-[34px]" onClick={() => onOpen(sel.id)}>
                Open full diff
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

const METRIC_TABS: ['p50' | 'p99' | 'rps', string][] = [
  ['p50', 'p50'],
  ['p99', 'p99'],
  ['rps', 'Req/s'],
]

function LiveMeter({ p }: { p: Partial<Record<Side, SideProgress>> }) {
  const f = (s?: SideProgress) => (s?.total ? Math.min(1, s.done / s.total) : 0)
  const cur = p.after ?? p.before
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="flex w-48 gap-1">
        {(['before', 'after'] as const).map((s) => (
          <span key={s} className={cn('h-1.5 flex-1 overflow-hidden rounded-full', s === 'before' ? 'bg-before-soft' : 'bg-after-soft')}>
            <span className={cn('block h-full origin-left transition-transform duration-(--dur-2)', s === 'before' ? 'bg-before' : 'bg-after')} style={{ transform: `scaleX(${f(p[s])})` }} />
          </span>
        ))}
      </div>
      <span className="font-mono text-xs text-muted">
        {cur?.done} / {cur?.total}
      </span>
    </div>
  )
}

function EndpointTable({ run, onOpen }: { run: Run; onOpen: (id: string) => void }) {
  const [m, setM] = useState<'p50' | 'p99' | 'rps'>('p50')
  const low = m !== 'rps'
  const unit = m === 'rps' ? ' r/s' : ' ms'
  const th = 'px-3 py-2.5 font-medium'

  return (
    <section aria-labelledby="ep-h" className={cn(card, 'flex flex-col overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] py-[18px]">
        <h2 id="ep-h" className="text-md font-semibold text-ink-strong">
          By endpoint
        </h2>
        <div role="radiogroup" aria-label="Metric" className="segmented">
          {METRIC_TABS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setM(k)} className="segment press h-[30px] rounded-[6px] px-3 text-sm">
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse tabular-nums">
          <thead>
            <tr className="text-left text-xs text-subtle shadow-[inset_0_-1px_0_var(--rule),inset_0_1px_0_var(--rule)]">
              <th scope="col" className={cn(th, 'pl-[22px]')}>
                Endpoint
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                <span className="text-before">Before</span>
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                <span className="text-after">After</span>
              </th>
              <th scope="col" className={cn(th, 'w-[28%]')}>
                Change
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Errors
              </th>
              <th scope="col" className={cn(th, 'pr-[22px]')}>
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            {run.config.endpoints.map((ep) => {
              const r = run.results[ep.id]
              const p = run.progress[ep.id]
              const c = run.checks[ep.id]
              const pending = !r && run.status === 'running'
              const b = r?.before && r.before.count > 0 ? r.before[m] : null
              const a = r?.after && r.after.count > 0 ? r.after[m] : null
              const d = pctChange(b, a)
              const tone = toneOf(d, low)
              const w = d == null ? 0 : Math.min(Math.abs(d), 50)
              const errB = r?.before.errors ?? 0
              const errA = r?.after.errors ?? 0
              return (
                <tr
                  key={ep.id}
                  tabIndex={0}
                  onClick={() => onOpen(ep.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(ep.id)
                    }
                  }}
                  aria-label={`${ep.method} ${ep.path || '/'}: open details`}
                  className="group cursor-pointer shadow-[inset_0_-1px_0_var(--rule)] outline-none transition-colors duration-(--dur-1) hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)] focus-visible:bg-hover"
                >
                  <td className="max-w-[320px] py-3.5 pr-3 pl-[22px] font-mono text-sm whitespace-nowrap">
                    <span className="flex min-w-0 items-baseline">
                      <span className="inline-block w-10 shrink-0 text-2xs text-subtle">{ep.method}</span>
                      <span className="min-w-0 truncate text-ink-strong" title={ep.afterPath ? `${ep.path} → ${ep.afterPath}` : ep.path}>
                        {ep.path || '/'}
                        {ep.afterPath && <span className="text-subtle"> → {ep.afterPath}</span>}
                      </span>
                    </span>
                  </td>
                  {r ? (
                    <>
                      <td className="px-3 py-3.5 text-right font-mono text-sm whitespace-nowrap text-muted">{b == null ? '–' : fmt(b) + unit}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm whitespace-nowrap text-ink-strong">{a == null ? '–' : fmt(a) + unit}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="relative h-1.5 flex-1 rounded-full bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                            <span aria-hidden className="absolute -top-[3px] left-1/2 h-3 w-px bg-rule-strong" />
                            <span
                              aria-hidden
                              className={cn('absolute top-0 h-full rounded-full', tone === 'better' ? 'right-1/2 bg-better' : 'left-1/2', tone === 'worse' && 'bg-worse', tone === 'same' && 'bg-subtle')}
                              style={{ width: `${w}%` }}
                            />
                          </span>
                          <Pill tone={tone} className="min-w-11 text-center">
                            {d == null ? '–' : signed(d)}
                          </Pill>
                        </div>
                      </td>
                      <td className={cn('px-3 py-3.5 text-right font-mono text-sm whitespace-nowrap', errA > errB ? 'text-worse' : 'text-muted')}>
                        {num(errB)} → {num(errA)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-3 py-3.5">
                      {pending && p ? <LiveMeter p={p} /> : <span className="font-mono text-xs text-faint">{pending ? 'queued' : 'not measured'}</span>}
                    </td>
                  )}
                  <td className="py-3.5 pr-[22px] pl-3 text-sm whitespace-nowrap">
                    <span className="flex items-center justify-between gap-2">
                      <span className={!c ? 'text-faint' : c.status === 'same' ? 'text-muted' : c.status === 'diff' ? 'text-warn' : 'text-worse'}>
                        {!run.config.options.check ? 'Not checked' : c ? diffWord(c) : '–'}
                      </span>
                      <ChevronRight aria-hidden className="size-3.5 text-faint transition-colors group-hover:text-ink" />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-[22px] pt-3 pb-4 text-xs text-subtle">Bars run left when After is better, right when it is worse. Scale ±50%. Select a row for the full breakdown.</p>
    </section>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

type Props = {
  run: Run
  runNumber: number
  /** The run bar, shown while measuring. */
  runBar: ReactNode
  onEditSetup: () => void
  onRunAgain: () => void
  onUseSettings: () => void
  canStart: boolean
  onOpen: (id: string) => void
}

export default function ResultsView({ run, runNumber, runBar, onEditSetup, onRunAgain, onUseSettings, canStart, onOpen }: Props) {
  const { rows, timed, avg } = useRows(run)
  const running = run.status === 'running'
  const { n, c } = run.config.load
  const eps = run.config.endpoints.length
  const sum = (side: Side) => rows.reduce((a, x) => a + x.r[side].errors, 0)
  const sent = rows.length * Number(n)

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-6 pt-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span className="rounded-full bg-hover px-2 py-0.5 text-ink-2">
              {run.fromHistory ? 'Saved run' : `Run #${runNumber}`} · {stamp(run.startedAt)}
            </span>
            {run.status === 'cancelled' && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">Stopped early · partial</span>}
            <span>
              {eps} endpoint{eps === 1 ? '' : 's'} · {n} req each · {c} at a time
            </span>
          </p>
          <h1 className="text-xl font-semibold text-ink-strong">{headline(run, timed)}</h1>
        </div>
        {!running && (
          <div className="flex gap-2">
            {run.fromHistory ? (
              <Button variant="outline" size="lg" onClick={onUseSettings}>
                <ArrowLeft strokeWidth={2} />
                Use these settings
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={onEditSetup}>
                <ArrowLeft strokeWidth={2} />
                Edit setup
              </Button>
            )}
            <Button variant="primary" size="lg" className="pr-4 pl-3.5" onClick={onRunAgain} disabled={!canStart}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.2-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
              </svg>
              Run again
            </Button>
          </div>
        )}
      </div>

      {running && runBar}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Tile label="Median latency · p50" unit="ms" before={avg('before', 'p50')} after={avg('after', 'p50')} lowerIsBetter />
        <Tile label="Tail latency · p99" unit="ms" before={avg('before', 'p99')} after={avg('after', 'p99')} lowerIsBetter />
        <Tile label="Throughput" unit="req/s" before={avg('before', 'rps')} after={avg('after', 'rps')} lowerIsBetter={false} />
        <Tile label="Errors" unit={`of ${sent.toLocaleString('en-US')}`} before={rows.length ? sum('before') : null} after={rows.length ? sum('after') : null} lowerIsBetter counts />
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        <Percentiles avg={avg} empty={!timed.length} />
        <DataCheck key={run.id} run={run} onOpen={onOpen} />
      </div>

      <EndpointTable run={run} onOpen={onOpen} />
    </div>
  )
}
