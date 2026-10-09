import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50'

export const Entrada = ({ className, ...p }: ComponentProps<'input'>) => <input className={cn(base, className)} {...p} />
export const Selecao = ({ className, ...p }: ComponentProps<'select'>) => <select className={cn(base, className)} {...p} />
export const AreaTexto = ({ className, ...p }: ComponentProps<'textarea'>) => (
  <textarea className={cn(base, 'min-h-20 resize-y', className)} {...p} />
)
