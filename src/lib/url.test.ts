// Run with `bun run test:ui` (Node runs .ts files directly).
// The same cases are checked against the Rust engine in src-tauri/src/url.rs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { joinUrl } from './url.ts'

const cases: { base: string; path: string; url: string }[] = JSON.parse(
  readFileSync(new URL('../../fixtures/url-cases.json', import.meta.url), 'utf8'),
)

test('joinUrl handles slashes', () => {
  assert.ok(cases.length > 0)
  for (const c of cases) assert.equal(joinUrl(c.base, c.path), c.url, `joinUrl(${c.base}, ${c.path})`)
})
