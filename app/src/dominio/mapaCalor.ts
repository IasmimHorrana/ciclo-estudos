// Calendário de calor dos flashcards (como o do Anki): um quadradinho por dia, mais escuro = mais cartões. Puro.

import type { DataISO } from '@/dominio/datas'

const DIA_MS = 86_400_000

/** `numeroDoDia` (dias desde 1970 no fuso local) → "AAAA-MM-DD". */
export const isoDoNumero = (dia: number): DataISO => new Date(dia * DIA_MS).toISOString().slice(0, 10)

/** Dia da semana de um número de dia: 0 = segunda … 6 = domingo. */
const idxSemana = (dia: number): number => (new Date(dia * DIA_MS).getUTCDay() + 6) % 7

export interface CelulaCalor {
  dia: number
  data: DataISO
  cartoes: number
  /** 0 = sem estudo; 1 a 4 = do mais claro ao mais escuro. */
  nivel: 0 | 1 | 2 | 3 | 4
  futuro: boolean
}

export interface MapaCalor {
  /** Colunas = semanas (segunda a domingo); posições antes do início ou depois de hoje vêm como `null`. */
  semanas: (CelulaCalor | null)[][]
  /** Mês (0–11) que começa em cada coluna, ou null; para os rótulos de cima. */
  meses: (number | null)[]
  mediaPorDiaEstudado: number
  /** Dias com estudo ÷ dias do período, de 0 a 100. */
  pctDiasEstudados: number
  maiorSequencia: number
  sequenciaAtual: number
}

function nivelDe(n: number, max: number): CelulaCalor['nivel'] {
  if (n <= 0) return 0
  const r = n / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}

/**
 * `porDia`: cartões estudados em cada número de dia. A grade mostra sempre os últimos `janela` dias;
 * as estatísticas contam do primeiro dia com estudo (limitado à janela) até hoje.
 */
export function mapaDeCalor(porDia: ReadonlyMap<number, number>, hoje: number, janela = 365): MapaCalor {
  const inicio = hoje - janela + 1
  const primeiro = Math.max(Math.min(...porDia.keys(), hoje), inicio)
  const max = Math.max(1, ...[...porDia].filter(([d]) => d >= inicio && d <= hoje).map(([, n]) => n))

  // a grade começa na segunda da semana do primeiro dia
  const ini = inicio - idxSemana(inicio)
  const fim = hoje + (6 - idxSemana(hoje))
  const semanas: (CelulaCalor | null)[][] = []
  const meses: (number | null)[] = []
  let mesAnterior = -1
  for (let s = ini; s <= fim; s += 7) {
    const col: (CelulaCalor | null)[] = []
    for (let i = 0; i < 7; i++) {
      const dia = s + i
      if (dia < inicio) {
        col.push(null)
        continue
      }
      const cartoes = dia <= hoje ? (porDia.get(dia) ?? 0) : 0
      col.push({ dia, data: isoDoNumero(dia), cartoes, nivel: nivelDe(cartoes, max), futuro: dia > hoje })
    }
    const primeiraReal = col.find((c) => c)
    const mes = primeiraReal ? Number(primeiraReal.data.slice(5, 7)) - 1 : -1
    meses.push(mes !== mesAnterior && mes >= 0 ? mes : null)
    if (mes >= 0) mesAnterior = mes
    semanas.push(col)
  }

  let estudados = 0
  let total = 0
  let soma = 0
  let maior = 0
  let corrente = 0
  for (let d = primeiro; d <= hoje; d++) {
    total++
    const n = porDia.get(d) ?? 0
    if (n > 0) {
      estudados++
      soma += n
      corrente++
      maior = Math.max(maior, corrente)
    } else corrente = 0
  }
  // hoje ainda sem estudo não quebra a sequência: o dia não acabou
  let atual = 0
  for (let d = (porDia.get(hoje) ?? 0) > 0 ? hoje : hoje - 1; d >= primeiro && (porDia.get(d) ?? 0) > 0; d--) atual++

  return {
    semanas,
    meses,
    mediaPorDiaEstudado: estudados ? soma / estudados : 0,
    pctDiasEstudados: total ? Math.round((estudados / total) * 100) : 0,
    maiorSequencia: maior,
    sequenciaAtual: atual,
  }
}
