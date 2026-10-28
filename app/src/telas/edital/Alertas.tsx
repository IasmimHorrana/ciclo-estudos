import { AlarmClock, ClipboardList, Flame, Hourglass, Plus, TrendingDown } from 'lucide-react'
import { abrirQuestoes } from '@/componentes/abrirQuestoes'
import { Button } from '@/componentes/ui/button'
import type { Alerta, MotivoAlerta } from '@/dominio/alertas'
import { cn } from '@/lib/utils'

const ICONE: Record<MotivoAlerta, { Icone: typeof Flame; cor: string }> = {
  revisao: { Icone: AlarmClock, cor: 'text-erro' },
  acerto: { Icone: TrendingDown, cor: 'text-erro' },
  urgente: { Icone: Flame, cor: 'text-aviso' },
  parado: { Icone: Hourglass, cor: 'text-muted-foreground' },
}

/** "Precisa de atenção": os assuntos que pedem reforço, com o motivo e atalhos. */
export function Alertas({ alertas, total, abrir, porNoCiclo }: {
  alertas: readonly Alerta[]
  total: number
  abrir: (assuntoId: string) => void
  /** Põe o assunto no próximo ciclo; `null` quando ele já está lá. */
  porNoCiclo: (assuntoId: string) => (() => void) | null
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.68rem] font-bold text-muted-foreground uppercase">Precisa de atenção</span>
        {total > alertas.length && <span className="text-xs text-muted-foreground">{alertas.length} de {total}</span>}
      </div>
      {alertas.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">Nada urgente: sem acerto baixo, revisão atrasada ou assunto prioritário parado.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {alertas.map((a) => {
            const { Icone, cor } = ICONE[a.motivo]
            const ciclo = porNoCiclo(a.assuntoId)
            return (
              <li key={a.assuntoId} className="rounded-lg border bg-background/60 px-2.5 py-2">
                <button className="flex w-full cursor-pointer items-start gap-2 text-left" onClick={() => abrir(a.assuntoId)} title="Abrir o assunto">
                  <Icone className={cn('mt-0.5 size-4 shrink-0', cor)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-semibold">{a.nome}</span>
                    <span className="block text-xs text-muted-foreground">{a.materia} · <span className={cor}>{a.texto}</span></span>
                  </span>
                </button>
                <span className="mt-1.5 flex gap-1.5 pl-6">
                  <Button size="sm" variant="outline" onClick={() => void abrirQuestoes({ materia: a.materia, assuntoId: a.assuntoId })}>
                    <ClipboardList className="size-3.5" /> Questões
                  </Button>
                  {ciclo && (
                    <Button size="sm" variant="outline" onClick={ciclo} title="Põe o assunto (e a matéria) no próximo ciclo">
                      <Plus className="size-3.5" /> Ciclo
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
