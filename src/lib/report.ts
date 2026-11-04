import { change, displayPath, ms, num, ratio } from './format'
import type { Run } from './types'

const pad = (v: number) => String(v).padStart(2, '0')
export function stamp(date: number | string | Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Markdown report: one table row per endpoint, ready to paste in a PR or doc.
export function toMarkdown(run: Run): string {
  const { config } = run
  const lines = [
    `# ${config.name || 'API benchmark'}`,
    '',
    `- Date: ${stamp(run.startedAt)}`,
    `- Before: ${config.before.label} \`${config.before.baseUrl}\``,
    `- After: ${config.after.label} \`${config.after.baseUrl}\``,
    `- ${config.load.n} requests per endpoint, ${config.load.c} at a time, ${config.load.warmup} warm-up`,
    '',
  ]

  const checks = Object.values(run.checks || {})
  if (checks.length) {
    const same = checks.filter((c) => c.status === 'same').length
    lines.push(`Same data: ${same} of ${checks.length} endpoints match.`, '')
  }

  lines.push(
    '| Endpoint | Before p50 | After p50 | Before p95 | After p95 | Before p99 | After p99 | Before req/s | After req/s | Change (p50) | Errors before/after |',
    '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|',
  )
  for (const ep of config.endpoints) {
    const r = run.results?.[ep.id]
    if (!r?.before || !r?.after) continue
    const b = r.before
    const a = r.after
    lines.push(
      `| \`${ep.method} ${displayPath(ep)}\` | ${ms(b.p50)} | ${ms(a.p50)} | ${ms(b.p95)} | ${ms(a.p95)} | ${ms(b.p99)} | ${ms(a.p99)} | ${num(b.rps)} | ${num(a.rps)} | ${change(ratio(b.p50, a.p50)).text} | ${b.errors}/${a.errors} |`,
    )
  }
  return lines.join('\n') + '\n'
}
