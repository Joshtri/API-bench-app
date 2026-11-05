import { useCallback, useEffect, useRef, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

// Background updates: check GitHub for a newer release, download it quietly,
// then let the title bar offer "Restart to update". Nothing pops up.

export type UpdateState =
  | { status: 'idle' }
  | { status: 'downloading'; version: string; percent: number | null }
  | { status: 'ready'; version: string; notes?: string }
  | { status: 'installing'; version: string }
  | { status: 'error'; version?: string; message: string }

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const FIRST_CHECK_MS = 5_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

export const RELEASES_URL = 'https://github.com/Joshtri/API-bench-app/releases/latest'

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const update = useRef<Update | null>(null)
  const busy = useRef(false)

  const run = useCallback(async () => {
    // Skip while a download is going or an update is already waiting.
    if (busy.current || update.current) return
    busy.current = true
    let version: string | undefined
    try {
      const found = await check()
      if (!found) return
      version = found.version
      let total = 0
      let got = 0
      setState({ status: 'downloading', version, percent: null })
      await found.download((e) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0
        if (e.event === 'Progress') {
          got += e.data.chunkLength
          if (total) setState({ status: 'downloading', version: version!, percent: Math.min(99, Math.round((got / total) * 100)) })
        }
      })
      update.current = found
      setState({ status: 'ready', version, notes: found.body })
    } catch (err) {
      // No connection or no release yet: stay quiet unless a download had started.
      if (version) setState({ status: 'error', version, message: String(err) })
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    if (!inTauri || import.meta.env.DEV) return
    const first = setTimeout(run, FIRST_CHECK_MS)
    const every = setInterval(run, CHECK_EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [run])

  const restart = useCallback(async () => {
    const u = update.current
    if (!u) return
    setState({ status: 'installing', version: u.version })
    try {
      // On Windows the installer closes the app and reopens it when done.
      await u.install()
      await relaunch()
    } catch (err) {
      setState({ status: 'error', version: u.version, message: String(err) })
    }
  }, [])

  return { state, restart }
}
