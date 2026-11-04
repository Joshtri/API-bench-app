import type { ComponentProps } from 'react'
import { DropdownMenu as Menu } from 'radix-ui'
import { cn } from './utils'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn('ui-pop glass-strong z-50 min-w-52 max-w-[calc(100vw-16px)] rounded-md p-1 text-sm text-ink', className)}
        {...props}
      />
    </Menu.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        'relative flex min-h-8 cursor-default items-center gap-2.5 rounded-[7px] px-2 py-1 outline-none',
        'data-highlighted:bg-hover data-highlighted:text-ink-strong data-disabled:pointer-events-none data-disabled:opacity-45',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-icon',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2 pt-2 pb-1 text-xs text-subtle', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('mx-1 my-1 h-px bg-rule', className)} {...props} />
}
