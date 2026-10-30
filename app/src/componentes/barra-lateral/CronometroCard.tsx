import { RotateCcw } from 'lucide-react'
import { encerrarLivre, escolherAlvoLivre, iniciarOuPausarLivre } from '@/componentes/cronometro-api'
import { confirmar } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { fmtHHMMSS } from '@/dominio/cronometro'
import { useCronometro } from '@/estado/cronometro'

/** Cronômetro livre: conta para cima, sem fases. Ao encerrar, abre "Fechar sessão". */
export function CronometroCard() {
  const { seg, rodando, alvo, zerar } = useCronometro()

  async function zerarSemRegistrar() {
    if (seg < 60 || (await confirmar(`Zerar ${fmtHHMMSS(seg)} sem registrar?`, 'Zerar', true))) zerar()
  }

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-center">
      <div className="flex h-24 flex-col items-center justify-center">
        <span className="text-4xl leading-none font-bold tabular-nums" role="timer" aria-live="off">{fmtHHMMSS(seg)}</span>
        <span className="mt-1 text-xs text-muted-foreground">{rodando ? 'Estudando' : seg > 0 ? 'Pausado' : 'Tempo livre'}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button className="min-w-24 rounded-full font-bold tracking-wider uppercase" onClick={() => void iniciarOuPausarLivre()}>
          {rodando ? 'Pausar' : seg > 0 ? 'Retomar' : 'Iniciar'}
        </Button>
        {seg > 0 && (
          <Button variant="outline" className="rounded-full" onClick={() => void encerrarLivre()} title="Parar e registrar o tempo, o assunto e as questões">
            Encerrar
          </Button>
        )}
        {!rodando && seg > 0 && (
          <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => void zerarSemRegistrar()} title="Zerar sem registrar" aria-label="Zerar sem registrar">
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>
      {alvo && (
        <button
          className="w-full cursor-pointer truncate rounded-lg bg-muted px-2 py-1 text-xs hover:bg-accent"
          title="Estudando isto. Clique para trocar a matéria, o tipo ou o assunto."
          onClick={() => void escolherAlvoLivre()}
        >
          📖 {alvo.materia} · {alvo.tipo}
        </button>
      )}
      <p className="m-0 text-xs text-muted-foreground">Sem blocos fixos: pause quando precisar e encerre ao terminar.</p>
    </div>
  )
}
