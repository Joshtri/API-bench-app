import { Channel, invoke } from '@tauri-apps/api/core'
import type { RunRequest } from '@/bindings/RunRequest'
import { parseHeaders } from './format'
import type { BenchEvent, Config } from './types'

// Turns the editable config into what the Rust engine expects.
export function toRunRequest(config: Config): RunRequest {
  const { n, c, warmup, timeoutMs } = config.load
  return {
    before: { baseUrl: config.before.baseUrl.trim(), headers: parseHeaders(config.before.headers).headers },
    after: { baseUrl: config.after.baseUrl.trim(), headers: parseHeaders(config.after.headers).headers },
    load: { n: Number(n), c: Number(c), warmup: Number(warmup), timeoutMs: Number(timeoutMs) },
    options: config.options,
    endpoints: config.endpoints
      .filter((e) => e.enabled)
      .map(({ id, method, path, afterPath, body }) => ({ id, method, path: path.trim(), afterPath: afterPath.trim(), body })),
  }
}

// Starts a run and calls onEvent for every event the engine sends back.
// Resolves when the run has ended; rejects if another run is going.
export async function runBenchmark(config: Config, onEvent: (event: BenchEvent) => void): Promise<void> {
  const channel = new Channel<BenchEvent>()
  channel.onmessage = onEvent
  await invoke('run_bench', { config: toRunRequest(config), onEvent: channel })
}

// Stops the current run, if any. The engine then sends a `cancelled` event.
export function cancelBenchmark(): Promise<void> {
  return invoke('cancel_bench')
}
