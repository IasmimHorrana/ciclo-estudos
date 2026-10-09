import { RotateCcw } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { Button } from '@/componentes/ui/button'
import { salvarPomo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { NOMES_FASE, fmtMMSS, type ConfigPomodoro } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'

const CAMPOS: { chave: keyof ConfigPomodoro; rotulo: string }[] = [
  { chave: 'foco', rotulo: 'Foco' },
  { chave: 'pausa', rotulo: 'Pausa' },
  { chave: 'longa', rotulo: 'Longa' },
  { chave: 'ate', rotulo: 'Longa a cada' },
]

export function PomodoroCard() {
  const { fase, restaSeg, rodando, alternar, reiniciar, encerrar, config, focosConcluidos, definirConfig } = usePomodoro()

  function mudar(chave: keyof ConfigPomodoro, n: number | null) {
    if (!n || n < 1) return
    const nova = { ...config, [chave]: Math.trunc(n) }
    definirConfig(nova)
    void salvarPomo(db, nova)
  }

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
        {fase === 'foco' && (
          <Button size="sm" variant="outline" onClick={encerrar} title="Encerrar o foco agora e somar o tempo estudado">
            Encerrar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={reiniciar} title="Reiniciar" aria-label="Reiniciar">
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
      <p className="m-0 mt-1 text-[0.7rem] text-muted-foreground">Focos concluídos nesta sessão: {focosConcluidos}</p>
      <details className="mt-1 text-left">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ajustar tempos (min)</summary>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {CAMPOS.map(({ chave, rotulo }) => (
            <label key={chave} className="flex flex-col text-[0.65rem] text-muted-foreground">
              {rotulo}
              <CampoNumero key={`${chave}${config[chave]}`} className="px-1.5 py-1 text-center" valor={config[chave]} aoConfirmar={(n) => mudar(chave, n)} />
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
