import { invoke } from '@tauri-apps/api/core'
import { LazyStore } from '@tauri-apps/plugin-store'
import type { ImportedFile } from '@/bindings/ImportedFile'

// ── localStorage: small per-window conveniences (current settings, theme) ──
// Every access is wrapped: storage can be full or blocked, and the app must
// still work.

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// ── Store plugin: History and Profiles, in the app's data folder ───────────

const store = new LazyStore('apibench.json')
// A plain browser (bun run dev without Tauri) has no store: use localStorage there.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function loadStored<T>(key: string, fallback: T): Promise<T> {
  if (!inTauri) return load<T>(`apibench.store.${key}`, fallback)
  try {
    return (await store.get<T>(key)) ?? fallback
  } catch {
    return fallback
  }
}

export async function saveStored(key: string, value: unknown): Promise<boolean> {
  if (!inTauri) return save(`apibench.store.${key}`, value)
  try {
    await store.set(key, value)
    await store.save()
    return true
  } catch {
    return false
  }
}

// ── Files: native Save / Open dialogs (handled in Rust) ────────────────────

/** Returns false if the user cancelled the dialog. Throws if writing failed. */
export function exportFile(fileName: string, contents: string): Promise<boolean> {
  return invoke('export_file', { fileName, contents })
}

/** A .json file the user picked, or null if they cancelled. */
export function importFile(): Promise<ImportedFile | null> {
  return invoke('import_file')
}
