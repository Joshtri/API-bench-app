// DEV ONLY (loaded from main.tsx behind import.meta.env.DEV; never in a build).
// Seeds a saved run + settings through the same boundaries the app uses
// (the store for History, localStorage for settings), then opens it from
// History. Toggle: ?data=demo|sample|worst|empty|one|huge
import { saveStored } from '@/lib/storage'
import type { Diff } from '@/bindings/Diff'
import type { CheckResult, Endpoint, EndpointResult, Method, Run, Stats } from '@/lib/types'

const MODES = ['demo', 'sample', 'worst', 'empty', 'one', 'huge'] as const
const mode = new URLSearchParams(location.search).get('data')
// ?theme=light|dark forces a theme (for screenshots).
const forcedTheme = new URLSearchParams(location.search).get('theme')
if (forcedTheme) {
  localStorage.setItem('apibench.theme', forcedTheme)
  document.documentElement.setAttribute('data-theme', forcedTheme)
}

// ── Fixture builders (same shapes as the Rust engine) ───────────────────────

type StatOptions = {
  spread?: number
  count?: number
  errors?: number
  statuses?: Record<string, number>
  errorMessages?: Record<string, number>
  rps?: number
  avgBytes?: number
}

function stat(p50: number, { spread = 1.6, count = 1000, errors = 0, statuses, errorMessages = {}, rps, avgBytes = 2048 }: StatOptions = {}): Stats {
  if (!count) {
    return { count: 0, errors, statuses: statuses ?? {}, errorMessages, min: 0, max: 0, mean: 0, stddev: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, rps: 0, avgBytes: 0, wallMs: 1, cdf: [] }
  }
  const at = (q: number) => p50 * Math.pow(spread, (q - 50) / 25)
  return {
    count,
    errors,
    statuses: statuses ?? { 200: count },
    errorMessages,
    min: at(0),
    max: at(100) * 3,
    mean: at(55),
    stddev: p50 * 0.4,
    p50: at(50),
    p75: at(75),
    p90: at(90),
    p95: at(95),
    p99: at(99),
    rps: rps ?? 1000 / p50,
    avgBytes,
    wallMs: 1000,
    cdf: Array.from({ length: 101 }, (_, i) => at(i)),
  }
}

let n = 0
const ep = (path: string, method: Method = 'GET', extra: Partial<Endpoint> = {}): Endpoint => ({
  id: `w${n++}`,
  enabled: true,
  method,
  path,
  afterPath: '',
  body: '',
  ...extra,
})

const longDiffs: Diff[] = Array.from({ length: 200 }, (_, i) => ({
  path: `.data[${i}].attributes.relationships.organization.data.meta.permissions["can-manage-billing-and-invoices"]`,
  before: i % 3 === 0 ? '"Aleksandra Wiśniewska-Kowalczyk <aleksandra.wisniewska-kowalczyk@northwind-ind...' : 'true',
  after: i % 3 === 0 ? '—' : i % 3 === 1 ? 'false' : '"true"',
  note: i % 3 === 0 ? 'missing in After' : i % 3 === 2 ? 'type boolean → string' : undefined,
}))

function worst(): Run {
  const eps = [
    ep('/v1/organizations/9f8b2c4e-1a7d-4b3e-9c2f-5d6e7f8a9b0c/projects/landing-page-2026/environments/production/deployments?include=artifacts,logs,metrics&limit=50', 'GET', {
      afterPath: '/v2/deployments?organization_id=9f8b2c4e-1a7d-4b3e-9c2f-5d6e7f8a9b0c&environment=production',
    }),
    ep('/api/v1/catégories/électroménager?tri=prix&ordre=décroissant'),
    ep('', 'GET'),
    ep('/reports/annual-export.csv', 'POST', { body: '{"year":2026}' }),
    ep('/cache/purge-all', 'DELETE'),
    ep('/health', 'HEAD'),
    ep('/المنتجات/ساعات?lang=ar'),
    ep('/search?q=bartholomew.fitzgerald%40northwind-industries-holdings.example.com'),
    ep('/never-measured', 'PATCH'),
  ]
  const [deep, accents, root, post, del, head, arabic, search] = eps
  return {
    id: 'worst-case',
    startedAt: Date.now() - 3600_000,
    status: 'done',
    elapsedMs: 3 * 3600_000 + 754_321,
    fraction: 1,
    saved: true,
    config: {
      name: 'Northwind Industries Holdings — billing & invoicing API migration (Express 4 → Go 1.23, eu-west-1, production mirror)',
      before: { label: 'Legacy monolith (Express 4 · Node 16 · eu-west-1)', baseUrl: 'https://legacy-billing-api.internal.northwind-industries-holdings.example.com:8443/api/v1', headers: '' },
      after: { label: 'Go', baseUrl: 'http://10.0.0.12:3000', headers: '' },
      load: { n: 100000, c: 500, warmup: 10000, timeoutMs: 30000 },
      options: { check: true, ignoreOrder: true },
      endpoints: eps,
    },
    checks: {
      [deep.id]: { status: 'diff', diffs: longDiffs, statusBefore: 200, statusAfter: 200, sizeBefore: 18_734_112, sizeAfter: 18_102_004 },
      [accents.id]: { status: 'same', diffs: [], statusBefore: 200, statusAfter: 200, sizeBefore: 812, sizeAfter: 812 },
      [root.id]: { status: 'diff', diffs: [{ path: '(status)', before: '200', after: '404' }, { path: '(body)', before: '"<!doctype html><html lang=\\"en\\"><head><meta charset=\\"utf-8\\"><title>Northwind...', after: '"Not Found"', note: 'not JSON; text differs' }], statusBefore: 200, statusAfter: 404, sizeBefore: 48_211, sizeAfter: 9 },
      [post.id]: { status: 'error', error: 'Before: Timed out after 30000 ms · After: ECONNRESET: socket hang up while reading response body from http://10.0.0.12:3000/reports/annual-export.csv' },
      [del.id]: { status: 'diff', diffs: [{ path: '.deleted', before: '1284', after: '1' }], statusBefore: 200, statusAfter: 200, sizeBefore: 31, sizeAfter: 28 },
      [head.id]: { status: 'same', diffs: [], statusBefore: 200, statusAfter: 200, sizeBefore: 0, sizeAfter: 0 },
      [arabic.id]: { status: 'same', diffs: [], statusBefore: 200, statusAfter: 200, sizeBefore: 1, sizeAfter: 1 },
      [search.id]: { status: 'diff', diffs: [{ path: '.results', before: '1 items', after: '0 items', note: 'different length' }], statusBefore: 200, statusAfter: 200, sizeBefore: 2_048, sizeAfter: 64 },
    },
    progress: {},
    results: {
      // 12 s vs 0.4 ms: a 29,000× ratio
      [deep.id]: { before: stat(12_345, { rps: 0.08, count: 100000, avgBytes: 18_734_112 }), after: stat(0.42, { rps: 12_345.6, count: 100000, avgBytes: 18_102_004 }) },
      [accents.id]: { before: stat(8.2), after: stat(8.1) },
      // After answers nothing but 404
      [root.id]: { before: stat(3.1), after: stat(0, { count: 0, errors: 100000, statuses: { 404: 100000 } }) },
      // Big regression, lots of errors with long messages
      [post.id]: {
        before: stat(240, { errors: 4321, count: 95679, statuses: { 200: 95679, 429: 4000, 503: 321 } }),
        after: stat(1880, { errors: 99_990, count: 10, statuses: { 200: 10 }, errorMessages: { 'Timed out after 30000 ms': 98_000, 'ECONNRESET: socket hang up while reading response body': 1_990 } }),
      },
      [del.id]: { before: stat(41), after: stat(43) },
      [head.id]: { before: stat(0.09), after: stat(0.11) },
      [arabic.id]: { before: stat(999.6), after: stat(1000.4) },
      [search.id]: { before: stat(55), after: stat(5.5) },
      // `never` has no result: "not measured"
    },
  }
}

// Realistic: what the design's example run shows.
function sample(): Run {
  const eps = [ep('/'), ep('/users'), ep('/users/:id')]
  const [root, users, user] = eps
  const same: CheckResult = { status: 'same', diffs: [], statusBefore: 200, statusAfter: 200, sizeBefore: 512, sizeAfter: 512 }
  return {
    id: 'sample-case',
    startedAt: Date.now() - 600_000,
    status: 'done',
    elapsedMs: 18_400,
    fraction: 1,
    saved: true,
    config: {
      name: 'My API migration',
      before: { label: 'Before', baseUrl: 'http://localhost:8080', headers: '' },
      after: { label: 'After', baseUrl: 'http://localhost:3000', headers: '' },
      load: { n: 100, c: 1, warmup: 10, timeoutMs: 30000 },
      options: { check: true, ignoreOrder: true },
      endpoints: eps,
    },
    checks: {
      [root.id]: same,
      [users.id]: same,
      [user.id]: { status: 'diff', diffs: [{ path: '$.created_at', before: '"2026-10-30 14:02:11"', after: '"2026-10-30T14:02:11Z"', note: 'Same moment, new format. Clients parsing the old string may break.' }], statusBefore: 200, statusAfter: 200, sizeBefore: 220, sizeAfter: 221 },
    },
    progress: {},
    results: {
      [root.id]: { before: stat(18, { rps: 52.4, count: 100 }), after: stat(12, { rps: 78.1, count: 100 }) },
      [users.id]: { before: stat(64, { spread: 1.7, rps: 14.9, count: 100 }), after: stat(39, { spread: 1.5, rps: 24.6, count: 100 }) },
      [user.id]: { before: stat(44, { rps: 21.8, count: 100 }), after: stat(33, { spread: 1.9, rps: 28.4, count: 98, errors: 2, statuses: { 200: 98, 500: 2 } }) },
    },
  }
}

function one(): Run {
  const e = ep('/x')
  return {
    id: 'one-case',
    startedAt: Date.now(),
    status: 'cancelled',
    elapsedMs: 900,
    fraction: 0.5,
    saved: true,
    config: { name: 'Jo', before: { label: 'A', baseUrl: 'http://a', headers: '' }, after: { label: 'B', baseUrl: 'http://b', headers: '' }, load: { n: 1, c: 1, warmup: 0, timeoutMs: 100 }, options: { check: true, ignoreOrder: false }, endpoints: [e] },
    checks: { [e.id]: { status: 'diff', diffs: [{ path: '.a', before: '1', after: '2' }], statusBefore: 200, statusAfter: 200, sizeBefore: 1, sizeAfter: 1 } },
    progress: {},
    results: { [e.id]: { before: stat(1, { count: 1, errors: 1, statuses: { 200: 1, 500: 1 } }), after: stat(1, { count: 1 }) } },
  }
}

function empty(): Run {
  return {
    id: 'empty-case',
    startedAt: Date.now(),
    status: 'cancelled',
    elapsedMs: 120,
    fraction: 0,
    saved: true,
    config: { name: '', before: { label: '', baseUrl: 'http://a', headers: '' }, after: { label: '', baseUrl: 'http://b', headers: '' }, load: { n: 100, c: 1, warmup: 0, timeoutMs: 1000 }, options: { check: false, ignoreOrder: false }, endpoints: [ep('/a'), ep('/b')] },
    checks: {},
    progress: {},
    results: {},
  }
}

function huge(): Run {
  const eps = Array.from({ length: 400 }, (_, i) => ep(`/v1/items/${i}?expand=owner,tags`, (['GET', 'POST', 'PUT', 'DELETE'] as const)[i % 4]))
  const results: Record<string, EndpointResult> = {}
  const checks: Record<string, CheckResult> = {}
  for (const [i, e] of eps.entries()) {
    results[e.id] = { before: stat(20 + (i % 37)), after: stat(10 + (i % 53)) }
    checks[e.id] = i % 9 ? { status: 'same', diffs: [], statusBefore: 200, statusAfter: 200, sizeBefore: 10, sizeAfter: 10 } : { status: 'diff', diffs: longDiffs.slice(0, 3), statusBefore: 200, statusAfter: 200, sizeBefore: 10, sizeAfter: 11 }
  }
  return { ...worst(), id: 'huge-case', config: { ...worst().config, name: '400 endpoints', endpoints: eps }, results, checks }
}

// ── Seed + open ─────────────────────────────────────────────────────────────

const build = mode ? ({ sample, worst, one, empty, huge } as Record<string, () => Run>)[mode] : undefined
if (build) {
  const run = build()
  const history = mode === 'huge' ? [run] : [run, ...Array.from({ length: 29 }, (_, i) => ({ ...one(), id: `h${i}`, config: { ...one().config, name: i % 2 ? 'Northwind Industries Holdings — billing & invoicing API migration (production mirror)' : 'Jo' } }))]
  await saveStored('history', history)
  localStorage.setItem('apibench.config', JSON.stringify(run.config))
  // Open the seeded run through the History panel, like a user would.
  const open = () => {
    const btn = document.querySelector('header button[aria-label^="History"]')
    if (!btn) return void requestAnimationFrame(open)
    ;(btn as HTMLElement).click()
    const pick = () => {
      const item = document.querySelector('[role="dialog"] li button')
      if (!item) return void requestAnimationFrame(pick)
      ;(item as HTMLElement).click()
    }
    pick()
  }
  setTimeout(open, 300)
}

// ── Toggle (plain chrome, not part of the design under test) ────────────────

const bar = document.createElement('div')
bar.setAttribute('style', 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;display:flex;gap:2px;padding:2px;background:#ddd;border-radius:6px;font:12px system-ui;box-shadow:0 1px 4px rgba(0,0,0,.2)')
for (const m of MODES) {
  const b = document.createElement('button')
  const on = (mode || 'demo') === m
  b.textContent = { demo: 'Demo data', sample: 'Sample run', worst: 'Worst case', empty: 'Empty', one: 'One', huge: '400 rows' }[m]
  b.setAttribute('style', `border:0;border-radius:4px;padding:4px 10px;cursor:pointer;background:${on ? '#fff' : 'transparent'};color:#111`)
  b.onclick = async () => {
    const u = new URL(location.href)
    if (m === 'demo') {
      u.searchParams.delete('data')
      await saveStored('history', [])
      localStorage.removeItem('apibench.config')
    } else u.searchParams.set('data', m)
    location.href = u.toString()
  }
  bar.append(b)
}
addEventListener('DOMContentLoaded', () => document.body.append(bar))
if (document.readyState !== 'loading') document.body.append(bar)
