// App-side types. Everything the Rust engine sends or receives comes from
// src/bindings (generated from the Rust structs by ts-rs: `bun run bindings`).
import type { BenchEvent } from '@/bindings/BenchEvent'
import type { CheckResult } from '@/bindings/CheckResult'
import type { Side } from '@/bindings/Side'
import type { Stats } from '@/bindings/Stats'

export type { BenchEvent, CheckResult, Side, Stats }

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const
export type Method = (typeof METHODS)[number]

// ── Editable settings ────────────────────────────────────────────────────────

/** A number field the user can clear while typing. */
export type NumInput = number | ''

export interface Endpoint {
  id: string
  enabled: boolean
  method: Method
  path: string
  /** Empty means the same path as Before. */
  afterPath: string
  body: string
}

export interface TargetSettings {
  label: string
  baseUrl: string
  /** "Name: value" per line, as typed. */
  headers: string
}

export interface LoadSettings {
  n: NumInput
  c: NumInput
  warmup: NumInput
  timeoutMs: NumInput
}

export interface RunOptions {
  check: boolean
  ignoreOrder: boolean
}

export interface Config {
  name: string
  before: TargetSettings
  after: TargetSettings
  load: LoadSettings
  options: RunOptions
  endpoints: Endpoint[]
}

export interface Profile {
  name: string
  savedAt: number
  config: Config
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'running' | 'done' | 'cancelled' | 'error'

export interface SideProgress {
  done: number
  total: number
}

export interface EndpointResult {
  before: Stats
  after: Stats
}

export interface Run {
  id: string
  startedAt: number
  status: RunStatus
  /** Snapshot of the settings, with only the endpoints that ran. */
  config: Config
  checks: Record<string, CheckResult>
  progress: Record<string, Partial<Record<Side, SideProgress>>>
  results: Record<string, EndpointResult>
  fraction: number
  elapsedMs?: number
  current?: string | null
  error?: string
  saved?: boolean
  fromHistory?: boolean
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export type StatKey = 'min' | 'max' | 'mean' | 'stddev' | 'p50' | 'p75' | 'p90' | 'p95' | 'p99'
export type MetricKey = 'p50' | 'p90' | 'p95' | 'p99' | 'mean' | 'max'

export interface Metric {
  key: MetricKey
  label: string
}
