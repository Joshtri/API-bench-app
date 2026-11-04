// URL cleanup. Mirrors src/lib/url.ts exactly, so the URL the form previews
// is the URL that gets called. Both read the cases in fixtures/url-cases.json.

/// Splits "a/b?x=1#y" into ("a/b", "?x=1#y").
fn split_query(v: &str) -> (&str, &str) {
    match v.find(['?', '#']) {
        Some(i) => v.split_at(i),
        None => (v, ""),
    }
}

/// Byte index of the last "http://" or "https://" before the query string.
fn last_scheme(v: &str) -> Option<usize> {
    let head = split_query(v).0.to_ascii_lowercase();
    let last = |pat: &str| head.rmatch_indices(pat).next().map(|(i, _)| i);
    last("http://").max(last("https://"))
}

/// Length of a leading "http://" or "https://" (any case), if there is one.
fn scheme_len(v: &str) -> Option<usize> {
    let lower = v.get(..8).unwrap_or(v).to_ascii_lowercase();
    if lower.starts_with("https://") {
        Some(8)
    } else if lower.starts_with("http://") {
        Some(7)
    } else {
        None
    }
}

/// Splits "https://host/rest" into ("https://host", "/rest"); the host ends
/// at the first character in `stop`.
fn split_origin<'a>(v: &'a str, stop: &[char]) -> Option<(&'a str, &'a str)> {
    let s = scheme_len(v)?;
    let end = v[s..].find(stop).map_or(v.len(), |i| s + i);
    Some(v.split_at(end))
}

/// Replaces every run of two or more "/" with one.
fn collapse_slashes(v: &str) -> String {
    let mut out = String::with_capacity(v.len());
    for c in v.chars() {
        if !(c == '/' && out.ends_with('/')) {
            out.push(c);
        }
    }
    out
}

/// Fixes common paste mistakes in a base URL:
///   "https://x.com/https://x.com/"  → "https://x.com"   (pasted twice)
///   "https://x.com/api//"           → "https://x.com/api"
pub fn clean_base(raw: &str) -> String {
    let mut v = raw.trim();
    if let Some(at) = last_scheme(v).filter(|&at| at > 0) {
        v = &v[at..];
    }
    match split_origin(v, &['/', '?', '#']) {
        None => v.trim_end_matches('/').to_string(),
        Some((origin, rest)) => {
            let (path, query) = split_query(rest);
            format!("{origin}{}{query}", collapse_slashes(path).trim_end_matches('/'))
        }
    }
}

/// Turns whatever was typed in a path field into "/path?query":
///   "faqs"                    → "/faqs"
///   "//faqs"                  → "/faqs"
///   "https://x.com/api/faqs" with base "https://x.com/api" → "/faqs"
///   "https://other.com/faqs"  → "/faqs" (the host comes from the base URL)
pub fn clean_path(raw: &str, base: &str) -> String {
    let mut p = raw.trim().to_string();
    if p.is_empty() {
        return p;
    }
    if let Some(at) = last_scheme(&p) {
        let (head, query) = split_query(&p[at..]);
        let (origin, rest) = split_origin(head, &['/']).expect("starts with a scheme");
        let full = format!("{origin}{}{query}", collapse_slashes(rest));
        let b = clean_base(base);
        p = if !b.is_empty() && full.to_ascii_lowercase().starts_with(&b.to_ascii_lowercase()) {
            full[b.len()..].to_string()
        } else {
            let (_, rest) = split_origin(&full, &['/', '?', '#']).expect("starts with a scheme");
            rest.to_string()
        };
    }
    let (path, query) = split_query(&p);
    format!("{}{query}", collapse_slashes(&format!("/{path}")))
}

pub fn join_url(base: &str, path: &str) -> String {
    clean_base(base) + &clean_path(path, base)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    struct Case {
        base: String,
        path: String,
        url: String,
    }

    #[test]
    fn join_url_handles_slashes() {
        let cases: Vec<Case> = serde_json::from_str(include_str!("../../fixtures/url-cases.json")).unwrap();
        assert!(!cases.is_empty());
        for c in cases {
            assert_eq!(join_url(&c.base, &c.path), c.url, "joinUrl({:?}, {:?})", c.base, c.path);
        }
    }

    #[test]
    fn clean_base_and_path_examples() {
        assert_eq!(clean_base("  https://x.com/api// "), "https://x.com/api");
        assert_eq!(clean_base("localhost:8080/"), "localhost:8080");
        assert_eq!(clean_path("faqs", ""), "/faqs");
        assert_eq!(clean_path("https://other.com/faqs", "https://x.com/api"), "/faqs");
        assert_eq!(clean_path("HTTPS://X.COM/api/faqs", "https://x.com/api"), "/faqs");
    }
}
