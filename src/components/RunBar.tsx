import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { duration } from '@/lib/format'
import type { Config, Run } from '@/lib/types'
import { Button } from './ui/button'
import { cn } from './ui/utils'

function useElapsed(run: Run | null) {
  const running = run?.status === 'running'
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [running])
  if (!run) return null
  if (!running) return run.elapsedMs ?? null
  return Math.max(0, now - run.startedAt)
}

function clock(msTotal: number | null) {
  if (msTotal == null) return '--:--.-'
  const s = msTotal / 1000
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

// How far each phase is, 0..1. The data check is null when it's off.
function phaseFractions(run: Run | null) {
  if (!run) return { check: 0, before: 0, after: 0, compare: 0 }
  const eps = run.config.endpoints
  const total = eps.length || 1
  const checkOn = run.config.options.check
  if (run.status === 'done') return { check: checkOn ? 1 : null, before: 1, after: 1, compare: 1 }
  const n = Number(run.config.load.n) || 1
  let before = 0
  let after = 0
  for (const ep of eps) {
    const p = run.progress[ep.id]
    const finished = Boolean(run.results[ep.id])
    before += p?.before?.done ?? (finished ? n : 0)
    after += p?.after?.done ?? (finished ? n : 0)
  }
  return {
    check: checkOn ? Object.keys(run.checks).length / total : null,
    before: Math.min(1, before / (n * total)),
    after: Math.min(1, after / (n * total)),
    compare: Object.keys(run.results).length / total,
  }
}

function Phase({ label, fraction, track, fill }: { label: string; fraction: number | null; track: string; fill: string }) {
  const off = fraction == null
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <span className={cn('relative h-1 overflow-hidden rounded-full', track)}>
        <span
          className={cn('absolute inset-0 origin-left rounded-full transition-transform duration-(--dur-3) ease-out', fill)}
          style={{ transform: `scaleX(${fraction ?? 0})` }}
        />
      </span>
      <span className={cn('truncate text-xs', off ? 'text-faint' : 'text-subtle')}>
        {label}
        {off && ' · off'}
      </span>
    </li>
  )
}

type Props = {
  run: Run | null
  config: Config
  onStart: () => void
  onStop: () => void
  canStart: boolean
  problem: string | null
  /** Shown as a link once a run has results (on the setup screen). */
  onViewResults?: () => void
}

export default function RunBar({ run, config, onStart, onStop, canStart, problem, onViewResults }: Props) {
  const running = run?.status === 'running'
  const elapsed = useElapsed(run)
  const f = phaseFractions(run)
  const pct = Math.round((run?.fraction ?? 0) * 100)

  const selected = config.endpoints.filter((e) => e.enabled).length
  const total = (Number(config.load.n) || 0) * selected * 2

  let dot = 'bg-subtle'
  let status = 'Ready. Make sure both APIs are running.'
  if (problem && !running) {
    dot = 'bg-warn'
    status = problem
  } else if (run?.status === 'running') {
    dot = 'bg-after live-dot'
    status = run.current || 'Starting…'
  } else if (run?.status === 'done') {
    dot = 'bg-better'
    status = `${run.fromHistory ? 'Saved run. ' : ''}Finished in ${duration(run.elapsedMs)}.`
  } else if (run?.status === 'cancelled') {
    status = `Stopped after ${duration(run.elapsedMs)}. Partial results.`
  } else if (run?.status === 'error') {
    dot = 'bg-worse'
    status = run.error ? `Run failed: ${run.error}` : 'Run failed.'
  }

  return (
    <div className="card flex flex-wrap items-center gap-5 p-4">
      {running ? (
        <Button variant="stop" size="xl" onClick={onStop} className="w-[172px]">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <rect width="12" height="12" rx="2" fill="currentColor" />
          </svg>
          Stop
        </Button>
      ) : (
        <Button variant="primary" size="xl" onClick={onStart} disabled={!canStart}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.2-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
          </svg>
          {run && run.status !== 'running' ? 'Run again' : 'Run comparison'}
        </Button>
      )}
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p
            className={cn('flex min-w-0 items-baseline gap-2 text-base', problem && !running ? 'text-warn' : run?.status === 'error' ? 'text-worse' : 'text-ink', running && 'font-mono text-sm')}
            aria-live="polite"
          >
            <span aria-hidden className={cn('inline-block size-[7px] shrink-0 -translate-y-px rounded-full', dot)} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{status}</span>
            {onViewResults && run && !running && (Object.keys(run.results).length > 0 || Object.keys(run.checks).length > 0) && (
              <button type="button" onClick={onViewResults} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink-strong">
                View results
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </p>
          <p className="shrink-0 font-mono text-xs text-muted tabular-nums">
            {running ? (
              <>
                T+{clock(elapsed)} · <span className="text-ink">{pct}%</span>
              </>
            ) : selected === 0 ? (
              'Select at least one endpoint'
            ) : (
              `${total.toLocaleString('en-US')} requests total`
            )}
          </p>
        </div>
        <ol aria-label="Run phases" className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
          <Phase label="Data check" fraction={run ? f.check : config.options.check ? 0 : null} track="bg-hover" fill="bg-ink-2" />
          <Phase label="Time Before" fraction={f.before} track="bg-before-soft" fill="bg-before" />
          <Phase label="Time After" fraction={f.after} track="bg-after-soft" fill="bg-after" />
          <Phase label="Compare" fraction={f.compare} track="bg-hover" fill="bg-better" />
        </ol>
      </div>
    </div>
  )
}
