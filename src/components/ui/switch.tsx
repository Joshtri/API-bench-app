import type { ComponentProps } from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from './utils'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 p-0.5 shadow-[0_0_0_1px_var(--field)]',
        'transition-colors duration-(--dur-1) data-[state=checked]:bg-ink data-[state=checked]:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'after:absolute after:-inset-2 after:content-[""]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-3.5 rounded-full bg-icon transition-transform duration-(--dur-2) ease-(--ease-out)',
          'data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-bg',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
