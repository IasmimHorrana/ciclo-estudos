import { useLiveQuery } from 'dexie-react-hooks'
import { Check, PencilLine, X } from 'lucide-react'
import { carregarEstudo } from '@/dados/desempenho'
import { db } from '@/dados/db'
import type { Ciclo } from '@/dados/ciclo'
import { corDe, fmtH, soma } from '@/dominio/ciclo'
import { constancia } from '@/dominio/constancia'
import { pctDe } from '@/dominio/desempenho'
import { fmtData } from '@/dominio/datas'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'

/** Tabela por disciplina: tempo da semana e questões feitas na semana (acertos, erros, total e %). */
export function PainelDisciplinas({ s, cores }: { s: SemanaAtual; cores: Record<string, number> }) {
  const estudo = useLiveQuery(() => carregarEstudo(db), [])
  const materias = [...new Set(s.passos.map((p) => p.materia))]
  const naSemana = (data: string) => data >= s.seg && data <= s.dom
  const cab = 'px-1 py-1 text-center text-[0.65rem] font-semibold text-muted-foreground'
  return (
    <section className={card}>
      <h2 className="m-0 mb-2 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">Painel da semana</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={cn(cab, 'text-left')}>Disciplina</th>
            <th className={cab} title="Acertos"><Check className="mx-auto size-3.5 text-ok" /></th>
            <th className={cab} title="Erros"><X className="mx-auto size-3.5 text-erro" /></th>
            <th className={cab} title="Questões feitas"><PencilLine className="mx-auto size-3.5" /></th>
            <th className={cab} title="% de acertos">%</th>
          </tr>
        </thead>
        <tbody>
          {materias.map((m, i) => {
            const itens = s.passos.filter((p) => p.materia === m)
            const feito = soma(itens, (p) => p.horasFeitas)
            const plan = soma(itens, (p) => p.horasPlanejadas)
            const qs = (estudo?.questoes ?? []).filter((q) => q.excluidoEm === null && q.materia === m && naSemana(q.data))
            const feitas = soma(qs, (q) => q.feitas)
            const acertos = soma(qs, (q) => q.acertos)
            const num = 'px-1 py-1.5 text-center tabular-nums'
            return (
              <tr key={m} className={i % 2 === 0 ? 'bg-muted/50' : ''}>
                <td className="max-w-0 px-1.5 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <i className="size-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, m) }} />
                    <span className="truncate font-medium" title={m}>{m}</span>
                  </span>
                  <span className="block pl-4 text-[0.68rem] text-muted-foreground">{fmtH(feito)} de {fmtH(plan)}</span>
                </td>
                <td className={cn(num, feitas ? 'font-semibold text-ok' : 'text-muted-foreground')}>{acertos}</td>
                <td className={cn(num, feitas ? 'font-semibold text-erro' : 'text-muted-foreground')}>{feitas - acertos}</td>
                <td className={num}>{feitas}</td>
                <td className={cn(num, 'text-xs')}>{feitas ? `${pctDe(acertos, feitas)}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

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
      <h2 className="m-0 mb-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">Constância nos estudos</h2>
      <p className="m-0 mb-2 text-sm">
        {sequencia > 0 ? (
          <>Você está há <b>{sequencia}</b> {sequencia === 1 ? 'dia' : 'dias'} sem falhar!</>
        ) : (
          <span className="text-muted-foreground">Estude hoje para começar uma sequência.</span>
        )}
      </p>
      <div className="grid grid-cols-14 gap-0.5">
        {celulas.map((c) => (
          <span
            key={c.data}
            title={`${fmtData(c.data)} · ${c.estado === 'feito' ? 'estudou' : c.estado === 'falhou' ? 'não estudou' : c.estado === 'folga' ? 'folga' : 'hoje'}`}
            className={cn(
              'flex aspect-square items-center justify-center rounded-sm',
              c.estado === 'feito' && 'bg-ok text-white',
              c.estado === 'falhou' && 'bg-erro-bg text-erro',
              c.estado === 'folga' && 'bg-muted',
              c.estado === 'hoje' && 'border-2 border-primary',
            )}
          >
            {c.estado === 'feito' && <Check className="size-2.5" strokeWidth={3} />}
            {c.estado === 'falhou' && <X className="size-2.5" strokeWidth={3} />}
          </span>
        ))}
      </div>
    </section>
  )
}
