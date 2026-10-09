// Constância nos estudos: dia a dia, quem estudou, quem faltou e a sequência atual. Puro.

import { addDias, idxDia, type DataISO } from '@/dominio/datas'

export type EstadoDia = 'feito' | 'falhou' | 'folga' | 'hoje'

export interface DiaConstancia {
  data: DataISO
  estado: EstadoDia
}

/** Quantos dias para trás a sequência é contada. */
const LIMITE_SEQUENCIA = 120

/**
 * `ativos`: dias em que houve estudo (foco do Pomodoro, questões ou passo concluído).
 * `diasDeEstudo`: segunda a domingo; dia sem estudo num dia de folga não conta como falha.
 * Hoje ainda sem estudo não quebra a sequência (o dia não acabou).
 */
export function constancia(hojeISO: DataISO, diasDeEstudo: boolean[], ativos: ReadonlySet<DataISO>, janela = 28) {
  const estadoDe = (d: DataISO): EstadoDia => {
    if (ativos.has(d)) return 'feito'
    if (d === hojeISO) return 'hoje'
    return diasDeEstudo[idxDia(d)] ? 'falhou' : 'folga'
  }
  const celulas: DiaConstancia[] = Array.from({ length: janela }, (_, i) => {
    const data = addDias(hojeISO, -(janela - 1 - i))
    return { data, estado: estadoDe(data) }
  })
  let sequencia = 0
  for (let i = 0; i < LIMITE_SEQUENCIA; i++) {
    const e = estadoDe(addDias(hojeISO, -i))
    if (e === 'feito') sequencia++
    else if (e === 'falhou') break
  }
  return { celulas, sequencia }
}
