import type { ComponentProps } from 'react'
import { cn } from './utils'

export const fieldClass =
  'field w-full min-w-0 rounded-sm border-0 px-2.5 text-sm text-ink-strong outline-none placeholder:text-faint ' +
  'disabled:cursor-not-allowed disabled:opacity-55 ' +
  'aria-invalid:shadow-[0_0_0_1px_var(--worse)]!'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldClass, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClass, 'block resize-y py-2 leading-[18px]', className)} {...props} />
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('block text-xs font-medium text-muted', className)} {...props} />
}
