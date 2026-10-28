// Revisão espaçada dos assuntos do edital (não dos cartões): ao marcar um assunto como estudado, o app agenda revisões
// (padrão: 1, 7 e 30 dias depois). Nada se conclui sozinho: cada revisão espera "Entendi" ou "Preciso rever". Puro.

import { addDias, type DataISO } from '@/dominio/datas'

export interface Revisao {
  /** Dia em que a revisão vence. */
  dia: DataISO
  /** Dia em que foi feita, ou `null` se ainda falta. */
  feitaEm: DataISO | null
  resultado: 'ok' | 'rever' | null
}

export type EstadoRevisao = 'nenhuma' | 'futura' | 'hoje' | 'atrasada' | 'concluida'

export const INTERVALOS_PADRAO: readonly number[] = [1, 7, 30]

/** Gravidade, para juntar vários assuntos num tópico (o pior manda). */
const PESO: Record<EstadoRevisao, number> = { nenhuma: 0, concluida: 1, futura: 2, hoje: 3, atrasada: 4 }
export const piorEstado = (estados: readonly EstadoRevisao[]): EstadoRevisao =>
  estados.reduce<EstadoRevisao>((p, e) => (PESO[e] > PESO[p] ? e : p), 'nenhuma')

/** Revisões a partir de `base`, uma para cada intervalo (em dias). */
export const agendarRevisoes = (base: DataISO, intervalos: readonly number[] = INTERVALOS_PADRAO): Revisao[] =>
  intervalos.map((n) => ({ dia: addDias(base, n), feitaEm: null, resultado: null }))

/** A próxima revisão que falta (a de dia mais cedo), ou `null`. */
export function proximaRevisao(revisoes: readonly Revisao[]): Revisao | null {
  return [...revisoes].filter((r) => r.feitaEm === null).sort((a, b) => a.dia.localeCompare(b.dia))[0] ?? null
}

export function estadoRevisoes(revisoes: readonly Revisao[], hoje: DataISO): EstadoRevisao {
  if (!revisoes.length) return 'nenhuma'
  const prox = proximaRevisao(revisoes)
  if (!prox) return 'concluida'
  return prox.dia < hoje ? 'atrasada' : prox.dia === hoje ? 'hoje' : 'futura'
}

/** Dias de atraso da próxima revisão (0 se vence hoje, no futuro ou não há). */
export function diasDeAtraso(revisoes: readonly Revisao[], hoje: DataISO): number {
  const prox = proximaRevisao(revisoes)
  if (!prox || prox.dia >= hoje) return 0
  return Math.round((Date.parse(`${hoje}T12:00:00`) - Date.parse(`${prox.dia}T12:00:00`)) / 86_400_000)
}

/**
 * Registra a resposta da próxima revisão que falta. "Entendi" (`ok`) só a conclui; "Preciso rever" a conclui e
 * recomeça a sequência a partir de hoje (as que faltavam são trocadas por novas). Sem revisão pendente, não muda nada.
 */
export function responderRevisao(revisoes: readonly Revisao[], hoje: DataISO, resultado: 'ok' | 'rever', intervalos: readonly number[] = INTERVALOS_PADRAO): Revisao[] {
  const prox = proximaRevisao(revisoes)
  if (!prox) return [...revisoes]
  const feita: Revisao = { ...prox, feitaEm: hoje, resultado }
  if (resultado === 'ok') return revisoes.map((r) => (r === prox ? feita : r))
  return [...revisoes.filter((r) => r.feitaEm !== null), feita, ...agendarRevisoes(hoje, intervalos)]
}

/**
 * O que muda num assunto ao marcar/desmarcar "estudado". Marcar agenda as revisões a partir de hoje (as já feitas
 * ficam como histórico); desmarcar tira as que faltavam. Se o estado não mudou, devolve `null` (nada a gravar).
 */
export function aoMudarEstudado(
  a: { estudado: boolean; revisoes?: readonly Revisao[] | undefined },
  estudado: boolean,
  hoje: DataISO,
  intervalos: readonly number[] = INTERVALOS_PADRAO,
): { estudadoEm: DataISO | null; revisoes: Revisao[] } | null {
  if (a.estudado === estudado) return null
  const feitas = (a.revisoes ?? []).filter((r) => r.feitaEm !== null)
  return estudado ? { estudadoEm: hoje, revisoes: [...feitas, ...agendarRevisoes(hoje, intervalos)] } : { estudadoEm: null, revisoes: feitas }
}

/** Lê "1, 7, 30" (ou "1 7 30"): de 1 a 6 números inteiros de 1 a 365, crescentes. Devolve `null` se não der. */
export function lerIntervalos(texto: string): number[] | null {
  const partes = texto.split(/[\s,;]+/).filter(Boolean)
  const n = partes.map(Number)
  if (!n.length || n.length > 6 || n.some((x) => !Number.isInteger(x) || x < 1 || x > 365)) return null
  return n.every((x, i) => i === 0 || x > (n[i - 1] as number)) ? n : null
}
