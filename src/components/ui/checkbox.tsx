import type { ComponentProps } from 'react'
import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from './utils'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'relative grid size-4 shrink-0 cursor-pointer place-items-center rounded-[4px] bg-bg shadow-[0_0_0_1px_var(--field-hover)]',
        'transition-colors duration-(--dur-1) hover:shadow-[0_0_0_1px_var(--field-focus)] data-[state=checked]:bg-ink data-[state=checked]:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        'after:absolute after:-inset-2 after:content-[""]',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-bg">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
