import { RotateCcw } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { escolherAlvo, iniciarOuPausar } from '@/componentes/iniciar-foco-api'
import { Button } from '@/componentes/ui/button'
import { salvarPomo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { NOMES_FASE, duracaoSeg, fmtMMSS, type ConfigPomodoro, type Fase } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'
import { cn } from '@/lib/utils'

const CAMPOS: { chave: keyof ConfigPomodoro; rotulo: string }[] = [
  { chave: 'foco', rotulo: 'Foco' },
  { chave: 'pausa', rotulo: 'Pausa' },
  { chave: 'longa', rotulo: 'Longa' },
  { chave: 'ate', rotulo: 'Longa a cada' },
]

const FASES: { id: Fase; rotulo: string }[] = [
  { id: 'foco', rotulo: 'Foco' },
  { id: 'pausa', rotulo: 'Pausa curta' },
  { id: 'longa', rotulo: 'Pausa longa' },
]

const RAIO = 62
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

export function PomodoroCard() {
  const { fase, restaSeg, rodando, alvo, reiniciar, encerrar, irParaFase, config, focosConcluidos, definirConfig } = usePomodoro()

  function mudar(chave: keyof ConfigPomodoro, n: number | null) {
    if (!n || n < 1) return
    const nova = { ...config, [chave]: Math.trunc(n) }
    definirConfig(nova)
    void salvarPomo(db, nova)
  }

  const total = duracaoSeg(fase, config)
  const restante = total > 0 ? Math.min(1, Math.max(0, restaSeg / total)) : 0

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-center">
      <div role="tablist" aria-label="Fase do Pomodoro" className="flex w-full justify-between gap-1">
        {FASES.map(({ id, rotulo }) => (
          <button
            key={id}
            role="tab"
            aria-selected={fase === id}
            disabled={rodando && fase !== id}
            onClick={() => irParaFase(id)}
            className={cn(
              'flex-1 border-b-2 border-transparent px-1 py-1 text-[0.62rem] font-bold tracking-wide uppercase text-muted-foreground transition-colors enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
              fase === id && 'border-primary text-primary',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="relative size-36">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" aria-hidden>
          <circle cx="80" cy="80" r={RAIO} fill="none" strokeWidth="9" className="stroke-border" />
          <circle
            cx="80"
            cy="80"
            r={RAIO}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={CIRCUNFERENCIA * (1 - restante)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl leading-none font-bold tabular-nums" role="timer" aria-live="off">
            {fmtMMSS(restaSeg)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{NOMES_FASE[fase]}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button className="min-w-24 rounded-full font-bold tracking-wider uppercase" onClick={() => void iniciarOuPausar()}>
          {rodando ? 'Pausar' : 'Iniciar'}
        </Button>
        {fase === 'foco' && (
          <Button variant="outline" className="rounded-full" onClick={encerrar} title="Encerrar o foco agora e somar o tempo estudado">
            Encerrar
          </Button>
        )}
        <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={reiniciar} title="Reiniciar" aria-label="Reiniciar">
          <RotateCcw className="size-4" />
        </Button>
      </div>

      {fase === 'foco' && alvo && (
        <button
          className="w-full cursor-pointer truncate rounded-lg bg-muted px-2 py-1 text-xs hover:bg-accent"
          title="Estudando isto. Clique para trocar o passo, o tipo ou o assunto."
          onClick={() => void escolherAlvo()}
        >
          📖 {alvo.rotulo}
        </button>
      )}

      <p className="m-0 text-xs text-muted-foreground">
        Focos concluídos nesta sessão: <b className="text-foreground">{focosConcluidos}</b>
      </p>

      <details className="w-full text-left">
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
