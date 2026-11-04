import type { Config, Endpoint, Method, Metric } from './types'

let seq = 0
export const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`

const ep = (path: string, method: Method = 'GET'): Endpoint => ({ id: newId(), enabled: true, method, path, afterPath: '', body: '' })

const base = (): Pick<Config, 'load' | 'options'> => ({
  load: { n: 100, c: 1, warmup: 10, timeoutMs: 30000 },
  options: { check: true, ignoreOrder: true },
})

// Starting point for any API: fill in your own URLs and endpoints.
export const blankConfig = (): Config => ({
  ...base(),
  name: 'My API migration',
  before: { label: 'Before', baseUrl: 'http://localhost:8080', headers: '' },
  after: { label: 'After', baseUrl: 'http://localhost:3000', headers: '' },
  endpoints: [ep('/')],
})

// Ready-made examples, shown under "Examples" in the Profiles menu.
export const EXAMPLES: { name: string; config: () => Config }[] = [
  {
    name: 'Dolphin landing API (Hono → Go)',
    config: () => ({
      ...base(),
      name: 'Dolphin landing API migration',
      before: { label: 'Before (Hono/Bun)', baseUrl: 'http://localhost:5001/api', headers: '' },
      after: { label: 'After (Go)', baseUrl: 'http://localhost:3000/api/public', headers: '' },
      endpoints: [
        '/landing-page',
        '/pricing',
        '/perfumes',
        '/faqs',
        '/testimonials',
        '/locations',
        '/contacts',
        '/home-sections',
        '/settings',
        '/articles?page=1&limit=9',
      ].map((p) => ep(p)),
    }),
  },
  {
    name: 'Public demo (JSONPlaceholder vs DummyJSON)',
    config: () => ({
      ...base(),
      load: { n: 30, c: 2, warmup: 3, timeoutMs: 15000 },
      name: 'Public demo APIs',
      before: { label: 'JSONPlaceholder', baseUrl: 'https://jsonplaceholder.typicode.com', headers: '' },
      after: { label: 'DummyJSON', baseUrl: 'https://dummyjson.com', headers: '' },
      endpoints: [ep('/posts/1'), ep('/users/1'), ep('/todos/1')],
    }),
  },
]

export const defaultConfig = blankConfig

export const blankEndpoint = (path = '') => ep(path)

/** Settings from a file, a profile or an old version: anything goes in. */
export type LooseConfig = Partial<Omit<Config, 'before' | 'after' | 'load' | 'options' | 'endpoints'>> & {
  before?: Partial<Config['before']>
  after?: Partial<Config['after']>
  load?: Partial<Config['load']>
  options?: Partial<Config['options']>
  endpoints?: Partial<Endpoint>[]
}

// Fills in missing fields. Endpoints keep their ids unless `freshIds`.
export function mergeConfig(c: LooseConfig, freshIds = false): Config {
  const d = blankConfig()
  return {
    ...d,
    ...c,
    before: { ...d.before, ...c.before },
    after: { ...d.after, ...c.after },
    load: { ...d.load, ...c.load },
    options: { ...d.options, ...c.options },
    endpoints: Array.isArray(c.endpoints)
      ? c.endpoints.map((e) => ({ ...ep(''), ...e, ...(freshIds ? { id: newId() } : {}), enabled: e.enabled !== false }))
      : d.endpoints,
  }
}

// Gives imported endpoints fresh ids and fills in missing fields.
export const cleanConfig = (c: LooseConfig): Config => mergeConfig(c, true)

export const METRICS: Metric[] = [
  { key: 'p50', label: 'p50 (median)' },
  { key: 'p90', label: 'p90' },
  { key: 'p95', label: 'p95' },
  { key: 'p99', label: 'p99' },
  { key: 'mean', label: 'Mean' },
  { key: 'max', label: 'Max' },
]

export const LOAD_PRESETS = [
  { label: 'Quick', n: 20, c: 1, warmup: 5, hint: 'A fast sanity pass. Good for checking that everything responds.' },
  { label: '1 at a time', n: 100, c: 1, warmup: 10, hint: 'Requests run one after another. Cleanest latency numbers.' },
  { label: '10 at a time', n: 500, c: 10, warmup: 10, hint: 'Ten requests in flight. Closer to real traffic.' },
  { label: 'Stress', n: 2000, c: 50, warmup: 20, hint: 'Pushes both APIs hard. Expect errors on weak servers.' },
]
