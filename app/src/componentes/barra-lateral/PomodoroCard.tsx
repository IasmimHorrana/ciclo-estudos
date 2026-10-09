import { RotateCcw } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { NOMES_FASE, fmtMMSS } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'

export function PomodoroCard() {
  const { fase, restaSeg, rodando, alternar, reiniciar } = usePomodoro()
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-2.5">
        <span className="text-[0.8rem] font-bold tracking-wider uppercase">{NOMES_FASE[fase]}</span>
        <span className="text-3xl font-bold tabular-nums">{fmtMMSS(restaSeg)}</span>
      </div>
      <div className="mt-0.5 flex justify-center gap-2">
        <Button size="sm" onClick={alternar}>
          {rodando ? '⏸ Pausar' : '▶ Iniciar'}
        </Button>
        <Button size="sm" variant="outline" onClick={reiniciar} title="Reiniciar" aria-label="Reiniciar">
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
