import type { Coluna } from '@/dominio/desempenho'

export interface ParteColorida {
  v: number
  cor: string
  t: string
}
export interface ColunaColorida {
  label: string
  partes: ParteColorida[]
}

/** Converte as colunas calculadas pelo domínio em colunas com cor. */
export function colorir(cols: Coluna[], corDaMateria: (m: string) => string, corTipo: Record<'acerto' | 'erro', string>): ColunaColorida[] {
  return cols.map((c) => ({
    label: c.label,
    partes: c.partes.map((p) => ({ v: p.v, t: p.t, cor: p.materia ? corDaMateria(p.materia) : corTipo[p.tipo ?? 'acerto'] })),
  }))
}
