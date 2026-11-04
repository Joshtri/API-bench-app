import { useState } from 'react'
import type { Diff } from '@/bindings/Diff'
import { Swatch } from './bits'
import { Button } from './ui/button'

export default function DiffTable({ diffs, limit = 10 }: { diffs: Diff[]; limit?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? diffs : diffs.slice(0, limit)
  const th = 'h-7 px-2 pb-1 text-left align-bottom text-xs font-medium text-subtle'
  return (
    <>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-collapse font-mono text-xs">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[33%]" />
            <col className="w-[33%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-rule-strong">
              <th className={th + ' pl-0'}>Field</th>
              <th className={th}>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch side="before" />
                  Before
                </span>
              </th>
              <th className={th}>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch side="after" />
                  After
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={i} className="border-b border-rule align-top">
                <td className="py-1.5 pr-2 [overflow-wrap:anywhere] text-ink">
                  {d.path}
                  {d.note && <div className="mt-0.5 font-sans text-2xs text-muted">{d.note}</div>}
                </td>
                <td className="border-l-2 border-before/60 bg-before-soft px-2 py-1.5 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                  {d.before}
                </td>
                <td className="border-l-2 border-after/60 bg-after-soft px-2 py-1.5 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                  {d.after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {diffs.length > limit && (
        <Button variant="link" size="sm" className="mt-2" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${diffs.length}${diffs.length >= 200 ? '+' : ''}`}
        </Button>
      )}
    </>
  )
}
