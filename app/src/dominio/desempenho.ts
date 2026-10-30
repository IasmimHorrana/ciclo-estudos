// Cálculos da aba Desempenho: níveis por assunto, horas e questões por período. Tudo puro.

import { addDias, type DataISO } from '@/dominio/datas'
import { round2, soma, todasMaterias } from '@/dominio/ciclo'

/** Abaixo disso o nível fica "Poucos dados". */
export const MIN_QUESTOES = 5

export type Nivel = 'na' | 'fraco' | 'medio' | 'bom' | 'dom'
export const NOMES_NIVEL: Record<Nivel, string> = { na: 'Poucos dados', fraco: 'Fraco', medio: 'Médio', bom: 'Bom', dom: 'Dominado' }

export type Periodo = 'hoje' | '7' | '30' | 'tudo'

export interface Questoes {
  id: string
  data: DataISO
  materia: string
  assuntoId: string | null
  feitas: number
  acertos: number
}
export interface Sessao {
  id: string
  data: DataISO
  materia: string
  assuntoId: string | null
  minutos: number
  tipo: string
}
export interface AssuntoDe {
  id: string
  materia: string
  nome: string
}

/** Onde cada nível começa, em % de acertos: abaixo de `fraco` é Fraco, abaixo de `medio` Médio, abaixo de `bom` Bom, e daí para cima Dominado. */
export interface Faixas {
  fraco: number
  medio: number
  bom: number
}
export const FAIXAS_PADRAO: Faixas = { fraco: 60, medio: 75, bom: 90 }

/** Nível pelo % de acertos (padrão: abaixo de 60 Fraco, até 74 Médio, até 89 Bom, 90 ou mais Dominado). */
export function nivelDe(feitas: number, acertos: number, faixas: Faixas = FAIXAS_PADRAO): Nivel {
  if (feitas < MIN_QUESTOES) return 'na'
  const p = (acertos / feitas) * 100
  return p < faixas.fraco ? 'fraco' : p < faixas.medio ? 'medio' : p < faixas.bom ? 'bom' : 'dom'
}

/** Problema nas faixas (números de 1 a 100, cada um maior que o anterior), ou `null` se estão boas. */
export function validarFaixas(f: Faixas): string | null {
  const v = [f.fraco, f.medio, f.bom]
  if (v.some((n) => !Number.isFinite(n) || n < 1 || n > 100)) return 'Use números de 1 a 100.'
  if (!(f.fraco < f.medio && f.medio < f.bom)) return 'Cada faixa precisa começar acima da anterior (Fraco < Médio < Bom).'
  return null
}

export const pctDe = (acertos: number, feitas: number) => (feitas ? Math.round((acertos / feitas) * 100) : 0)
/** Horas exatas das sessões, sem arredondar (as do cronômetro livre têm segundos). */
export const horasDe = (ss: Sessao[]) => soma(ss, (x) => x.minutos) / 60

/** Primeiro dia do período (inclusive). */
export const inicioDoPeriodo = (p: Periodo, hojeISO: DataISO): DataISO =>
  p === 'hoje' ? hojeISO : p === '7' ? addDias(hojeISO, -6) : p === '30' ? addDias(hojeISO, -29) : '0000-00-00'

export interface LinhaAssunto {
  /** `null` = "(sem assunto)" */
  id: string | null
  nome: string
  feitas: number
  acertos: number
  horas: number
  nivel: Nivel
}
export interface BlocoMateria {
  materia: string
  feitas: number
  acertos: number
  horas: number
  nivel: Nivel
  assuntos: LinhaAssunto[]
  temAssuntos: boolean
}
export interface Coluna {
  label: string
  partes: { v: number; materia?: string; tipo?: 'acerto' | 'erro'; t: string }[]
}

export interface EntradaDesempenho {
  questoes: Questoes[]
  sessoes: Sessao[]
  assuntos: AssuntoDe[]
  /** Matérias do passo da semana em andamento (também aparecem na lista). */
  materiasDaSemana: string[]
  config: { custom: string[]; ocultas: string[] }
  periodo: Periodo
  hojeISO: DataISO
  /** Limites dos níveis (padrão `FAIXAS_PADRAO`). */
  faixas?: Faixas
}

/** Tudo que a visão "Estudo" mostra, calculado para o período escolhido. */
export function calcularDesempenho(e: EntradaDesempenho) {
  const ini = inicioDoPeriodo(e.periodo, e.hojeISO)
  const qs = e.questoes.filter((q) => q.data >= ini)
  const ss = e.sessoes.filter((x) => x.data >= ini)
  const feitas = soma(qs, (q) => q.feitas)
  const acertos = soma(qs, (q) => q.acertos)
  const dias = new Set([...qs.map((q) => q.data), ...ss.map((x) => x.data)]).size

  // matérias: as da lista de escolha primeiro, na ordem dela; depois as outras que aparecem nos dados
  const ordem = todasMaterias(e.config)
  const mats: string[] = []
  const add = (m: string) => {
    if (m && !mats.includes(m)) mats.push(m)
  }
  e.assuntos.forEach((a) => add(a.materia))
  e.questoes.forEach((q) => add(q.materia))
  e.sessoes.forEach((x) => add(x.materia))
  e.materiasDaSemana.forEach(add)
  const pos = (m: string) => (ordem.indexOf(m) < 0 ? 999 : ordem.indexOf(m))
  mats.sort((a, b) => pos(a) - pos(b))

  const linha = (qm: Questoes[], sm: Sessao[], id: string | null, nome: string): LinhaAssunto | null => {
    const q = qm.filter((x) => (x.assuntoId ?? null) === id)
    const f = soma(q, (x) => x.feitas)
    const a = soma(q, (x) => x.acertos)
    const h = horasDe(sm.filter((x) => (x.assuntoId ?? null) === id))
    if (!id && !f && !h) return null
    return { id, nome, feitas: f, acertos: a, horas: h, nivel: nivelDe(f, a, e.faixas) }
  }
  const blocos: BlocoMateria[] = mats.map((m) => {
    const qm = qs.filter((q) => q.materia === m)
    const sm = ss.filter((x) => x.materia === m)
    const f = soma(qm, (q) => q.feitas)
    const a = soma(qm, (q) => q.acertos)
    const as = e.assuntos.filter((x) => x.materia === m)
    const linhas = [...as.map((x) => linha(qm, sm, x.id, x.nome)), linha(qm, sm, null, '(sem assunto)')].filter((l): l is LinhaAssunto => l !== null)
    return { materia: m, feitas: f, acertos: a, horas: horasDe(sm), nivel: nivelDe(f, a, e.faixas), assuntos: linhas, temAssuntos: as.length > 0 }
  })

  const horasPorMateria = mats
    .map((m) => ({ nome: m, valor: horasDe(ss.filter((x) => x.materia === m)) }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  const horas = horasDe(ss)
  const tipos = (['Teoria', 'Questões', 'Revisão'] as const).map((t) => ({ tipo: t, horas: horasDe(ss.filter((x) => (x.tipo || 'Teoria') === t)) }))

  // os gráficos por dia mostram 7 dias em "Hoje" e em "7 dias" (uma barra só seria pouco), e 30 nos outros
  const N = e.periodo === 'hoje' || e.periodo === '7' ? 7 : 30
  const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const colsHoras: Coluna[] = Array.from({ length: N }, (_, i) => {
    const iso = addDias(e.hojeISO, -(N - 1 - i))
    return { label: fmtDia(iso), partes: mats.map((m) => ({ v: horasDe(ss.filter((x) => x.data === iso && x.materia === m)), materia: m, t: `${fmtDia(iso)} · ${m}` })) }
  })
  const colsQuestoes: Coluna[] = Array.from({ length: N }, (_, i) => {
    const iso = addDias(e.hojeISO, -(N - 1 - i))
    const q = e.questoes.filter((x) => x.data === iso)
    const f = soma(q, (x) => x.feitas)
    const a = soma(q, (x) => x.acertos)
    return { label: fmtDia(iso), partes: [{ v: a, tipo: 'acerto', t: `${fmtDia(iso)}: ${a} acertos` }, { v: f - a, tipo: 'erro', t: `${fmtDia(iso)}: ${f - a} erros` }] }
  })

  const acertoPorMateria = mats
    .map((m) => {
      const qm = qs.filter((q) => q.materia === m)
      return { materia: m, feitas: soma(qm, (q) => q.feitas), acertos: soma(qm, (q) => q.acertos) }
    })
    .filter((x) => x.feitas > 0)
    .sort((a, b) => pctDe(b.acertos, b.feitas) - pctDe(a.acertos, a.feitas))

  const recentes = <T extends { data: DataISO; id: string }>(l: T[]) => [...l].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)).slice(0, 8)
  const ultimos = recentes(e.questoes)
  const ultimasSessoes = recentes(e.sessoes)
  return { feitas, acertos, dias, horas, tipos, mats, blocos, horasPorMateria, colsHoras, colsQuestoes, acertoPorMateria, ultimos, ultimasSessoes }
}

/** Indicadores da visão "Semanas" (histórico de semanas fechadas). */
export function resumoDasSemanas(f: { cicloFechado: boolean; horasEstudadas: number; pctConcluido: number }[]) {
  return {
    total: f.length,
    fechadas: f.filter((r) => r.cicloFechado).length,
    horas: round2(soma(f, (r) => r.horasEstudadas)),
    media: f.length ? Math.round(soma(f, (r) => r.pctConcluido) / f.length) : 0,
  }
}

export interface DadosQuestoes {
  data: string
  materia: string
  assuntoId: string
  novo: string
  feitas: number
  acertos: number
}

/** Valida o formulário "Registrar questões". Devolve a mensagem de erro ou `null`. */
export function validarQuestoes(d: DadosQuestoes, hojeISO: DataISO): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return 'Informe a data.'
  if (d.data > hojeISO) return 'A data não pode ser no futuro.'
  if (!d.materia) return 'Escolha a matéria.'
  if (!(d.feitas >= 1)) return 'Informe quantas questões você fez (mínimo 1).'
  if (!(d.acertos >= 0) || d.acertos > d.feitas) return 'Os acertos precisam estar entre 0 e o número de questões feitas.'
  return null
}

export const TIPOS_ESTUDO = ['Teoria', 'Revisão', 'Questões'] as const
export type TipoEstudo = (typeof TIPOS_ESTUDO)[number]

export interface EstudoManual {
  data: DataISO
  materia: string
  tipo: string
  /** Minutos estudados (0 se só quer registrar questões). */
  minutos: number
  /** Questões resolvidas (em qualquer tipo; no tipo Questões podem ser o único registro). */
  feitas: number
  acertos: number
}

/** Valida o registro manual de estudo (feito fora do app). Devolve a mensagem de erro ou `null`. */
export function validarEstudoManual(d: EstudoManual, hojeISO: DataISO): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return 'Informe a data.'
  if (d.data > hojeISO) return 'A data não pode ser no futuro.'
  if (!d.materia) return 'Escolha a matéria.'
  if (!(TIPOS_ESTUDO as readonly string[]).includes(d.tipo)) return 'Escolha o tipo de estudo.'
  if (!(d.minutos >= 0) || d.minutos > 24 * 60) return 'O tempo precisa estar entre 0 e 24 horas.'
  if (!(d.feitas >= 0) || !(d.acertos >= 0) || d.acertos > d.feitas) return 'Os acertos precisam estar entre 0 e o número de questões feitas.'
  if (d.tipo === 'Questões') return d.feitas < 1 && d.minutos < 1 ? 'Informe as questões feitas ou o tempo estudado.' : null
  if (d.minutos < 1) return 'Informe o tempo estudado (mínimo 1 minuto).'
  return null
}
