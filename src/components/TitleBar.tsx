import { useEffect, useState, type ReactNode } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { cn } from './ui/utils'

// In `bun run dev` outside Tauri there is no window to control.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
// macOS keeps its own traffic lights (tauri.macos.conf.json): leave room for them.
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)

export function Logo({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M2 15c2.5 0 3-8 5.5-8S10 17 12.5 17 15 9 17.5 9 20 13 22 13" stroke="var(--before)" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 18c2.5 0 3-5 5.5-5S10 19 12.5 19 15 14 17.5 14 20 16 22 16" stroke="var(--after)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function useMaximized() {
  const [max, setMax] = useState(false)
  useEffect(() => {
    if (!inTauri) return
    const win = getCurrentWindow()
    let off: (() => void) | undefined
    let alive = true
    const sync = () => win.isMaximized().then((m) => alive && setMax(m)).catch(() => {})
    sync()
    win.onResized(sync).then((u) => (alive ? (off = u) : u()))
    return () => {
      alive = false
      off?.()
    }
  }, [])
  return max
}

// Windows-style caption buttons: 46px wide, full bar height, red close.
function WindowControls() {
  const max = useMaximized()
  if (!inTauri || isMac) return null
  const win = getCurrentWindow()
  const btn = 'grid h-full w-[46px] place-items-center text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink-strong'
  return (
    <div className="ml-1 flex h-full self-stretch">
      <button type="button" tabIndex={-1} aria-label="Minimize" className={btn} onClick={() => win.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button type="button" tabIndex={-1} aria-label={max ? 'Restore' : 'Maximize'} className={btn} onClick={() => win.toggleMaximize()}>
        {max ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" />
            <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" stroke="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" />
          </svg>
        )}
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className={cn(btn, 'hover:bg-[#c42b1c] hover:text-white')}
        onClick={() => win.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}

type Props = {
  /** Project menu or breadcrumb, after the app name. */
  left?: ReactNode
  /** Toolbar actions, before the window controls. */
  right?: ReactNode
}

// The window's own title bar (the OS one is turned off in tauri.conf.json).
// Empty areas drag the window; double-click maximizes. Only elements marked
// data-tauri-drag-region start a drag, so the decorative bits ignore the
// pointer and let it fall through to the bar.
export default function TitleBar({ left, right }: Props) {
  return (
    <header
      data-tauri-drag-region
      className={cn(
        'relative z-40 flex h-(--titlebar-h) shrink-0 items-center gap-1 bg-chrome pl-3 shadow-[inset_0_-1px_0_var(--rule)]',
        isMac && 'pl-[78px]',
        (!inTauri || isMac) && 'pr-2',
      )}
    >
      <div className="pointer-events-none flex items-center gap-2 pr-2">
        <Logo />
        <span className="text-sm font-semibold tracking-[-0.01em] whitespace-nowrap text-ink-strong max-sm:hidden">API Bench</span>
      </div>
      <span aria-hidden className="pointer-events-none mx-1 h-4 w-px bg-rule-strong" />
      <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden">{left}</div>
      <div data-tauri-drag-region className="h-full min-w-4 flex-1" />
      <div className="flex shrink-0 items-center gap-0.5">{right}</div>
      <WindowControls />
    </header>
  )
}

// Compact toolbar button for the title bar.
export const barButton =
  'press inline-flex h-7 shrink-0 items-center gap-2 rounded-[7px] px-2.5 text-sm font-medium text-ink-2 hover:bg-hover hover:text-ink-strong ' +
  'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0'
