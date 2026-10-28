import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

export interface ItemMenu {
  rotulo: string
  icone?: ReactNode
  acao: () => void
  perigo?: boolean
  desativado?: boolean
}

/** Botão "⋯" que abre uma lista de ações. Fecha ao escolher, ao clicar fora ou com Esc. */
export function Menu({ itens, rotulo, className }: { itens: ItemMenu[]; rotulo: string; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div ref={caixa} className={cn('relative', className)}>
      <Button size="icon" variant="ghost" className="size-7" aria-label={rotulo} title={rotulo} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <MoreHorizontal className="size-4" />
      </Button>
      {aberto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          {itens.map((i) => (
            <button
              key={i.rotulo}
              role="menuitem"
              disabled={i.desativado}
              className={cn('flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-default disabled:opacity-45', i.perigo && 'text-destructive')}
              onClick={() => {
                setAberto(false)
                i.acao()
              }}
            >
              {i.icone}
              {i.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
