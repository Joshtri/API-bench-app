import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ChevronDown, ClipboardCopy, Download, FileJson, FileText, History, Moon, Sun } from 'lucide-react'
import EmptyState from './components/EmptyState'
import EndpointDetail from './components/EndpointDetail'
import EndpointsEditor from './components/EndpointsEditor'
import HistoryPanel from './components/HistoryPanel'
import LoadSettings from './components/LoadSettings'
import ProfilesMenu from './components/ProfilesMenu'
import ResultsView from './components/ResultsView'
import RunBar from './components/RunBar'
import Targets from './components/Targets'
import TitleBar, { barButton } from './components/TitleBar'
import UpdateButton from './components/UpdateButton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu'
import { TooltipProvider } from './components/ui/tooltip'
import { cn } from './components/ui/utils'
import { cancelBenchmark, runBenchmark } from './lib/api'
import { cleanConfig, defaultConfig, mergeConfig, newId, type LooseConfig } from './lib/defaults'
import { displayPath, parseHeaders } from './lib/format'
import { stamp, toMarkdown } from './lib/report'
import { cleanBase } from './lib/url'
import { exportFile, importFile, load, loadStored, save, saveStored } from './lib/storage'
import { useUpdater } from './lib/updater'
import type { BenchEvent, Config, Profile, Run } from './lib/types'

const HISTORY_LIMIT = 30
const SIDES = ['before', 'after'] as const

function loadConfig(): Config {
  const c = load<LooseConfig | null>('apibench.config', null)
  return c ? mergeConfig(c) : defaultConfig()
}

function problemWith(config: Config): string | null {
  for (const side of SIDES) {
    const name = side === 'before' ? 'Before' : 'After'
    try {
      const u = new URL(cleanBase(config[side].baseUrl))
      if (!/^https?:$/.test(u.protocol)) return `${name} URL must start with http:// or https://`
    } catch {
      return `${name} URL is not a valid URL`
    }
    if (parseHeaders(config[side].headers).bad.length) return `${name} headers: use one "Name: value" per line`
  }
  const { n, c, warmup, timeoutMs } = config.load
  if (!(n !== '' && n >= 1 && n <= 100000)) return 'Requests must be from 1 to 100,000'
  if (!(c !== '' && c >= 1 && c <= 500)) return '"At a time" must be from 1 to 500'
  if (!(warmup !== '' && warmup >= 0 && warmup <= 10000)) return 'Warm-up must be from 0 to 10,000'
  if (!(timeoutMs !== '' && timeoutMs >= 100)) return 'Timeout must be at least 100 ms'
  if (!config.endpoints.some((e) => e.enabled)) return 'Select at least one endpoint'
  return null
}

// A list kept in the store plugin. Changes made before it has loaded wait
// for the load, so they never overwrite what's saved.
function useStoredList<T>(key: string) {
  const [list, setList] = useState<T[]>([])
  const current = useRef<T[]>([])
  const loaded = useRef<Promise<void> | null>(null)
  loaded.current ??= loadStored<T[]>(key, []).then((v) => {
    current.current = Array.isArray(v) ? v : []
    setList(current.current)
  })

  const update = useCallback(
    async (fn: (prev: T[]) => T[]) => {
      await loaded.current
      const next = fn(current.current)
      current.current = next
      setList(next)
      return saveStored(key, next)
    },
    [key],
  )
  return [list, update] as const
}

// ── Run state ────────────────────────────────────────────────────────────────

function withFraction(run: Run): Run {
  const { endpoints, load: l, options } = run.config
  const total = (options.check ? endpoints.length : 0) + endpoints.length * 2 * Number(l.n)
  let done = Object.keys(run.checks).length
  for (const p of Object.values(run.progress)) done += (p.before?.done ?? 0) + (p.after?.done ?? 0)
  return { ...run, fraction: total ? Math.min(1, done / total) : 0 }
}

type Action =
  | { type: 'reset'; run: Run }
  | { type: 'event'; event: BenchEvent }
  | { type: 'failed'; message: string }
  | { type: 'saved' }

function reducer(run: Run | null, a: Action): Run | null {
  if (a.type === 'reset') return a.run
  if (!run) return run
  switch (a.type) {
    case 'event': {
      const e = a.event
      switch (e.type) {
        case 'check': {
          const ep = run.config.endpoints.find((x) => x.id === e.id)
          return withFraction({ ...run, checks: { ...run.checks, [e.id]: e }, current: `Checking data · ${displayPath(ep)}` })
        }
        case 'progress': {
          const ep = run.config.endpoints.find((x) => x.id === e.id)
          const label = run.config[e.side].label
          return withFraction({
            ...run,
            progress: { ...run.progress, [e.id]: { ...run.progress[e.id], [e.side]: { done: e.done, total: e.total } } },
            current: `${label} · ${displayPath(ep)} · ${e.done} / ${e.total}`,
          })
        }
        case 'result':
          return withFraction({ ...run, results: { ...run.results, [e.id]: { before: e.before, after: e.after } } })
        case 'done':
          return { ...run, status: 'done', fraction: 1, elapsedMs: e.elapsedMs, current: null }
        case 'cancelled':
          return { ...run, status: 'cancelled', elapsedMs: e.elapsedMs, current: null }
        case 'error':
          return { ...run, status: 'error', error: e.message, current: null }
        default:
          return run
      }
    }
    case 'failed':
      return { ...run, status: 'error', error: a.message, current: null }
    case 'saved':
      return { ...run, saved: true }
  }
}

// ── App ──────────────────────────────────────────────────────────────────────

type View = 'setup' | 'results'

export default function App() {
  const [config, setConfig] = useState(loadConfig)
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const [history, updateHistory] = useStoredList<Run>('history')
  const [profiles, updateProfileList] = useStoredList<Profile>('profiles')
  const [run, dispatch] = useReducer(reducer, null)
  const [view, setView] = useState<View>('setup')
  const [selected, setSelected] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const running = run?.status === 'running'
  const updater = useUpdater()
  const problem = problemWith(config)
  const patch =
    <K extends keyof Config>(k: K) =>
    (v: Config[K]) =>
      setConfig((c) => ({ ...c, [k]: v }))

  useEffect(() => {
    save('apibench.config', config)
  }, [config])

  // A run left over from before a page reload has nobody listening: stop it.
  useEffect(() => {
    cancelBenchmark().catch(() => {})
  }, [])

  const updateProfiles = (next: Profile[]) => {
    updateProfileList(() => next).then((ok) => {
      if (!ok) setNotice('Could not save profiles on this computer.')
    })
  }

  useEffect(() => {
    // Switch themes with transitions off, so every color doesn't animate at once.
    const freeze = document.createElement('style')
    freeze.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.append(freeze)
    document.documentElement.setAttribute('data-theme', theme)
    void document.body.offsetHeight // flush styles while transitions are off
    requestAnimationFrame(() => requestAnimationFrame(() => freeze.remove()))
    try {
      localStorage.setItem('apibench.theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(t)
  }, [notice])

  // Save a finished run once.
  useEffect(() => {
    if (!run || run.saved || run.fromHistory) return
    if (run.status !== 'done' && run.status !== 'cancelled') return
    if (!Object.keys(run.results).length && !Object.keys(run.checks).length) return
    const entry: Run = { ...run, saved: true, progress: {}, current: null }
    updateHistory((h) => [entry, ...h.filter((x) => x.id !== run.id)].slice(0, HISTORY_LIMIT)).then((ok) => {
      if (!ok) setNotice('Could not save the run on this computer.')
    })
    dispatch({ type: 'saved' })
  }, [run, updateHistory])

  async function start(from: Config = config) {
    if (problemWith(from) || running) return
    const snapshot: Config = structuredClone({ ...from, endpoints: from.endpoints.filter((e) => e.enabled) })
    // The name is optional; results and the progress text need one.
    snapshot.before.label = snapshot.before.label.trim() || 'Before'
    snapshot.after.label = snapshot.after.label.trim() || 'After'
    dispatch({
      type: 'reset',
      run: { id: newId(), startedAt: Date.now(), status: 'running', config: snapshot, checks: {}, progress: {}, results: {}, fraction: 0 },
    })
    setView('results')
    try {
      await runBenchmark(snapshot, (event) => dispatch({ type: 'event', event }))
    } catch (e) {
      dispatch({ type: 'failed', message: String(e) })
    }
  }

  // The engine answers with a `cancelled` event, which ends the run here.
  const stop = () => {
    cancelBenchmark().catch((e) => setNotice(`Could not stop the run. ${String(e)}`))
  }

  // Ctrl/⌘ + Enter runs from anywhere, like a desktop app's default action.
  const startRef = useRef(start)
  startRef.current = start
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        startRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openSaved(saved: Run) {
    dispatch({ type: 'reset', run: { ...saved, fromHistory: true } })
    setShowHistory(false)
    setView('results')
  }

  function deleteSaved(id: string) {
    updateHistory((h) => h.filter((x) => x.id !== id))
  }

  async function importJSON() {
    let file
    try {
      file = await importFile()
    } catch (e) {
      return setNotice(`Could not open the file. ${String(e)}`)
    }
    if (!file) return
    try {
      const r = JSON.parse(file.text) as Run
      if (!r?.config?.endpoints || !r?.results) throw new Error()
      // Older exports may lack these.
      const missing: Pick<Run, 'checks' | 'progress' | 'fraction'> = { checks: {}, progress: {}, fraction: 1 }
      const entry: Run = { ...missing, ...r, id: r.id || newId(), saved: true }
      updateHistory((h) => [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, HISTORY_LIMIT))
      openSaved(entry)
    } catch {
      setNotice('That file is not an exported benchmark run.')
    }
  }

  const fileBase = run ? `benchmark-${stamp(run.startedAt).replace(/[: ]/g, '-')}` : 'benchmark'
  const exportAs = async (fileName: string, text: string) => {
    try {
      await exportFile(fileName, text)
    } catch (e) {
      setNotice(`Could not save the file. ${String(e)}`)
    }
  }
  const exportJSON = () => {
    if (!run) return
    const { fromHistory: _f, saved: _s, progress: _p, current: _c, ...clean } = run
    exportAs(`${fileBase}.json`, JSON.stringify(clean, null, 2))
  }
  const exportMd = () => run && exportAs(`${fileBase}.md`, toMarkdown(run))
  const copyMd = async () => {
    if (!run) return
    try {
      await navigator.clipboard.writeText(toMarkdown(run))
      setNotice('Markdown table copied.')
    } catch {
      setNotice('Could not copy; use "Download Markdown" instead.')
    }
  }

  const hasResults = Boolean(run && (running || Object.keys(run.results).length > 0 || Object.keys(run.checks).length > 0))
  const showResults = view === 'results' && run !== null
  // Runs are numbered oldest-first; a run not saved yet is the next number.
  const at = run ? history.findIndex((h) => h.id === run.id) : -1
  const runNumber = at === -1 ? history.length + 1 : history.length - at

  const applySettings = (r: Run) => {
    setConfig(cleanConfig(structuredClone(r.config)))
    setView('setup')
  }
  const swap = () =>
    setConfig((c) => ({
      ...c,
      before: { ...c.before, baseUrl: c.after.baseUrl, headers: c.after.headers },
      after: { ...c.after, baseUrl: c.before.baseUrl, headers: c.before.headers },
    }))

  const runBar = (
    <RunBar
      run={run}
      config={config}
      onStart={() => start()}
      onStop={stop}
      canStart={!problem && !running}
      problem={!running ? problem : null}
      onViewResults={view === 'setup' && hasResults ? () => setView('results') : undefined}
    />
  )

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <TitleBar
          left={
            showResults ? (
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 text-sm">
                <button type="button" onClick={() => setView('setup')} className={cn(barButton, 'min-w-0 shrink font-normal text-muted')}>
                  <span className="truncate">{run.fromHistory ? run.config.name || 'Saved run' : config.name || 'Untitled project'}</span>
                </button>
                <span aria-hidden className="pointer-events-none text-faint">
                  /
                </span>
                <span className="pointer-events-none shrink-0 px-2 font-medium whitespace-nowrap text-ink">{running ? 'Running…' : `Run #${runNumber}`}</span>
              </nav>
            ) : (
              <ProfilesMenu config={config} profiles={profiles} onProfiles={updateProfiles} onLoad={setConfig} onNotice={setNotice} disabled={running} />
            )
          }
          right={
            <>
              <UpdateButton state={updater.state} onRestart={updater.restart} blocked={running} />
              <button type="button" className={barButton} onClick={() => setShowHistory(true)} aria-label={`History, ${history.length} saved runs`}>
                <History />
                <span className="max-sm:hidden">History</span>
                {history.length > 0 && <span className="rounded-xs bg-rule-strong px-1.5 font-mono text-xs leading-[18px] text-ink">{history.length}</span>}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!run || running}>
                  <button type="button" className={barButton} aria-label="Export">
                    <Download />
                    <span className="max-sm:hidden">Export</span>
                    <ChevronDown className="size-3.5! text-icon" strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={copyMd}>
                    <ClipboardCopy />
                    Copy Markdown table
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportMd}>
                    <FileText />
                    Download Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportJSON}>
                    <FileJson />
                    Download JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                className={barButton + ' w-8 justify-center px-0'}
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              >
                {theme === 'dark' ? <Sun /> : <Moon />}
              </button>
            </>
          }
        />

        {/* The window's content scrolls; the title bar stays put. */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {showResults ? (
            <ResultsView
              run={run}
              runNumber={runNumber}
              runBar={runBar}
              onEditSetup={() => setView('setup')}
              onRunAgain={() => {
                if (!run.fromHistory) return start()
                const c = cleanConfig(structuredClone(run.config))
                setConfig(c)
                start(c)
              }}
              onUseSettings={() => applySettings(run)}
              canStart={!running && (run.fromHistory ? !problemWith(run.config) : !problem)}
              onOpen={setSelected}
            />
          ) : (
            <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-start gap-5 px-6 pt-5 pb-8">
              <aside aria-label="Run setup" className="card flex min-w-0 flex-[1_1_360px] flex-col md:max-w-[440px]">
                <Targets before={config.before} after={config.after} onChange={(side, v) => patch(side)(v)} onSwap={swap} disabled={running} />
                <div aria-hidden className="h-px bg-rule" />
                <LoadSettings load={config.load} options={config.options} onLoad={patch('load')} onOptions={patch('options')} disabled={running} />
                <div aria-hidden className="h-px bg-rule" />
                <EndpointsEditor
                  endpoints={config.endpoints}
                  bases={{ before: config.before.baseUrl, after: config.after.baseUrl }}
                  onChange={patch('endpoints')}
                  disabled={running}
                />
              </aside>
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                {runBar}
                <EmptyState onViewResults={hasResults ? () => setView('results') : undefined} />
              </div>
            </div>
          )}
        </main>

        {notice && (
          <div role="status" className="toast fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-sm bg-pop px-3.5 py-2 text-sm text-ink-strong shadow-(--shadow-pop)">
            {notice}
          </div>
        )}

        <EndpointDetail run={run} id={selected} onHide={() => setSelected(null)} />
        <HistoryPanel
          show={showHistory}
          onHide={() => setShowHistory(false)}
          history={history}
          activeId={run?.id}
          onOpen={openSaved}
          onDelete={deleteSaved}
          onImport={importJSON}
        />
      </div>
    </TooltipProvider>
  )
}
