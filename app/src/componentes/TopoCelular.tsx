import { Menu as IconeMenu } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { ABAS } from '@/componentes/barra-lateral/abas'
import { useUi } from '@/estado/ui'

/** Barra do topo no celular (até 900 px): botão do menu e nome da aba (o relógio fica na barra de baixo). */
export function TopoCelular({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const aba = useUi((s) => s.aba)
  const rotulo = aba === 'dados' ? 'Dados' : ABAS.find((a) => a.id === aba)?.rotulo

  return (
    <header className="sticky top-0 z-40 hidden items-center gap-1.5 border-b bg-lateral px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 max-[900px]:flex">
      <Button variant="ghost" size="icon" className="size-10" aria-label="Abrir menu" onClick={aoAbrirMenu}>
        <IconeMenu className="size-5" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-base font-bold">{rotulo}</span>
    </header>
  )
}
