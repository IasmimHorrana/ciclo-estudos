import { CronometroCard } from '@/componentes/barra-lateral/CronometroCard'
import { PomodoroCard } from '@/componentes/barra-lateral/PomodoroCard'
import { useCronometro } from '@/estado/cronometro'
import { usePomodoro } from '@/estado/pomodoro'
import { useUi, type Relogio as TipoRelogio } from '@/estado/ui'
import { cn } from '@/lib/utils'

const OPCOES: { id: TipoRelogio; rotulo: string; dica: string }[] = [
  { id: 'pomodoro', rotulo: 'Pomodoro', dica: 'Blocos de foco e pausa' },
  { id: 'livre', rotulo: 'Livre', dica: 'Cronômetro que conta para cima, sem blocos' },
]

/** Pomodoro ou cronômetro livre. Só um relógio por vez: com um rodando, não dá para trocar. */
export function Relogio() {
  const { relogio, escolherRelogio } = useUi()
  const pomoRodando = usePomodoro((s) => s.rodando)
  const livreAtivo = useCronometro((s) => s.rodando || s.seg > 0)
  // um relógio em andamento sempre aparece, mesmo que a escolha guardada seja o outro
  const atual: TipoRelogio = pomoRodando ? 'pomodoro' : livreAtivo ? 'livre' : relogio
  const travado = pomoRodando || livreAtivo

  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label="Relógio" className="grid grid-cols-2 rounded-lg border bg-muted p-0.5 text-xs font-bold">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={atual === o.id}
            disabled={travado && atual !== o.id}
            title={travado && atual !== o.id ? 'Termine ou zere o relógio atual para trocar' : o.dica}
            onClick={() => escolherRelogio(o.id)}
            className={cn(
              'rounded-md px-2 py-1 text-muted-foreground transition-colors enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
              atual === o.id && 'bg-card text-foreground shadow-sm',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {atual === 'pomodoro' ? <PomodoroCard /> : <CronometroCard />}
    </div>
  )
}
