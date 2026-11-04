import { useState } from 'react'
import { ChevronDown, ClipboardList, Plus, TriangleAlert, X } from 'lucide-react'
import { blankEndpoint } from '@/lib/defaults'
import { METHODS, type Endpoint, type Method, type Side } from '@/lib/types'
import { cleanPath, joinUrl } from '@/lib/url'
import { methodColor, StepHead, WRITE_METHODS } from './bits'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Collapsible, CollapsibleContent } from './ui/collapsible'
import { Dialog, DialogContent, DialogFooter } from './ui/dialog'
import { fieldClass, Input, Label, Textarea } from './ui/input'
import { cn } from './ui/utils'

type Bases = Record<Side, string>

const iconBtn = 'press grid size-8 shrink-0 place-items-center rounded-[7px] text-icon hover:bg-hover hover:text-ink-strong disabled:opacity-45'

type RowProps = {
  ep: Endpoint
  bases: Bases
  onChange: (ep: Endpoint) => void
  onRemove: () => void
  disabled?: boolean
}

function EndpointRow({ ep, bases, onChange, onRemove, disabled }: RowProps) {
  const [open, setOpen] = useState(false)
  const set =
    <K extends 'method' | 'path' | 'afterPath' | 'body'>(k: K) =>
    (e: { target: { value: string } }) =>
      onChange({ ...ep, [k]: e.target.value as Endpoint[K] })
  const tidy = (k: 'path' | 'afterPath', base: string) => () => {
    const clean = cleanPath(ep[k], base)
    if (clean !== ep[k]) onChange({ ...ep, [k]: clean })
  }
  const writes = WRITE_METHODS.has(ep.method)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col shadow-[inset_0_-1px_0_var(--rule)] transition-colors duration-(--dur-1) hover:bg-[color-mix(in_oklab,var(--ink)_2.5%,transparent)]">
      <div className={cn('flex items-center gap-2 py-1.5 pr-1.5 pl-3', !ep.enabled && 'opacity-50')}>
        <Checkbox aria-label={`Include ${ep.method} ${ep.path || '/'}`} checked={ep.enabled} onCheckedChange={(v) => onChange({ ...ep, enabled: v === true })} disabled={disabled} />
        <select
          value={ep.method}
          onChange={set('method')}
          disabled={disabled}
          aria-label="Method"
          className={cn(
            'h-[22px] w-[52px] shrink-0 cursor-pointer appearance-none rounded-xs border-0 bg-hover text-center font-mono text-2xs font-medium outline-none',
            'hover:bg-rule-strong focus-visible:outline-2 focus-visible:outline-(--focus) disabled:cursor-not-allowed [&>option]:bg-pop [&>option]:text-ink',
            methodColor(ep.method),
          )}
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          placeholder="/path?query"
          value={ep.path}
          onChange={set('path')}
          onBlur={tidy('path', bases.before)}
          disabled={disabled}
          aria-label="Path"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="h-8 min-w-0 flex-1 rounded-xs border-0 bg-transparent px-1.5 font-mono text-sm text-ink-strong outline-none placeholder:text-faint focus:bg-surface-2"
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Show full URLs" title="Full URLs and After path" className={iconBtn}>
          <ChevronDown className={cn('size-3.5 transition-transform duration-(--dur-2)', open && 'rotate-180')} strokeWidth={2} />
        </button>
        <button type="button" onClick={onRemove} disabled={disabled} aria-label="Remove endpoint" title="Remove" className={iconBtn}>
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>
      {(writes || (ep.afterPath && !open)) && (
        <div className="-mt-1 flex flex-col gap-0.5 pr-3 pb-2 pl-[36px] text-xs text-subtle">
          {ep.afterPath && !open && (
            <span className="min-w-0 truncate">
              After calls <span className="font-mono text-ink-2">{ep.afterPath}</span>
            </span>
          )}
          {writes && (
            <span className="flex items-center gap-1.5 text-warn">
              <TriangleAlert className="size-3 shrink-0" />
              {ep.method} may change data on both APIs, every request
            </span>
          )}
        </div>
      )}
      <CollapsibleContent>
        <div className="flex flex-col gap-3 pr-3 pb-3 pl-[36px]">
          <div className="selectable flex flex-col gap-1 font-mono text-xs break-all text-muted">
            <div className="flex gap-2">
              <span className="shrink-0 text-before">CH1</span>
              {joinUrl(bases.before, ep.path)}
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 text-after">CH2</span>
              {joinUrl(bases.after, ep.afterPath || ep.path)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Path on After, only if the route changed</Label>
            <Input
              className="h-8 font-mono text-xs"
              placeholder={`empty = same (${ep.path || '/'})`}
              value={ep.afterPath}
              onChange={set('afterPath')}
              onBlur={tidy('afterPath', bases.after)}
              disabled={disabled}
              spellCheck={false}
            />
          </div>
          {writes && (
            <div className="flex flex-col gap-1.5">
              <Label>Request body</Label>
              <Textarea rows={3} className="font-mono text-xs" placeholder='{"key": "value"}' value={ep.body} onChange={set('body')} disabled={disabled} spellCheck={false} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// One line per endpoint: "[METHOD] /path" or "[METHOD] /old -> /new".
function parseLine(line: string, bases: Bases): Endpoint {
  const m = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(.+)$/i)
  const method = (m ? m[1].toUpperCase() : 'GET') as Method
  const [before, after = ''] = (m ? m[2] : line).split(/\s*(?:->|→|=>)\s*/)
  const path = cleanPath(before, bases.before)
  const afterPath = after ? cleanPath(after, bases.after) : ''
  return { ...blankEndpoint(path), method, afterPath: afterPath === path ? '' : afterPath }
}

type EditorProps = {
  endpoints: Endpoint[]
  bases: Bases
  onChange: (endpoints: Endpoint[]) => void
  disabled?: boolean
}

export default function EndpointsEditor({ endpoints, bases, onChange, disabled }: EditorProps) {
  const [paste, setPaste] = useState<string | null>(null)
  const enabled = endpoints.filter((e) => e.enabled).length
  const update = (i: number, ep: Endpoint) => onChange(endpoints.map((e, j) => (j === i ? ep : e)))
  const remove = (i: number) => onChange(endpoints.filter((_, j) => j !== i))
  const toggleAll = (on: boolean) => onChange(endpoints.map((e) => ({ ...e, enabled: on })))

  const addPasted = () => {
    const added = (paste ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => parseLine(l, bases))
    onChange([...endpoints, ...added])
    setPaste(null)
  }

  return (
    <section className="flex flex-col gap-3 p-5">
      <StepHead
        n="03"
        title="Endpoints"
        aside={
          <>
            <span className="text-ink tabular-nums">{enabled}</span> of {endpoints.length} selected
          </>
        }
      />
      <p className="text-sm text-subtle">Each path is appended to both base URLs.</p>

      <div className="well flex flex-col overflow-hidden rounded-[10px]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 shadow-[inset_0_-1px_0_var(--rule)]">
          <Button variant="ghost" size="xs" className="text-muted" onClick={() => toggleAll(true)} disabled={disabled}>
            Select all
          </Button>
          <Button variant="ghost" size="xs" className="text-muted" onClick={() => toggleAll(false)} disabled={disabled}>
            Clear
          </Button>
        </div>
        {endpoints.map((ep, i) => (
          <EndpointRow key={ep.id} ep={ep} bases={bases} onChange={(v) => update(i, v)} onRemove={() => remove(i)} disabled={disabled} />
        ))}
        {endpoints.length === 0 && <p className="px-3 py-[18px] text-center text-sm text-subtle">No endpoints yet. Add a path, or paste a list.</p>}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="md" onClick={() => onChange([...endpoints, blankEndpoint('/')])} disabled={disabled}>
          <Plus strokeWidth={2} />
          Add path
        </Button>
        <Button variant="ghost" size="md" onClick={() => setPaste('')} disabled={disabled}>
          <ClipboardList />
          Paste list
        </Button>
      </div>

      <Dialog open={paste !== null} onOpenChange={(o) => !o && setPaste(null)}>
        <DialogContent
          title="Paste endpoints"
          description='One per line. GET is the default. If the route changed on After, write "/old -> /new". Full URLs work too.'
        >
          <div className="p-5">
            <textarea
              rows={8}
              className={cn(fieldClass, 'block resize-y py-2 font-mono text-xs leading-5')}
              placeholder={'/users\n/orders?page=1\nPOST /search\n/api/v1/faqs -> /v2/faqs'}
              value={paste ?? ''}
              onChange={(e) => setPaste(e.target.value)}
              spellCheck={false}
              autoFocus
              aria-label="Endpoints, one per line"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="md" onClick={() => setPaste(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={addPasted} disabled={!paste?.trim()}>
              Add endpoints
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
