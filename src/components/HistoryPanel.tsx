import { Trash2, Upload } from 'lucide-react'
import { geoMean, ratio } from '@/lib/format'
import { stamp } from '@/lib/report'
import type { Run } from '@/lib/types'
import { Pill, signed, toneOf } from './bits'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from './ui/utils'

/** Overall p50 change for a run, in percent (negative = After faster). */
export function overallPct(run: Run): number | null {
  const r = geoMean(Object.values(run.results).filter((x) => x.before && x.after).map((x) => ratio(x.before.p50, x.after.p50)))
  return r == null ? null : (1 / r - 1) * 100
}

type Props = {
  show: boolean
  onHide: () => void
  history: Run[]
  activeId: string | undefined
  onOpen: (run: Run) => void
  onDelete: (id: string) => void
  /** Opens a native file dialog to pick an exported run. */
  onImport: () => void
}

export default function HistoryPanel({ show, onHide, history, activeId, onOpen, onDelete, onImport }: Props) {
  return (
    <Dialog open={show} onOpenChange={(o) => !o && onHide()}>
      <DialogContent side="right" title="History" description="Finished runs are saved on this computer. Open one to see its results again.">
        <div className="px-5 py-3 shadow-[inset_0_-1px_0_var(--rule)]">
          <Button variant="outline" size="md" onClick={onImport}>
            <Upload />
            Import run (.json)
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-subtle">No saved runs yet.</p>
        ) : (
          <ul className="p-2">
            {history.map((run, i) => {
              const p = overallPct(run)
              const tone = toneOf(p)
              const active = run.id === activeId
              return (
                <li key={run.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onOpen(run)}
                    aria-current={active || undefined}
                    className={cn('flex w-full flex-col gap-1.5 rounded-sm py-2.5 pr-12 pl-3 text-left transition-colors duration-(--dur-1) hover:bg-hover', active && 'bg-hover')}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-subtle">#{history.length - i}</span>
                      <span className="min-w-0 truncate text-sm font-medium text-ink-strong">{run.config.name || 'Benchmark'}</span>
                    </span>
                    <span className="font-mono text-2xs text-subtle">
                      {stamp(run.startedAt)} · {Object.keys(run.results).length} ep · {run.config.load.n}×{run.config.load.c}
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={tone}>{p == null ? '–' : tone === 'same' ? 'about the same' : `p50 ${signed(p)}`}</Pill>
                      {run.status === 'cancelled' && <span className="pill bg-warn-soft text-warn">partial</span>}
                    </span>
                  </button>
                  <Button
                    variant="danger"
                    size="icon"
                    className="absolute top-2 right-2"
                    title="Delete"
                    aria-label={`Delete run ${run.config.name || 'Benchmark'}`}
                    onClick={() => onDelete(run.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
