import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

function Step({ n, title, text, art }: { n: string; title: string; text: string; art: ReactNode }) {
  return (
    <li className="well flex flex-col gap-4 rounded-md p-[18px]">
      <div aria-hidden className="flex h-[92px] flex-col justify-center rounded-sm bg-surface-2 px-3">
        {art}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="flex items-baseline gap-2 text-base font-semibold text-ink-strong">
          <span className="font-mono text-xs font-normal text-subtle">{n}</span>
          {title}
        </h3>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </li>
  )
}

const BEFORE_BARS = [40, 70, 55, 90, 60, 75, 50, 65]
const AFTER_BARS = [30, 45, 35, 55, 40, 50, 30, 42]

function Bars({ heights, color, opacity }: { heights: number[]; color: string; opacity: number }) {
  return (
    <div className="flex h-[26px] items-end gap-[3px]">
      {heights.map((h, i) => (
        <span key={i} className={`flex-1 rounded-[2px] ${color}`} style={{ height: `${h}%`, opacity }} />
      ))}
    </div>
  )
}

function PercentileArt() {
  const rows: [string, number, number][] = [
    ['p50', 70, 46],
    ['p90', 84, 60],
    ['p99', 96, 74],
  ]
  return (
    <div className="flex flex-col gap-[7px] font-mono text-2xs text-subtle">
      {rows.map(([label, b, a]) => (
        <div key={label} className="grid grid-cols-[30px_1fr] items-center gap-2">
          <span>{label}</span>
          <div className="flex flex-col gap-0.5">
            <span className="h-[3px] rounded-[2px] bg-before" style={{ width: `${b}%` }} />
            <span className="h-[3px] rounded-[2px] bg-after" style={{ width: `${a}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EmptyState({ onViewResults }: { onViewResults?: () => void }) {
  return (
    <section className="card flex flex-col gap-9 px-12 pt-12 pb-10 max-md:px-6 max-md:pt-8">
      <div className="flex max-w-[620px] flex-col gap-2.5">
        <h1 className="text-2xl font-semibold text-ink-strong">Is the new API as correct, and faster?</h1>
        <p className="text-md text-muted">
          Point <span className="font-medium text-before">Before</span> at the old API and <span className="font-medium text-after">After</span> at the new one.
          One run checks the data matches, then times both under the same load.
        </p>
      </div>

      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-0">
        <Step
          n="1"
          title="Same data?"
          text="Each endpoint is called once on both sides. The JSON is compared field by field."
          art={
            <div className="flex flex-col gap-[5px] font-mono text-2xs text-subtle">
              <div>{'{ "id": 42,'}</div>
              <div>&nbsp;&nbsp;"name": "Ada",</div>
              <div className="flex gap-1.5">
                <span className="rounded-[3px] bg-before-soft px-1 text-before-text">"at": "10:02"</span>
                <span className="rounded-[3px] bg-after-soft px-1 text-after-text">"10:02Z"</span>
              </div>
            </div>
          }
        />
        <Step
          n="2"
          title="Load test"
          text="Every endpoint is timed on Before, then on After, with the load you set. Never both at once."
          art={
            <div className="flex flex-col gap-2.5">
              <Bars heights={BEFORE_BARS} color="bg-before" opacity={0.55} />
              <Bars heights={AFTER_BARS} color="bg-after" opacity={0.6} />
            </div>
          }
        />
        <Step n="3" title="Compare" text="p50 to p99, requests per second and errors, side by side, per endpoint." art={<PercentileArt />} />
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 shadow-[inset_0_1px_0_var(--rule)]">
        <p className="text-sm text-subtle">Save targets and endpoints per project from the project menu.</p>
        {onViewResults && (
          <button type="button" onClick={onViewResults} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink-strong">
            See the last run
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    </section>
  )
}
