import { Bookmark, ChevronDown, FileDown, FilePlus2, FileUp, Folder, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react'
import { blankConfig, cleanConfig, EXAMPLES, type LooseConfig } from '@/lib/defaults'
import { exportFile, importFile } from '@/lib/storage'
import type { Config, Profile } from '@/lib/types'
import { barButton } from './TitleBar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

type Props = {
  config: Config
  profiles: Profile[]
  onProfiles: (next: Profile[]) => void
  onLoad: (config: Config) => void
  onNotice: (message: string) => void
  disabled?: boolean
}

// The project menu in the title bar. Profiles = saved settings (APIs, headers, load, endpoints) per project,
// so the tool can be reused for any API, not just one migration.
export default function ProfilesMenu({ config, profiles, onProfiles, onLoad, onNotice, disabled }: Props) {
  const replace = (next: Config, what: string) => {
    if (confirm(`Replace the current settings with ${what}?`)) onLoad(next)
  }

  const saveCurrent = () => {
    const name = prompt('Profile name', config.name || 'My API')?.trim()
    if (!name) return
    const exists = profiles.some((p) => p.name === name)
    if (exists && !confirm(`A profile named "${name}" exists. Overwrite it?`)) return
    const entry: Profile = { name, savedAt: Date.now(), config: structuredClone({ ...config, name }) }
    onProfiles([entry, ...profiles.filter((p) => p.name !== name)])
    onNotice(`Saved profile "${name}".`)
  }

  const remove = (name: string) => {
    if (confirm(`Delete profile "${name}"?`)) onProfiles(profiles.filter((p) => p.name !== name))
  }

  const exportSettings = async () => {
    const slug = (config.name || 'settings').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    try {
      await exportFile(`${slug || 'settings'}.bench.json`, JSON.stringify({ kind: 'api-benchmark-settings', config }, null, 2))
    } catch (e) {
      onNotice(`Could not save the file. ${String(e)}`)
    }
  }

  const importSettings = async () => {
    let file
    try {
      file = await importFile()
    } catch (e) {
      return onNotice(`Could not open the file. ${String(e)}`)
    }
    if (!file) return
    try {
      const data = JSON.parse(file.text)
      const c: LooseConfig = data?.kind === 'api-benchmark-settings' ? data.config : (data?.config ?? data)
      if (!c?.before?.baseUrl || !c?.after?.baseUrl || !Array.isArray(c?.endpoints)) throw new Error()
      replace(cleanConfig(c), `"${c.name || file.name}"`)
    } catch {
      onNotice('That file is not an API Benchmark settings file.')
    }
  }

  const rename = () => {
    const name = prompt('Project name', config.name || 'My API')?.trim()
    if (name) onLoad({ ...config, name })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button type="button" className={barButton + ' max-w-[260px] text-ink'}>
          <Folder className="text-icon" />
          <span className="min-w-0 truncate">{config.name || 'Untitled project'}</span>
          <ChevronDown className="size-3.5! text-icon" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        <DropdownMenuItem onSelect={rename}>
          <Pencil />
          Rename project…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Saved profiles</DropdownMenuLabel>
        {profiles.length === 0 && <p className="px-2 pb-1.5 text-xs text-muted">None yet. Save your current settings below.</p>}
        {profiles.map((p) => (
          <DropdownMenuItem key={p.name} onSelect={() => replace(cleanConfig(p.config), `profile "${p.name}"`)} className="pr-1">
            <Bookmark />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <button
              type="button"
              className="grid size-6 shrink-0 place-items-center rounded-xs text-icon hover:bg-worse-soft hover:text-worse"
              title={`Delete ${p.name}`}
              aria-label={`Delete profile ${p.name}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                remove(p.name)
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={saveCurrent}>
          <Plus />
          Save current as profile…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Start from</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => replace(blankConfig(), 'blank settings')}>
          <FilePlus2 />
          Blank
        </DropdownMenuItem>
        {EXAMPLES.map((ex) => (
          <DropdownMenuItem key={ex.name} onSelect={() => replace(ex.config(), `the example "${ex.name}"`)}>
            <Lightbulb />
            <span className="min-w-0 flex-1">{ex.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={exportSettings}>
          <FileUp />
          Export settings <span className="ml-auto font-mono text-2xs text-muted">.json</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={importSettings}>
          <FileDown />
          Import settings <span className="ml-auto font-mono text-2xs text-muted">.json</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
