import type { ComponentProps } from 'react'
import { Collapsible as C } from 'radix-ui'
import { cn } from './utils'

export const Collapsible = C.Root
export const CollapsibleTrigger = C.Trigger

export function CollapsibleContent({ className, ...props }: ComponentProps<typeof C.Content>) {
  return (
    <C.Content
      className={cn('overflow-hidden data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close', className)}
      {...props}
    />
  )
}
