import { Check, X } from 'lucide-react'
import { caixa, tituloCaixa } from '@/componentes/visual'
import type { Ciclo } from '@/dados/ciclo'
import { useConstancia } from '@/dados/useConstancia'
import { fmtData } from '@/dominio/datas'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

/** Faixa dos últimos 28 dias: cor da paleta = estudou, vermelho = faltou num dia de estudo, cinza = folga. */
export function Constancia({ s, diasDeEstudo, hojeISO }: { s: SemanaAtual | null; diasDeEstudo: boolean[]; hojeISO: string }) {
  const { celulas, sequencia } = useConstancia(s, diasDeEstudo, hojeISO)
  return (
    <section className={cn(caixa, 'py-3')}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className={tituloCaixa}>
          Constância nos estudos <span className="text-xs font-normal text-muted-foreground">últimos 28 dias</span>
        </h2>
        <p className="m-0 text-[0.8rem] text-muted-foreground">
          {sequencia > 0 ? (
            <>Você está há <b className="text-primary">{sequencia} {sequencia === 1 ? 'dia' : 'dias'}</b> sem falhar</>
          ) : (
            'Estude hoje para começar uma sequência.'
          )}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-1 max-[700px]:grid-cols-[repeat(14,minmax(0,1fr))]">
        {celulas.map((c) => (
          <span
            key={c.data}
            title={`${fmtData(c.data)} · ${c.estado === 'feito' ? 'estudou' : c.estado === 'falhou' ? 'não estudou' : c.estado === 'folga' ? 'folga' : 'hoje'}`}
            className={cn(
              'flex h-6 items-center justify-center rounded-md',
              c.estado === 'feito' && 'bg-primary text-primary-foreground',
              c.estado === 'falhou' && 'bg-erro-bg text-erro',
              c.estado === 'folga' && 'bg-muted',
              c.estado === 'hoje' && 'bg-muted outline-2 outline-offset-1 outline-primary',
              c.data === hojeISO && c.estado === 'feito' && 'outline-2 outline-offset-1 outline-primary',
            )}
          >
            {c.estado === 'feito' && <Check className="size-3" strokeWidth={3} />}
            {c.estado === 'falhou' && <X className="size-3" strokeWidth={3} />}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-primary" /> estudou</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-erro-bg" /> faltou num dia de estudo</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-muted" /> folga</span>
      </div>
    </section>
  )
}
