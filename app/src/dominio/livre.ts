// Modo Livre: até duas matérias por dia, tempo livre e meta semanal sem dívida. Tudo puro.
// As horas saem das sessões (não dos passos do ciclo), então o Pomodoro, o cronômetro livre e o registro manual contam igual.

import { addDias, idxDia, segundaDe, type DataISO } from '@/dominio/datas'
import { soma } from '@/dominio/ciclo'
import { pctDe, type Questoes, type Sessao } from '@/dominio/desempenho'

export type ModoEstudo = 'ciclo' | 'livre'

/** Horas exatas das sessões, sem arredondar (as do cronômetro livre têm segundos). */
const horasExatas = (ss: Sessao[]) => soma(ss, (x) => x.minutos) / 60

/** Horas com os segundos, no estilo do app: "2min 20s", "45min", "1h05 20s", "28h00". */
export function fmtHs(h: number): string {
  const s = Math.max(0, Math.round((h || 0) * 3600))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const base = hh ? `${hh}h${String(mm).padStart(2, '0')}` : `${mm}min`
  return ss ? `${base} ${String(ss).padStart(2, '0')}s` : base
}

/** Meta em horas por semana: a base é o compromisso; a estendida, o bônus de uma semana boa. */
export interface MetaLivre {
  base: number
  estendida: number
  /** Meta de semanas específicas (chave = segunda-feira), para uma semana apertada. Não passa para a seguinte. */
  ajustes: Record<DataISO, number>
}

export const META_LIVRE_PADRAO: MetaLivre = { base: 28, estendida: 32, ajustes: {} }

/** As matérias escolhidas para um dia: a principal e, se der, a secundária (e, num dia bom, uma extra, como Redação). */
export interface DiaLivre {
  data: DataISO
  principal: string | null
  secundaria: string | null
  extra: string | null
}

/** Meta da semana que começa em `segunda` (o ajuste daquela semana, senão a base). */
export const metaDaSemana = (m: MetaLivre, segunda: DataISO): number => m.ajustes[segunda] ?? m.base

/** Problema na meta, ou `null` se está boa. */
export function validarMeta(base: number, estendida: number): string | null {
  if (!Number.isFinite(base) || base <= 0 || base > 168) return 'A meta-base precisa estar entre 1 e 168 horas.'
  if (!Number.isFinite(estendida) || estendida < base || estendida > 168) return 'A meta estendida precisa ser maior ou igual à base (até 168 horas).'
  return null
}

/** Guarda (ou tira, com `null`) a meta de uma semana. Ajustes com mais de 26 semanas são descartados para não crescer sem fim. */
export function ajustarSemana(m: MetaLivre, segunda: DataISO, horas: number | null): MetaLivre {
  const limite = addDias(segunda, -26 * 7)
  const ajustes: Record<DataISO, number> = {}
  for (const [k, v] of Object.entries(m.ajustes)) if (k >= limite && k !== segunda) ajustes[k] = v
  if (horas != null) ajustes[segunda] = horas
  return { ...m, ajustes }
}

export type SituacaoMeta = 'abaixo' | 'base' | 'estendida'

export interface ProgressoMeta {
  horas: number
  /** Meta desta semana (a base ou o ajuste). */
  meta: number
  /** A estendida nunca fica abaixo da meta desta semana. */
  estendida: number
  pctMeta: number
  pctEstendida: number
  faltaMeta: number
  faltaEstendida: number
  situacao: SituacaoMeta
}

/** Quanto da meta da semana já foi feito. O que faltar termina com a semana: não vira dívida. */
export function progressoMeta(horas: number, meta: number, estendidaCfg: number): ProgressoMeta {
  const estendida = Math.max(meta, estendidaCfg)
  const pct = (x: number) => (x > 0 ? Math.min(100, Math.round((horas / x) * 100)) : 100)
  return {
    horas,
    meta,
    estendida,
    pctMeta: pct(meta),
    pctEstendida: pct(estendida),
    faltaMeta: Math.max(0, meta - horas),
    faltaEstendida: Math.max(0, estendida - horas),
    situacao: horas >= estendida && estendida > meta ? 'estendida' : horas >= meta ? 'base' : 'abaixo',
  }
}

export interface DiaDaSemanaLivre {
  data: DataISO
  horas: number
  /** Horas por matéria, da que mais estudou para a que menos. */
  materias: { materia: string; horas: number }[]
}

const porMateria = (ss: Sessao[]) => {
  const m = new Map<string, number>()
  for (const s of ss) m.set(s.materia, (m.get(s.materia) ?? 0) + s.minutos)
  return [...m].map(([materia, min]) => ({ materia, horas: min / 60 })).sort((a, b) => b.horas - a.horas || a.materia.localeCompare(b.materia))
}

export interface ResumoLivre {
  segunda: DataISO
  domingo: DataISO
  dias: DiaDaSemanaLivre[]
  horasSemana: number
  hoje: {
    horas: number
    materias: { materia: string; horas: number }[]
    feitas: number
    acertos: number
    pct: number
  }
  progresso: ProgressoMeta
}

/** Tudo o que o painel do modo Livre mostra para a semana de `hojeISO`. */
export function resumoLivre(sessoes: Sessao[], questoes: Questoes[], meta: MetaLivre, hojeISO: DataISO): ResumoLivre {
  const segunda = segundaDe(hojeISO)
  const domingo = addDias(segunda, 6)
  const naSemana = sessoes.filter((s) => s.data >= segunda && s.data <= domingo)
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = addDias(segunda, i)
    const doDia = naSemana.filter((s) => s.data === data)
    return { data, horas: horasExatas(doDia), materias: porMateria(doDia) }
  })
  const horasSemana = horasExatas(naSemana)
  const qHoje = questoes.filter((q) => q.data === hojeISO)
  const feitas = soma(qHoje, (q) => q.feitas)
  const acertos = soma(qHoje, (q) => q.acertos)
  const hoje = dias[idxDia(hojeISO)] ?? { horas: 0, materias: [] }
  return {
    segunda, domingo, dias, horasSemana,
    hoje: { horas: hoje.horas, materias: hoje.materias, feitas, acertos, pct: pctDe(acertos, feitas) },
    progresso: progressoMeta(horasSemana, metaDaSemana(meta, segunda), meta.estendida),
  }
}

/** O dia escolhido vale só para a data em que foi escolhido; num dia novo, começa vazio. */
export const diaDe = (d: DiaLivre | null, hojeISO: DataISO): DiaLivre =>
  d && d.data === hojeISO ? d : { data: hojeISO, principal: null, secundaria: null, extra: null }

export type PapelNoDia = 'principal' | 'secundaria' | 'extra'

/**
 * Escolhe a principal, a secundária ou a extra. Escolher na outra posição a matéria que já está na principal ou na secundária
 * troca as duas de lugar. A extra nunca repete uma das duas (se repetir, não muda nada).
 */
export function escolherNoDia(d: DiaLivre, papel: PapelNoDia, materia: string | null): DiaLivre {
  if (papel === 'extra') return materia && (materia === d.principal || materia === d.secundaria) ? d : { ...d, extra: materia }
  const novo = { ...d, [papel]: materia }
  if (novo.principal && novo.principal === novo.secundaria) novo[papel === 'principal' ? 'secundaria' : 'principal'] = d[papel]
  if (!novo.principal && novo.secundaria) Object.assign(novo, { principal: novo.secundaria, secundaria: null })
  if (novo.extra && (novo.extra === novo.principal || novo.extra === novo.secundaria)) novo.extra = null
  return novo
}

/** Matérias do dia (principal, secundária e extra), sem repetir. */
export const materiasDoDia = (d: DiaLivre): string[] => [d.principal, d.secundaria, d.extra].filter((m): m is string => !!m)

/**
 * Ordem para sugerir a escolha do dia: primeiro as que nunca foram estudadas, depois as estudadas há mais tempo.
 * Só um palpite: quem escolhe é você.
 */
export function sugerirMaterias(sessoes: Sessao[], materias: string[]): string[] {
  const ultima = new Map<string, DataISO>()
  for (const s of sessoes) if ((ultima.get(s.materia) ?? '') < s.data) ultima.set(s.materia, s.data)
  return [...materias].sort((a, b) => (ultima.get(a) ?? '').localeCompare(ultima.get(b) ?? '') || materias.indexOf(a) - materias.indexOf(b))
}
