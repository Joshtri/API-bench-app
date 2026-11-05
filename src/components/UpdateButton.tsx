import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { RELEASES_URL, type UpdateState } from '../lib/updater'
import { barButton } from './TitleBar'
import { Tooltip } from './ui/tooltip'
import { cn } from './ui/utils'

type Props = {
  state: UpdateState
  onRestart: () => void
  /** A benchmark is running; restarting now would cut it off. */
  blocked?: boolean
}

// Title bar entry for app updates. Hidden until there is something to show.
export default function UpdateButton({ state, onRestart, blocked }: Props) {
  if (state.status === 'idle') return null

  if (state.status === 'downloading') {
    return (
      <Tooltip content={`Downloading version ${state.version} in the background`} side="bottom">
        <span className={cn(barButton, 'pointer-events-auto cursor-default text-muted hover:bg-transparent hover:text-muted')}>
          <LoaderCircle className="animate-spin" />
          <span className="max-sm:hidden">Updating</span>
          {state.percent !== null && <span className="font-mono text-xs tabular-nums">{state.percent}%</span>}
        </span>
      </Tooltip>
    )
  }

  if (state.status === 'error') {
    return (
      <Tooltip content="The update could not be installed. Click to download it from GitHub." side="bottom">
        <button type="button" className={cn(barButton, 'text-warn hover:text-warn')} onClick={() => openUrl(RELEASES_URL)}>
          <TriangleAlert />
          <span className="max-sm:hidden">Update failed</span>
        </button>
      </Tooltip>
    )
  }

  const installing = state.status === 'installing'
  return (
    <Tooltip
      content={blocked ? 'Finish or stop the run first' : `Version ${state.version} is ready. Restart to finish updating.`}
      side="bottom"
    >
      {/* Wrapper keeps the tooltip working while the button is disabled. */}
      <span className="inline-flex">
        <button
          type="button"
          disabled={blocked || installing}
          onClick={onRestart}
          aria-label={`Restart to update to version ${state.version}`}
          className={cn(
            barButton,
            'bg-better-soft text-better hover:bg-better-soft hover:text-better hover:brightness-125',
          )}
        >
          {installing ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
          <span className="max-sm:hidden">{installing ? 'Restarting…' : 'Restart to update'}</span>
          {!installing && (
            <span className="rounded-xs bg-better-soft px-1.5 font-mono text-xs leading-[18px] max-md:hidden">
              v{state.version}
            </span>
          )}
        </button>
      </span>
    </Tooltip>
  )
}
