import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Botão no padrão do shadcn/ui (sem Radix, ainda não precisamos do "asChild").
const botao = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-110',
        outline: 'border bg-card text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-95',
        destructive: 'border bg-card text-destructive hover:bg-erro-bg',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface BotaoProps extends React.ComponentProps<'button'>, VariantProps<typeof botao> {}

export function Button({ className, variant, size, type = 'button', ...props }: BotaoProps) {
  return <button type={type} className={cn(botao({ variant, size }), className)} {...props} />
}
