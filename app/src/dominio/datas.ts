// Datas sempre no fuso LOCAL do aparelho, em texto ISO "AAAA-MM-DD".
// (O app antigo chegou a usar UTC e, à noite no Brasil, marcava o dia seguinte: por isso os testes.)

export type DataISO = string

export const NOMES_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
export const NOMES_DIA_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const

const dois = (n: number) => String(n).padStart(2, '0')

export function parseISO(iso: DataISO): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function toISO(dt: Date): DataISO {
  return `${dt.getFullYear()}-${dois(dt.getMonth() + 1)}-${dois(dt.getDate())}`
}

/** O dia de hoje (ou de `agora`, para testes) no fuso local. */
export const hoje = (agora: Date = new Date()): DataISO => toISO(agora)

export function addDias(iso: DataISO, n: number): DataISO {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 0 = segunda … 6 = domingo */
export const idxDia = (iso: DataISO): number => (parseISO(iso).getDay() + 6) % 7

export const segundaDe = (iso: DataISO): DataISO => addDias(iso, -idxDia(iso))

/** "09/10" */
export function fmtData(iso: DataISO): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export interface CelulaCalendario {
  iso: DataISO
  doMes: boolean
}

/** Grade do mês começando na segunda: 4, 5 ou 6 linhas conforme o mês precisa. `mes` é 0–11. */
export function mesGrade(ano: number, mes: number): CelulaCalendario[] {
  const primeiro = toISO(new Date(ano, mes, 1))
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const linhas = Math.ceil((idxDia(primeiro) + diasNoMes) / 7)
  const inicio = segundaDe(primeiro)
  return Array.from({ length: linhas * 7 }, (_, i) => {
    const iso = addDias(inicio, i)
    return { iso, doMes: parseISO(iso).getMonth() === mes }
  })
}

/** "Outubro de 2026" */
export function tituloMes(ano: number, mes: number): string {
  const t = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
