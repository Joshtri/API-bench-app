import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from './utils'

const buttonVariants = cva(
  'press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium ' +
    'disabled:cursor-not-allowed disabled:opacity-45 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5',
  {
    variants: {
      variant: {
        primary: 'bg-primary font-semibold text-primary-fg shadow-(--shadow-primary) hover:not-disabled:bg-primary-hover',
        // The design's quiet button: faint fill + hairline ring.
        outline: 'bg-tint text-ink shadow-[0_0_0_1px_var(--field)] hover:not-disabled:bg-hover hover:not-disabled:text-ink-strong',
        ghost: 'bg-transparent text-ink-2 hover:not-disabled:bg-hover hover:not-disabled:text-ink-strong',
        stop: 'bg-worse-soft font-semibold text-worse shadow-[0_0_0_1px_color-mix(in_oklab,var(--worse)_35%,transparent)] hover:not-disabled:bg-[color-mix(in_oklab,var(--worse)_20%,transparent)]',
        danger: 'bg-transparent text-icon hover:not-disabled:bg-worse-soft hover:not-disabled:text-worse',
        link: 'h-auto! px-0! text-muted underline decoration-rule-strong underline-offset-3 hover:text-ink-strong hover:decoration-current',
      },
      size: {
        xs: 'h-[26px] rounded-xs px-2 text-xs',
        sm: 'h-[30px] px-2.5 text-sm',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 rounded-[9px] px-3.5 text-base',
        xl: 'h-11 rounded-md pr-5 pl-4 text-md',
        icon: 'size-8 rounded-[7px]',
        'icon-sm': 'size-7 rounded-[7px]',
      },
    },
    defaultVariants: { variant: 'outline', size: 'sm' },
  },
)

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
