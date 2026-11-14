import { Menu as IconeMenu, Timer } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { ABAS } from '@/componentes/barra-lateral/abas'
import { fmtHHMMSS } from '@/dominio/cronometro'
import { fmtMMSS, NOMES_FASE } from '@/dominio/pomodoro'
import { useCronometro } from '@/estado/cronometro'
import { usePomodoro } from '@/estado/pomodoro'
import { useUi } from '@/estado/ui'

/** Barra do topo no celular (até 900 px): botão do menu, nome da aba e o relógio quando está rodando. */
export function TopoCelular({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const aba = useUi((s) => s.aba)
  const rotulo = aba === 'dados' ? 'Dados' : ABAS.find((a) => a.id === aba)?.rotulo
  const pomodoro = usePomodoro((s) => (s.rodando ? `${fmtMMSS(s.restaSeg)} · ${NOMES_FASE[s.fase]}` : null))
  const livre = useCronometro((s) => (s.rodando ? `${fmtHHMMSS(s.seg)} · Livre` : null))
  const relogio = pomodoro ?? livre

  return (
    <header className="sticky top-0 z-40 hidden items-center gap-1.5 border-b bg-lateral px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 max-[900px]:flex">
      <Button variant="ghost" size="icon" className="size-10" aria-label="Abrir menu" onClick={aoAbrirMenu}>
        <IconeMenu className="size-5" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-base font-bold">{rotulo}</span>
      {relogio && (
        <button onClick={aoAbrirMenu} className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground tabular-nums" aria-label={`Relógio: ${relogio}. Abrir menu`}>
          <Timer className="size-3.5" /> {relogio}
        </button>
      )}
    </header>
  )
}
