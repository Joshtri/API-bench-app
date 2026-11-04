// Benchmark engine. For each endpoint it first checks that Before and After
// return the same data, then measures how fast each answers.
//
// Events go out through `Emit` (a Tauri Channel in the app, a Vec in tests),
// in this order: start, check*, (progress*, result)*, then done or cancelled.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use hdrhistogram::Histogram;
use reqwest::header::{CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

use crate::url::{clean_base, join_url};

const METHODS: [&str; 6] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const PROGRESS_EVERY: Duration = Duration::from_millis(100);
const DIFF_LIMIT: usize = 200;

pub type Emit = Arc<dyn Fn(BenchEvent) + Send + Sync>;

// ── Input (what the UI sends) ────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct RunRequest {
    pub before: TargetInput,
    pub after: TargetInput,
    pub load: LoadInput,
    pub endpoints: Vec<EndpointInput>,
    pub options: OptionsInput,
}

#[derive(Debug, Clone, Default, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct TargetInput {
    pub base_url: String,
    pub headers: HashMap<String, String>,
}

/// Numbers stay f64 so a value like 1.5 gets a readable error from
/// `validate` instead of a serde type error.
#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct LoadInput {
    pub n: f64,
    pub c: f64,
    pub warmup: f64,
    pub timeout_ms: f64,
}

impl Default for LoadInput {
    fn default() -> Self {
        Self { n: 0.0, c: 0.0, warmup: 0.0, timeout_ms: 30000.0 }
    }
}

#[derive(Debug, Clone, Default, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export, optional_fields)]
pub struct EndpointInput {
    pub id: Option<String>,
    pub method: Option<String>,
    pub path: Option<String>,
    pub after_path: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct OptionsInput {
    pub check: bool,
    pub ignore_order: bool,
}

impl Default for OptionsInput {
    fn default() -> Self {
        Self { check: true, ignore_order: true }
    }
}

// ── Output (events) ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum Side {
    Before,
    After,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum CheckStatus {
    Same,
    Diff,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct Diff {
    pub path: String,
    pub before: String,
    pub after: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub note: Option<String>,
}

/// Result of calling one endpoint once on both sides. On `error` only
/// `error` is set; otherwise the statuses, sizes and diffs are.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, optional_fields)]
pub struct CheckResult {
    pub status: CheckStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diffs: Option<Vec<Diff>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_before: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_after: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(as = "Option<f64>")]
    pub size_before: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(as = "Option<f64>")]
    pub size_after: Option<u64>,
}

/// Timings are in milliseconds. Only 2xx answers are timed.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Stats {
    pub count: u32,
    pub errors: u32,
    pub statuses: BTreeMap<String, u32>,
    pub error_messages: BTreeMap<String, u32>,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub stddev: f64,
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
    pub p95: f64,
    pub p99: f64,
    pub rps: f64,
    #[ts(type = "number")]
    pub avg_bytes: u64,
    pub wall_ms: f64,
    /// 101 points (p0..p100) for the latency distribution chart.
    pub cdf: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[ts(export)]
pub enum BenchEvent {
    Start { endpoints: u32, check: bool },
    Check {
        id: String,
        #[serde(flatten)]
        result: CheckResult,
    },
    Progress { id: String, side: Side, done: u32, total: u32 },
    Result { id: String, before: Stats, after: Stats },
    Done { elapsed_ms: f64 },
    Cancelled { elapsed_ms: f64 },
    Error { message: String },
}

// ── Validation ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Load {
    pub n: u32,
    pub c: u32,
    pub warmup: u32,
    pub timeout_ms: u32,
}

#[derive(Debug, Clone)]
pub struct Endpoint {
    pub id: String,
    pub method: Method,
    pub path: String,
    pub after_path: String,
    pub body: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Target {
    pub base_url: String,
    pub headers: HeaderMap,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub before: Target,
    pub after: Target,
    pub load: Load,
    pub endpoints: Vec<Endpoint>,
    pub check: bool,
    pub ignore_order: bool,
}

fn int(v: f64, min: u32, max: u32, name: &str) -> Result<u32, String> {
    if v.fract() != 0.0 || v < min as f64 || v > max as f64 {
        return Err(format!("{name} must be a whole number from {min} to {max}"));
    }
    Ok(v as u32)
}

fn target(t: &TargetInput, name: &str) -> Result<Target, String> {
    let base_url = clean_base(&t.base_url);
    let u = Url::parse(&base_url).map_err(|_| format!("{name} URL is not valid"))?;
    if u.scheme() != "http" && u.scheme() != "https" {
        return Err(format!("{name} URL must start with http:// or https://"));
    }
    let mut headers = HeaderMap::new();
    for (k, v) in &t.headers {
        let key = HeaderName::try_from(k.as_str()).map_err(|_| format!("{name} headers: \"{k}\" is not a valid header name"))?;
        let value = HeaderValue::try_from(v.as_str()).map_err(|_| format!("{name} headers: the value of \"{k}\" is not valid"))?;
        headers.insert(key, value);
    }
    Ok(Target { base_url, headers })
}

pub fn validate(cfg: &RunRequest) -> Result<Config, String> {
    let before = target(&cfg.before, "Before")?;
    let after = target(&cfg.after, "After")?;
    let l = &cfg.load;
    let load = Load {
        n: int(l.n, 1, 100_000, "Requests")?,
        c: int(l.c, 1, 500, "Concurrency")?,
        warmup: int(l.warmup, 0, 10_000, "Warm-up")?,
        timeout_ms: int(l.timeout_ms, 100, 600_000, "Timeout")?,
    };
    let endpoints = cfg
        .endpoints
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let m = e.method.as_deref().unwrap_or("GET").to_uppercase();
            if !METHODS.contains(&m.as_str()) {
                return Err(format!("Endpoint {}: method {m} is not supported", i + 1));
            }
            let method = Method::from_bytes(m.as_bytes()).expect("known method");
            let reads = method == Method::GET || method == Method::HEAD;
            Ok(Endpoint {
                id: e.id.clone().unwrap_or_else(|| i.to_string()),
                path: e.path.clone().unwrap_or_default(),
                after_path: e.after_path.clone().unwrap_or_default(),
                body: e.body.clone().filter(|b| !reads && !b.is_empty()),
                method,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    if endpoints.is_empty() {
        return Err("Pick at least one endpoint".into());
    }
    Ok(Config { before, after, load, endpoints, check: cfg.options.check, ignore_order: cfg.options.ignore_order })
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

struct Request {
    url: String,
    method: Method,
    headers: HeaderMap,
    body: Option<String>,
}

struct Reply {
    status: u16,
    size: u64,
    ms: f64,
    body: Vec<u8>,
}

const STOPPED: &str = "Stopped";

fn describe(e: &reqwest::Error, timeout_ms: u32) -> String {
    if e.is_timeout() {
        return format!("Timed out after {timeout_ms} ms");
    }
    // reqwest's own message includes the URL; the innermost cause is the
    // useful, stable part ("connection refused"), so errors group well.
    let mut src: &dyn std::error::Error = e;
    while let Some(s) = src.source() {
        src = s;
    }
    let msg = src.to_string();
    if e.is_connect() { format!("Could not connect: {msg}") } else { msg }
}

async fn send_once(client: &Client, r: &Request, keep_body: bool, timeout_ms: u32) -> Result<Reply, String> {
    let mut req = client.request(r.method.clone(), &r.url).headers(r.headers.clone());
    if let Some(body) = &r.body {
        if !r.headers.contains_key(CONTENT_TYPE) {
            req = req.header(CONTENT_TYPE, "application/json");
        }
        req = req.body(body.clone());
    }
    let t0 = Instant::now();
    let mut res = req.send().await.map_err(|e| describe(&e, timeout_ms))?;
    let status = res.status().as_u16();
    let mut size = 0u64;
    let mut body = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|e| describe(&e, timeout_ms))? {
        size += chunk.len() as u64;
        if keep_body {
            body.extend_from_slice(&chunk);
        }
    }
    Ok(Reply { status, size, ms: t0.elapsed().as_secs_f64() * 1000.0, body })
}

async fn send(client: &Client, r: &Request, keep_body: bool, timeout_ms: u32, cancel: &CancellationToken) -> Result<Reply, String> {
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(STOPPED.into()),
        res = send_once(client, r, keep_body, timeout_ms) => res,
    }
}

fn make_client(connections: u32, timeout_ms: u32) -> Result<Client, String> {
    Client::builder()
        .pool_max_idle_per_host(connections as usize)
        .timeout(Duration::from_millis(timeout_ms as u64))
        .tcp_nodelay(true)
        // A system proxy would add its own latency to every number.
        .no_proxy()
        .build()
        .map_err(|e| format!("Could not start the HTTP client: {e}"))
}

// ── Load ─────────────────────────────────────────────────────────────────────

/// Collects one side's answers. Percentiles come from an HDR histogram
/// (microseconds, 3 significant digits, so within 0.1%); min, max, mean and
/// stddev are exact.
pub struct Recorder {
    hist: Histogram<u64>,
    count: u32,
    sum: f64,
    sum_sq: f64,
    min: f64,
    max: f64,
    errors: u32,
    bytes: u64,
    statuses: BTreeMap<String, u32>,
    error_messages: BTreeMap<String, u32>,
}

impl Default for Recorder {
    fn default() -> Self {
        Self {
            hist: Histogram::new(3).expect("3 significant digits is valid"),
            count: 0,
            sum: 0.0,
            sum_sq: 0.0,
            min: f64::INFINITY,
            max: 0.0,
            errors: 0,
            bytes: 0,
            statuses: BTreeMap::new(),
            error_messages: BTreeMap::new(),
        }
    }
}

impl Recorder {
    /// A timed 2xx answer.
    pub fn ok(&mut self, ms: f64, size: u64) {
        // Auto-resizes, so this only fails on absurd values; those still count.
        let _ = self.hist.record((ms * 1000.0).round() as u64);
        self.count += 1;
        self.sum += ms;
        self.sum_sq += ms * ms;
        self.min = self.min.min(ms);
        self.max = self.max.max(ms);
        self.bytes += size;
    }

    pub fn status(&mut self, code: u16) {
        *self.statuses.entry(code.to_string()).or_default() += 1;
    }

    pub fn error(&mut self, message: String) {
        self.errors += 1;
        *self.error_messages.entry(message).or_default() += 1;
    }

    fn reply(&mut self, r: Result<Reply, String>) {
        match r {
            Err(message) => self.error(message),
            Ok(r) => {
                self.status(r.status);
                if (200..300).contains(&r.status) {
                    self.ok(r.ms, r.size);
                } else {
                    self.errors += 1;
                }
            }
        }
    }

    pub fn finish(self, wall_ms: f64) -> Stats {
        let n = self.count;
        let (min, max) = if n > 0 { (self.min, self.max) } else { (0.0, 0.0) };
        let q = |q: f64| {
            if n == 0 {
                return 0.0;
            }
            (self.hist.value_at_quantile(q) as f64 / 1000.0).clamp(min, max)
        };
        let mean = if n > 0 { self.sum / n as f64 } else { 0.0 };
        let variance = if n > 0 { (self.sum_sq / n as f64 - mean * mean).max(0.0) } else { 0.0 };
        Stats {
            count: n,
            errors: self.errors,
            statuses: self.statuses,
            error_messages: self.error_messages,
            min,
            max,
            mean,
            stddev: variance.sqrt(),
            p50: q(0.50),
            p75: q(0.75),
            p90: q(0.90),
            p95: q(0.95),
            p99: q(0.99),
            rps: if wall_ms > 0.0 { n as f64 / wall_ms * 1000.0 } else { 0.0 },
            avg_bytes: if n > 0 { (self.bytes as f64 / n as f64).round() as u64 } else { 0 },
            wall_ms,
            cdf: if n > 0 { (0..=100).map(|i| q(i as f64 / 100.0)).collect() } else { vec![] },
        }
    }
}

/// Throttles progress events to one per 100 ms, plus the final one.
struct Progress {
    emit: Emit,
    id: String,
    side: Side,
    total: u32,
    last: Mutex<Instant>,
}

impl Progress {
    fn send(&self, done: u32) {
        self.emit.as_ref()(BenchEvent::Progress { id: self.id.clone(), side: self.side, done, total: self.total });
    }

    fn tick(&self, done: u32) {
        let mut last = self.last.lock().unwrap();
        if done == self.total || last.elapsed() >= PROGRESS_EVERY {
            *last = Instant::now();
            self.send(done);
        }
    }
}

async fn load(client: &Client, req: Arc<Request>, l: &Load, cancel: &CancellationToken, progress: Arc<Progress>) -> Stats {
    // Warm up with the same concurrency so all connections are open before timing.
    let started = Arc::new(AtomicU32::new(0));
    let mut warm = JoinSet::new();
    for _ in 0..l.c.min(l.warmup) {
        let (client, req, cancel, started, l) = (client.clone(), req.clone(), cancel.clone(), started.clone(), l.clone());
        warm.spawn(async move {
            while !cancel.is_cancelled() && started.fetch_add(1, Ordering::Relaxed) < l.warmup {
                let _ = send(&client, &req, false, l.timeout_ms, &cancel).await;
            }
        });
    }
    warm.join_all().await;

    // One recorder for all workers: the lock is held for nanoseconds, a
    // request takes milliseconds, and 500 workers don't need 500 histograms.
    let rec = Arc::new(Mutex::new(Recorder::default()));
    let next = Arc::new(AtomicU32::new(0));
    let done = Arc::new(AtomicU32::new(0));
    let t0 = Instant::now();
    let mut workers = JoinSet::new();
    for _ in 0..l.c.min(l.n) {
        let (client, req, cancel, l) = (client.clone(), req.clone(), cancel.clone(), l.clone());
        let (next, done, progress, rec) = (next.clone(), done.clone(), progress.clone(), rec.clone());
        workers.spawn(async move {
            while !cancel.is_cancelled() && next.fetch_add(1, Ordering::Relaxed) < l.n {
                let r = send(&client, &req, false, l.timeout_ms, &cancel).await;
                if cancel.is_cancelled() {
                    break;
                }
                rec.lock().unwrap().reply(r);
                progress.tick(done.fetch_add(1, Ordering::Relaxed) + 1);
            }
        });
    }
    workers.join_all().await;
    let wall_ms = t0.elapsed().as_secs_f64() * 1000.0;
    let rec = Arc::into_inner(rec).expect("workers finished").into_inner().unwrap();
    rec.finish(wall_ms)
}

// ── Same data? ───────────────────────────────────────────────────────────────

fn looks_like_iso_date(s: &str) -> bool {
    // ^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}
    let b = s.as_bytes();
    let digit = |i: usize| b.get(i).is_some_and(u8::is_ascii_digit);
    b.len() >= 16
        && [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15].into_iter().all(digit)
        && b[4] == b'-'
        && b[7] == b'-'
        && (b[10] == b'T' || b[10] == b' ')
        && b[13] == b':'
}

/// The same instant as an ISO string in UTC ("2026-10-30T10:00:00.000Z"),
/// or None when the text is not a date. Times without an offset are local,
/// as in JavaScript's Date.parse.
fn to_instant(s: &str) -> Option<String> {
    use chrono::{DateTime, Local, NaiveDateTime, SecondsFormat, Utc};
    let t = s.replacen(' ', "T", 1);
    let utc: DateTime<Utc> = if let Ok(d) = DateTime::parse_from_rfc3339(&t) {
        d.to_utc()
    } else if let Ok(d) = DateTime::parse_from_str(&t, "%Y-%m-%dT%H:%M:%S%.f%z") {
        d.to_utc()
    } else {
        let naive = ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M"].iter().find_map(|f| NaiveDateTime::parse_from_str(&t, f).ok())?;
        naive.and_local_timezone(Local).earliest()?.to_utc()
    };
    Some(utc.to_rfc3339_opts(SecondsFormat::Millis, true))
}

fn sort_key(v: &Value) -> String {
    match v.get("id") {
        Some(Value::String(s)) if v.is_object() => s.clone(),
        Some(Value::Number(n)) if v.is_object() => match n.as_f64() {
            Some(f) if f.fract() == 0.0 && f.abs() < 1e15 => format!("{}", f as i64),
            _ => n.to_string(),
        },
        _ => v.to_string(),
    }
}

/// Removes differences a client does not care about: list order (when asked)
/// and the text format of timestamps (compared as instants).
pub fn normalize(v: &Value, ignore_order: bool) -> Value {
    match v {
        Value::Array(items) => {
            let mut a: Vec<Value> = items.iter().map(|x| normalize(x, ignore_order)).collect();
            if ignore_order {
                a.sort_by_cached_key(sort_key);
            }
            Value::Array(a)
        }
        Value::Object(o) => Value::Object(o.iter().map(|(k, x)| (k.clone(), normalize(x, ignore_order))).collect()),
        Value::String(s) if looks_like_iso_date(s) => to_instant(s).map_or_else(|| v.clone(), Value::String),
        _ => v.clone(),
    }
}

fn short(v: &Value) -> String {
    let s = v.to_string();
    if s.chars().count() > 80 { s.chars().take(77).collect::<String>() + "..." } else { s }
}

fn kind(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn d(path: &str, before: String, after: String, note: Option<String>) -> Diff {
    Diff { path: path.to_string(), before, after, note }
}

pub fn diff(path: &str, a: &Value, b: &Value, out: &mut Vec<Diff>) {
    if out.len() >= DIFF_LIMIT {
        return;
    }
    let at = if path.is_empty() { "(body)" } else { path };
    let (ka, kb) = (kind(a), kind(b));
    match (a, b) {
        _ if ka != kb => out.push(d(at, short(a), short(b), Some(format!("type {ka} → {kb}")))),
        (Value::Object(oa), Value::Object(ob)) => {
            let keys: BTreeSet<&String> = oa.keys().chain(ob.keys()).collect();
            for k in keys {
                let p = format!("{path}.{k}");
                match (oa.get(k), ob.get(k)) {
                    (Some(x), None) => out.push(d(&p, short(x), "—".into(), Some("missing in After".into()))),
                    (None, Some(y)) => out.push(d(&p, "—".into(), short(y), Some("only in After".into()))),
                    (Some(x), Some(y)) => diff(&p, x, y, out),
                    (None, None) => unreachable!(),
                }
            }
        }
        (Value::Array(xa), Value::Array(xb)) => {
            if xa.len() != xb.len() {
                out.push(d(at, format!("{} items", xa.len()), format!("{} items", xb.len()), Some("different length".into())));
            } else {
                for (i, (x, y)) in xa.iter().zip(xb).enumerate() {
                    diff(&format!("{path}[{i}]"), x, y, out);
                }
            }
        }
        // 1 and 1.0 are the same number to a JSON client.
        (Value::Number(x), Value::Number(y)) if x.as_f64() == y.as_f64() => {}
        _ if a != b => out.push(d(at, short(a), short(b), None)),
        _ => {}
    }
}

async fn check(client_b: &Client, client_a: &Client, rb: &Request, ra: &Request, cfg: &Config, cancel: &CancellationToken) -> CheckResult {
    let t = cfg.load.timeout_ms;
    let (b, a) = tokio::join!(send(client_b, rb, true, t, cancel), send(client_a, ra, true, t, cancel));
    let (b, a) = match (b, a) {
        (Ok(b), Ok(a)) => (b, a),
        (b, a) => {
            let parts: Vec<String> = [("Before", b.err()), ("After", a.err())]
                .into_iter()
                .filter_map(|(side, e)| e.map(|e| format!("{side}: {e}")))
                .collect();
            return CheckResult {
                status: CheckStatus::Error,
                error: Some(parts.join(" · ")),
                diffs: None,
                status_before: None,
                status_after: None,
                size_before: None,
                size_after: None,
            };
        }
    };
    let mut diffs = vec![];
    if b.status != a.status {
        diffs.push(d("(status)", b.status.to_string(), a.status.to_string(), None));
    }
    match (serde_json::from_slice::<Value>(&b.body), serde_json::from_slice::<Value>(&a.body)) {
        (Ok(jb), Ok(ja)) => diff("", &normalize(&jb, cfg.ignore_order), &normalize(&ja, cfg.ignore_order), &mut diffs),
        _ if b.body != a.body => {
            let text = |v: &[u8]| short(&Value::String(String::from_utf8_lossy(v).into_owned()));
            diffs.push(d("(body)", text(&b.body), text(&a.body), Some("not JSON; text differs".into())));
        }
        _ => {}
    }
    CheckResult {
        status: if diffs.is_empty() { CheckStatus::Same } else { CheckStatus::Diff },
        error: None,
        diffs: Some(diffs),
        status_before: Some(b.status),
        status_after: Some(a.status),
        size_before: Some(b.size),
        size_after: Some(a.size),
    }
}

// ── Run ──────────────────────────────────────────────────────────────────────

fn request(cfg: &Config, side: Side, ep: &Endpoint) -> Request {
    let (t, path) = match side {
        Side::Before => (&cfg.before, &ep.path),
        Side::After => (&cfg.after, if ep.after_path.is_empty() { &ep.path } else { &ep.after_path }),
    };
    Request { url: join_url(&t.base_url, path), method: ep.method.clone(), headers: t.headers.clone(), body: ep.body.clone() }
}

/// Runs a whole benchmark. A config that does not validate returns Err
/// before any event is sent; everything else is reported through `emit`.
pub async fn run_bench(raw: RunRequest, emit: Emit, cancel: CancellationToken) -> Result<(), String> {
    let cfg = validate(&raw)?;
    let l = &cfg.load;
    let client_b = make_client(l.c, l.timeout_ms)?;
    let client_a = make_client(l.c, l.timeout_ms)?;
    let started = Instant::now();
    let emit_ = |e| emit.as_ref()(e);
    emit_(BenchEvent::Start { endpoints: cfg.endpoints.len() as u32, check: cfg.check });

    if cfg.check {
        for ep in &cfg.endpoints {
            if cancel.is_cancelled() {
                break;
            }
            let result = check(&client_b, &client_a, &request(&cfg, Side::Before, ep), &request(&cfg, Side::After, ep), &cfg, &cancel).await;
            if cancel.is_cancelled() {
                break;
            }
            emit_(BenchEvent::Check { id: ep.id.clone(), result });
        }
    }

    'endpoints: for ep in &cfg.endpoints {
        let mut stats = Vec::with_capacity(2);
        for (side, client) in [(Side::Before, &client_b), (Side::After, &client_a)] {
            if cancel.is_cancelled() {
                break 'endpoints;
            }
            let progress = Arc::new(Progress { emit: emit.clone(), id: ep.id.clone(), side, total: l.n, last: Mutex::new(Instant::now()) });
            progress.send(0);
            stats.push(load(client, Arc::new(request(&cfg, side, ep)), l, &cancel, progress).await);
        }
        if cancel.is_cancelled() {
            break;
        }
        let after = stats.pop().expect("after");
        let before = stats.pop().expect("before");
        emit_(BenchEvent::Result { id: ep.id.clone(), before, after });
    }

    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;
    emit_(if cancel.is_cancelled() { BenchEvent::Cancelled { elapsed_ms } } else { BenchEvent::Done { elapsed_ms } });
    Ok(())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn cfg(v: Value) -> RunRequest {
        serde_json::from_value(v).unwrap()
    }

    #[test]
    fn normalize_ignores_list_order_and_timestamp_format() {
        let a = normalize(&json!({ "items": [{ "id": "b" }, { "id": "a" }], "at": "2026-10-30T10:00:00Z" }), true);
        let b = normalize(&json!({ "items": [{ "id": "a" }, { "id": "b" }], "at": "2026-10-30T10:00:00.000Z" }), true);
        let mut out = vec![];
        diff("", &a, &b, &mut out);
        assert_eq!(out, vec![]);
    }

    #[test]
    fn diff_reports_missing_extra_and_changed_fields() {
        let mut out = vec![];
        diff("", &json!({ "a": 1, "b": 2 }), &json!({ "a": 3, "c": 4 }), &mut out);
        let paths: Vec<&str> = out.iter().map(|d| d.path.as_str()).collect();
        assert_eq!(paths, [".a", ".b", ".c"]);
    }

    #[test]
    fn diff_treats_1_and_1_0_as_equal_and_notes_type_changes() {
        let mut out = vec![];
        diff("", &json!({ "n": 1, "t": true }), &json!({ "n": 1.0, "t": "true" }), &mut out);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].path, ".t");
        assert_eq!(out[0].note.as_deref(), Some("type boolean → string"));
    }

    #[test]
    fn summarize_computes_percentiles() {
        let mut r = Recorder::default();
        for t in [5.0, 1.0, 3.0, 2.0, 4.0] {
            r.ok(t, 10);
        }
        let s = r.finish(1000.0);
        // HDR percentiles are within 0.1% of the exact value.
        assert!((s.p50 - 3.0).abs() <= 0.003, "p50 = {}", s.p50);
        assert_eq!(s.min, 1.0);
        assert_eq!(s.max, 5.0);
        assert_eq!(s.mean, 3.0);
        assert_eq!(s.rps, 5.0);
        assert_eq!(s.avg_bytes, 10);
        assert_eq!(s.cdf.len(), 101);
    }

    #[test]
    fn validate_rejects_bad_input() {
        let e = validate(&cfg(json!({ "before": { "baseUrl": "ftp://x" }, "after": { "baseUrl": "http://y" } }))).unwrap_err();
        assert!(e.contains("http"), "{e}");
        let e = validate(&cfg(json!({
            "before": { "baseUrl": "http://x" }, "after": { "baseUrl": "http://y" },
            "load": { "n": 0, "c": 1 }, "endpoints": [{}]
        })))
        .unwrap_err();
        assert!(e.contains("Requests"), "{e}");
        let e = validate(&cfg(json!({
            "before": { "baseUrl": "http://x" }, "after": { "baseUrl": "http://y" },
            "load": { "n": 1.5, "c": 1 }, "endpoints": [{}]
        })))
        .unwrap_err();
        assert!(e.contains("whole number"), "{e}");
    }

    /// A tiny keep-alive HTTP/1.1 server that answers every request with
    /// `payload` after `delay`. Returns its base URL.
    async fn serve(payload: Value, delay: Duration) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let body = payload.to_string();
        tokio::spawn(async move {
            loop {
                let Ok((mut sock, _)) = listener.accept().await else { return };
                let body = body.clone();
                tokio::spawn(async move {
                    let mut buf = Vec::new();
                    let mut chunk = [0u8; 4096];
                    loop {
                        while let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                            buf.drain(..end + 4);
                            tokio::time::sleep(delay).await;
                            let res = format!("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{body}", body.len());
                            if sock.write_all(res.as_bytes()).await.is_err() {
                                return;
                            }
                        }
                        match sock.read(&mut chunk).await {
                            Ok(0) | Err(_) => return,
                            Ok(n) => buf.extend_from_slice(&chunk[..n]),
                        }
                    }
                });
            }
        });
        format!("http://{addr}")
    }

    fn collector() -> (Emit, Arc<Mutex<Vec<BenchEvent>>>) {
        let events = Arc::new(Mutex::new(vec![]));
        let sink = events.clone();
        (Arc::new(move |e| sink.lock().unwrap().push(e)), events)
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn run_bench_end_to_end_against_two_local_servers() {
        let before = serve(json!({ "items": [{ "id": 2 }, { "id": 1 }] }), Duration::ZERO).await;
        let after = serve(json!({ "items": [{ "id": 1 }, { "id": 2 }] }), Duration::ZERO).await;
        let (emit, events) = collector();
        let req = cfg(json!({
            "before": { "baseUrl": before }, "after": { "baseUrl": after },
            "load": { "n": 20, "c": 4, "warmup": 2 },
            "endpoints": [{ "id": "x", "method": "GET", "path": "/x" }]
        }));
        run_bench(req, emit, CancellationToken::new()).await.unwrap();

        let events = events.lock().unwrap();
        let check = events.iter().find_map(|e| match e {
            BenchEvent::Check { result, .. } => Some(result),
            _ => None,
        });
        assert_eq!(check.unwrap().status, CheckStatus::Same);
        let (b, a) = events
            .iter()
            .find_map(|e| match e {
                BenchEvent::Result { before, after, .. } => Some((before, after)),
                _ => None,
            })
            .unwrap();
        assert_eq!(b.count, 20);
        assert_eq!(a.errors, 0);
        assert!(matches!(events.last(), Some(BenchEvent::Done { .. })));
        // The final progress event for each side reports all requests done.
        let last_done = |s: Side| {
            events.iter().rev().find_map(|e| match e {
                BenchEvent::Progress { side, done, .. } if *side == s => Some(*done),
                _ => None,
            })
        };
        assert_eq!(last_done(Side::Before), Some(20));
        assert_eq!(last_done(Side::After), Some(20));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn cancel_stops_a_run_quickly() {
        let slow = serve(json!({ "ok": true }), Duration::from_millis(200)).await;
        let (emit, events) = collector();
        let req = cfg(json!({
            "before": { "baseUrl": slow }, "after": { "baseUrl": slow },
            "load": { "n": 1000, "c": 2 },
            "endpoints": [{ "path": "/a" }, { "path": "/b" }]
        }));
        let cancel = CancellationToken::new();
        let stopper = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(500)).await;
            stopper.cancel();
        });
        let t0 = Instant::now();
        run_bench(req, emit, cancel).await.unwrap();
        assert!(t0.elapsed() < Duration::from_secs(2), "took {:?}", t0.elapsed());
        let events = events.lock().unwrap();
        assert!(matches!(events.last(), Some(BenchEvent::Cancelled { .. })));
        assert!(!events.iter().any(|e| matches!(e, BenchEvent::Result { .. })));
    }

    #[tokio::test]
    async fn run_bench_returns_validation_errors() {
        let (emit, events) = collector();
        let err = run_bench(cfg(json!({ "before": { "baseUrl": "nope" } })), emit, CancellationToken::new()).await.unwrap_err();
        assert!(err.contains("Before URL"), "{err}");
        assert!(events.lock().unwrap().is_empty());
    }

    #[test]
    fn events_serialize_like_the_node_runner() {
        let e = BenchEvent::Progress { id: "x".into(), side: Side::After, done: 1, total: 2 };
        assert_eq!(serde_json::to_value(&e).unwrap(), json!({ "type": "progress", "id": "x", "side": "after", "done": 1, "total": 2 }));
        let e = BenchEvent::Done { elapsed_ms: 1.5 };
        assert_eq!(serde_json::to_value(&e).unwrap(), json!({ "type": "done", "elapsedMs": 1.5 }));
        let e = BenchEvent::Check {
            id: "x".into(),
            result: CheckResult {
                status: CheckStatus::Error,
                error: Some("Before: boom".into()),
                diffs: None,
                status_before: None,
                status_after: None,
                size_before: None,
                size_after: None,
            },
        };
        assert_eq!(serde_json::to_value(&e).unwrap(), json!({ "type": "check", "id": "x", "status": "error", "error": "Before: boom" }));
    }
}
