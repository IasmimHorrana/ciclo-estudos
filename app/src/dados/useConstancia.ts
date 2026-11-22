import { useLiveQuery } from 'dexie-react-hooks'
import type { Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { carregarEstudo } from '@/dados/desempenho'
import { constancia } from '@/dominio/constancia'

type SemanaAtual = NonNullable<Ciclo['semana']>

/** Dias com estudo (sessões, questões e passos feitos) nos últimos 28 dias e a sequência atual. */
export function useConstancia(s: SemanaAtual | null, diasDeEstudo: boolean[], hojeISO: string) {
  const estudo = useLiveQuery(() => carregarEstudo(db), [])
  const ativos = new Set<string>()
  for (const x of estudo?.sessoes ?? []) if (x.excluidoEm === null) ativos.add(x.data)
  for (const q of estudo?.questoes ?? []) if (q.excluidoEm === null && q.feitas > 0) ativos.add(q.data)
  for (const p of s?.passos ?? []) if (p.feito && p.dia) ativos.add(p.dia)
  return constancia(hojeISO, diasDeEstudo, ativos, 28)
}
