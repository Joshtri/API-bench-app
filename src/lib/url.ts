// URL helpers for the form previews. The Rust engine (src-tauri/src/url.rs)
// does the same cleanup, so the URL the form previews is exactly the URL
// that gets called. Both are tested against fixtures/url-cases.json.

// Splits "a/b?x=1#y" into ["a/b", "?x=1#y"].
function splitQuery(v: string): [string, string] {
  const i = v.search(/[?#]/)
  return i === -1 ? [v, ''] : [v.slice(0, i), v.slice(i)]
}

// Index of the last "http://" or "https://" before the query string, or -1.
function lastScheme(v: string): number {
  const [head] = splitQuery(v)
  let at = -1
  for (const m of head.matchAll(/https?:\/\//gi)) at = m.index
  return at
}

// Fixes common paste mistakes in a base URL:
//   "https://x.com/https://x.com/"  → "https://x.com"   (pasted twice)
//   "https://x.com/api//"            → "https://x.com/api"
export function cleanBase(raw: string | null | undefined): string {
  let v = String(raw ?? '').trim()
  const at = lastScheme(v)
  if (at > 0) v = v.slice(at)
  const m = v.match(/^(https?:\/\/[^/?#]*)(.*)$/i)
  if (!m) return v.replace(/\/+$/, '')
  const [path, query] = splitQuery(m[2])
  return m[1] + path.replace(/\/{2,}/g, '/').replace(/\/+$/, '') + query
}

// Turns whatever was typed in a path field into "/path?query":
//   "faqs"                        → "/faqs"
//   "//faqs"                      → "/faqs"
//   "https://x.com/api/faqs" with base "https://x.com/api" → "/faqs"
//   "https://other.com/faqs"      → "/faqs" (the host comes from the base URL)
export function cleanPath(raw: string | null | undefined, base = ''): string {
  let p = String(raw ?? '').trim()
  if (!p) return ''
  const at = lastScheme(p)
  if (at !== -1) {
    const [head, query] = splitQuery(p.slice(at))
    const [, origin, rest] = head.match(/^(https?:\/\/[^/]*)(.*)$/i)!
    p = origin + rest.replace(/\/{2,}/g, '/') + query
    const b = cleanBase(base)
    if (b && p.toLowerCase().startsWith(b.toLowerCase())) p = p.slice(b.length)
    else p = p.replace(/^https?:\/\/[^/?#]*/i, '')
  }
  const [path, query] = splitQuery(p)
  return ('/' + path).replace(/\/{2,}/g, '/') + query
}

export function joinUrl(base: string, path: string): string {
  return cleanBase(base) + cleanPath(path, base)
}
