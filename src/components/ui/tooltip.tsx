import type { ReactElement, ReactNode } from 'react'
import { Tooltip as T } from 'radix-ui'
import { cn } from './utils'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </T.Provider>
  )
}

type TooltipProps = {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn('ui-tip glass-strong z-50 max-w-64 rounded-sm px-2 py-1 text-xs text-ink', className)}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
