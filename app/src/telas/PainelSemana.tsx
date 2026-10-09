import { useLiveQuery } from 'dexie-react-hooks'
import { Check, X } from 'lucide-react'
import { carregarEstudo } from '@/dados/desempenho'
import { db } from '@/dados/db'
import type { Ciclo } from '@/dados/ciclo'
import { constancia } from '@/dominio/constancia'
import { fmtData } from '@/dominio/datas'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

const card = 'rounded-xl border bg-card px-3.5 py-2.5 shadow-sm'

/** Faixa dos últimos 28 dias: verde = estudou, vermelho = faltou num dia de estudo, cinza = folga. */
export function Constancia({ s, diasDeEstudo, hojeISO }: { s: SemanaAtual; diasDeEstudo: boolean[]; hojeISO: string }) {
  const estudo = useLiveQuery(() => carregarEstudo(db), [])
  const ativos = new Set<string>()
  for (const x of estudo?.sessoes ?? []) if (x.excluidoEm === null) ativos.add(x.data)
  for (const q of estudo?.questoes ?? []) if (q.excluidoEm === null && q.feitas > 0) ativos.add(q.data)
  for (const p of s.passos) if (p.feito && p.dia) ativos.add(p.dia)
  const { celulas, sequencia } = constancia(hojeISO, diasDeEstudo, ativos, 28)
  return (
    <section className={card}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="m-0 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">Constância nos estudos</h2>
        <p className="m-0 text-sm">
          {sequencia > 0 ? (
            <>Você está há <b>{sequencia}</b> {sequencia === 1 ? 'dia' : 'dias'} sem falhar!</>
          ) : (
            <span className="text-muted-foreground">Estude hoje para começar uma sequência.</span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-0.5">
        {celulas.map((c) => (
          <span
            key={c.data}
            title={`${fmtData(c.data)} · ${c.estado === 'feito' ? 'estudou' : c.estado === 'falhou' ? 'não estudou' : c.estado === 'folga' ? 'folga' : 'hoje'}`}
            className={cn(
              'flex h-6 items-center justify-center rounded-sm',
              c.estado === 'feito' && 'bg-ok text-background',
              c.estado === 'falhou' && 'bg-erro-bg text-erro',
              c.estado === 'folga' && 'bg-muted',
              c.estado === 'hoje' && 'border-2 border-primary',
            )}
          >
            {c.estado === 'feito' && <Check className="size-3" strokeWidth={3} />}
            {c.estado === 'falhou' && <X className="size-3" strokeWidth={3} />}
          </span>
        ))}
      </div>
    </section>
  )
}
