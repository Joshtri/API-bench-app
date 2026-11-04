# API Bench (desktop)

A desktop tool to compare two versions of **any HTTP API**: Before and After
a migration, a rewrite, a new framework, a new server, or two different
providers. For each endpoint it:

1. **Checks the data**: calls both once and compares the JSON field by field.
   You can choose to ignore list order (items are sorted by `id`), and
   timestamps are compared as instants, not as text.
2. **Measures speed**: sends N requests, C at a time, to each side after a
   warm-up, and reports p50 / p90 / p95 / p99 / mean / max, requests per
   second, status codes and errors.

Stack: Tauri v2. The engine is Rust (reqwest + tokio, hdrhistogram); the UI is
React + TypeScript + Vite, Tailwind 4, Radix, Recharts.

## Run it

```sh
bun install
bun run tauri dev      # desktop app with hot reload
bun run tauri build    # installer in src-tauri/target/release/bundle
```

1. Start the two APIs you want to compare.
2. Fill in the **Before** and **After** base URLs (and headers if they need
   auth, for example `Authorization: Bearer …`).
3. Add the endpoints. Use **Paste list** for many at once (`/users`,
   `POST /search`, …).
4. Pick a load preset and press **Run**.

## Profiles and History

- **Profiles** (top of the Targets card): save URLs, headers, load and
  endpoints per project. Start from Blank or an example. **Export / Import
  settings** use native file dialogs, so a `*.bench.json` can live in a
  project's repo for teammates.
- **History**: finished runs (last 30). Open, delete, import a run, or export
  it as JSON or a Markdown table for a PR.

Profiles and History are kept by the Tauri store plugin in
`apibench.json` in the app data folder (`%APPDATA%\com.yosry.api-benchmark-desktop`
on Windows). The current settings and the theme stay in the webview's
localStorage.

## Endpoint options

- Any method: GET, POST, PUT, PATCH, DELETE, HEAD. Methods that write show a
  warning, because every request writes on both APIs.
- A request body for POST/PUT/PATCH (JSON by default).
- **Different path on After**, for when the route changed (for example
  `/api/v1/users` → `/v2/users`). Open a row (▾) to set it and see the full
  URL each side will call. In **Paste list**, write `/api/v1/users -> /v2/users`.
- URLs are tidied for you: a trailing `/`, `//` in a path, a base URL pasted
  twice, or a full URL pasted into a path field all end up as one clean URL.

## How it works

```
React UI ── invoke('run_bench', { config, onEvent: Channel }) ──▶ Rust engine
         ◀── events: start, check, progress, result, done | cancelled | error
         ── invoke('cancel_bench') (Stop) ─────────────────────────▶
```

- `src-tauri/src/bench.rs`: validate → check data → warm up → load test →
  summarize. Each side gets its own keep-alive connection pool, with no
  system proxy. Workers run on tokio's thread pool, so the runner is not
  limited to one thread like the old Node version.
- Percentiles come from an HDR histogram (microseconds, 3 significant
  digits, so within 0.1%). Min, max, mean and stddev are exact.
- `src-tauri/src/url.rs` and `src/lib/url.ts` do the same URL cleanup (the
  engine and the form preview), tested against the same cases in
  `fixtures/url-cases.json`.
- Export / Import open native dialogs from Rust (`export_file`,
  `import_file`), so the webview has no general file-system access.
- `src/bindings/` is generated from the Rust structs by ts-rs. After changing
  a struct, run `bun run bindings`.

## Tips for fair numbers

- Run both APIs on the same machine (or the same kind of server), against the
  same database.
- Use "1 at a time" for the per-request comparison and "10 at a time" or
  "Stress" to see how each copes with load.
- Against remote APIs, network latency is part of every number. Compare
  APIs in the same region.

## Tests

```sh
bun run test         # both suites below
bun run test:engine  # Rust: URLs, diff, percentiles, validation, full run and cancel against local servers
bun run test:ui      # TypeScript URL helpers (same cases as Rust)
bun run typecheck
```
