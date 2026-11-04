import type { ComponentProps, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from './utils'

export const Dialog = DialogPrimitive.Root
export const DialogClose = DialogPrimitive.Close

type DialogContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> & {
  side?: 'right'
  title: ReactNode
  description?: ReactNode
  headerExtra?: ReactNode
}

// Centered modal. `side="right"` turns it into a sheet that sits under the
// title bar, so the window controls stay reachable.
export function DialogContent({ className, children, side, title, description, headerExtra, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-overlay fixed inset-x-0 top-(--titlebar-h) bottom-0 z-50 bg-(--overlay)" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-pop text-ink shadow-(--shadow-pop) outline-none',
          side === 'right'
            ? 'ui-sheet top-(--titlebar-h) right-0 bottom-0 w-[min(420px,100vw)]'
            : 'ui-dialog top-[calc(50%+var(--titlebar-h)/2)] left-1/2 max-h-[calc(100dvh-var(--titlebar-h)-32px)] w-[calc(100vw-32px)] max-w-lg overflow-hidden rounded-card',
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3.5 shadow-[inset_0_-1px_0_var(--rule)]">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-md font-semibold tracking-[-0.01em] text-ink-strong">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={description ? 'mt-1 text-sm text-subtle' : 'sr-only'}>
              {description || 'Dialog'}
            </DialogPrimitive.Description>
          </div>
          {headerExtra}
          <DialogPrimitive.Close
            className="press -mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-[7px] text-icon hover:bg-hover hover:text-ink-strong"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex justify-end gap-2 px-5 py-3.5 shadow-[inset_0_1px_0_var(--rule)]', className)} {...props} />
}
