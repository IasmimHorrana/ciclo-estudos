import type { LinhaEdital } from '@/dominio/edital'

export type NivelPrioridade = 'alta' | 'media' | 'baixa'
export const COR_PRIORIDADE: Record<NivelPrioridade, string> = { alta: 'bg-erro', media: 'bg-aviso', baixa: 'bg-ok' }
export const NOME_PRIORIDADE: Record<NivelPrioridade, string> = { alta: 'alta', media: 'média', baixa: 'baixa' }

/** Faixa da prioridade em relação à maior da lista; `null` quando não se aplica (estudado ou sem dados). */
export function nivelPrioridade(l: LinhaEdital, maxPrioridade: number): NivelPrioridade | null {
  if (l.estudado || l.semDados) return null
  const pct = (l.prioridade / Math.max(1, maxPrioridade)) * 100
  return pct >= 66 ? 'alta' : pct >= 33 ? 'media' : 'baixa'
}
