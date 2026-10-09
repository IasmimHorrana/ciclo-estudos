import type { ReactNode } from 'react'
import { Layers, CalendarDays, Moon, NotebookPen, Puzzle, Sun, TrendingUp, type LucideIcon } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { MiniCalendario } from '@/componentes/barra-lateral/MiniCalendario'
import { PomodoroCard } from '@/componentes/barra-lateral/PomodoroCard'
import { useBackup } from '@/estado/backup'
import { useUi, temaEscuro, type AbaId } from '@/estado/ui'
import { cn } from '@/lib/utils'

const ABAS: { id: AbaId; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'montar', rotulo: 'Montar ciclo', Icone: Puzzle },
  { id: 'semana', rotulo: 'Semana', Icone: CalendarDays },
  { id: 'desempenho', rotulo: 'Desempenho', Icone: TrendingUp },
  { id: 'resumos', rotulo: 'Resumos', Icone: NotebookPen },
  { id: 'flashcards', rotulo: 'Flashcards', Icone: Layers },
]

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details open className="border-t pt-1.5">
      <summary className="mb-1.5 cursor-pointer text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
        {titulo}
      </summary>
      {children}
    </details>
  )
}

export function BarraLateral() {
  const { aba, irParaAba, tema, alternarTema } = useUi()
  const escuro = temaEscuro(tema)
  const bk = useBackup((s) => s.estado)
  const backupOk = bk === 'ok' || bk === 'gravando'
  return (
    <aside className="flex h-full flex-col gap-1.5 overflow-x-hidden overflow-y-auto border-r bg-lateral p-2.5 max-[900px]:h-auto max-[900px]:border-r-0 max-[900px]:border-b">
      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
        <span className="flex items-center gap-2 text-base font-extrabold">
          <img src="/favicon.svg" alt="" className="size-6 rounded-md" />
          Ciclo de Estudos
        </span>
        <Button variant="outline" size="icon" onClick={alternarTema} title="Alternar tema" aria-label="Alternar tema">
          {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      <nav className="flex flex-col max-[900px]:flex-row max-[900px]:flex-wrap">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            onClick={() => irParaAba(id)}
            aria-current={aba === id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold hover:bg-accent max-[900px]:flex-1 max-[900px]:justify-center',
              aba === id && 'bg-accent text-accent-foreground',
            )}
          >
            <Icone className="size-4 shrink-0" />
            {rotulo}
          </button>
        ))}
      </nav>

      <Secao titulo="Calendário">
        <MiniCalendario />
      </Secao>

      <Secao titulo="Pomodoro">
        <PomodoroCard />
      </Secao>

      <button
        onClick={() => irParaAba('dados')}
        className={cn(
          'mt-auto w-full rounded-lg px-2.5 py-1.5 text-left text-[0.8rem] font-semibold',
          backupOk ? 'bg-ok-bg text-ok' : 'bg-aviso-bg text-aviso',
        )}
        title="Importar, exportar e backup em pasta"
      >
        {backupOk ? '✅ Backup em pasta ativo' : '⚠ Sem backup automático'} · Dados
      </button>
    </aside>
  )
}
