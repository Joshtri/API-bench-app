import type { Endpoint } from './types'

type Maybe = number | null | undefined

export function ms(v: Maybe): string {
  if (v == null || Number.isNaN(v)) return '–'
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`
  if (v >= 100) return `${v.toFixed(0)} ms`
  if (v >= 10) return `${v.toFixed(1)} ms`
  return `${v.toFixed(2)} ms`
}

export function num(v: Maybe, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '–'
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function bytes(v: Maybe): string {
  if (!v) return '0 B'
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / 1024 / 1024).toFixed(2)} MB`
}

export function duration(msTotal: Maybe): string {
  if (msTotal == null) return '–'
  const s = msTotal / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

// ratio > 1 means After is faster.
export function ratio(before: Maybe, after: Maybe): number | null {
  if (!before || !after) return null
  return before / after
}

export type ChangeVariant = 'success' | 'danger' | 'secondary'

export function change(r: Maybe): { text: string; variant: ChangeVariant; icon: string } {
  if (r == null) return { text: '–', variant: 'secondary', icon: 'dash' }
  if (r >= 1.05) return { text: `${r.toFixed(1)}× faster`, variant: 'success', icon: 'arrow-down' }
  if (r <= 0.95) return { text: `${(1 / r).toFixed(1)}× slower`, variant: 'danger', icon: 'arrow-up' }
  return { text: 'about the same', variant: 'secondary', icon: 'dash' }
}

export function geoMean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && x > 0)
  if (!v.length) return null
  return Math.exp(v.reduce((a, b) => a + Math.log(b), 0) / v.length)
}

export function displayPath(ep: Pick<Endpoint, 'path' | 'afterPath'> | undefined): string {
  if (!ep) return '/'
  return ep.afterPath ? `${ep.path} → ${ep.afterPath}` : ep.path || '/'
}

export function parseHeaders(text: string | undefined): { headers: Record<string, string>; bad: string[] } {
  const out: Record<string, string> = {}
  const bad: string[] = []
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf(':')
    if (i <= 0) bad.push(line)
    else out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { headers: out, bad }
}
